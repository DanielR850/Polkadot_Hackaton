// Modal para cambiar el nombre de la mascota (una transacción).
import { boton, el } from "./dom";
import { createModal } from "./Modal";
import { createCampoNombre } from "./Nombre";

export interface ModalNombre {
  element: HTMLDialogElement;
  abrir(actual: string): void;
  sync(ocupado: boolean): void;
}

export function createModalNombre(onGuardar: (nombre: string) => Promise<boolean>): ModalNombre {
  const modal = createModal("Cambiar nombre");
  const guardar = async () => {
    if (await onGuardar(campo.input.value)) modal.cerrar();
  };
  const campo = createCampoNombre(() => void guardar());
  const btnGuardar = boton("Guardar", () => void guardar(), "btn primary");

  modal.cuerpo.append(
    el("p", { class: "ayuda", text: "Cambiar el nombre es una transacción: tendrás que aprobar la firma." }),
    campo.element,
    el("div", { class: "botones-fila" }, boton("Cancelar", () => modal.cerrar(), "btn ghost"), btnGuardar),
  );

  return {
    element: modal.element,
    abrir(actual) {
      campo.input.value = actual;
      campo.input.dispatchEvent(new Event("input"));
      modal.abrir();
      campo.input.select();
    },
    sync(ocupado) {
      btnGuardar.disabled = ocupado;
      campo.input.disabled = ocupado;
    },
  };
}
