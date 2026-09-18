import type { InputEntry } from "./InputEntry";

/**
 * One tracked symlink or junction and the physical target last observed for it.
 *
 * Retargeting a link moves every input beneath it without an event on those
 * inputs. The bounded link poll compares the current target with this one and
 * re-checks the dependent inputs when it moves.
 */
export interface LinkedPath {
  target: string | undefined;
  inputs: Set<InputEntry>;
}
