// Ayudas mínimas para crear DOM. Todo el texto entra con textContent: los nombres de las
// mascotas vienen de la cadena y cualquiera puede escribirlos.

type Hijo = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; text?: string; attrs?: Record<string, string> } = {},
  ...hijos: Hijo[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (props.class) e.className = props.class;
  if (props.text !== undefined) e.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) e.setAttribute(k, v);
  for (const h of hijos) if (h) e.append(h);
  return e;
}

export function boton(texto: string, onClick: () => void, clase = "btn"): HTMLButtonElement {
  const b = el("button", { class: clase, text: texto, attrs: { type: "button" } });
  b.addEventListener("click", onClick);
  return b;
}
