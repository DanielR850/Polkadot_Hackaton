import { NAME_MAX_LENGTH, validateName } from '../game/petState.ts';
import { createDialog, h } from './dom.ts';

export function createRenameDialog(onSave: (name: string) => void) {
  const { dialog, body, close } = createDialog('Cambiar nombre');
  const input = h('input', { type: 'text', class: 'name-input small', maxlength: NAME_MAX_LENGTH, autocomplete: 'off', 'aria-label': 'Nuevo nombre' });
  const error = h('p', { class: 'hint', 'aria-live': 'polite' });
  const save = h('button', { type: 'submit', class: 'primary' }, 'Guardar');
  const form = h('form', {}, input, error, h('div', { class: 'row' }, save));
  body.append(form);

  const refresh = () => {
    const result = validateName(input.value);
    save.disabled = !result.ok;
    error.textContent = result.ok ? `De 1 a ${NAME_MAX_LENGTH} caracteres.` : result.error;
    error.classList.toggle('error', !result.ok);
  };
  input.addEventListener('input', refresh);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const result = validateName(input.value);
    if (!result.ok) return;
    close();
    onSave(result.value);
  });

  return {
    open(current: string) { input.value = current; refresh(); dialog.showModal(); input.select(); },
  };
}
