// web3.js — Wallet-only auth (không email/mật khẩu)
export const SERVER_URL = "http://localhost:3001"; // backend nonce/verify

// ===== Helpers phiên & hồ sơ hiển thị (localStorage) =====
const KEY_CURRENT = "currentUser";
const KEY_PROFILES = "profiles"; // { [walletLower]: { fullname } }

export function setCurrentUser(u) {
  localStorage.setItem(KEY_CURRENT, JSON.stringify(u));
}
export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(KEY_CURRENT)||"null"); } catch { return null; }
}
export function clearCurrentUser() { localStorage.removeItem(KEY_CURRENT); }

export function getProfiles() {
  try { return JSON.parse(localStorage.getItem(KEY_PROFILES)||"{}"); } catch { return {}; }
}
export function setProfiles(p) { localStorage.setItem(KEY_PROFILES, JSON.stringify(p)); }

export function setProfile(wallet, profile) {
  const k = wallet.toLowerCase();
  const all = getProfiles();
  all[k] = { ...(all[k]||{}), ...profile };
  setProfiles(all);
}
export function getProfile(wallet) {
  return getProfiles()[wallet?.toLowerCase()] || null;
}
export function shortAddr(a) {
  return a ? a.slice(0,6) + "..." + a.slice(-4) : "";
}

// ===== MetaMask =====
export async function connectWallet() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

// ===== Smart contract (IdentityManager) =====
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const ABI = [
  {"inputs":[{"internalType":"bytes32","name":"_emailHash","type":"bytes32"}],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
];

function getContractWithSigner() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  return provider.getSigner().then(signer => {
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  });
}
function getContractRead() {
  const provider = new ethers.BrowserProvider(window.ethereum);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

// Đăng ký on-chain cho địa chỉ ví (không email)
export async function registerWalletOnly() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const addr = await signer.getAddress();

  const contract = await getContractWithSigner();
  // Dùng keccak256(address) làm “emailHash” thay thế
  const pseudoHash = ethers.keccak256(ethers.toUtf8Bytes(addr.toLowerCase()));
  const tx = await contract.register(pseudoHash);
  await tx.wait();
  return addr;
}

// Kiểm tra on-chain đã đăng ký
export async function isRegisteredOnChain(address) {
  const contract = await getContractRead();
  return await contract.isRegistered(address);
}

// ===== Đăng nhập bằng chữ ký + verify backend =====
export async function loginWithSignature() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = (await signer.getAddress()).toLowerCase();

  // 1) xin nonce
  const r1 = await fetch(`${SERVER_URL}/api/nonce`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address })
  });
  const { nonce } = await r1.json();

  // 2) ký nonce
  const signature = await signer.signMessage(nonce);

  // 3) verify + check on-chain
  const r2 = await fetch(`${SERVER_URL}/api/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature })
  });
  const data = await r2.json();
  if (!r2.ok || !data.success) {
    // server trả "reason": "Not registered on chain" hoặc "Invalid signature"
    return { ok: false, error: data.reason || data.error || "VERIFY_FAILED" };
  }

  // 4) set phiên, lấy fullname từ local profile (nếu có)
  const profile = getProfile(address);
  const fullname = profile?.fullname || shortAddr(address);
  setCurrentUser({ wallet: address, fullname });
  return { ok: true };
}
