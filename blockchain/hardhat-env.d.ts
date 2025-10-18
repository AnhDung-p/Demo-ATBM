// Augment Hardhat Runtime Environment to include ethers helpers
import "@nomicfoundation/hardhat-ethers";
import type { HardhatEthersHelpers } from "@nomicfoundation/hardhat-ethers/types";

declare module "hardhat/types/runtime" {
  interface HardhatRuntimeEnvironment {
    ethers: HardhatEthersHelpers;
  }
}
