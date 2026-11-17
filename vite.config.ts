import { defineConfig, type Plugin } from 'vite';

const DESCRIPTORES = '@parity/product-sdk-descriptors/';
const STUB = '\0descriptor-sin-usar:';

// @parity/product-sdk-chain-client importa de forma dinámica los metadatos de todas las cadenas
// aunque la app solo usa devnet-asset-hub. En el build se cambian los demás descriptores por un
// módulo vacío para que no terminen en dist (unos 4-5 MB). Igual que el taller Products Devnet.
// Solo aplica en el build: si la app llega a importar otra cadena, agrega su subruta aquí.
function soloDescriptorDevnet(): Plugin {
  return {
    name: 'solo-descriptor-devnet',
    apply: 'build',
    enforce: 'pre',
    resolveId(id) {
      if (!id.startsWith(DESCRIPTORES)) return null;
      const subruta = id.slice(DESCRIPTORES.length);
      return subruta === 'devnet-asset-hub' ? null : STUB + subruta;
    },
    load(id) {
      return id.startsWith(STUB) ? 'export {};' : null;
    },
  };
}

export default defineConfig({
  // Rutas relativas: el bundle se sirve desde un CID de Bulletin, no desde la raíz de un dominio.
  base: './',
  plugins: [soloDescriptorDevnet()],
  server: { host: '0.0.0.0', port: 5173 },
  // product-app/ es otro proyecto con sus propias dependencias; no se escanea desde aquí.
  optimizeDeps: { entries: ['index.html'] },
});
