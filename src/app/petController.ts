import { care, createPetState, tick, type CareAction } from '../domain/pet/petState';
import { createPetScene } from '../game/scenes/petScene';
import { LocalPetStorage } from '../infrastructure/storage/localPetStorage';
import { mountPetView } from '../ui/petView';

export async function startPetController(root: HTMLElement): Promise<() => void> {
  const gameElement = root.querySelector<HTMLElement>('#game');
  if (!gameElement) throw new Error('No se encontró el contenedor del juego #game.');

  const storage = new LocalPetStorage();
  const state = createPetState(await storage.load());
  const scene = createPetScene(gameElement);

  const view = mountPetView(root, (action: CareAction) => {
    const message = care(state, action);
    scene.react(action);
    void storage.save(state);
    view.render(state, message);
  });

  view.render(state, 'Tu criatura te está esperando.');
  const timer = window.setInterval(() => {
    tick(state);
    void storage.save(state);
    view.render(state);
  }, 30_000);

  return () => {
    window.clearInterval(timer);
    view.destroy();
    scene.destroy();
  };
}
