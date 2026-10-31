// Barra de un atributo (0–100), con color según el nivel. sync() la actualiza sin recrear DOM.
import { clampStat } from "../lib/format";
import { el } from "./dom";

export interface StatBar {
  element: HTMLElement;
  sync(valor: number): void;
}

export function createStatBar(etiqueta: string, emoji: string): StatBar {
  const valorTxt = el("span", { class: "stat-valor" });
  const fill = el("span");
  const bar = el("div", { class: "bar", attrs: { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": etiqueta } }, fill);
  const element = el(
    "div",
    { class: "stat" },
    el("div", { class: "stat-label" }, el("span", { text: `${emoji} ${etiqueta}` }), valorTxt),
    bar,
  );

  let previo = -1;
  return {
    element,
    sync(crudo) {
      const v = clampStat(crudo);
      if (v === previo) return;
      previo = v;
      valorTxt.textContent = `${v}`;
      fill.style.width = `${v}%`;
      bar.setAttribute("aria-valuenow", String(v));
      bar.classList.remove("ok", "warn", "crit");
      bar.classList.add(v >= 50 ? "ok" : v >= 25 ? "warn" : "crit");
    },
  };
}
