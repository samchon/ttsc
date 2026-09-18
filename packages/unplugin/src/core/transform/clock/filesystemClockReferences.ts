import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * The current stamp an adapter-owned probe has minted, keyed by the operations
 * object that observes it and, inside, by reporting device.
 *
 * A filesystem stamps a write once per clock tick, so two same-length writes
 * inside one tick are indistinguishable by metadata alone. A signature may
 * therefore stand for content only while a later write is guaranteed to move
 * it, and that guarantee needs a reference instant the observed filesystem
 * itself produced: once some stamp on the same device is strictly newer than an
 * input's modification stamp, that input's tick is provably over, so any later
 * write must mint a newer stamp and move the signature. This adapts git's
 * racily-clean index rule: both sides of the comparison come from the same
 * reporting device, and the newer side is a write the adapter itself made.
 *
 * A timestamp merely observed on another input cannot advance the reference.
 * Tools may assign modification times, and a filesystem clock can move
 * backwards independently of the process clock. Neither a passive historical
 * maximum nor `Date.now()` proves what stamp a write would mint now. The probe
 * is therefore rewritten immediately before every validation that may reuse a
 * content signature, and its previous reference is cleared before the write. A
 * failed refresh or a different reporting device declines the optimization and
 * retains the content comparison (samchon/ttsc#1344).
 *
 * The probe lives in an adapter-owned temporary directory outside the project.
 * That directory may be on another volume, such as `C:` when a project lives on
 * `D:`. Such a split-volume generation safely keeps reading content because no
 * same-device reference exists; it never substitutes a process-clock guess or
 * writes a probe into the user's project.
 */
const FILESYSTEM_CLOCK_REFERENCES = new WeakMap<
  TtscTransformFilesystemOperations,
  Map<bigint, bigint>
>();

/** Return one observed filesystem's current per-device references. */
export function filesystemClockReferences(
  filesystem: TtscTransformFilesystemOperations,
): Map<bigint, bigint> {
  let references = FILESYSTEM_CLOCK_REFERENCES.get(filesystem);
  if (references === undefined) {
    references = new Map();
    FILESYSTEM_CLOCK_REFERENCES.set(filesystem, references);
  }
  return references;
}
