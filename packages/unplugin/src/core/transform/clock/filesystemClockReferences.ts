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
 * is therefore rewritten immediately before every proof that may reuse a
 * content signature, and its previous reference is cleared before the write. A
 * failed refresh or a different reporting device declines the optimization and
 * retains the content comparison (samchon/ttsc#1344). A generation's capture
 * and deliveries rewrite the probe it retains
 * (`refreshFilesystemClockReference`); a proof that holds no generation, a
 * failed generation's replay, a record's proof at a build start, and the
 * observer's proof of a plugin source, mints in scratch storage it removes at
 * once (`refreshScratchClockReference`).
 *
 * Proofs share one reference per operations object and may interleave across an
 * await. That is sound because separability is decided when an input's metadata
 * is taken before its read (`inputMetadataEvidence`): whatever reference is
 * current then was minted before that read, whichever proof minted it.
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

/**
 * Return one observed filesystem's current clock references, creating the empty
 * map on first use.
 *
 * Each entry maps a reporting device to the modification stamp the adapter's
 * probe last minted there. `refreshFilesystemClockReference` replaces the map's
 * contents before a validation, and `stampSeparable` reads it: an input whose
 * stamp is strictly older than its device's reference can be trusted by
 * signature. A device with no entry proves nothing, so its inputs keep being
 * compared by content. The map is held per operations object, so references
 * minted through a replaced filesystem seam never vouch for the host's
 * filesystem.
 */
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
