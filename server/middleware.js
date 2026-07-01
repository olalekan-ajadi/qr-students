const jwt = require("jsonwebtoken");

// Wrap an async route handler so any rejected promise is forwarded to Express's
// error middleware instead of silently hanging the request (Express 4 does not
// catch async throws on its own).
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function auth(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "No token provided" });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (roles.length && !roles.includes(payload.role))
        return res.status(403).json({ error: "Access denied" });
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

module.exports = { auth, asyncHandler };
