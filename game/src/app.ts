// Arma el DOM y conecta el hub con las pantallas. La UI solo reacciona al estado del hub.
// Cada segundo simula el paso del tiempo (engine/tiempo.ts) para que las barras bajen
// entre dos lecturas de la cadena, con la misma fórmula que el contrato.
import { createCabecera } from "./components/Cabecera";
import { createConectar } from "./components/Conectar";
import { el } from "./components/dom";
import { createEspecie } from "./components/Especie";
import { createInicio } from "./components/Inicio";
import { createJuego } from "./components/Juego";
import { createMensajes } from "./components/Mensajes";
import { createModalNombre } from "./components/ModalNombre";
import { createModalRanking } from "./components/ModalRanking";
import { createNombre } from "./components/Nombre";
import { EXPLORER_URL, PETS_ADDRESS } from "./contract/config";
import { mascotaAhora } from "./engine/tiempo";
import { createHub, leerRanking, type HubState, type Pantalla } from "./hub/hub";

export function startApp(root: HTMLElement): void {
  const hub = createHub();

  const cabecera = createCabecera(() => hub.salir());
  const mensajes = createMensajes(() => hub.limpiarMensajes());
  const ranking = createModalRanking(leerRanking);
  const abrirRanking = () => ranking.abrir(hub.getState().cuenta);
  const modalNombre = createModalNombre((n) => hub.renombrar(n));

  const inicio = createInicio(() => hub.empezar(), abrirRanking);
  const conectar = createConectar(
    (w) => void hub.conectar(w),
    () => void hub.buscarWallets(),
    () => hub.volver(),
  );
  const nombre = createNombre(
    (n) => hub.elegirNombre(n),
    () => hub.volver(),
  );
  const especieUI = createEspecie(
    (e) => void hub.adoptar(e),
    () => hub.volver(),
  );
  const juego = createJuego({
    onCuidar: (a) => void hub.cuidar(a),
    onNombre: () => modalNombre.abrir(hub.getState().mascota?.nombre ?? ""),
    onRanking: abrirRanking,
    onNuevaPartida: () => hub.nuevaPartida(),
  });

  const pantallas: Record<Pantalla, HTMLElement> = {
    inicio: inicio,
    conectar: conectar.element,
    nombre: nombre.element,
    especie: especieUI.element,
    juego: juego.element,
  };

  const contrato = el("a", {
    text: "Ver contrato en el explorador",
    attrs: { href: `${EXPLORER_URL}/address/${PETS_ADDRESS}`, target: "_blank", rel: "noopener noreferrer" },
  });
  const pie = el("footer", { class: "footer" }, el("span", { text: "Mascotas NFT (ERC-721) en Polkadot Hub TestNet · " }), contrato);
  const escena = el("main", { class: "escena" });

  root.replaceChildren(cabecera.element, mensajes.element, escena, pie, ranking.element, modalNombre.element);

  let pantallaActual: Pantalla | null = null;

  function pintarJuego(s: HubState): void {
    if (!s.mascota) return;
    const t = (performance.now() - s.leidaEn) / 1000;
    juego.sync(mascotaAhora(s.mascota, t), s.ocupado !== null);
  }

  function render(s: HubState): void {
    if (s.pantalla !== pantallaActual) {
      pantallaActual = s.pantalla;
      escena.replaceChildren(pantallas[s.pantalla]);
      if (s.pantalla === "nombre") nombre.enfocar(s.nombreNuevo);
    }
    cabecera.sync(s);
    mensajes.sync(s);
    conectar.sync(s);
    especieUI.sync(s);
    modalNombre.sync(s.ocupado !== null);
    pintarJuego(s);
  }

  hub.subscribe(render);
  setInterval(() => {
    const s = hub.getState();
    if (s.pantalla === "juego") pintarJuego(s);
  }, 1000);
}
