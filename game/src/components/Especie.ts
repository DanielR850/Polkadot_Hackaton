// Pantalla para elegir la mascota (especie). Adoptar mintea el NFT.
import { ESPECIES } from "../contract/polkapets";
import { portraitUrl } from "../../../src/game/assets.ts";
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
      el("img", { class: "especie-retrato", attrs: { src: portraitUrl(e.slug), alt: "", draggable: "false" } }),
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
  const disponibilidad = el("p", { class: "ayuda", attrs: { "aria-live": "polite" } });

  const element = el(
    "section",
    { class: "pantalla" },
    el("p", { class: "paso", text: "Paso 3 de 3" }),
    titulo,
    el("p", { class: "ayuda", text: "Al adoptar firmas una transacción que crea tu mascota como NFT en tu cuenta." }),
    el("div", { class: "especies" }, ...tarjetas),
    disponibilidad,
    el("div", { class: "botones-fila" }, volver, adoptar),
  );

  return {
    element,
    sync(s) {
      titulo.textContent = `Elige a ${s.nombreNuevo || "tu mascota"}`;
      const ocupado = s.ocupado !== null;
      if (elegida >= s.numEspecies) elegida = 0;
      marcar();
      adoptar.disabled = ocupado || elegida >= s.numEspecies;
      volver.disabled = ocupado;
      tarjetas.forEach((t, i) => { t.disabled = ocupado || i >= s.numEspecies; });
      disponibilidad.textContent = s.numEspecies < ESPECIES.length
        ? `El contrato NFT actual admite ${s.numEspecies === 1 ? "solo al ajolote" : `${s.numEspecies} especies`}. Los demás animales ya pueden jugarse en modo local y estarán disponibles como NFT tras desplegar el contrato nuevo.`
        : "Las cinco especies están disponibles como NFT en este contrato.";
    },
  };
}
