// Pantalla de inicio: título, Empezar partida y Ranking.
import { ESPECIES } from "../contract/polkapets";
import { boton, el } from "./dom";

export function createInicio(onEmpezar: () => void, onRanking: () => void): HTMLElement {
  const desfile = el("div", { class: "desfile", attrs: { "aria-hidden": "true" } });
  for (const e of ESPECIES) desfile.append(el("span", { text: e.emoji }));

  return el(
    "section",
    { class: "pantalla inicio" },
    desfile,
    el("h1", { class: "titulo", text: "PolkaPets" }),
    el("p", {
      class: "subtitulo",
      text: "Adopta una mascota NFT en Polkadot Hub y cuídala para que viva lo más posible.",
    }),
    el(
      "div",
      { class: "botones-col" },
      boton("▶ Empezar partida", onEmpezar, "btn primary grande"),
      boton("🏆 Ranking", onRanking, "btn ghost grande"),
    ),
  );
}
