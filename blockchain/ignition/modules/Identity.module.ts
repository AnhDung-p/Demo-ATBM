import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("IdentityModule", (m) => {
  const identity = m.contract("IdentityManager");
  return { identity };
});
