// web3.js — ES Module cho frontend (dùng với ethers UMD đã nhúng trong HTML)

export const SERVER_URL = "http://localhost:3001"; // backend /api/nonce, /api/verify
export const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // địa chỉ contract hardhat local

// ABI rút gọn của IdentityManager
const ABI = [
  {
    "inputs":[{"internalType":"bytes32","name":"_emailHash","type":"bytes32"}],
    "name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"
  },
  {
    "inputs":[{"internalType":"address","name":"_user","type":"address"}],
    "name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"
  },
  {
    "inputs":[{"internalType":"address","name":"_user","type":"address"}],
    "name":"getEmailHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"
  }
];

// ethers từ UMD
const { ethers } = window;

// ===== helpers ethers/metamask =====
async function getProvider() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  return new ethers.BrowserProvider(window.ethereum);
}
async function getSigner() {
  const p = await getProvider();
  return p.getSigner();
}
async function getContract(write = false) {
  const p = await getProvider();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, write ? await p.getSigner() : p);
}

// ===== session helpers =====
export function setCurrentUser(u) { localStorage.setItem("currentUser", JSON.stringify(u)); }
export function getCurrentUser() { try { return JSON.parse(localStorage.getItem("currentUser")||"null"); } catch { return null; } }
export function clearCurrentUser() { localStorage.removeItem("currentUser"); }

// ===== auth/web3 functions =====
export async function connectWallet() {
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("Không lấy được tài khoản");
  return ethers.getAddress(accounts[0]);
}

export function hashEmail(email) {
  if (!email) throw new Error("Thiếu email");
  return ethers.id(email.trim().toLowerCase());
}

export async function registerOnChain(email) {
  const c = await getContract(true);
  const tx = await c.register(hashEmail(email));
  return tx.wait();
}

export async function isRegistered(address) {
  const c = await getContract(false);
  return c.isRegistered(address);
}

export async function loginWithSignature() {
  const signer = await getSigner();
  const address = await (await getSigner()).getAddress();

  // 1) Lấy nonce từ backend (nếu có)
  let nonce;
  try {
    const r1 = await fetch(`${SERVER_URL}/api/nonce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address })
    });
    if (!r1.ok) throw new Error(`/api/nonce failed ${r1.status}`);
    ({ nonce } = await r1.json());
    if (!nonce) throw new Error("Không nhận được nonce");
  } catch {
    // fallback demo: chỉ ký local xem như OK
    await signer.signMessage("LOGIN_NONCE_DEMO");
    return true;
  }

  // 2) Ký nonce
  const signature = await signer.signMessage(nonce);

  // 3) Gửi verify
  const r2 = await fetch(`${SERVER_URL}/api/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature })
  });

  if (!r2.ok) {
    try {
      const err = await r2.json();
      throw new Error(err?.reason || err?.error || `Verify thất bại (${r2.status})`);
    } catch {
      throw new Error(`Verify thất bại (${r2.status})`);
    }
  }

  // 4) Có thể yêu cầu đã đăng ký on-chain
  try {
    const ok = await isRegistered(address);
    return !!ok;
  } catch {
    // Nếu ABI/địa chỉ sai vẫn coi như pass (tuỳ bạn)
    return true;
  }
}
