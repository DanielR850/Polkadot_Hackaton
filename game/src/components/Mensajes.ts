// Avisos de estado: operación en curso, error o aviso informativo.
import type { HubState } from "../hub/hub";
import { boton, el } from "./dom";

export interface Mensajes {
  element: HTMLElement;
  sync(s: HubState): void;
}

export function createMensajes(onCerrar: () => void): Mensajes {
  const texto = el("span");
  const spinner = el("span", { class: "spinner", attrs: { "aria-hidden": "true" } });
  const cerrar = boton("✕", onCerrar, "btn ghost chico");
  cerrar.setAttribute("aria-label", "Cerrar aviso");
  const element = el("div", { class: "banner", attrs: { role: "status", "aria-live": "polite", hidden: "" } }, spinner, texto, cerrar);

  return {
    element,
    sync(s) {
      const tipo = s.ocupado ? "tx" : s.error ? "error" : s.aviso ? "aviso" : null;
      element.hidden = tipo === null;
      if (!tipo) return;
      element.className = `banner ${tipo}`;
      spinner.hidden = tipo !== "tx";
      cerrar.hidden = tipo === "tx";
      texto.textContent =
        tipo === "tx"
          ? `${s.ocupado} ${s.firmante?.tipo === "host" || s.enHost ? "Aprueba la firma en tu teléfono." : "Revisa tu wallet si te pide firmar."}` : tipo === "error" ? `⚠️ ${s.error}` : `${s.aviso}`;
    },
  };
}
