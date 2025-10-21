require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PORT = process.env.PORT || 3001;

if (!CONTRACT_ADDRESS) {
  console.error("❌ Missing CONTRACT_ADDRESS in .env");
  process.exit(1);
}

const ABI = [
  {"inputs":[{"internalType":"bytes32","name":"_emailHash","type":"bytes32"}],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
];

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Demo store nonce in memory
const nonces = new Map();

app.get("/health", (req,res)=>res.json({ok:true, contract: CONTRACT_ADDRESS}));

app.post("/api/nonce", (req, res) => {
  const { address } = req.body || {};
  if (!address) return res.status(400).json({ error: "MISSING_ADDRESS" });
  const nonce = "LOGIN_NONCE_" + Math.floor(Math.random() * 1e9);
  nonces.set(address.toLowerCase(), nonce);
  console.log("→ /api/nonce", address, "=>", nonce);
  res.json({ nonce });
});

app.post("/api/verify", async (req, res) => {
  const { address, signature } = req.body || {};
  if (!address || !signature) return res.status(400).json({ error: "MISSING_FIELDS" });

  const nonce = nonces.get(address.toLowerCase());
  if (!nonce) return res.status(400).json({ error: "NO_NONCE" });

  try {
    const recovered = ethers.verifyMessage(nonce, signature);
    const okSig = recovered.toLowerCase() === address.toLowerCase();
    const registered = await contract.isRegistered(address);

    console.log("→ /api/verify",
      { address, recovered, okSig, registered }
    );

    if (okSig && registered) {
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

app.listen(PORT, () =>
  console.log(`✅ Auth server running: http://localhost:${PORT} (contract ${CONTRACT_ADDRESS})`)
);
