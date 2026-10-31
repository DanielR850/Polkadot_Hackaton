// Modal del ranking: las mascotas que más han durado (vivas o muertas).
import { especie, type FilaRanking } from "../contract/polkapets";
import { ordenarRanking } from "../engine/ranking";
import { acortarDireccion, duracionHumana } from "../lib/format";
import { mensajeError } from "../lib/txErrors";
import { boton, el } from "./dom";
import { createModal } from "./Modal";

export interface ModalRanking {
  element: HTMLDialogElement;
  abrir(cuenta: string | null): void;
}

export function createModalRanking(leer: () => Promise<FilaRanking[]>, onConnect: () => void): ModalRanking {
  const modal = createModal("🏆 Ranking de longevidad");
  const contenido = el("div", { class: "ranking" });
  const aviso = el("p", { class: "ayuda ranking-connect", text: "Vincula tu cuenta para registrar tu récord NFT en la cadena." });
  const conectar = boton("Vincular cuenta", () => { modal.cerrar(); onConnect(); }, "btn primary");
  let cuenta: string | null = null;
  let pedido = 0;

  async function cargar(): Promise<void> {
    const n = ++pedido;
    contenido.replaceChildren(el("p", { class: "ayuda", text: "Leyendo el ranking de la cadena…" }));
    try {
      const filas = ordenarRanking(await leer(), cuenta, 10);
      if (n !== pedido) return;
      if (filas.length === 0) {
        contenido.replaceChildren(el("p", { class: "ayuda", text: "Todavía no hay mascotas. ¡Sé la primera persona en adoptar!" }));
        return;
      }
      const tabla = el(
        "ol",
        { class: "ranking-lista" },
        ...filas.map((f) =>
          el(
            "li",
            { class: f.mia ? "mia" : "" },
            el("span", { class: "pos", text: f.posicion <= 3 ? ["🥇", "🥈", "🥉"][f.posicion - 1] : `${f.posicion}` }),
            el("span", { class: "rk-emoji", text: f.viva ? especie(f.especie).emoji : "🪦" }),
            el(
              "span",
              { class: "rk-nombre" },
              el("strong", { text: f.nombre }),
              el("small", { text: `${f.mia ? "Tuya" : acortarDireccion(f.dueno)} · ${f.viva ? "viva" : "murió"}` }),
            ),
            el("span", { class: "rk-tiempo", text: duracionHumana(f.duracion) }),
          ),
        ),
      );
      contenido.replaceChildren(tabla);
    } catch (e) {
      if (n !== pedido) return;
      contenido.replaceChildren(
        el("p", { class: "ayuda", text: `No se pudo leer el ranking: ${mensajeError(e)}` }),
        boton("Reintentar", () => void cargar(), "btn ghost"),
      );
    }
  }

  modal.cuerpo.append(
    el("p", { class: "ayuda", text: "Las 10 mascotas que más tiempo han vivido. Las vivas siguen sumando." }),
    aviso,
    conectar,
    contenido,
  );

  return {
    element: modal.element,
    abrir(c) {
      cuenta = c;
      aviso.hidden = Boolean(c);
      conectar.hidden = Boolean(c);
      modal.abrir();
      void cargar();
    },
  };
}
