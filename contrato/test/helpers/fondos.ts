import hre from "hardhat";

/**
 * Solo para pruebas: pone pesitos a varias mascotas escribiendo el almacenamiento (en la cadena real
 * los pesitos solo se ganan con `cobrarPesitos`, que tiene un cupo). Detecta solo la posición del mapeo.
 */
export async function fondear(items: { getAddress(): Promise<string>; pesitos(id: number): Promise<bigint> }, ids: number[], cantidad = 5000) {
  const { ethers, network } = hre;
  const address = await items.getAddress();
  const coder = ethers.AbiCoder.defaultAbiCoder();
  const clave = (id: number, slot: number) => ethers.keccak256(coder.encode(["uint256", "uint256"], [id, slot]));
  const valor = ethers.toBeHex(cantidad, 32);
  for (let slot = 0; slot < 40; slot++) {
    await network.provider.send("hardhat_setStorageAt", [address, clave(ids[0], slot), valor]);
    if ((await items.pesitos(ids[0])) === BigInt(cantidad)) {
      for (const id of ids.slice(1)) await network.provider.send("hardhat_setStorageAt", [address, clave(id, slot), valor]);
      return;
    }
    await network.provider.send("hardhat_setStorageAt", [address, clave(ids[0], slot), ethers.toBeHex(0, 32)]);
  }
  throw new Error("No encontré el mapeo de pesitos");
}
