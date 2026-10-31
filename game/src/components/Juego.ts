// Pantalla principal: la mascota, sus seis atributos y los botones de cuidado.
import { especie, Etapa, etiquetaEtapa, type Accion, type Mascota, etapaPorNivel } from "../contract/polkapets";
import { diagnosticar, progresoXp } from "../engine/salud";
import { duracionHumana } from "../lib/format";
import { boton, el } from "./dom";
import { createStatBar } from "./StatBar";
import { createPetScene, type PetSceneHandle, type SceneView } from "../../../src/game/petScene.ts";
import type { PetAnim } from "../../../src/game/animations.ts";
import type { Stage } from "../../../src/game/types.ts";
import { buildTheme } from "../../../src/ui/theme.ts";
import { findPet } from "../../../src/game/catalog.ts";

export interface Juego {
  element: HTMLElement;
  /** `m` ya viene con el tiempo simulado al instante actual. */
  sync(m: Mascota, ocupado: boolean): void;
  react(action: Accion): void;
}

export interface JuegoAcciones {
  onCuidar(a: Accion): void;
  onNombre(): void;
  onRanking(): void;
  onNuevaPartida(): void;
}

export function createJuego(acc: JuegoAcciones): Juego {
  const gameHost = el("div", { class: "onchain-pet-scene", attrs: { "aria-label": "Mascota NFT animada" } });
  const nombre = el("h2", { class: "mascota-nombre" });
  const meta = el("p", { class: "mascota-meta" });
  const xp = el("span");
  const xpBar = el("div", { class: "bar xp" }, xp);
  const tiempo = el("p", { class: "tiempo" });
  const consejo = el("p", { class: "consejo", attrs: { "aria-live": "polite" } });

  const barras = {
    vida: createStatBar("Vida", "❤️"),
    hambre: createStatBar("Hambre", "🍖"),
    sed: createStatBar("Sed", "💧"),
    energia: createStatBar("Energía", "⚡"),
    felicidad: createStatBar("Felicidad", "🎾"),
    limpieza: createStatBar("Limpieza", "🛁"),
  };

  const btn: Record<Accion, HTMLButtonElement> = {
    alimentar: boton("🍖 Alimentación", () => acc.onCuidar("alimentar")),
    jugar: boton("🎾 Jugar", () => acc.onCuidar("jugar")),
    dormir: boton("💤 Dormir", () => acc.onCuidar("dormir")),
    banar: boton("🛁 Bañar", () => acc.onCuidar("banar")),
  };
  const btnNombre = boton("✏️ Nombre", acc.onNombre, "btn ghost");
  const btnRanking = boton("🏆 Ranking", acc.onRanking, "btn ghost");

  const acciones = el("div", { class: "acciones" }, btn.alimentar, btn.jugar, btn.dormir, btn.banar, btnNombre, btnRanking);

  const fin = el(
    "div",
    { class: "fin", attrs: { hidden: "" } },
    el("p", { class: "fin-titulo", text: "💀 Fin de la partida" }),
    el("p", { class: "fin-texto" }),
    el(
      "div",
      { class: "botones-fila" },
      boton("🏆 Ver ranking", acc.onRanking, "btn ghost"),
      boton("▶ Nueva partida", acc.onNuevaPartida, "btn primary"),
    ),
  );
  const finTexto = fin.querySelector(".fin-texto") as HTMLElement;
  let scene: PetSceneHandle | null = null;
  let currentStage: Stage = "baby";
  let idleView: SceneView = { petId: 0, stage: "baby", anim: "idle" };
  let reactionTimer = 0;
  let themedPetId = -1;

  const element = el(
    "section",
    { class: "pantalla juego" },
    el(
      "div",
      { class: "escenario" },
      gameHost,
      el("div", { class: "mascota-info" }, nombre, meta, xpBar, tiempo),
    ),
    consejo,
    el("div", { class: "stats" }, ...Object.values(barras).map((b) => b.element)),
    acciones,
    fin,
  );

  return {
    element,
    sync(m, ocupado) {
      const esp = especie(m.especie);
      const d = diagnosticar(m);

      const growth = m.etapa === Etapa.Enferma || m.etapa === Etapa.Muerta ? etapaPorNivel(m.nivel) : m.etapa;
      currentStage = growth === Etapa.Adulta ? "adult" : growth === Etapa.Joven ? "teen" : "baby";
      const anim: PetAnim = !m.viva ? "dead" : m.etapa === Etapa.Enferma ? "sad" : "idle";
      idleView = { petId: m.especie, stage: currentStage, anim };
      scene ??= createPetScene(gameHost, () => {});
      if (themedPetId !== m.especie) {
        scene.setRoomColors(buildTheme(findPet(m.especie)?.theme ?? 0xe4007c).room);
        themedPetId = m.especie;
      }
      scene.show(idleView);
      nombre.textContent = m.nombre;
      meta.textContent = `${esp.nombre} · ${etiquetaEtapa(m.etapa)} · Nivel ${m.nivel} · NFT #${m.tokenId}`;
      xp.style.width = `${progresoXp(m)}%`;
      tiempo.textContent = m.viva ? `⏱️ Lleva viva ${duracionHumana(m.duracion)}` : `⏱️ Vivió ${duracionHumana(m.duracion)}`;
      consejo.textContent = d.mensaje;
      consejo.className = `consejo ${d.urgencia}`;

      barras.vida.sync(m.vida);
      barras.hambre.sync(m.hambre);
      barras.sed.sync(m.sed);
      barras.energia.sync(m.energia);
      barras.felicidad.sync(m.felicidad);
      barras.limpieza.sync(m.limpieza);

      for (const [accion, b] of Object.entries(btn) as [Accion, HTMLButtonElement][]) {
        b.disabled = ocupado || !m.viva;
        b.classList.toggle("primary", d.consejo === accion);
      }
      btnNombre.disabled = ocupado || !m.viva;

      fin.hidden = m.viva;
      if (!m.viva) finTexto.textContent = `${m.nombre} vivió ${duracionHumana(m.duracion)}. Su récord queda en el ranking.`;
    },
    react(action) {
      if (!scene) return;
      const anim: Record<Accion, PetAnim> = { alimentar: "eat", jugar: "play", dormir: "sleep", banar: "bath" };
      const icon: Record<Accion, string> = { alimentar: "🍓", jugar: "🎾", dormir: "🌙", banar: "🫧" };
      scene.show({ petId: idleView.petId, stage: currentStage, anim: anim[action] });
      scene.react(icon[action]);
      window.clearTimeout(reactionTimer);
      reactionTimer = window.setTimeout(() => scene?.show(idleView), 1400);
    },
  };
}
