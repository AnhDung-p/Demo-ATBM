// hardhat.config.ts
import "@nomicfoundation/hardhat-ethers";
import type { HardhatUserConfig } from "hardhat/config";
import { configVariable } from "hardhat/config";

// ✅ Nạp plugin theo side-effect (bắt buộc để có hre.ethers)
import "@nomicfoundation/hardhat-ethers";
// (nếu bạn có bộ mocha-ethers thì cứ giữ, không ảnh hưởng)
import "@nomicfoundation/hardhat-toolbox-mocha-ethers";

const config: HardhatUserConfig = {
  solidity: {
    profiles: {
      default: { version: "0.8.28" },
      production: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    // node nội bộ khi chạy `npx hardhat node`
    hardhat: { type: "edr-simulated", chainType: "l1" },

    // terminal khác deploy vào node trên
    localhost: { type: "http", url: "http://127.0.0.1:8545" },

    // các mạng template của bạn (giữ nguyên nếu cần)
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    hardhatOp: { type: "edr-simulated", chainType: "op" },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
};

export default config;
