import { startPetController } from './petController';

export async function bootstrap(): Promise<void> {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('No se encontró el elemento raíz #app.');
  await startPetController(root);
}
