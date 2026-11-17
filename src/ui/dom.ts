// Ayudas mínimas para construir la interfaz sin framework.

type Attrs = Record<string, string | number | boolean | null | undefined>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

/** Diálogo modal nativo: el navegador maneja foco, Esc y fondo. */
export function createDialog(title: string, className = ''): { dialog: HTMLDialogElement; body: HTMLElement; close: () => void } {
  const closeButton = h('button', { type: 'button', class: 'dialog-close', 'aria-label': 'Cerrar' }, '✕');
  const body = h('div', { class: 'dialog-body' });
  const dialog = h('dialog', { class: `dialog ${className}`.trim(), 'aria-label': title },
    h('header', { class: 'dialog-header' }, h('h2', {}, title), closeButton), body);
  const close = () => dialog.close();
  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  document.body.append(dialog);
  return { dialog, body, close };
}
