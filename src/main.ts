// Controlador: interpreta las intenciones de la interfaz, aplica las reglas del juego y actualiza
// la escena y las pantallas. Todo es local; ninguna acción pide firma (ver README).
import './style.css';
import { pickAnimation, type PetAnim } from './game/animations.ts';
import { findItem } from './game/catalog.ts';
import { DEFAULT_CONFIG, withSpeed } from './game/config.ts';
import { createPetScene, type PetSceneHandle } from './game/petScene.ts';
import {
  ageMs, bathe, computeStage, computeStats, createPet, detectStageChange, feed, isDead, lowNeeds,
  markDeadIfNeeded, play, rename, sleep, wake,
} from './game/petState.ts';
import { createMockRanking } from './game/ranking.ts';
import { loadPet, savePet } from './game/storage.ts';
import type { NeedKey, PetState, Stage } from './game/types.ts';
import { h } from './ui/dom.ts';
import { createFeedMenu } from './ui/feedMenu.ts';
import { formatDuration, STAGE_LABEL } from './ui/format.ts';
import { createGameScreen, type GameMode } from './ui/gameScreen.ts';
import { createRankingDialog } from './ui/rankingDialog.ts';
import { createRenameDialog } from './ui/renameDialog.ts';
import { createSelectScreen } from './ui/selectScreen.ts';
import { createStartScreen } from './ui/startScreen.ts';

const params = new URLSearchParams(location.search);
// `?speed=10` acelera el tiempo para probar etapas y muerte en la demo.
const config = withSpeed(DEFAULT_CONFIG, Number(params.get('speed') ?? 1));
const app = document.querySelector<HTMLElement>('#app')!;
const ACTION_MS = 1200;

type Screen = 'start' | 'select' | 'game';

let pet: PetState | null = loadPet();
let draftName = '';
let bathing = false;
let bathProgress = 0;
let action: { anim: 'eat' | 'play'; until: number } | null = null;
let lastStage: Stage | null = null;
let scene: PetSceneHandle | null = null;
let screen: Screen = 'start';

const startScreen = createStartScreen((name) => { draftName = name; showScreen('select'); });

const selectScreen = createSelectScreen((petId) => {
  pet = createPet(petId, draftName, Date.now());
  savePet(pet);
  lastStage = 'baby';
  showScreen('game');
  gameScreen.say(`¡Hola, ${pet.name}! Te toca cuidar de tu nueva mascota.`);
}, () => showScreen('start'));

const gameScreen = createGameScreen({
  feed: () => feedMenu.open(),
  play: () => withPet((p, now) => commit(play(p, now, config), '¡Se divirtió muchísimo jugando contigo!', { anim: 'play', icon: '🎾' })),
  sleep: () => withPet((p, now) => commit(sleep(p, now, config), 'Shhh… está durmiendo.')),
  wake: () => withPet((p, now) => commit(wake(p, now, config), '¡Buenos días! Ya despertó.')),
  bath: () => {
    bathing = true;
    bathProgress = 0;
    scene?.resetBath();
    gameScreen.say('¡Hora del baño!');
    render();
  },
  exitBath: () => withPet((p, now) => {
    const progress = bathProgress;
    bathing = false;
    bathProgress = 0;
    scene?.resetBath();
    const message = progress === 0 ? 'Salió del baño sin enjabonarse.' : progress < 50 ? 'Le faltó un poco de jabón.' : '¡Quedó reluciente!';
    commit(bathe(p, progress, now, config), message);
  }),
  rename: () => { if (pet) renameDialog.open(pet.name); },
  ranking: () => rankingDialog.open(),
  restart: () => {
    pet = null;
    savePet(null);
    bathing = false;
    action = null;
    startScreen.reset();
    showScreen('start');
  },
});

const feedMenu = createFeedMenu((itemId) => withPet((p, now) => {
  const item = findItem(itemId);
  if (!item) return;
  commit(feed(p, itemId, now, config), `¡Qué rico! Le diste ${item.label.toLowerCase()}.`, { anim: 'eat', icon: item.icon });
}));

const renameDialog = createRenameDialog((name) => withPet((p, now) => commit(rename(p, name, now, config), `Ahora se llama ${name}.`)));

const rankingDialog = createRankingDialog(createMockRanking(() => pet
  ? { id: 'me', petName: pet.name, petId: pet.petId, aliveMs: ageMs(pet, Date.now()), isMine: true }
  : null));

function withPet(fn: (p: PetState, now: number) => void) {
  if (pet) fn(pet, Date.now());
}

/** Guarda el estado nuevo de una acción y lanza su animación breve. */
function commit(next: PetState, message: string, reaction?: { anim: 'eat' | 'play'; icon: string }) {
  if (next === pet) { gameScreen.say('Ahora no puede hacer eso.'); render(); return; }
  pet = next;
  savePet(pet);
  if (reaction) {
    action = { anim: reaction.anim, until: Date.now() + ACTION_MS };
    scene?.react(reaction.icon);
    // Reactiva los botones justo al terminar la animación, sin esperar al siguiente segundo.
    window.setTimeout(render, ACTION_MS + 20);
  }
  gameScreen.say(message);
  render();
}

const MOOD: Partial<Record<PetAnim, { icon: string; text: string }>> = {
  dead: { icon: '🕊️', text: 'Descansa en paz.' },
  sleep: { icon: '☾', text: 'Zzz… está soñando.' },
  bath: { icon: '🫧', text: '¡Burbujas por todas partes!' },
  eat: { icon: '😋', text: '¡Ñam, ñam!' },
  play: { icon: '😄', text: '¡Otra vez, otra vez!' },
};
const NEED_MOOD: Record<NeedKey, string> = {
  hunger: 'Tengo hambre…', thirst: 'Tengo sed…', energy: 'Tengo sueño…', happiness: 'Quiero jugar…', cleanliness: 'Necesito un baño…',
};

function render() {
  if (!pet || screen !== 'game') return;
  const now = Date.now();
  const stats = computeStats(pet, now, config);
  const stage = computeStage(pet, now, config);
  const dead = isDead(pet, now, config);
  const low = lowNeeds(stats, config);
  const anim = pickAnimation({ dead, sleeping: pet.sleeping, bathing, action, low, now });
  const mode: GameMode = dead ? 'dead' : pet.sleeping ? 'sleep' : bathing ? 'bath' : 'normal';
  const mood = MOOD[anim] ?? (low.length ? { icon: '☹', text: NEED_MOOD[low[0]] } : { icon: '☺', text: '¡Qué bonito día!' });
  gameScreen.update({
    name: pet.name, stageLabel: STAGE_LABEL[stage], ageLabel: formatDuration(ageMs(pet, now)),
    stats, mode, bathProgress, mood, busy: action !== null && now < action.until,
  });
  scene?.show({ petId: pet.petId, stage, anim });
}

/** Cada segundo: detecta muerte y cambio de etapa, y refresca las barras. */
function tick() {
  if (!pet || screen !== 'game') return;
  const now = Date.now();
  const checked = markDeadIfNeeded(pet, now, config);
  if (checked !== pet) {
    pet = checked;
    savePet(pet);
    bathing = false;
    gameScreen.say(`${pet.name} no recibió los cuidados que necesitaba.`);
  }
  const stage = computeStage(pet, now, config);
  const grown = lastStage ? detectStageChange(lastStage, stage) : null;
  if (grown && pet.diedAt === null) gameScreen.showToast(`¡${pet.name} creció a ${STAGE_LABEL[grown].toLowerCase()}!`);
  lastStage = stage;
  if (action && now >= action.until) action = null;
  render();
}

function showScreen(next: Screen) {
  screen = next;
  startScreen.root.hidden = next !== 'start';
  selectScreen.root.hidden = next !== 'select';
  gameScreen.root.hidden = next !== 'game';
  if (next === 'start') startScreen.focus();
  if (next === 'select') selectScreen.reset(draftName);
  if (next === 'game') {
    // Phaser se crea cuando su contenedor ya es visible, para que mida bien el tamaño.
    scene ??= createPetScene(gameScreen.gameHost, (progress) => { bathProgress = progress; render(); });
    if (pet) lastStage = computeStage(pet, Date.now(), config);
    render();
  }
}

if (params.get('outside') === '1') {
  // Vista previa del aviso para cuando la app se abra fuera de un Host. La detección real
  // (`isInsideContainer()` del Product SDK) se conectará después desde src/polkadot/.
  app.replaceChildren(h('section', { class: 'screen start-screen' },
    h('span', { class: 'eyebrow' }, 'POLKADOT'), h('h1', { class: 'title' }, 'Abre esta app dentro de Polkadot Desktop o de la Polkadot App'),
    h('p', { class: 'hint' }, 'El juego necesita el Host de Polkadot para guardar tus logros.')));
} else {
  app.append(startScreen.root, selectScreen.root, gameScreen.root);
  startScreen.reset();
  showScreen(pet ? 'game' : 'start');
  window.setInterval(tick, 1000);
}
