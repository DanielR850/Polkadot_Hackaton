import { isPetId } from './catalog.ts';
import { NEED_KEYS } from './petState.ts';
import type { PetState } from './types.ts';

// Guardado local. Dentro del Host `localStorage` no está verificado, así que todo va en try/catch
// con respaldo en memoria. Clave nueva (v2) porque el formato cambió respecto al prototipo.
export const PET_STORAGE_KEY = 'tamagotchi-polkadot-pet-v2';
let memory: string | null = null;

export function parsePetState(raw: string | null): PetState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PetState>;
    const needsOk = data.needs && NEED_KEYS.every((key) => typeof data.needs?.[key] === 'number');
    if (data.version !== 2 || !isPetId(data.petId) || typeof data.name !== 'string' || !needsOk) return null;
    if (typeof data.bornAt !== 'number' || typeof data.updatedAt !== 'number') return null;
    return {
      version: 2,
      petId: data.petId,
      name: data.name,
      bornAt: data.bornAt,
      updatedAt: data.updatedAt,
      needs: { ...data.needs! },
      sleeping: data.sleeping === true,
      diedAt: typeof data.diedAt === 'number' ? data.diedAt : null,
    };
  } catch {
    return null;
  }
}

export function loadPet(): PetState | null {
  let raw = memory;
  try { raw = localStorage.getItem(PET_STORAGE_KEY); } catch { /* sin localStorage */ }
  return parsePetState(raw);
}

/** NFT de la partida actual (solo informativo: los cuidados no van a la cadena). */
export interface PetNft {
  tokenId: string;
  address: string;
  /** Ya se preguntó si registrar la partida al morir (para no preguntar en cada recarga). */
  asked?: boolean;
  /** La partida ya quedó registrada en el leaderboard. */
  recorded?: boolean;
}
export const NFT_STORAGE_KEY = 'tamagotchi-polkadot-nft-v1';
let nftMemory: string | null = null;

export function loadNft(): PetNft | null {
  let raw = nftMemory;
  try { raw = localStorage.getItem(NFT_STORAGE_KEY); } catch { /* sin localStorage */ }
  try {
    const data = raw ? (JSON.parse(raw) as Partial<PetNft>) : null;
    if (!data || typeof data.tokenId !== 'string' || !/^\d+$/.test(data.tokenId) || typeof data.address !== 'string') return null;
    return { tokenId: data.tokenId, address: data.address, asked: data.asked === true, recorded: data.recorded === true };
  } catch {
    return null;
  }
}

export function saveNft(nft: PetNft | null): void {
  nftMemory = nft ? JSON.stringify(nft) : null;
  try {
    if (nftMemory) localStorage.setItem(NFT_STORAGE_KEY, nftMemory);
    else localStorage.removeItem(NFT_STORAGE_KEY);
  } catch { /* se queda en memoria */ }
}

export function savePet(state: PetState | null): void {
  memory = state ? JSON.stringify(state) : null;
  try {
    if (memory) localStorage.setItem(PET_STORAGE_KEY, memory);
    else localStorage.removeItem(PET_STORAGE_KEY);
  } catch { /* se queda en memoria */ }
}
