import type { InputEntry } from "./InputEntry";

/**
 * One tracked symlink or junction and the physical target last observed for it.
 *
 * Retargeting a link moves every input beneath it without an event on those
 * inputs. The bounded link poll compares the current target with this one and
 * re-checks dependent inputs when the observed target changes, including an
 * unresolved result. Polling does not certify every intervening native change.
 *
 * @evidence contracts/common.md#principled-implementation One observed target is paired with every dependent entry because retargeting a shared component can move inputs without descendant events.
 * @evidence contracts/common.md#clear-and-simple-design The shape stores topology state and dependents only; the observer owns polling, aliases, and condition validation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An unresolved target remains undefined and requires conservative observation rather than an invented physical identity.
 * @evidence contracts/common.md#meaningful-documentation The native prose explains why links need independent checks and how target changes affect dependents.
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Target carries the last native realpath result, with undefined for failed
 *   observation. Physical target spelling is not event-name/case equivalence
 *   or proof that the current topology remains the same.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   The target/dependent association implements no traversal; native target
 *   sampling and condition checks belong to the observer.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   The shape defines no sharing coordinator; the observer's link map and
 *   dependent registration establish how one observation serves several inputs.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Observer registration/removal and disposal own link/dependent retention;
 *   this carrier defines no independent handle/task acquisition or teardown.
 */
export interface LinkedPath {
  /** Physical target last observed, or `undefined` when unresolvable. */
  target: string | undefined;

  /** Entries reached through this link. */
  inputs: Set<InputEntry>;
}
