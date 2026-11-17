// Voz de la mascota. Lógica pura: frases cortas en primera persona, con modismos mexicanos.
// Cada situación tiene varias frases; `say` elige una que cambia con el tiempo (no en cada cuadro)
// para que la mascota no repita siempre lo mismo. Así los textos se sienten escritos por alguien,
// no generados: tono de plática, sin explicar de más y sin emoji.

export type Moment =
  | 'happy' | 'hungry' | 'thirsty' | 'sleepy' | 'bored' | 'dirty'
  | 'sleeping' | 'bath' | 'eating' | 'playing' | 'dead'
  | 'fed' | 'drank' | 'goSleep' | 'notSleepy' | 'woke' | 'wokeAlone'
  | 'bathDone' | 'bathHalf' | 'bathNone' | 'grew' | 'hello' | 'cantNow' | 'special' | 'gift' | 'noGift' | 'starved';

export const LINES: Readonly<Record<Moment, readonly string[]>> = {
  happy: ['¡Qué bonito día!', 'Aquí nomás, contento.', '¿Jugamos al rato?', 'Me caes bien, ¿eh?', 'Todo chido por aquí.'],
  hungry: ['Tengo un hambre…', 'Oye, ¿y la comida?', 'Me ruge la panza.', 'Se me antoja algo rico.'],
  thirsty: ['Tengo sed…', '¿Me das agüita?', 'Ando seco, seco.'],
  sleepy: ['Ya me dio sueñito…', 'Se me cierran los ojos.', 'Un ratito de siesta, ¿no?'],
  bored: ['Me aburro…', 'Ándale, juega conmigo.', 'No hay nada que hacer…'],
  dirty: ['Ando todo cochino.', 'Creo que ya huelo raro.', 'Un bañito no me caería mal.'],
  sleeping: ['Zzz…', 'Zzz… cinco minutitos más…', 'Zzz… soñando con tamales…'],
  bath: ['¡Burbujas!', '¡Ahí no, que me da cosquillas!', 'Tallen bien atrás de las orejas.'],
  eating: ['¡Ñam, ñam!', '¡Qué rico!', 'Mmm…'],
  playing: ['¡Otra vez, otra vez!', '¡A que no me atrapas!', '¡Esto está buenísimo!'],
  dead: ['Descansa en paz.', 'Gracias por cuidarme.'],
  fed: ['¡Gracias! Estaba buenísimo.', '¡Ay, qué rico!', 'Ya con eso aguanto.'],
  drank: ['¡Ahh, qué fresquito!', 'Ya se me quitó la sed.'],
  goSleep: ['Buenas noches…', 'Me voy a dormir. No hagas ruido.', 'A dormir se ha dicho.'],
  notSleepy: ['¿Dormir? ¡Si ando con toda la pila!', 'Todavía no tengo sueño.'],
  woke: ['¡Buenos días!', 'Ya desperté… más o menos.'],
  wokeAlone: ['¡Ya desperté! Dormí como bebé.', 'Ya descansé, ¿qué hacemos?'],
  bathDone: ['¡Quedé rechinando de limpio!', '¡Qué bien me siento!'],
  bathHalf: ['Me faltó tantito jabón…', 'Bueno, algo es algo.'],
  bathNone: ['¿Y el baño? Ni me mojaste.', 'Salí igual de cochino.'],
  grew: ['¡Mira cómo he crecido!', '¡Ya estoy más grande!'],
  hello: ['¡Hola! ¿Tú me vas a cuidar?', '¡Qué gusto conocerte!'],
  cantNow: ['Ahorita no puedo.', 'Espérame tantito.'],
  special: ['¡Esto sí es comida de verdad!', '¡Uy, me siento nuevo!'],
  gift: ['¡Un regalo! ¿Qué será?', '¡Ábrelo, ábrelo!'],
  noGift: ['Todavía no hay regalo. Cuídame otro rato.', 'Paciencia, que ya viene.'],
  starved: ['No me cuidaste a tiempo…', 'Me dejaste solito mucho rato…'],
};

/**
 * Elige una frase de la situación. `seed` cambia el orden; con el mismo seed y momento la frase es
 * la misma (por ejemplo, el seed puede ser el minuto actual para que no cambie cada segundo).
 */
export function say(moment: Moment, seed = 0): string {
  const lines = LINES[moment];
  const i = Math.abs(Math.floor(seed)) % lines.length;
  return lines[i];
}

/** Frase con el nombre de la mascota: "Ajolotito: ¡Qué rico!". */
export const sayAs = (name: string, moment: Moment, seed = 0) => `${name}: «${say(moment, seed)}»`;
