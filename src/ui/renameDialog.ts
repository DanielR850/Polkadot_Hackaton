import { NAME_MAX_LENGTH, validateName, type NameResult } from '../game/petState.ts';
import { createDialog, h } from './dom.ts';

/** `validate` permite reglas extra (por ejemplo, el límite en bytes del contrato). */
export function createRenameDialog(onSave: (name: string) => void, validate: (raw: string) => NameResult = validateName) {
  const { dialog, body, close } = createDialog('Cambiar nombre');
  const input = h('input', { type: 'text', class: 'name-input small', maxlength: NAME_MAX_LENGTH, autocomplete: 'off', 'aria-label': 'Nuevo nombre' });
  const error = h('p', { class: 'hint', 'aria-live': 'polite' });
  const save = h('button', { type: 'submit', class: 'primary' }, 'Guardar');
  const form = h('form', {}, input, error, h('div', { class: 'row' }, save));
  body.append(form);

  const refresh = () => {
    const result = validate(input.value);
    save.disabled = !result.ok;
    error.textContent = result.ok ? `De 1 a ${NAME_MAX_LENGTH} caracteres.` : result.error;
    error.classList.toggle('error', !result.ok);
  };
  input.addEventListener('input', refresh);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validate(input.value);
    if (!result.ok) return;
    close();
    onSave(result.value);
  });

  return {
    open(current: string) { input.value = current; refresh(); dialog.showModal(); input.select(); },
  };
}
