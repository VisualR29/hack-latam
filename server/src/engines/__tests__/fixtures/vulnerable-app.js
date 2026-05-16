// =========================================================================
// FIXTURE: Aplicación "vibecodeada" intencionalmente vulnerable
// Contiene ejemplos de TODAS las OWASP Top 10 para probar los motores
// =========================================================================

const express = require("express");
const jwt = require("jsonwebtoken");
const mysql = require("mysql2");
const app = express();

// ========== A01: Broken Access Control ==========

// IDOR: Access resource by user-supplied ID without ownership check
app.get("/api/users/:id", (req, res) => {
  const user = User.findById(req.params.id);
  res.json(user);
});

// Route without auth middleware on sensitive endpoint
app.post("/api/admin/settings", (req, res) => {
  updateSettings(req.body);
  res.send("OK");
});

// Privilege escalation: role from client
app.post("/api/profile", (req, res) => {
  user.role = req.body.role;
  user.save();
  res.json(user);
});

// Sensitive function without authorization
async function deleteAllUsers(id) {
  await db.users.deleteMany({});
  return { deleted: true };
}

// Public secret endpoint
app.get("/secret/data", (req, res) => {
  res.json({ secrets: getAllSecrets() });
});

// ========== A02: Cryptographic Failures ==========

// Hardcoded AWS key
const AWS_KEY = "AKIAIOSFODNN7EXAMPLE";

// Private key in code
const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA0Z3VS5JJcds...
-----END RSA PRIVATE KEY-----`;

// .env-like secret
const DB_URL = "mongodb://admin:SuperSecret123@db.prod.example.com:27017/myapp";

// ========== A03: Injection ==========

// SQL Injection — concat style
app.get("/api/search", (req, res) => {
  const query = "SELECT * FROM products WHERE name = '" + req.params.name + "'";
  db.query(query);
});

// SQL Injection — template literal style
const userQuery = `SELECT id FROM accounts WHERE email = ${req.body.email}` + ` AND active = 1`;

// NoSQL Injection
app.post("/api/find", (req, res) => {
  db.users.find({ $where: `this.name === '${req.body.name}'` });
});

// Command Injection (Node.js)
const { exec } = require("child_process");
app.get("/api/ping", (req, res) => {
  child_process.exec(`ping ${req.query.host}`, (err, stdout) => {
    res.send(stdout);
  });
});

// Path Traversal
app.get("/api/file", (req, res) => {
  const data = require("fs").readFileSync(`./uploads/${req.query.path}`);
  res.send(data);
});

// ========== A04: Insecure Design ==========

// CORS wildcard
const corsOpts = cors({ origin: '*', credentials: true });
app.use(corsOpts);

// Debug mode on
const CONFIG = { DEBUG: true, LOG_LEVEL: "verbose" };

// Public secret variable name
const NEXT_PUBLIC_API_SECRET_KEY = "sk-proj-abc123def456";

// No CSP configured, no X-Frame-Options, no HSTS...
// (absence is detected by configExposure engine)

// ========== A05: Security Misconfiguration / Integrity ==========

// eval usage
function processUserInput(code) {
  return eval(code);
}

// new Function from string
const dynamicFunc = new Function("a", "b", userCode);

// innerHTML XSS
document.getElementById("output").innerHTML = userInput;

// Prisma raw unsafe
const result = prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${id}`);

// SQL concat
const q = `select * from orders where user = ${req.body.userId}`;

// ========== A06: Vulnerable Components (deps engine) ==========
// (Tested via package.json fixture separately)

// ========== A07: Identification and Authentication Failures ==========

// Weak password - accepts anything >= 4 chars
function validatePassword(password) {
  if (password.length <= 4) return false;
  return true;
}

// JWT without expiration
const token = jwt.sign({ userId: user.id, role: "admin" }, "mysecretkey");

// Weak token generation
const sessionId = Math.random().toString(36);

// Hardcoded credentials for authentication
const username = "admin";
const password = "P@ssw0rd!Admin2024";
function authenticate(input) {
  if (input === password) return true;
}

// No brute force protection on login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || user.password !== password) {
    return res.status(401).json({ error: "user not found" });
  }
  return res.json({ token: generateToken(user) });
});

// Insecure password reset
function resetPassword(email) {
  const token = Math.random().toString(36).substring(7);
  sendResetEmail(email, token);
}

// ========== A08: Software and Data Integrity ==========

// Python pickle (in .py files, but pattern is here for reference)
// pickle.loads(untrusted_data)

// httpOnly: false cookie
app.use(
  require("express-session")({
    secret: "keyboard cat",
    cookie: { httpOnly: false, secure: false },
  })
);

// ========== A09: Security Logging & Monitoring Failures ==========

// Login without logging
function signin(email, password) {
  const user = findUser(email);
  if (user && user.password === password) {
    return generateSession(user);
  }
  return null;
}

// Catch without logging
try {
  await processPayment(order);
} catch (err) {
  throw err;
}

// Sensitive data in logs
console.log("User login attempt:", { email, password, token: jwt_token });
logger.info("Auth debug password=" + password + " token=" + authToken);

// Using console.log instead of proper logger
console.log("Server started on port 3000");
console.error("Database connection failed");

// ========== A10: Server-Side Request Forgery (SSRF) ==========

// User-controlled URL fetch
app.post("/api/fetch-url", (req, res) => {
  fetch(req.body.url).then((r) => r.text()).then((html) => res.send(html));
});

// Webhook without validation
app.post("/api/webhook", (req, res) => {
  const webhookUrl = req.body.notifyUrl;
  fetch(webhookUrl, { method: "POST", body: JSON.stringify(req.body.data) });
});

// Redirect from user input
app.get("/redirect", (req, res) => {
  res.redirect(req.query.url);
});

// Metadata endpoint reference
const metadataUrl = "http://169.254.169.254/latest/meta-data/iam/security-credentials/";

// SSL verification disabled
const agent = new https.Agent({ rejectUnauthorized: false });
axios.get(url, { httpsAgent: agent });

// Private IP hardcoded reference
const internalApi = "http://192.168.1.100/internal/admin";

app.listen(3000, () => {
  console.log("Vulnerable app running on port 3000");
});
