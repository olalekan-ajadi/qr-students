const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const router = express.Router();

function sign(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

// Read pixel dimensions straight from the image bytes (PNG IHDR / JPEG SOF),
// with no external dependency, so the passport-photo rules can be enforced on
// the server too.
function imageDimensions(buf) {
  // PNG: 8-byte signature, then IHDR with width@16 and height@20 (big-endian).
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 &&
      buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: starts FF D8; scan segments for a Start-Of-Frame marker.
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
        off += 2; continue;
      }
      const len = buf.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf &&
          marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
      }
      off += 2 + len;
    }
  }
  return null;
}

// Server-side passport photo guard: enforces image type, file size, a minimum
// resolution and a portrait/square aspect ratio. The admin still reviews each
// photo visually at approval.
function photoIsAcceptable(photo) {
  if (!photo || typeof photo !== "string") return "Passport photograph is required";
  if (!/^data:image\/(jpeg|jpg|png);base64,/.test(photo))
    return "Photo must be a JPEG or PNG image";

  const b64 = photo.slice(photo.indexOf(",") + 1);
  const bytes = Math.ceil(b64.length * 0.75);
  if (bytes > 2 * 1024 * 1024) return "Photo must be 2 MB or smaller";
  if (bytes < 3 * 1024) return "Photo file is too small to be valid";

  const dim = imageDimensions(Buffer.from(b64, "base64"));
  if (!dim || !dim.width || !dim.height)
    return "Could not read the image — please upload a valid JPEG or PNG";
  if (dim.width < 300 || dim.height < 300)
    return "Photo resolution is too low — use at least 300 × 300 pixels";
  const ratio = dim.width / dim.height;
  if (ratio > 1.05)
    return "Use a portrait or square passport photo, not a landscape image";
  if (ratio < 0.62)
    return "Photo is too narrow — use a standard portrait or square passport photo";

  return null;
}

// --- Public: student self-registration (account starts as 'pending') ---
router.post("/register", async (req, res) => {
  const {
    matric_no, full_name, faculty, department, level, email, password, photo,
    dob, sex, state_of_origin, phone, address,
  } = req.body;
  if (!matric_no || !full_name || !faculty || !department || !level ||
      !dob || !sex || !state_of_origin || !address || !phone ||
      !email || !password)
    return res.status(400).json({ error: "All fields are required" });
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ error: "Please enter a valid email address" });
  if (password.length < MIN_PASSWORD)
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD} characters` });
  const photoError = photoIsAcceptable(photo);
  if (photoError) return res.status(400).json({ error: photoError });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO students
         (matric_no, full_name, faculty, department, level, email, password_hash, photo,
          dob, sex, state_of_origin, phone, address, status, qr_valid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending',FALSE)`,
      [matric_no, full_name, faculty, department, level, email, hash, photo,
       dob || null, sex || null, state_of_origin || null, phone || null, address || null]
    );
    res.status(201).json({ message: "Registration received. Your account is pending admin approval." });
  } catch (e) {
    if (e.code === "23505")
      return res.status(409).json({ error: "Matric number or email already registered" });
    res.status(500).json({ error: "Server error" });
  }
});

// --- Login — no role selector needed. Checks admins first, then students. ---
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password are required" });
  try {
    // 1. Check admin table first
    const adminRes = await pool.query("SELECT * FROM admins WHERE email=$1", [email]);
    if (adminRes.rows.length) {
      const user = adminRes.rows[0];
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });
      const token = sign({ id: user.admin_id, role: "admin", name: user.full_name, email: user.email });
      return res.json({ token, role: "admin", name: user.full_name });
    }

    // 2. Check student table
    const stuRes = await pool.query("SELECT * FROM students WHERE email=$1", [email]);
    if (!stuRes.rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const user = stuRes.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    if (user.status === "pending")
      return res.status(403).json({ error: "Your account is awaiting admin approval." });
    if (user.status === "rejected")
      return res.status(403).json({ error: "Your registration was not approved. Please contact the administrator." });

    const token = sign({ id: user.student_id, role: "student", name: user.full_name, email: user.email });
    return res.json({ token, role: "student", name: user.full_name });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = { router, photoIsAcceptable };
