import hre from "hardhat";

/** Muestra la cuenta de despliegue (dirección pública) y su saldo. Nunca imprime la llave. */
async function main() {
  const [signer] = await hre.ethers.getSigners();
  if (!signer) throw new Error("No hay cuenta: revisa PRIVATE_KEY en contrato/.env");
  const address = await signer.getAddress();
  const saldo = await hre.ethers.provider.getBalance(address);
  const red = await hre.ethers.provider.getNetwork();
  console.log(`Red:     ${hre.network.name} (chainId ${red.chainId})`);
  console.log(`Cuenta:  ${address}`);
  console.log(`Saldo:   ${hre.ethers.formatEther(saldo)} PAS`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
