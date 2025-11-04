// web3.js — Wallet-only auth (không email/mật khẩu)

// 🟢 PHẦN THÊM MỚI: import ethers v6 cho môi trường browser (ESM)
import { ethers } from "https://cdn.jsdelivr.net/npm/ethers@6.13.2/dist/ethers.min.js";

// Backend nonce/verify
export const SERVER_URL = "http://localhost:3001"; // backend nonce/verify

// 🟢 PHẦN THÊM MỚI: hằng số mạng Hardhat (31337)
const CHAIN_ID_DEC = 31337;
const CHAIN_ID_HEX = "0x7A69"; // 31337
const HARDHAT_RPC = "http://127.0.0.1:8545";

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

// 🟢 PHẦN THÊM MỚI: đảm bảo có MetaMask + đúng mạng Hardhat (31337)
export async function ensureNetwork() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  // Thử chuyển sang 31337; nếu chưa có thì add mới
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_ID_HEX }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: CHAIN_ID_HEX,
          chainName: "Localhost 8545",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: [HARDHAT_RPC],
          blockExplorerUrls: []
        }]
      });
    } else {
      throw e;
    }
  }
}

// ===== MetaMask =====
export async function connectWallet() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  // 🟢 PHẦN THÊM MỚI: đảm bảo đúng mạng trước khi yêu cầu kết nối
  await ensureNetwork();

  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

// ===== Smart contract (IdentityManager) =====
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // nhớ cập nhật khi redeploy
const ABI = [
  {"inputs":[{"internalType":"bytes32","name":"_emailHash","type":"bytes32"}],"name":"register","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"address","name":"_user","type":"address"}],"name":"isRegistered","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
];

// 🟢 PHẦN THÊM MỚI: luôn đảm bảo network đúng khi tạo contract
async function getContractWithSigner() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  await ensureNetwork();
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
}
async function getContractRead() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  await ensureNetwork();
  const provider = new ethers.BrowserProvider(window.ethereum);
  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

// Đăng ký on-chain cho địa chỉ ví (không email)
export async function registerWalletOnly() {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  await ensureNetwork();

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
// 🟢 PHẦN THÊM MỚI: cho phép truyền context để lưu vào lịch sử server
export async function loginWithSignature(context = "index") {
  if (!window.ethereum) throw new Error("Chưa cài MetaMask");
  await ensureNetwork();

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = (await signer.getAddress()).toLowerCase();

  // 1) xin nonce
  const r1 = await fetch(`${SERVER_URL}/api/nonce`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address })
  });
  if (!r1.ok) {
    return { ok: false, error: `NONCE_HTTP_${r1.status}` };
  }
  const j1 = await r1.json();
  const nonce = j1?.nonce;
  if (!nonce) return { ok: false, error: "NO_NONCE_FROM_SERVER" };

  // 2) ký nonce
  const signature = await signer.signMessage(nonce);

  // 3) verify + check on-chain (server sẽ ghi lịch sử nếu success)
  const r2 = await fetch(`${SERVER_URL}/api/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature, context })
  });
  const data = await r2.json().catch(() => ({}));
  if (!r2.ok || !data.success) {
    // server có thể trả reason: "NOT_REGISTERED" | "INVALID_SIGNATURE" ...
    return { ok: false, error: data.reason || data.error || `VERIFY_HTTP_${r2.status}` };
  }

  // 4) set phiên, lấy fullname từ local profile (nếu có)
  const profile = getProfile(address);
  const fullname = profile?.fullname || shortAddr(address);
  setCurrentUser({ wallet: address, fullname });
  return { ok: true };
}

// 🟢 PHẦN THÊM MỚI: tiện ích lấy lịch sử từ backend (nếu muốn dùng ở trang khác)
export async function fetchLoginHistory({ address = "", limit = 200 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (address) qs.set("address", address);
  const res = await fetch(`${SERVER_URL}/api/login-history?${qs.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
