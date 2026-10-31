// Pantalla para elegir el nombre de la mascota nueva.
import { bytesUtf8, NOMBRE_MAX_BYTES, nombreValido } from "../contract/polkapets";
import { boton, el } from "./dom";

export interface Nombre {
  element: HTMLElement;
  enfocar(valor: string): void;
}

/** Campo de nombre con contador de bytes; lo reusa el modal de cambiar nombre. */
export function createCampoNombre(alEnviar: (nombre: string) => void): {
  element: HTMLElement;
  input: HTMLInputElement;
  valido(): boolean;
} {
  const input = el("input", {
    class: "input",
    attrs: { type: "text", autocomplete: "off", spellcheck: "false", "aria-label": "Nombre de la mascota" },
  });
  const contador = el("span", { class: "contador" });
  const actualizar = () => {
    const usados = bytesUtf8(input.value.trim());
    contador.textContent = `${usados}/${NOMBRE_MAX_BYTES}`;
    contador.classList.toggle("excedido", usados > NOMBRE_MAX_BYTES);
  };
  input.addEventListener("input", actualizar);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") alEnviar(input.value);
  });
  actualizar();
  return {
    element: el("div", { class: "campo" }, input, contador),
    input,
    valido: () => nombreValido(input.value),
  };
}

export function createNombre(onSiguiente: (nombre: string) => void, onVolver: () => void): Nombre {
  const campo = createCampoNombre((n) => onSiguiente(n));
  campo.input.placeholder = "Por ejemplo: Michi";

  const element = el(
    "section",
    { class: "pantalla" },
    el("p", { class: "paso", text: "Paso 2 de 3" }),
    el("h2", { text: "¿Cómo se va a llamar?" }),
    el("p", { class: "ayuda", text: "Podrás cambiarlo después con el botón Nombre." }),
    campo.element,
    el(
      "div",
      { class: "botones-fila" },
      boton("← Volver", onVolver, "btn ghost"),
      boton("Siguiente →", () => onSiguiente(campo.input.value), "btn primary"),
    ),
  );

  return {
    element,
    enfocar(valor) {
      campo.input.value = valor;
      campo.input.dispatchEvent(new Event("input"));
      setTimeout(() => campo.input.focus(), 0);
    },
  };
}
