// Tema de color derivado de la mascota elegida (teoría del color):
// - Principal: el tono de la mascota, con saturación y luz ajustadas para botones legibles.
// - Análogos: fondo, paneles y tinta usan el mismo tono, muy suaves, para que todo combine.
// - Complementario: el tono opuesto (+180°) solo para detalles pequeños (destellos, foco).
// Las barras conservan verde, amarillo y rojo: son señales de estado, no decoración.

export interface Hsl { h: number; s: number; l: number }

export interface Theme {
  vars: Record<string, string>;
  /** Colores del canvas (Phaser usa números 0xRRGGBB). */
  room: { wall: number; stripe: number };
}

const WHITE = 0xffffff;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function hexToHsl(color: number): Hsl {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): number {
  const sat = clamp(s, 0, 100) / 100;
  const lig = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255);
  return (to(r) << 16) | (to(g) << 8) | to(b);
}

export const toCss = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

function luminance(color: number): number {
  const channel = (shift: number) => {
    const v = ((color >> shift) & 255) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
}

/** Contraste WCAG entre dos colores (1 a 21). 4.5 es el mínimo para texto normal. */
export function contrastRatio(a: number, b: number): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Cempasúchil: tema de las pantallas antes de elegir mascota. */
export const DEFAULT_THEME_COLOR = 0xf2a900;

export function buildTheme(petColor: number): Theme {
  const { h, s } = hexToHsl(petColor);
  // Estilo maximalista: colores saturados aunque la mascota sea casi gris (lobo, manatí).
  const sat = clamp(s, 60, 92);
  const soft = clamp(s, 55, 80);
  const ink = hslToHex({ h, s: 30, l: 13 });
  // Botones con contraste WCAG ≥ 4.5. Los tonos claros (amarillo, naranja, turquesa) se quedan
  // brillantes con texto oscuro; los demás se oscurecen hasta que el texto blanco se lea bien.
  let accentL = 44;
  const bright = hslToHex({ h, s: sat, l: accentL });
  const darkText = contrastRatio(ink, bright) >= 4.5 && contrastRatio(ink, bright) > contrastRatio(WHITE, bright);
  if (!darkText) {
    while (accentL > 20 && contrastRatio(WHITE, hslToHex({ h, s: sat, l: accentL })) < 4.5) accentL -= 1;
  }
  const accent = hslToHex({ h, s: sat, l: accentL });
  const onAccent = darkText ? ink : WHITE;
  const complement = hslToHex({ h: (h + 180) % 360, s: 85, l: 50 });
  return {
    vars: {
      '--accent': toCss(accent),
      '--accent-light': toCss(hslToHex({ h, s: sat, l: accentL + 16 })),
      '--accent-dark': toCss(hslToHex({ h, s: sat, l: accentL - 16 })),
      '--accent-soft': toCss(hslToHex({ h, s: soft + 25, l: 87 })),
      '--on-accent': toCss(onAccent),
      '--complement': toCss(complement),
      '--ink': toCss(ink),
      '--muted': toCss(hslToHex({ h, s: 18, l: 34 })),
      // Fondo con azulejo de talavera: dos tonos del color de la mascota.
      '--bg': toCss(hslToHex({ h, s: soft, l: 70 })),
      '--bg-dot': toCss(hslToHex({ h, s: soft, l: 58 })),
      '--tile': toCss(hslToHex({ h, s: sat, l: 40 })),
      '--panel': toCss(hslToHex({ h: (h + 30) % 360, s: 85, l: 95 })),
      '--panel-2': toCss(hslToHex({ h, s: soft, l: 86 })),
      '--frame': toCss(hslToHex({ h, s: soft, l: 78 })),
    },
    room: {
      wall: hslToHex({ h, s: soft * 0.8, l: 80 }),
      stripe: hslToHex({ h, s: soft * 0.8, l: 73 }),
    },
  };
}

/** Aplica el tema en la página y en la barra del navegador móvil. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(theme.vars)) root.style.setProperty(name, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.vars['--bg']);
}
