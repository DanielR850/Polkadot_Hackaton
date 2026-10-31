// Modal accesible basado en <dialog>: Escape y clic fuera lo cierran, el foco vuelve a quien lo abrió.
import { boton, el } from "./dom";

export interface Modal {
  element: HTMLDialogElement;
  cuerpo: HTMLElement;
  abrir(): void;
  cerrar(): void;
  readonly abierto: boolean;
}

export function createModal(titulo: string, alCerrar?: () => void): Modal {
  const cuerpo = el("div", { class: "modal-cuerpo" });
  const element = el(
    "dialog",
    { class: "modal" },
    el("div", { class: "modal-cabecera" }, el("h3", { text: titulo }), boton("✕", () => element.close(), "btn ghost cerrar")),
    cuerpo,
  );
  element.querySelector(".cerrar")?.setAttribute("aria-label", "Cerrar");

  let opener: HTMLElement | null = null;
  element.addEventListener("click", (e) => {
    if (e.target === element) element.close();
  });
  element.addEventListener("close", () => {
    alCerrar?.();
    opener?.focus();
  });

  return {
    element,
    cuerpo,
    abrir() {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (!element.open) element.showModal();
    },
    cerrar() {
      if (element.open) element.close();
    },
    get abierto() {
      return element.open;
    },
  };
}
