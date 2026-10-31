import './style.css';
import { bootstrap } from './app/bootstrap';

void bootstrap().catch((error: unknown) => {
  console.error('No se pudo iniciar el Tamagotchi:', error);
});
