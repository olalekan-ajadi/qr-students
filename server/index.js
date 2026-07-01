const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { router: authRoutes } = require("./routes/auth");
const studentRoutes = require("./routes/students");

// ── Fail fast on missing/placeholder secrets ──────────────
// A weak JWT_SECRET would let anyone forge admin tokens, so refuse to start.
const PLACEHOLDERS = ["", "change_this_to_a_long_random_string"];
for (const key of ["JWT_SECRET", "QR_ENC_KEY", "CARD_TOKEN_SECRET"]) {
  const val = process.env[key];
  if (PLACEHOLDERS.includes(val) || !val || val.length < 32) {
    console.error(
      `\nFATAL: ${key} is missing, too short, or still the example value.\n` +
      `Set a unique random value (env var in production, server/.env locally). Generate one with:\n` +
      `  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"\n`
    );
    process.exit(1);
  }
}

const app = express();
app.disable("x-powered-by");

// Security headers. The Content-Security-Policy is tuned for this app, which
// renders QR codes and passport photos as data: URLs and loads the Inter font
// from Google Fonts.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// In production the client is served from the same origin (below), so CORS is
// not needed by the browser. If you host the front-end separately, set
// CORS_ORIGIN to its URL. In development the Vite proxy makes calls same-origin.
const isProd = process.env.NODE_ENV === "production";
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors(isProd && allowedOrigins.length ? { origin: allowedOrigins } : {}));

app.use(express.json({ limit: "5mb" })); // larger limit to allow base64 photo uploads

// Throttle auth endpoints to slow brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,                       // 50 attempts / 15 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
});

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/students", studentRoutes);

// ── Serve the built React app (production) ────────────────
// After `npm run build` in client/, serve client/dist and let the SPA router
// handle client-side routes (so a refresh on /admin or /student works).
const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next(); // don't swallow API 404s
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// ── Central error handler — keeps a thrown query from hanging the request ──
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
