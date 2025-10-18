// server.cjs
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

// --- ENV ---
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const PORT = Number(process.env.PORT || 3001);
const CHECK_ONCHAIN = process.env.CHECK_ONCHAIN !== "false"; // default: true

// --- ABI tối thiểu ---
const ABI = [
  { "inputs":[{"internalType":"bytes32","name":"_emailHash","type":"bytes32"}], "name":"register","outputs":[], "stateMutability":"nonpayable","type":"function" },
  { "inputs":[{"internalType":"address","name":"_user","type":"address"}], "name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}], "stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"address","name":"_user","type":"address"}], "name":"getEmailHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}], "stateMutability":"view","type":"function" }
];

// --- App ---
const app = express();
app.use(express.json());
// Cho phép mọi origin (demo). Khi lên prod hãy whiltelist domain.
app.use(cors({ origin: true }));

// --- Blockchain bindings ---
const provider = new ethers.JsonRpcProvider(RPC_URL);
let contract;
try {
  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
} catch (e) {
  console.error("[BOOT] Contract init failed:", e.message);
}

// --- Nonces (RAM) ---
const nonces = new Map(); // key = checksum address

// Helpers
const toChecksum = (addr) => ethers.getAddress(addr);

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, rpc: RPC_URL, contract: CONTRACT_ADDRESS, checkOnChain: CHECK_ONCHAIN });
});

// 1) Issue nonce
app.post("/api/nonce", (req, res) => {
  try {
    const { address } = req.body || {};
    if (!address) return res.status(400).json({ ok: false, error: "MISSING_ADDRESS" });

    const cs = toChecksum(address);
    const nonce = `LOGIN_NONCE_${Math.floor(Math.random() * 1e9)}`;
    nonces.set(cs, nonce);
    console.log("[nonce]", cs, "=>", nonce);
    return res.json({ ok: true, nonce });
  } catch (e) {
    return res.status(400).json({ ok: false, error: "BAD_ADDRESS", details: e.message });
  }
});

// 2) Verify signature (+ optional on-chain check)
app.post("/api/verify", async (req, res) => {
  try {
    const { address, signature } = req.body || {};
    if (!address || !signature) return res.status(400).json({ ok: false, error: "MISSING_PARAMS" });

    const cs = toChecksum(address);
    const nonce = nonces.get(cs);
    if (!nonce) return res.status(400).json({ ok: false, error: "NO_NONCE" });

    // Verify signature
    const recovered = ethers.verifyMessage(nonce, signature);
    const okSig = toChecksum(recovered) === cs;
    if (!okSig) return res.status(401).json({ ok: false, error: "BAD_SIGNATURE" });

    // Optional: check on-chain
    if (CHECK_ONCHAIN) {
      try {
        if (!contract) throw new Error("Contract not initialized");
        const registered = await contract.isRegistered(cs);
        if (!registered) {
          return res.status(403).json({ ok: false, error: "NOT_REGISTERED" });
        }
      } catch (err) {
        console.error("[verify] isRegistered failed:", err);
        return res.status(502).json({ ok: false, error: "CHAIN_CHECK_FAILED", details: err.message });
      }
    }

    nonces.delete(cs);
    console.log("[verify] OK for", cs);
    return res.json({ ok: true });
  } catch (e) {
    console.error("[verify] error:", e);
    return res.status(400).json({ ok: false, error: "VERIFY_ERROR", details: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`Auth server running: http://127.0.0.1:${PORT}`);
  console.log(`RPC: ${RPC_URL}`);
  console.log(`CONTRACT_ADDRESS: ${CONTRACT_ADDRESS}`);
  console.log(`CHECK_ONCHAIN: ${CHECK_ONCHAIN}`);
});
