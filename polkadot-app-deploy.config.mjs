// Publicación con icono y manifest (taller Products Devnet, capítulo 6).
// El dominio sale de la variable APP_DOT: pad sube a un nombre temporal y después el CID se pega
// a mano en polka-pets.dot desde dotns.dot (ver docs/PUBLICACION.md). Nunca pasar polka-pets.dot a pad.
export default {
  domain: process.env.APP_DOT,
  displayName: 'PolkaPets',
  description: 'Adopta un ajolote NFT en Polkadot y cuídalo: comida, juego, sueño y baño guardados en la blockchain.',
  icon: { path: './assets/icono.png', format: 'png' },
  executables: [{ kind: 'app', path: './dist', appVersion: [1, 0, 0] }],
};
