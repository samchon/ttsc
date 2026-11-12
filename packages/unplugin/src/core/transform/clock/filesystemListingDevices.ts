import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";

/**
 * The devices on which an observing view saw its adapter-owned probe directory
 * move both of its stamps when the probe was recreated, keyed by the operations
 * object, as `filesystemClockReferences` keys their references.
 *
 * A directory's stamps move when an entry is created, removed or renamed in it,
 * so while they hold still a directory still holds the entries a walk read
 * (`IPluginSourceListing` from `ttsc/plugin-source`). That premise is offered
 * as evidence only on a device where the view has seen it hold, and each
 * refresh clears and re-establishes it with the reference it mints.
 *
 * @evidence contracts/common.md#principled-implementation A device enters only after the view observed a fresh entry change in owned storage move that directory's modification and change stamps; refresh clears the set before minting.
 * @evidence contracts/common.md#clear-and-simple-design One WeakMap owns the sets by operation identity, beside the reference tables they qualify.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No device is assumed to keep directory stamps from its platform or filesystem name.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the premise, how a device is admitted and when it is cleared.
 * @evidence contracts/portability.md#os-neutral-implementation Devices are the observing view's bigint identifiers; the premise is observed, not inferred from the OS.
 * @evidence contracts/performance.md#efficient-algorithms One WeakMap lookup selects the set.
 * @evidence contracts/performance.md#reuse-equivalent-work Every proof through one operations object shares its admitted devices until the next refresh.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Weak association does not retain the operations object, and a set holds at most the devices of its probes.
 */
export function filesystemListingDevices(
  /** Coherent observing view whose probe established the premise. */
  filesystem: TtscTransformFilesystemOperations,
): Set<bigint> {
  let devices = FILESYSTEM_LISTING_DEVICES.get(filesystem);
  if (devices === undefined) {
    devices = new Set();
    FILESYSTEM_LISTING_DEVICES.set(filesystem, devices);
  }
  return devices;
}

const FILESYSTEM_LISTING_DEVICES = new WeakMap<
  TtscTransformFilesystemOperations,
  Set<bigint>
>();
