// Deploy thuần Ethers, KHÔNG dùng hre.ethers
import hre from "hardhat";
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";

async function main() {
  // 1) Provider tới Hardhat node local
  const provider = new JsonRpcProvider("http://127.0.0.1:8545");

  // 2) DÙNG PRIVATE KEY CỦA Account #0 IN TRONG TERMINAL A
  //    (Bạn copy ở cửa sổ node; ví dụ dưới là mặc định của Hardhat)
  const PRIVATE_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // <-- thay nếu khác

  const wallet = new Wallet(PRIVATE_KEY, provider);

  // 3) Lấy ABI + bytecode từ artifacts của Hardhat
  const artifact = await hre.artifacts.readArtifact("IdentityManager");

  // 4) Tạo factory & deploy
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log("✅ IdentityManager deployed at:", await contract.getAddress());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
