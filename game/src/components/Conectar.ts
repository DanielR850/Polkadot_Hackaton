// Pantalla para vincular la cuenta. Dentro de Polkadot Desktop o la Polkadot App la cuenta la da
// el Host; en un navegador normal se listan las wallets EVM que haya (MetaMask, Talisman…).
import { WALLETS_SUGERIDAS, type WalletInfo } from "../contract/wallets";
import type { HubState } from "../hub/hub";
import { boton, el } from "./dom";

export interface Conectar {
  element: HTMLElement;
  sync(s: HubState): void;
}

export function createConectar(
  onElegir: (w: WalletInfo) => void,
  onReintentar: () => void,
  onVolver: () => void,
  onHost: () => void,
): Conectar {
  const ayuda = el("p", { class: "ayuda" });
  const lista = el("div", { class: "wallets" });
  const element = el(
    "section",
    { class: "pantalla" },
    el("p", { class: "paso", text: "Paso 1 de 3" }),
    el("h2", { text: "Vincula tu cuenta" }),
    ayuda,
    lista,
    el("div", { class: "botones-fila" }, boton("← Volver", onVolver, "btn ghost")),
  );

  let ultimaClave = "";

  function sync(s: HubState): void {
    const clave = `${s.enHost}|${s.buscandoWallets}|${s.wallets.map((w) => w.id).join(",")}|${s.ocupado ?? ""}`;
    if (clave === ultimaClave) return;
    ultimaClave = clave;

    if (s.buscandoWallets || s.enHost === null) {
      ayuda.textContent = "";
      lista.replaceChildren(el("p", { class: "ayuda", text: "Buscando tu cuenta…" }));
      return;
    }

    if (s.enHost) {
      ayuda.textContent =
        "Tu cuenta es la de la Polkadot App. Al conectar, acepta en tu teléfono los permisos de cuenta, transacciones y gas.";
      const b = boton("Conectar con la Polkadot App", onHost, "btn");
      b.disabled = s.ocupado !== null;
      lista.replaceChildren(b);
      return;
    }

    ayuda.textContent =
      "Elige tu wallet. Funciona con MetaMask y con wallets de Polkadot compatibles con EVM (Talisman, SubWallet, Nova).";

    if (s.wallets.length === 0) {
      const enlaces = el("div", { class: "sugeridas" });
      for (const w of WALLETS_SUGERIDAS) {
        enlaces.append(el("a", { text: w.nombre, attrs: { href: w.url, target: "_blank", rel: "noopener noreferrer" } }));
      }
      lista.replaceChildren(
        el("p", { class: "ayuda", text: "No encontramos ninguna wallet en este navegador. Instala una y recarga:" }),
        enlaces,
        boton("Buscar de nuevo", onReintentar, "btn ghost"),
      );
      return;
    }

    lista.replaceChildren(
      ...s.wallets.map((w) => {
        const b = el("button", { class: "wallet", attrs: { type: "button" } });
        // Solo se aceptan iconos embebidos (data:image/...), nunca URLs externas.
        if (w.icono?.startsWith("data:image/")) {
          b.append(el("img", { attrs: { src: w.icono, alt: "", width: "32", height: "32" } }));
        } else {
          b.append(el("span", { class: "wallet-icono", text: "👛" }));
        }
        b.append(el("span", { text: w.nombre }));
        b.disabled = s.ocupado !== null;
        b.addEventListener("click", () => onElegir(w));
        return b;
      }),
    );
  }

  return { element, sync };
}
