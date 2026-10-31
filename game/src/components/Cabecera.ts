// Barra superior: marca, cuenta vinculada, saldo y salir.
import { formatEther } from "viem";
import { FAUCET_URL, NATIVE_SYMBOL } from "../contract/config";
import type { HubState } from "../hub/hub";
import { acortarDireccion } from "../lib/format";
import { boton, el } from "./dom";

export interface Cabecera {
  element: HTMLElement;
  sync(s: HubState): void;
}

export function createCabecera(onSalir: () => void, salirLabel = "Salir"): Cabecera {
  const keepExitVisible = salirLabel !== "Salir";
  const cuenta = el("span", { class: "cuenta" });
  const faucet = el("a", {
    class: "faucet",
    text: "Conseguir PAS",
    attrs: { href: FAUCET_URL, target: "_blank", rel: "noopener noreferrer", hidden: "" },
  });
  const salir = boton(salirLabel, onSalir, "btn ghost chico");
  const derecha = el("div", { class: "cabecera-der" }, faucet, cuenta, salir);

  const element = el(
    "header",
    { class: "cabecera" },
    el("div", { class: "brand" }, el("span", { class: "dot" }), el("span", { text: "PolkaPets" })),
    derecha,
  );

  return {
    element,
    sync(s) {
      derecha.hidden = s.cuenta === null && !keepExitVisible;
      if (!s.cuenta) return;
      const saldo = s.saldo === null ? "" : ` · ${Number(formatEther(s.saldo)).toFixed(2)} ${NATIVE_SYMBOL}`;
      cuenta.textContent = `${s.firmante?.nombre ?? "Wallet"} · ${acortarDireccion(s.cuenta)}${saldo}`;
      faucet.hidden = !(s.saldo !== null && s.saldo < 10n ** 16n); // menos de 0.01 PAS
      salir.disabled = s.ocupado !== null;
    },
  };
}
