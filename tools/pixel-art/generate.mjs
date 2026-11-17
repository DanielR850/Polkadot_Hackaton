// Genera el pixel art de la tienda (accesorios, paredes, pisos, muebles y adornos) y los iconos
// de los botones del juego en public/assets/. Cada PNG se puede reemplazar a mano por otro dibujo
// con el mismo nombre: este script no sobrescribe archivos que ya existen (usa --force para eso).
//
//   node tools/pixel-art/generate.mjs           crea solo los que faltan
//   node tools/pixel-art/generate.mjs --force   vuelve a crear todos
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Art, shade } from './art.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'assets');

const C = {
  ink: '#302b43', black: '#2b2b3a', white: '#ffffff', cream: '#fff3d6', bone: '#f4f1e8',
  pink: '#e4007c', rose: '#ff6fae', red: '#d7263d', orange: '#ff8c1a', yellow: '#ffd23f', gold: '#f2b530',
  green: '#2e9e4f', leaf: '#5fc46a', teal: '#00a6a6', sky: '#7fc8f8', blue: '#1f4fa3', navy: '#3b3f6b',
  purple: '#7b2d8e', wood: '#a8703f', woodDark: '#7a4e2a', woodLight: '#c0864f', clay: '#c0643c', brass: '#c9a24a',
};

/** Pinta los píxeles que cumplen `pred(x, y, color)`. */
const paintWhere = (art, pred, color) => {
  for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
    const c = art.get(x, y);
    if (pred(x, y, c)) art.set(x, y, color);
  }
  return art;
};
/** Polígono relleno (regla par-impar sobre el centro de cada píxel). */
const poly = (art, pts, color) => {
  for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) art.set(x, y, color);
  }
  return art;
};
const star = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const d = i % 2 ? r : R;
  return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
});

/* ------------------------------------------------------------ accesorios 24×24 */

const accessories = {
  sombrero() {
    const a = new Art(24, 24);
    a.rect(7, 3, 10, 14, C.black).rect(8, 4, 1, 11, '#4a4a62');
    a.rect(7, 13, 10, 3, C.red).rect(7, 13, 10, 1, '#f0566b');
    a.rect(2, 17, 20, 3, C.black).rect(3, 17, 18, 1, '#4a4a62');
    return a.outline();
  },
  mono() {
    const a = new Art(24, 24);
    a.tri(2, 7, 11, 13, 2, 20, C.rose).tri(22, 7, 13, 13, 22, 20, C.rose);
    a.line(4, 10, 8, 13, '#d6457f').line(20, 10, 16, 13, '#d6457f').line(4, 17, 8, 14, '#d6457f').line(20, 17, 16, 14, '#d6457f');
    a.set(3, 9, '#ffb3d4').set(4, 9, '#ffb3d4').set(20, 9, '#ffb3d4');
    a.rect(10, 10, 4, 6, '#d6457f').rect(10, 10, 4, 1, C.rose);
    a.rect(9, 16, 2, 5, C.rose).rect(13, 16, 2, 5, C.rose);
    return a.outline();
  },
  lentes() {
    const a = new Art(24, 24);
    a.rect(2, 10, 9, 7, C.black).rect(13, 10, 9, 7, C.black).rect(11, 11, 2, 2, C.black);
    a.rect(0, 11, 2, 1, C.black).rect(22, 11, 2, 1, C.black);
    a.rect(3, 11, 7, 5, '#34407a').rect(14, 11, 7, 5, '#34407a');
    a.rect(3, 14, 7, 2, '#5b2d6e').rect(14, 14, 7, 2, '#5b2d6e');
    for (const dx of [0, 11]) a.set(4 + dx, 12, '#cfe0ff').set(5 + dx, 12, '#cfe0ff').set(4 + dx, 13, '#cfe0ff');
    return a.outline();
  },
  flor() {
    const a = new Art(24, 24);
    a.tri(1, 19, 8, 16, 5, 23, C.green).tri(23, 19, 16, 16, 19, 23, C.green);
    for (const [x, y] of [[12, 6.5], [7, 10.5], [17, 10.5], [9, 16], [15, 16]]) a.ellipse(x, y, 3.8, 3.8, C.pink);
    for (const [x, y] of [[11, 5], [6, 9], [16, 9], [8, 15], [14, 15]]) a.set(x, y, '#ff8cc0');
    a.ellipse(12, 12, 2.6, 2.6, C.yellow).set(11, 11, C.cream);
    return a.outline();
  },
  corona() {
    const a = new Art(24, 24);
    a.tri(3, 15, 6, 5, 9, 15, C.yellow).tri(8, 15, 12, 3, 16, 15, C.yellow).tri(15, 15, 18, 5, 21, 15, C.yellow);
    a.rect(3, 14, 18, 6, C.yellow).rect(3, 18, 18, 2, '#d99a1e').rect(4, 14, 16, 1, C.cream);
    a.ellipse(6, 5, 1.6, 1.6, C.cream).ellipse(12, 3, 1.6, 1.6, C.cream).ellipse(18, 5, 1.6, 1.6, C.cream);
    a.rect(6, 15, 2, 2, C.red).rect(11, 15, 2, 2, C.blue).rect(16, 15, 2, 2, C.red);
    return a.outline();
  },
  medalla() {
    const a = new Art(24, 24);
    a.tri(5, 0, 10, 0, 12.5, 11, C.blue).tri(19, 0, 14, 0, 11.5, 11, C.red);
    a.ellipse(12, 16, 6.5, 6.5, C.yellow).ellipse(12, 16, 4.5, 4.5, C.gold);
    a.map(10, 14, ['..x..', '.xxx.', 'xxxxx', '.xxx.', '.x.x.'], { x: C.cream });
    return a.outline();
  },
  estrella() {
    const a = new Art(24, 24);
    poly(a, star(12, 12.5, 11, 4.6), C.yellow);
    poly(a, star(11, 11.5, 5.5, 2.3), C.cream);
    paintWhere(a, (x, y, c) => c === C.yellow && y > 15, C.gold);
    return a.outline();
  },
  cinta() {
    const a = new Art(24, 24);
    a.tri(8, 12, 12, 12, 5, 23, C.blue).tri(12, 12, 16, 12, 19, 23, C.blue);
    for (let i = 0; i < 12; i++) {
      const t = (i * Math.PI) / 6;
      a.ellipse(12 + Math.cos(t) * 6.5, 10 + Math.sin(t) * 6.5, 2.2, 2.2, C.red);
    }
    a.ellipse(12, 10, 6.5, 6.5, C.red).ellipse(12, 10, 4.5, 4.5, '#f0566b').ellipse(12, 10, 3, 3, C.yellow).set(11, 9, C.cream);
    return a.outline();
  },
  amuleto() {
    const a = new Art(24, 24);
    a.rect(11, 0, 2, 4, C.brass);
    a.ellipse(12, 13, 9.5, 9.5, C.blue).ellipse(12, 13, 6.5, 6.5, C.white).ellipse(12, 13, 4.2, 4.2, C.sky).ellipse(12, 13, 2.2, 2.2, '#141428');
    a.set(11, 12, C.white).set(6, 8, '#3d6fc4').set(7, 7, '#3d6fc4');
    return a.outline();
  },
  charro() {
    const a = new Art(24, 24);
    a.ellipse(12, 18, 11, 3.6, '#e8c27a').ellipse(12, 18.5, 8, 2, '#d9ac5c');
    a.ellipse(12, 11, 5, 7, '#e8c27a').rect(7, 11, 10, 6, '#e8c27a');
    a.rect(7, 14, 10, 2, C.red);
    for (const x of [8, 11, 14]) a.set(x, 14, C.yellow);
    for (let x = 3; x <= 20; x += 3) a.set(x, 19, C.red);
    a.rect(9, 6, 1, 7, '#f5dca6');
    return a.outline();
  },
  fiesta() {
    const a = new Art(24, 24);
    a.tri(12, 4, 5, 21, 19, 21, C.teal);
    paintWhere(a, (x, y, c) => c === C.teal && (y === 9 || y === 10 || y === 15 || y === 16), C.pink);
    for (const [x, y] of [[11, 7], [9, 13], [14, 12], [8, 18], [12, 18], [16, 18]]) a.set(x, y, C.yellow);
    a.rect(5, 20, 14, 2, C.yellow);
    a.ellipse(12, 3, 2.6, 2.6, C.orange).set(11, 2, C.cream);
    return a.outline();
  },
  paliacate() {
    const a = new Art(24, 24);
    a.ellipse(12, 17, 10, 8, C.red);
    paintWhere(a, (x, y) => y > 18, null);
    a.rect(2, 17, 20, 2, '#a81c2e');
    a.tri(20, 15, 24, 11, 23, 20, C.red);
    for (const [x, y] of [[7, 11], [12, 10], [17, 11], [5, 15], [10, 14], [15, 14], [19, 16], [22, 15]]) a.set(x, y, C.cream);
    return a.outline();
  },
  audifonos() {
    const a = new Art(24, 24);
    a.ellipse(12, 14, 10, 10, C.navy).ellipse(12, 14, 8, 8, null);
    paintWhere(a, (x, y) => y > 13, null);
    a.rect(1, 12, 5, 8, C.red).rect(18, 12, 5, 8, C.red);
    a.rect(2, 13, 1, 6, '#f0566b').rect(19, 13, 1, 6, '#f0566b');
    a.rect(10, 4, 4, 1, '#5d628f');
    return a.outline();
  },
  gorro() {
    const a = new Art(24, 24);
    a.ellipse(12, 15, 9, 9, C.green);
    paintWhere(a, (x, y) => y > 17, null);
    paintWhere(a, (x, y, c) => c === C.green && (y === 10 || y === 11), C.cream);
    a.rect(3, 16, 18, 4, C.yellow);
    for (let x = 4; x < 21; x += 2) a.rect(x, 16, 1, 4, '#d9a91e');
    a.ellipse(12, 5, 3.2, 3.2, C.cream).set(11, 4, C.white);
    return a.outline();
  },
  coronaFlores() {
    const a = new Art(24, 24);
    a.rect(1, 16, 22, 3, C.green);
    for (const x of [2, 8, 15, 21]) a.tri(x, 16, x + 3, 13, x + 4, 17, C.leaf);
    [[4, C.pink], [9, C.orange], [14, C.yellow], [19, C.purple]].forEach(([x, color]) => {
      a.ellipse(x + 0.5, 15, 2.8, 2.8, color);
      a.set(x, 14, C.cream);
    });
    return a.outline();
  },
  gorra() {
    const a = new Art(24, 24);
    a.ellipse(11, 17, 8.5, 8, C.blue);
    paintWhere(a, (x, y) => y > 18, null);
    a.ellipse(19, 18.5, 5.5, 2, '#173d80');
    a.rect(11, 10, 1, 9, '#173d80');
    a.set(11, 9, C.red).set(7, 13, C.yellow).set(8, 14, C.yellow).set(6, 14, C.yellow);
    a.rect(5, 12, 1, 3, '#3d6fc4');
    return a.outline();
  },
};

/* ------------------------------------------------- paredes y pisos (azulejo 16×16) */

const tile = (base) => new Art(16, 16).fill(base);

const walls = {
  rosa() {
    const a = tile('#f3a6c8');
    a.map(6, 6, ['.x.', 'xxx', '.x.'], { x: '#e07fae' });
    a.set(0, 0, '#e07fae').set(15, 0, '#e07fae').set(0, 15, '#e07fae').set(15, 15, '#e07fae');
    return a;
  },
  turquesa() { return tile('#8fd3d6').rect(0, 0, 4, 16, '#7cc4c8').rect(6, 0, 1, 16, '#a6e0e2'); },
  amarilla() {
    const a = tile('#f6c453');
    for (const [x, y] of [[4, 4], [12, 12]]) a.ellipse(x, y, 2, 2, C.orange).set(x - 1, y - 1, '#d96b0b');
    a.set(12, 4, '#e5ab3c').set(4, 12, '#e5ab3c');
    return a;
  },
  ladrillo() {
    const a = tile('#d9c7b0');
    for (let row = 0; row < 4; row++) {
      const y = row * 4, off = row % 2 ? 4 : 0;
      for (let x = -8 + off; x < 16; x += 8) {
        a.rect(x, y, 7, 3, '#b5533c').rect(x, y, 7, 1, '#c96a50');
        a.set(x + 5, y + 2, '#9c4430');
      }
    }
    return a;
  },
  floral() {
    const a = tile('#fff3d6').rect(8, 0, 1, 16, '#f3e4c2');
    a.map(2, 2, ['.p.', 'pyp', '.p.', '.g.'], { p: '#f08fb8', y: C.yellow, g: C.leaf });
    a.map(10, 10, ['.b.', 'byb', '.b.', 'g..'], { b: '#8fb8e8', y: C.yellow, g: C.leaf });
    return a;
  },
  madera() {
    const a = tile('#a8703f').rect(0, 0, 1, 16, '#7a4e2a').rect(8, 0, 1, 16, '#7a4e2a');
    for (const [x, y, h] of [[3, 2, 4], [5, 10, 3], [11, 4, 5], [13, 12, 2]]) a.rect(x, y, 1, h, '#b98250');
    a.set(2, 1, '#5b3a24').set(10, 14, '#5b3a24');
    return a;
  },
  talavera() {
    const a = tile('#f7f3ea');
    a.tri(8, 2, 14, 8, 8, 14, C.blue).tri(8, 2, 2, 8, 8, 14, C.blue);
    a.rect(6, 6, 4, 4, '#f7f3ea').rect(7, 7, 2, 2, C.yellow);
    a.rect(0, 0, 2, 2, C.blue).rect(14, 0, 2, 2, C.blue).rect(0, 14, 2, 2, C.blue).rect(14, 14, 2, 2, C.blue);
    return a;
  },
  noche() {
    const a = tile('#1f2a5a').rect(0, 8, 16, 8, '#22306a');
    for (const [x, y] of [[2, 3], [11, 1], [6, 9], [14, 12], [9, 14]]) a.set(x, y, C.cream);
    a.map(10, 5, ['.w.', 'www', '.w.'], { w: C.white });
    return a;
  },
};

const floors = {
  barro() {
    const a = tile('#c0643c').rect(0, 0, 16, 1, '#8e4428').rect(0, 8, 16, 1, '#8e4428').rect(0, 0, 1, 16, '#8e4428').rect(8, 0, 1, 16, '#8e4428');
    a.set(3, 3, '#d27a52').set(12, 5, '#d27a52').set(5, 12, '#a85432').set(13, 13, '#d27a52');
    return a;
  },
  pasto() {
    const a = tile('#6fae4f');
    for (const [x, y] of [[1, 2], [5, 6], [9, 1], [13, 4], [3, 11], [7, 13], [11, 9], [14, 14]]) {
      a.rect(x, y, 1, 2, '#4f8f37').set(x + 1, y - 1, '#8fd06a');
    }
    return a;
  },
  piedra() {
    const a = tile('#6f747c');
    a.ellipse(4, 4, 3.5, 3, '#a9afb7').ellipse(12, 4, 3.5, 3, '#9399a2').ellipse(8, 12, 4, 3, '#a1a7af');
    a.ellipse(0, 12, 3, 3, '#9399a2').ellipse(16, 12, 3, 3, '#9399a2');
    a.set(3, 3, '#c3c8cf').set(11, 3, '#b4bac2').set(7, 11, '#c3c8cf');
    return a;
  },
  duela() {
    const a = tile('#d9a86c');
    for (const y of [3, 7, 11, 15]) a.rect(0, y, 16, 1, '#b07f48');
    a.rect(5, 0, 1, 3, '#b07f48').rect(12, 4, 1, 3, '#b07f48').rect(2, 8, 1, 3, '#b07f48').rect(9, 12, 1, 3, '#b07f48');
    a.rect(8, 1, 2, 1, '#e6bb84').rect(1, 5, 3, 1, '#e6bb84').rect(11, 9, 2, 1, '#e6bb84');
    return a;
  },
  ajedrez() { return tile('#f4f1e8').rect(0, 0, 8, 8, '#3a3550').rect(8, 8, 8, 8, '#3a3550'); },
  mosaico() {
    const a = tile('#f7f3ea');
    for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16]]) a.ellipse(x, y, 5, 5, C.blue).ellipse(x, y, 3, 3, '#f7f3ea').ellipse(x, y, 1.5, 1.5, C.orange);
    a.rect(7, 7, 2, 2, C.blue);
    return a;
  },
  arena() {
    const a = tile('#e9cf94');
    for (const [x, y] of [[2, 3], [9, 2], [13, 7], [5, 9], [11, 13], [1, 14]]) a.set(x, y, '#d4b26c');
    for (const [x, y] of [[6, 4], [14, 11], [3, 12]]) a.set(x, y, '#f6e2b2');
    a.map(8, 7, ['ss', 'ss'], { s: '#f2b8a0' });
    return a;
  },
};

/* --------------------------------------------------------- muebles 32×32 (en el piso) */

const furniture = {
  sillon() {
    const a = new Art(32, 32), c = '#2a9d8f';
    a.rect(4, 9, 24, 11, c).rect(5, 9, 22, 1, shade(c, 1.35)).rect(16, 10, 1, 9, shade(c, 0.8));
    a.rect(1, 14, 6, 12, shade(c, 0.85)).rect(25, 14, 6, 12, shade(c, 0.85)).rect(1, 14, 6, 1, shade(c, 1.3)).rect(25, 14, 6, 1, shade(c, 1.3));
    a.rect(7, 19, 18, 5, shade(c, 1.2)).rect(16, 19, 1, 5, c);
    a.rect(3, 24, 26, 3, shade(c, 0.7));
    a.rect(4, 27, 2, 3, C.woodDark).rect(26, 27, 2, 3, C.woodDark);
    return a.outline();
  },
  silla() {
    const a = new Art(32, 32);
    a.rect(8, 3, 2, 27, C.wood).rect(22, 3, 2, 27, C.wood);
    a.rect(10, 4, 12, 3, C.woodLight).rect(10, 9, 12, 2, C.woodLight).rect(10, 13, 12, 2, C.woodLight);
    a.rect(6, 18, 20, 4, C.woodLight).rect(6, 18, 20, 1, '#d9a06a');
    a.rect(7, 16, 18, 2, C.red).rect(8, 16, 16, 1, '#f0566b');
    a.rect(10, 26, 12, 1, C.woodDark);
    return a.outline();
  },
  planta() {
    const a = new Art(32, 32);
    a.ellipse(9, 13, 4, 6.5, C.green).ellipse(23, 13, 4, 6.5, C.green).ellipse(16, 9, 4.5, 8, C.green);
    a.ellipse(12, 17, 3, 4, '#3cb35c').ellipse(20, 17, 3, 4, '#3cb35c');
    a.line(16, 3, 16, 16, C.leaf).line(9, 9, 10, 17, C.leaf).line(23, 9, 22, 17, C.leaf);
    a.rect(11, 22, 10, 8, C.clay).rect(9, 20, 14, 3, '#d27a52').rect(12, 23, 1, 6, '#d27a52');
    return a.outline();
  },
  cactus() {
    const a = new Art(32, 32);
    a.rect(13, 6, 6, 16, C.green).ellipse(16, 6, 3, 3, C.green);
    a.rect(8, 10, 3, 8, C.green).rect(8, 16, 6, 3, C.green).ellipse(9.5, 10, 1.5, 1.5, C.green);
    a.rect(21, 7, 3, 8, C.green).rect(18, 13, 6, 3, C.green).ellipse(22.5, 7, 1.5, 1.5, C.green);
    a.rect(15, 5, 1, 17, '#237a3c').rect(14, 6, 1, 15, C.leaf);
    for (const [x, y] of [[13, 9], [18, 12], [13, 15], [18, 18], [8, 13], [23, 10]]) a.set(x, y, C.cream);
    a.ellipse(16, 3, 2, 1.5, C.pink);
    a.rect(10, 23, 12, 7, C.bone).rect(9, 21, 14, 2, '#e5e0d3').rect(10, 25, 12, 2, C.blue).set(15, 28, C.yellow).set(12, 28, C.blue).set(19, 28, C.blue);
    return a.outline();
  },
  lampara() {
    const a = new Art(32, 32), s = C.orange;
    a.rect(11, 5, 10, 10, s).tri(11, 5, 11, 15, 7, 15, s).tri(21, 5, 21, 15, 25, 15, s);
    a.rect(8, 14, 16, 2, '#d96b0b').rect(9, 16, 14, 1, '#ffe9a0').rect(13, 6, 1, 7, '#ffb15e');
    a.rect(15, 17, 2, 8, C.brass);
    a.rect(10, 25, 12, 3, C.brass).rect(11, 25, 10, 1, '#e0c27a').rect(8, 28, 16, 2, '#9c7c34');
    return a.outline();
  },
  cama() {
    const a = new Art(32, 32);
    a.rect(2, 7, 6, 21, C.wood).ellipse(5, 7, 3, 3, C.wood).rect(3, 9, 1, 17, C.woodLight);
    a.rect(26, 14, 4, 14, C.wood).rect(27, 15, 1, 12, C.woodLight);
    a.rect(8, 16, 18, 7, C.cream).ellipse(11, 15, 3.5, 2.2, C.white);
    a.rect(14, 15, 12, 8, C.blue).rect(14, 18, 12, 1, C.yellow).rect(14, 21, 12, 1, C.pink);
    a.rect(8, 23, 18, 3, C.woodDark);
    a.rect(3, 28, 2, 2, C.woodDark).rect(27, 28, 2, 2, C.woodDark);
    return a.outline();
  },
  puff() {
    const a = new Art(32, 32), c = C.purple;
    a.ellipse(16, 22, 12.5, 8, c).ellipse(16, 17, 11.5, 4.5, '#9b4fb0');
    paintWhere(a, (x, y) => y > 29, null);
    a.line(8, 21, 10, 27, shade(c, 0.75)).line(24, 21, 22, 27, shade(c, 0.75)).rect(16, 21, 1, 8, shade(c, 0.75));
    a.ellipse(16, 17, 1.5, 1, C.yellow).rect(10, 15, 4, 1, '#c27ad6');
    return a.outline();
  },
  hamaca() {
    const a = new Art(32, 32);
    a.rect(1, 3, 3, 27, C.woodDark).rect(28, 3, 3, 27, C.woodDark).rect(2, 4, 1, 25, C.wood).rect(29, 4, 1, 25, C.wood);
    const colors = [C.pink, C.orange, C.yellow, C.green, C.teal, C.purple];
    for (let x = 6; x <= 25; x++) {
      const y = 11 + Math.round(7 * Math.sin((Math.PI * (x - 6)) / 19));
      a.rect(x, y, 1, 4, colors[Math.floor((x - 6) / 3) % colors.length]);
      if (x % 2 === 0) a.set(x, y + 4, C.cream);
    }
    a.line(4, 6, 6, 11, C.brass).line(27, 6, 25, 11, C.brass);
    return a.outline();
  },
  mesita() {
    const a = new Art(32, 32);
    a.rect(3, 15, 26, 3, C.woodLight).rect(3, 15, 26, 1, '#d9a06a');
    a.rect(5, 18, 22, 3, C.wood).rect(7, 21, 2, 9, C.wood).rect(23, 21, 2, 9, C.wood);
    a.rect(10, 13, 12, 2, C.pink).rect(10, 13, 12, 1, C.rose);
    a.rect(19, 8, 5, 5, C.clay).rect(24, 9, 1, 3, C.clay).rect(19, 8, 5, 1, '#d27a52');
    a.ellipse(10, 12, 3.5, 1.6, C.cream).ellipse(9, 10.5, 1.5, 1.5, C.red).ellipse(11.5, 10.5, 1.5, 1.5, C.orange);
    return a.outline();
  },
  librero() {
    const a = new Art(32, 32);
    a.rect(5, 2, 22, 28, C.woodDark).rect(7, 4, 18, 24, '#5b3a24');
    a.rect(7, 11, 18, 2, C.wood).rect(7, 19, 18, 2, C.wood);
    const colors = [C.red, C.blue, C.yellow, C.green, C.purple, C.orange, C.teal, C.pink, C.cream];
    let i = 0;
    for (const [top, bottom] of [[4, 11], [13, 19], [21, 28]]) {
      for (let x = 8; x < 24; x += 2) {
        const h = bottom - top - (i * 7) % 3;
        if ((i * 5) % 7 !== 3) a.rect(x, bottom - h, 2, h, colors[i % colors.length]).set(x, bottom - h + 1, shade(colors[i % colors.length], 1.4));
        i++;
      }
    }
    return a.outline();
  },
  tele() {
    const a = new Art(32, 32);
    a.line(13, 8, 8, 1, C.ink).line(18, 8, 23, 1, C.ink).set(8, 1, C.red).set(23, 1, C.red);
    a.rect(3, 8, 26, 17, C.wood).rect(4, 9, 24, 1, C.woodLight);
    a.rect(5, 10, 16, 13, C.navy).rect(6, 11, 14, 11, '#4b6aa8');
    a.set(5, 10, C.wood).set(20, 10, C.wood).set(5, 22, C.wood).set(20, 22, C.wood);
    a.rect(7, 12, 3, 1, C.sky).rect(7, 13, 1, 2, C.sky);
    a.ellipse(24.5, 13, 1.6, 1.6, C.yellow).ellipse(24.5, 18, 1.6, 1.6, C.yellow);
    a.rect(23, 21, 4, 1, C.woodDark).rect(23, 23, 4, 1, C.woodDark);
    a.rect(6, 25, 2, 5, C.woodDark).rect(24, 25, 2, 5, C.woodDark);
    return a.outline();
  },
  lamparaPie() {
    const a = new Art(32, 32), s = '#f6c453';
    a.rect(12, 2, 8, 8, s).tri(12, 2, 12, 10, 8, 10, s).tri(20, 2, 20, 10, 24, 10, s);
    a.rect(10, 4, 12, 1, C.pink).rect(9, 7, 14, 1, C.pink);
    a.rect(8, 10, 16, 1, '#d99a1e').rect(10, 11, 12, 1, '#ffe9a0');
    a.rect(15, 11, 2, 17, C.brass).rect(16, 12, 1, 15, '#e0c27a');
    a.rect(10, 28, 12, 2, '#9c7c34').rect(12, 27, 8, 1, C.brass);
    return a.outline();
  },
  girasol() {
    const a = new Art(32, 32);
    a.rect(15, 12, 2, 10, C.green).ellipse(12, 17, 3.5, 1.6, C.leaf).ellipse(20, 15, 3.5, 1.6, C.leaf);
    for (let i = 0; i < 10; i++) {
      const t = (i * Math.PI) / 5;
      a.ellipse(16 + Math.cos(t) * 5.5, 8 + Math.sin(t) * 5.5, 2.4, 2.4, C.yellow);
    }
    a.ellipse(16, 8, 5, 5, '#f2a81d').ellipse(16, 8, 3.5, 3.5, C.woodDark);
    for (const [x, y] of [[15, 7], [17, 8], [15, 9]]) a.set(x, y, '#5b3a24');
    a.rect(11, 23, 10, 7, C.clay).rect(10, 21, 12, 3, '#d27a52').rect(12, 24, 1, 5, '#d27a52');
    return a.outline();
  },
};

/* --------------------------------------------------------- adornos 24×24 (en la pared) */

const decor = {
  cuadro() {
    const a = new Art(24, 24);
    a.rect(2, 4, 20, 16, C.brass).rect(2, 4, 20, 1, '#e0c27a');
    a.rect(4, 6, 16, 12, C.sky).rect(4, 6, 16, 3, '#a8dcfb');
    a.tri(4, 18, 10, 9, 16, 18, C.green).tri(10, 18, 15, 11, 20, 18, '#237a3c');
    a.ellipse(16.5, 9, 2, 2, C.yellow);
    return a.outline();
  },
  reloj() {
    const a = new Art(24, 24);
    a.ellipse(12, 12, 10.5, 10.5, C.wood).ellipse(12, 12, 8.5, 8.5, C.cream);
    for (const [x, y] of [[12, 5], [19, 12], [12, 19], [5, 12]]) a.set(x - 0.5 + 0.5, y, C.ink);
    a.line(12, 12, 12, 7, C.ink).line(12, 12, 16, 12, C.ink).set(12, 12, C.red);
    a.set(6, 5, C.woodLight).set(5, 6, C.woodLight);
    return a.outline();
  },
  calavera() {
    const a = new Art(24, 24);
    a.ellipse(12, 10, 8.5, 8.5, C.bone).rect(7, 13, 10, 7, C.bone);
    a.ellipse(8.5, 11, 2.6, 2.6, C.pink).ellipse(15.5, 11, 2.6, 2.6, C.teal);
    a.ellipse(8.5, 11, 1.2, 1.2, C.ink).ellipse(15.5, 11, 1.2, 1.2, C.ink);
    a.tri(12, 13, 10.5, 16, 13.5, 16, C.ink);
    for (let x = 8; x <= 15; x += 2) a.set(x, 18, C.ink);
    a.rect(8, 17, 8, 1, '#d8d2c4');
    a.map(10, 3, ['.y.', 'yoy', '.y.'], { y: C.yellow, o: C.orange });
    a.set(6, 6, C.green).set(17, 6, C.green).set(5, 7, C.pink).set(18, 7, C.pink);
    return a.outline();
  },
  poster() {
    const a = new Art(24, 24);
    a.rect(3, 2, 18, 20, C.pink).rect(3, 2, 18, 1, '#ff4fa6');
    for (let i = 0; i < 6; i++) {
      const t = -Math.PI / 2 + (i * Math.PI) / 3;
      a.ellipse(12 + Math.cos(t) * 5.5, 12 + Math.sin(t) * 5.5, 1.9, 1.9, C.white);
    }
    a.rect(2, 1, 3, 2, C.cream).rect(19, 1, 3, 2, C.cream);
    return a.outline();
  },
  espejo() {
    const a = new Art(24, 24);
    a.ellipse(12, 12.5, 8.5, 11, C.brass).ellipse(12, 12.5, 6.5, 9, '#bfe6f0');
    a.rect(12, 4, 6, 18, '#a7d8e6');
    a.ellipse(12, 12.5, 6.5, 9, null);
    a.ellipse(12, 12.5, 6.5, 9, '#bfe6f0');
    paintWhere(a, (x, y, c) => c === '#bfe6f0' && x + y > 26, '#a7d8e6');
    a.line(8, 9, 10, 7, C.white).line(8, 12, 12, 8, C.white);
    a.set(12, 1, C.yellow).set(11, 2, C.yellow).set(13, 2, C.yellow);
    return a.outline();
  },
  florero() {
    const a = new Art(24, 24);
    a.line(9, 6, 11, 12, C.green).line(15, 6, 13, 12, C.green).line(12, 4, 12, 12, C.green);
    a.ellipse(8.5, 5, 2.2, 2.2, C.pink).ellipse(15.5, 5, 2.2, 2.2, C.orange).ellipse(12, 2.8, 2.2, 2.2, C.yellow);
    a.rect(10, 10, 4, 3, C.blue).ellipse(12, 15.5, 4.5, 4, C.blue).rect(8, 14, 8, 1, C.white).set(10, 13, '#3d6fc4');
    a.rect(2, 19, 20, 2, C.wood).rect(2, 19, 20, 1, C.woodLight).rect(4, 21, 2, 2, C.woodDark).rect(18, 21, 2, 2, C.woodDark);
    return a.outline();
  },
  velas() {
    const a = new Art(24, 24);
    a.rect(5, 12, 4, 8, C.cream).rect(10, 8, 4, 12, C.cream).rect(15, 13, 4, 7, C.cream);
    a.rect(5, 12, 1, 8, C.white).rect(10, 8, 1, 12, C.white).rect(15, 13, 1, 7, C.white);
    for (const [x, y] of [[7, 9.5], [12, 5.5], [17, 10.5]]) a.ellipse(x, y, 1.4, 2.2, C.orange).set(x - 0.5, y, C.yellow);
    a.rect(2, 20, 20, 2, C.brass).rect(2, 20, 20, 1, '#e0c27a');
    for (const x of [3, 9, 14, 20]) a.set(x, 19, C.orange).set(x + 1, 19, '#ffb15e');
    return a.outline();
  },
  foquitos() {
    const a = new Art(24, 24);
    const colors = [C.pink, C.yellow, C.teal, C.orange, C.green];
    let prev = null;
    for (let x = 0; x < 24; x++) {
      const y = 5 + Math.round(5 * Math.sin((Math.PI * x) / 23));
      if (prev !== null) a.line(x - 1, prev, x, y, C.ink); else a.set(x, y, C.ink);
      prev = y;
    }
    [3, 8, 12, 16, 21].forEach((x, i) => {
      const y = 5 + Math.round(5 * Math.sin((Math.PI * x) / 23));
      a.rect(x, y + 1, 1, 1, C.ink);
      a.ellipse(x + 0.5, y + 4, 1.8, 2.3, colors[i]).set(x, y + 3, C.white);
    });
    return a.outline();
  },
};

/* ---------------------------------------------------------------- iconos 16×16 */

const icons = {
  shop() {
    const a = new Art(16, 16);
    a.rect(2, 7, 12, 7, '#f6c453').rect(6, 9, 4, 5, C.woodDark).rect(3, 9, 2, 2, C.sky).rect(11, 9, 2, 2, C.sky);
    for (let x = 1; x < 15; x++) a.rect(x, 2, 1, 4, Math.floor((x - 1) / 2) % 2 ? C.cream : C.red);
    for (let x = 1; x < 15; x += 2) a.set(x, 6, Math.floor((x - 1) / 2) % 2 ? C.cream : C.red);
    return a.outline();
  },
  accessories() {
    const a = new Art(16, 16);
    a.rect(4, 2, 8, 8, C.black).rect(5, 3, 1, 5, '#4a4a62').rect(4, 7, 8, 2, C.red);
    a.rect(1, 10, 14, 2, C.black).rect(2, 10, 12, 1, '#4a4a62');
    return a.outline();
  },
  space() {
    const a = new Art(16, 16);
    a.tri(8, 1, 0.5, 8, 15.5, 8, C.red).rect(3, 8, 10, 6, C.cream).rect(7, 10, 3, 4, C.woodDark).rect(4, 9, 2, 2, C.sky).rect(11, 9, 1, 1, C.sky);
    a.rect(11, 2, 2, 3, C.clay);
    return a.outline();
  },
  trophies() {
    const a = new Art(16, 16);
    a.rect(4, 1, 8, 5, C.yellow).ellipse(8, 6, 4, 3, C.yellow);
    a.rect(2, 2, 2, 1, C.yellow).rect(1, 2, 1, 3, C.yellow).rect(12, 2, 2, 1, C.yellow).rect(14, 2, 1, 3, C.yellow);
    a.rect(7, 9, 2, 3, '#d99a1e').rect(5, 12, 6, 2, '#d99a1e').rect(5, 2, 1, 4, C.cream);
    return a.outline();
  },
};

/* ------------------------------------------------------------------- escribir */

const groups = [
  ['items/accessories', accessories], ['items/walls', walls], ['items/floors', floors],
  ['items/furniture', furniture], ['items/decor', decor], ['ui/icons', icons],
];
const kebab = (s) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
const force = process.argv.includes('--force');
let made = 0, kept = 0;
for (const [dir, sprites] of groups) {
  mkdirSync(join(ROOT, dir), { recursive: true });
  for (const [name, draw] of Object.entries(sprites)) {
    const file = join(ROOT, dir, `${kebab(name)}.png`);
    if (existsSync(file) && !force) { kept++; continue; }
    writeFileSync(file, draw().png());
    made++;
  }
}
console.log(`Pixel art: ${made} creados, ${kept} ya existían (sin cambios).`);
