const express    = require("express");
const QRCode     = require("qrcode");
const PDFDocument = require("pdfkit");
const crypto     = require("crypto");
const bcrypt     = require("bcryptjs");
const pool       = require("../db/pool");
const { auth, asyncHandler } = require("../middleware");
const router     = express.Router();

const MIN_PASSWORD = 8;

const SCHOOL_NAME  = () => process.env.SCHOOL_NAME  || "Oduduwa University";
const SCHOOL_SHORT = () => process.env.SCHOOL_SHORT || "OU";

// ── HMAC token for the public PDF card URL ────────────────
// Full 32-hex (128-bit) token derived from a dedicated secret so the card
// link cannot be guessed or enumerated even if other secrets are known.
function cardToken(id) {
  return crypto.createHmac("sha256", process.env.CARD_TOKEN_SECRET)
    .update(String(id)).digest("hex").slice(0, 32);
}

// ── AES-256-GCM encryption for QR codes ──────────────────
// QR payload is ciphertext: normal phone cameras see gibberish.
// Only the admin scanner, which calls /verify, can make sense of it.
let _encKey = null;
function getEncKey() {
  if (!_encKey)
    _encKey = crypto.scryptSync(process.env.QR_ENC_KEY, "ou-qr-v1", 32);
  return _encKey;
}

function encryptPayload(data) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncKey(), iv);
  const enc    = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return "enc:" + Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decryptPayload(token) {
  if (!token?.startsWith("enc:")) throw new Error("not encrypted");
  const buf = Buffer.from(token.slice(4), "base64url");
  if (buf.length < 29) throw new Error("payload too short");
  const iv  = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const dec = crypto.createDecipheriv("aes-256-gcm", getEncKey(), iv);
  dec.setAuthTag(tag);
  return JSON.parse(Buffer.concat([dec.update(enc), dec.final()]).toString("utf8"));
}

// QR now holds an encrypted token — opaque to generic camera apps
function buildPayload(s) {
  return encryptPayload({ id: s.student_id, issued: new Date().toISOString().slice(0, 10) });
}

// Absolute base URL of this deployment, used to bake a scannable link into the
// QR. Derived from the incoming request (works on Render) unless overridden by
// the PUBLIC_BASE_URL env var.
function publicBase(req) {
  const env = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (env) return env;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  return `${proto}://${req.get("host")}`;
}
// The QR encodes this link; scanning it with any phone camera opens the public
// verification page, which decrypts the token and shows the student's status.
function verifyUrl(req, encToken) {
  return `${publicBase(req)}/verify?t=${encodeURIComponent(encToken)}`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ═══════════════════════════════════════════════════════
//  PUBLIC — Student ID card PDF (no auth, link-protected)
// ═══════════════════════════════════════════════════════

router.get("/:id/card", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id < 1) return res.status(400).send("Invalid id.");
    if (req.query.t !== cardToken(id)) return res.status(403).send("Invalid or expired link.");

    const { rows } = await pool.query(
      `SELECT student_id, matric_no, full_name, faculty, department, level,
              dob, sex, state_of_origin, phone, email, photo, qr_payload, status, created_at
       FROM students WHERE student_id=$1`, [id]
    );
    if (!rows.length || rows[0].status !== "active")
      return res.status(404).send("Student not found or account not active.");

    const s = rows[0];
    const token = buildPayload(s);
    const qrDataUrl = await QRCode.toDataURL(verifyUrl(req, token), { width: 160, margin: 1, color: { dark: "#1B2A4A" } });

    const doc = new PDFDocument({ size: "A5", margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition",
      `inline; filename="${s.matric_no.replace(/\//g, "-")}-id.pdf"`);
    doc.pipe(res);
    buildCardPDF(doc, s, qrDataUrl);
    doc.end();
  } catch (e) {
    console.error("Card generation error:", e);
    if (!res.headersSent) res.status(500).send("Could not generate card.");
  }
});

function buildCardPDF(doc, s, qrDataUrl) {
  const W = doc.page.width;
  const H = doc.page.height;
  const NAVY = "#1B2A4A", BLUE = "#2E5C9E", GOLD = "#E9A23B";
  const LIGHT = "#EAF0F7", LINE = "#DFE6EF", GREY = "#5C6B82";
  const TEAL = "#2A9D8F", WHITE = "#FFFFFF";

  // Header
  doc.rect(0, 0, W, 88).fill(NAVY);
  const lx = 52, ly = 44;
  doc.circle(lx, ly, 30).fill(BLUE);
  doc.circle(lx, ly, 30).lineWidth(2).strokeColor(GOLD).stroke();
  doc.circle(lx, ly, 22).lineWidth(0.5).strokeColor(GOLD).fillOpacity(0).stroke();
  doc.fillOpacity(1);
  doc.ellipse(lx, ly - 8, 6, 9).fill(GOLD);
  doc.ellipse(lx, ly - 10, 3.5, 5.5).fill(WHITE).fillOpacity(0.55);
  doc.fillOpacity(1).rect(lx - 2, ly, 4, 6).fill(GOLD);
  doc.polygon([lx - 10, ly + 18], [lx, ly + 14], [lx + 10, ly + 18]).fill(GOLD).fillOpacity(0.9);
  doc.fillOpacity(1);
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(GOLD)
     .text(SCHOOL_SHORT(), lx - 15, ly + 20, { width: 30, align: "center" });
  doc.fontSize(14).font("Helvetica-Bold").fillColor(WHITE)
     .text(SCHOOL_NAME().toUpperCase(), 96, 16, { width: W - 106, lineGap: 1 });
  doc.fontSize(8.5).font("Helvetica").fillColor(GOLD)
     .text("STUDENT IDENTIFICATION CARD", 96, 44, { width: W - 106 });
  doc.fontSize(7).fillColor("rgba(255,255,255,0.5)")
     .text("OFFICIAL DOCUMENT — NOT TRANSFERABLE", 96, 60, { width: W - 106 });
  doc.rect(0, 88, W, 3.5).fill(GOLD);

  // Photo
  const PX = 24, PY = 102, PW = 115, PH = 138;
  doc.rect(PX, PY, PW, PH).fill(LIGHT);
  doc.rect(PX, PY, PW, PH).lineWidth(1).strokeColor(LINE).stroke();
  if (s.photo && s.photo.includes(",")) {
    try { doc.image(Buffer.from(s.photo.split(",")[1], "base64"), PX, PY, { width: PW, height: PH }); }
    catch (_) {}
  }
  doc.rect(PX, PY + PH, PW, 20).fill(BLUE);
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor(WHITE)
     .text(s.matric_no, PX, PY + PH + 5, { width: PW, align: "center" });

  // Details
  const DX = 156, DY = 102, ROW = 30;
  const fields = [
    ["FULL NAME",     s.full_name],
    ["DATE OF BIRTH", fmtDate(s.dob)],
    ["SEX",           s.sex || "—"],
    ["STATE OF ORIGIN", s.state_of_origin || "—"],
    ["FACULTY",       s.faculty || "—"],
    ["DEPT / LEVEL",  `${s.department} · ${s.level}L`],
    ["PHONE",         s.phone || s.email],
    ["ISSUED",        fmtDate(s.created_at)],
  ];
  fields.forEach(([label, value], i) => {
    const fy = DY + i * ROW;
    doc.fontSize(6.5).font("Helvetica").fillColor(GREY).text(label, DX, fy, { width: W - DX - 14 });
    doc.fontSize(9.5).font("Helvetica-Bold").fillColor(NAVY)
       .text(value, DX, fy + 10, { width: W - DX - 14 });
    if (i < fields.length - 1)
      doc.rect(DX, fy + ROW - 3, W - DX - 14, 0.4).fill(LINE);
  });

  // Active badge
  const sy = DY + fields.length * ROW + 2;
  doc.roundedRect(DX, sy, 52, 15, 7).fill("#E3F4F1");
  doc.roundedRect(DX, sy, 52, 15, 7).lineWidth(0.7).strokeColor(TEAL).stroke();
  doc.fontSize(8).font("Helvetica-Bold").fillColor(TEAL)
     .text("✓  ACTIVE", DX + 2, sy + 3, { width: 48, align: "center" });

  // Divider + QR
  const divY = Math.max(PY + PH + 20 + 14, sy + 22);
  doc.rect(22, divY, W - 44, 0.5).fill(GOLD);
  const QS = 108, QX = (W - QS) / 2, QY = divY + 12;
  doc.rect(QX - 5, QY - 5, QS + 10, QS + 10).fill(WHITE);
  doc.rect(QX - 5, QY - 5, QS + 10, QS + 10).lineWidth(0.7).strokeColor(LINE).stroke();
  if (qrDataUrl && qrDataUrl.includes(",")) {
    try { doc.image(Buffer.from(qrDataUrl.split(",")[1], "base64"), QX, QY, { width: QS }); }
    catch (_) {}
  }
  doc.fontSize(7.5).font("Helvetica").fillColor(GREY)
     .text("Scan to verify this student identification card", 0, QY + QS + 8, { width: W, align: "center" });

  // Footer
  const FY = H - 30;
  doc.rect(0, FY, W, 30).fill(NAVY);
  doc.fontSize(6.5).font("Helvetica").fillColor("rgba(255,255,255,0.5)")
     .text(`${SCHOOL_NAME()} · Student Records System · Property of the university`,
           0, FY + 10, { width: W, align: "center" });
}

// ═══════════════════════════════════════════════════════
//  ADMIN — static routes (must come before /:id wildcards)
// ═══════════════════════════════════════════════════════

// List active students
router.get("/", auth(["admin"]), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT student_id, matric_no, full_name, faculty, department, level,
            email, status, qr_valid, created_at
     FROM students WHERE status='active' ORDER BY full_name`
  );
  res.json(rows);
}));

// List pending
router.get("/pending", auth(["admin"]), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT student_id, matric_no, full_name, faculty, department, level,
            dob, sex, state_of_origin, phone, email, photo, created_at
     FROM students WHERE status='pending' ORDER BY created_at`
  );
  res.json(rows);
}));

router.post("/create", auth(["admin"]), async (req, res) => {
  const {
    matric_no, full_name, faculty, department, level, email, password,
    dob, sex, state_of_origin, phone, address, photo,
  } = req.body;
  if (!matric_no || !full_name || !department || !level || !email || !password)
    return res.status(400).json({ error: "Matric, name, department, level, email and password are required" });
  if (password.length < MIN_PASSWORD)
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
  if (photo && !/^data:image\/(jpeg|jpg|png);base64,/.test(photo))
    return res.status(400).json({ error: "Photo must be a JPEG or PNG data URL" });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO students
         (matric_no, full_name, faculty, department, level, email, password_hash,
          photo, dob, sex, state_of_origin, phone, address, status, qr_valid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',FALSE)
       RETURNING student_id`,
      [matric_no, full_name, faculty || null, department, level, email, hash,
       photo || null, dob || null, sex || null, state_of_origin || null,
       phone || null, address || null]
    );
    const student_id = rows[0].student_id;
    const payload = buildPayload({ student_id });
    await pool.query("UPDATE students SET qr_payload=$1, qr_valid=TRUE WHERE student_id=$2",
      [payload, student_id]);
    res.status(201).json({ message: "Student created and activated", student_id });
  } catch (e) {
    if (e.code === "23505")
      return res.status(409).json({ error: "Matric number or email already registered" });
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// PUBLIC verification — opened by scanning a student's QR with any phone
// camera. The QR links here with the encrypted token in ?t=. No login required;
// the page shows only enough to confirm identity at a glance.
router.get("/verify-public", asyncHandler(async (req, res) => {
  const token = req.query.t;
  if (typeof token !== "string" || !token.startsWith("enc:"))
    return res.json({ valid: false, result: "invalid" });

  let data;
  try { data = decryptPayload(token); }
  catch { return res.json({ valid: false, result: "invalid" }); }

  const { rows } = await pool.query(
    `SELECT full_name, matric_no, faculty, department, level, photo, status
     FROM students WHERE student_id=$1`, [data.id]
  );
  if (!rows.length) return res.json({ valid: false, result: "not_found" });

  const s = rows[0];
  const active = s.status === "active";
  res.json({
    valid: active,
    result: active ? "verified" : "inactive",
    student: {
      full_name: s.full_name,
      matric_no: s.matric_no,
      faculty:   s.faculty,
      department: s.department,
      level:     s.level,
      photo:     s.photo,
    },
  });
}));

// ═══════════════════════════════════════════════════════
//  ADMIN — parameterised routes
// ═══════════════════════════════════════════════════════

// Approve
router.post("/:id/approve", auth(["admin"]), asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM students WHERE student_id=$1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Student not found" });
  const s = rows[0];
  const payload = buildPayload(s);
  await pool.query(
    "UPDATE students SET status='active', qr_payload=$1, qr_valid=TRUE WHERE student_id=$2",
    [payload, s.student_id]
  );
  res.json({ message: "Student approved and QR generated", student_id: s.student_id });
}));

// Reject
router.post("/:id/reject", auth(["admin"]), asyncHandler(async (req, res) => {
  // Mark the pending registration as rejected. The record is kept so it can be
  // reviewed under the Rejected tab; the applicant can still register again
  // because the registration route clears any rejected record for their email.
  const { rowCount } = await pool.query(
    "UPDATE students SET status='rejected' WHERE student_id=$1 AND status='pending'",
    [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: "Pending registration not found" });
  res.json({ message: "Student registration rejected" });
}));

// List rejected registrations
router.get("/rejected", auth(["admin"]), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT student_id, matric_no, full_name, faculty, department, level,
            dob, sex, state_of_origin, phone, email, photo, created_at
     FROM students WHERE status='rejected' ORDER BY created_at DESC`
  );
  res.json(rows);
}));

// Restore a rejected registration back to pending (undo a rejection)
router.post("/:id/restore", auth(["admin"]), asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    "UPDATE students SET status='pending' WHERE student_id=$1 AND status='rejected'",
    [req.params.id]
  );
  if (!rowCount) return res.status(404).json({ error: "Rejected registration not found" });
  res.json({ message: "Registration restored to pending" });
}));

// Delete
router.delete("/:id", auth(["admin"]), asyncHandler(async (req, res) => {
  await pool.query("DELETE FROM students WHERE student_id=$1", [req.params.id]);
  res.json({ ok: true });
}));

// Get QR image
router.get("/:id/qr", auth(["admin"]), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT qr_payload, qr_valid FROM students WHERE student_id=$1", [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: "Student not found" });
  if (!rows[0].qr_valid || !rows[0].qr_payload)
    return res.status(409).json({ error: "QR not available — student must regenerate it" });
  const dataUrl = await QRCode.toDataURL(verifyUrl(req, rows[0].qr_payload), { width: 320, margin: 2, color: { dark: "#1B2A4A" } });
  res.json({ qr: dataUrl, payload: rows[0].qr_payload });
}));

// Full student detail (admin)
router.get("/:id/detail", auth(["admin"]), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT student_id, matric_no, full_name, faculty, department, level,
            dob, sex, state_of_origin, phone, address, email, photo,
            qr_valid, status, created_at
     FROM students WHERE student_id=$1`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Student not found" });
  res.json(rows[0]);
}));

// Edit student details (admin). QR encodes only the student id, so changing
// details does not affect QR validity.
router.put("/:id", auth(["admin"]), asyncHandler(async (req, res) => {
  const { matric_no, full_name, faculty, department, level, email,
          phone, address, state_of_origin, sex, dob } = req.body;
  if (!matric_no || !full_name || !department || !level || !email)
    return res.status(400).json({ error: "Matric number, name, department, level and email are required" });
  try {
    await pool.query(
      `UPDATE students SET
         matric_no=$1, full_name=$2, faculty=$3, department=$4, level=$5, email=$6,
         phone=$7, address=$8, state_of_origin=$9, sex=$10, dob=$11
       WHERE student_id=$12`,
      [matric_no, full_name, faculty || null, department, level, email,
       phone || null, address || null, state_of_origin || null,
       sex || null, dob || null, req.params.id]
    );
    res.json({ message: "Student details updated" });
  } catch (e) {
    if (e.code === "23505") {
      const field = (e.detail || "").includes("matric_no") ? "Matric number" : "Email";
      return res.status(409).json({ error: `${field} is already in use by another student` });
    }
    throw e;
  }
}));

// ═══════════════════════════════════════════════════════
//  STUDENT (self)
// ═══════════════════════════════════════════════════════

router.get("/me/profile", auth(["student"]), asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT student_id, matric_no, full_name, faculty, department, level,
            dob, sex, state_of_origin, phone, address, email, photo,
            qr_payload, qr_valid, status
     FROM students WHERE student_id=$1`, [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  const s = rows[0];
  s.qr = (s.qr_valid && s.qr_payload)
    ? await QRCode.toDataURL(verifyUrl(req, s.qr_payload), { width: 320, margin: 2, color: { dark: "#1B2A4A" } })
    : null;
  delete s.qr_payload;
  res.json(s);
}));

// The QR encodes only the student id, so editing details does not invalidate
// it — verification always reads fresh data from the database. Only the fields
// exposed in the student portal are updated; others (phone, address) are left
// untouched.
router.put("/me/profile", auth(["student"]), asyncHandler(async (req, res) => {
  const { full_name, department, level } = req.body;
  if (!full_name || !department || !level)
    return res.status(400).json({ error: "Name, department and level are required" });
  await pool.query(
    `UPDATE students SET full_name=$1, department=$2, level=$3 WHERE student_id=$4`,
    [full_name, department, level, req.user.id]
  );
  res.json({ message: "Details updated." });
}));

router.post("/me/qr/regenerate", auth(["student"]), asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT * FROM students WHERE student_id=$1", [req.user.id]);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  if (rows[0].status !== "active") return res.status(403).json({ error: "Account is not active" });
  const payload = buildPayload(rows[0]);
  await pool.query("UPDATE students SET qr_payload=$1, qr_valid=TRUE WHERE student_id=$2",
    [payload, req.user.id]);
  const qr = await QRCode.toDataURL(verifyUrl(req, payload), { width: 320, margin: 2, color: { dark: "#1B2A4A" } });
  res.json({ qr, message: "QR code regenerated" });
}));

module.exports = router;
