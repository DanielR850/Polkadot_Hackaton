import type { PetState } from '../../domain/pet/petState';

/** Storage boundary keeps game rules independent of browser or Host storage APIs. */
export interface PetStorage {
  load(): Promise<Partial<PetState> | undefined>;
  save(state: PetState): Promise<void>;
}
