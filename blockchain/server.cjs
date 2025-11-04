// server.cjs
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers"); // v6: ethers.verifyMessage ; v5: ethers.utils.verifyMessage

// ====== ENV ======
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PORT = process.env.PORT || 3001;
if (!CONTRACT_ADDRESS) {
  console.error("❌ Missing CONTRACT_ADDRESS in .env");
  process.exit(1);
}

// ====== CONTRACT ABI ======
const ABI = [
  {"inputs":[{"internalType":"bytes32","name":"_emailHash","type":"bytes32"}],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
];

// ====== APP ======
const app = express();
app.use(cors()); // cần thì cấu hình origin: [...] cho LAN
app.use(express.json());

// ====== ETHERS ======
const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// ====== NONCE IN-MEMORY ======
const nonces = new Map();

// ====== LOGIN HISTORY (RAM + FILE) ======
const HISTORY_FILE = path.join(__dirname, "login-history.json");

// nạp lịch sử từ file (nếu có)
let loginHistory = [];
try {
  if (fs.existsSync(HISTORY_FILE)) {
    loginHistory = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  }
} catch (e) {
  console.warn("⚠️ Không đọc được login-history.json:", e.message);
  loginHistory = [];
}

function saveHistoryToFile() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(loginHistory, null, 2), "utf8");
  } catch (e) {
    console.error("❌ Ghi login-history.json thất bại:", e.message);
  }
}

// ====== ROUTES ======
app.get("/health", (req, res) =>
  res.json({ ok: true, contract: CONTRACT_ADDRESS })
);

// cấp nonce để ký
app.post("/api/nonce", (req, res) => {
  const { address } = req.body || {};
  if (!address) return res.status(400).json({ error: "MISSING_ADDRESS" });

  const nonce = "LOGIN_NONCE_" + Math.floor(Math.random() * 1e9);
  nonces.set(address.toLowerCase(), nonce);
  console.log("→ /api/nonce", address, "=>", nonce);
  res.json({ nonce });
});

// verify chữ ký + check đã đăng ký on-chain
app.post("/api/verify", async (req, res) => {
  const { address, signature, context } = req.body || {};
  if (!address || !signature) return res.status(400).json({ error: "MISSING_FIELDS" });

  const nonce = nonces.get(address.toLowerCase());
  if (!nonce) return res.status(400).json({ error: "NO_NONCE" });

  try {
    // ethers v6
    const recovered = ethers.verifyMessage(nonce, signature);
    const okSig = recovered.toLowerCase() === address.toLowerCase();
    const registered = await contract.isRegistered(address);

    console.log("→ /api/verify", { address, recovered, okSig, registered });

    if (okSig && registered) {
      // Lưu lịch sử
      const item = {
        address: address,
        time: new Date().toISOString(),
        ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null,
        context: context || null // frontend có thể gửi thêm thông tin (email, page, v.v.)
      };
      loginHistory.push(item);
      saveHistoryToFile();

      nonces.delete(address.toLowerCase());
      return res.json({ success: true });
    }

    const reason = okSig ? "NOT_REGISTERED" : "INVALID_SIGNATURE";
    return res.status(401).json({ success: false, reason });
  } catch (e) {
    console.error("verify error:", e);
    return res.status(400).json({ error: e.message || "BAD_REQUEST" });
  }
});

// ====== LẤY LỊCH SỬ ĐĂNG NHẬP ======
// GET /api/login-history?limit=50&address=0xabc...&from=2025-10-01&to=2025-10-31
app.get("/api/login-history", (req, res) => {
  let { limit, address, from, to } = req.query;
  let data = [...loginHistory];

  if (address) {
    address = String(address).toLowerCase();
    data = data.filter(x => x.address.toLowerCase() === address);
  }
  if (from) {
    const t = Date.parse(from);
    if (!isNaN(t)) data = data.filter(x => Date.parse(x.time) >= t);
  }
  if (to) {
    const t = Date.parse(to);
    if (!isNaN(t)) data = data.filter(x => Date.parse(x.time) <= t);
  }
  limit = Number(limit) || 100;
  data = data.slice(-limit); // lấy các bản ghi mới nhất

  res.json({ count: data.length, items: data });
});

// ====== XÓA LỊCH SỬ (tùy chọn) ======
app.delete("/api/login-history", (req, res) => {
  loginHistory = [];
  saveHistoryToFile();
  res.json({ ok: true, cleared: true });
});

// ====== START ======
app.listen(PORT, () =>
  console.log(`✅ Auth server running: http://localhost:${PORT} (contract ${CONTRACT_ADDRESS})`)
);
