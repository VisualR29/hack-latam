// SAFE APP: No vulnerabilities - used as negative control
const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const app = express();

// Proper security headers
app.use(helmet());

// Rate limiting configured
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// CORS restricted
app.use(
  require("cors")({
    origin: ["https://myapp.com"],
    credentials: false,
  })
);

// Proper auth middleware
function verifyAuth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// Protected route with auth and ownership check
app.get("/api/users/:id", verifyAuth, async (req, res) => {
  if (req.user.id !== req.params.id && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  const user = await db.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
  res.json(user);
});

// Parameterized SQL
app.get("/api/search", verifyAuth, async (req, res) => {
  const results = await db.query("SELECT * FROM products WHERE name = ?", [
    req.query.name,
  ]);
  res.json(results);
});

// Proper password validation
function validatePassword(password) {
  if (password.length < 12) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*]/.test(password)) return false;
  return true;
}

// JWT with expiration
const token = jwt.sign(
  { userId: user.id },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

// Secure cookie
app.use(
  require("express-session")({
    secret: process.env.SESSION_SECRET,
    cookie: { httpOnly: true, secure: true, sameSite: "strict" },
  })
);

// Proper logging
const logger = require("winston");
app.post("/api/login", limiter, async (req, res) => {
  logger.info({ event: "login_attempt", email: req.body.email, timestamp: new Date().toISOString() });
  // ... auth logic with bcrypt.compare
});

app.listen(process.env.PORT);
