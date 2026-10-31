// Pantalla para elegir la mascota (especie). Adoptar mintea el NFT.
import { ESPECIES } from "../contract/polkapets";
import type { HubState } from "../hub/hub";
import { boton, el } from "./dom";

export interface EspecieUI {
  element: HTMLElement;
  sync(s: HubState): void;
}

export function createEspecie(onAdoptar: (especie: number) => void, onVolver: () => void): EspecieUI {
  let elegida = 0;
  const titulo = el("h2");
  const tarjetas = ESPECIES.map((e) => {
    const b = el(
      "button",
      { class: "especie", attrs: { type: "button", "aria-pressed": "false" } },
      el("span", { class: "especie-emoji", text: e.emoji }),
      el("strong", { text: e.nombre }),
      el("span", { class: "ayuda", text: e.descripcion }),
    );
    b.addEventListener("click", () => {
      elegida = e.id;
      marcar();
    });
    return b;
  });
  const marcar = () =>
    tarjetas.forEach((t, i) => {
      t.classList.toggle("elegida", i === elegida);
      t.setAttribute("aria-pressed", String(i === elegida));
    });
  marcar();

  const volver = boton("← Volver", onVolver, "btn ghost");
  const adoptar = boton("🥚 Adoptar (NFT)", () => onAdoptar(elegida), "btn primary");

  const element = el(
    "section",
    { class: "pantalla" },
    el("p", { class: "paso", text: "Paso 3 de 3" }),
    titulo,
    el("p", { class: "ayuda", text: "Al adoptar firmas una transacción que crea tu mascota como NFT en tu cuenta." }),
    el("div", { class: "especies" }, ...tarjetas),
    el("div", { class: "botones-fila" }, volver, adoptar),
  );

  return {
    element,
    sync(s) {
      titulo.textContent = `Elige a ${s.nombreNuevo || "tu mascota"}`;
      const ocupado = s.ocupado !== null;
      adoptar.disabled = ocupado;
      volver.disabled = ocupado;
      for (const t of tarjetas) t.disabled = ocupado;
    },
  };
}
