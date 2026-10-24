import { Game, type GameOpts } from "./game";
/** Mounts NEURON: CYBERVERSE into a container and returns a disposer. */
export function createCyberverse(opts: GameOpts) {
  const g = new Game(opts);
  return { dispose: () => g.dispose(), game: g };
}
export type { GameOpts };
