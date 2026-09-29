import type { InputEntry } from "./InputEntry";

/**
 * One tracked symlink or junction and the physical target last observed for it.
 *
 * Retargeting a link moves every input beneath it without an event on those
 * inputs. The bounded link poll compares the current target with this one and
 * re-checks the dependent inputs when it moves.
 *
 * @evidence contracts/common.md#principled-implementation One observed target is paired with every dependent entry because retargeting a shared component can move inputs without descendant events.
 * @evidence contracts/common.md#clear-and-simple-design The shape stores topology state and dependents only; the observer owns polling, aliases, and condition validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An unresolved target remains undefined and requires conservative observation rather than an invented physical identity.
 * @evidence contracts/common.md#meaningful-documentation The native prose explains why links need independent checks and how target changes affect dependents.
 */
export interface LinkedPath {
  /** Physical target last observed, or `undefined` when unresolvable. */
  target: string | undefined;

  /** Entries reached through this link. */
  inputs: Set<InputEntry>;
}
