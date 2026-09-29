import fs from "node:fs";

import { projectRecordDigest } from "../bridge/projectRecordDigest";
import { refreshProjectRecordFile } from "../bridge/refreshProjectRecordFile";
import type { RollupCachedModuleProof } from "./RollupCachedModuleProof";
import type { TtscRollupDelivery } from "./TtscRollupDelivery";

/**
 * Answer Rollup's cache for the modules the adapter delivers to it.
 *
 * Rollup serves a module from the cache it was handed, the `cache` input
 * option, whenever the module's source is unchanged and no plugin's
 * `shouldTransformCachedModule` asks for it. Rollup's own watcher runs again a
 * cached module whose watch file changed, the project's record among them, but
 * a build handed a cache has no watcher, so a module whose source never changed
 * kept the output of a type edited since (samchon/ttsc#1491). Every other build
 * host holds the record as the module's dependency and compares it before it
 * restores the module; this makes the same comparison for Rollup.
 *
 * A delivery leaves the options it was compiled under, the record, and the
 * digest of the bytes its process wrote to the record in the module's `meta`
 * (`TtscRollupDelivery`), which Rollup keeps with the module. A module it would
 * serve from its cache runs again unless it was compiled under the options the
 * build runs with and its digest is the record's bytes now. A build that proves
 * records proves each one once, as its first cached module names it
 * (`refreshProjectRecordFile`), which moves it for a project that changed while
 * nothing ran: Rollup reads the cache it was handed as it builds its graph, and
 * says which modules it holds only by asking here, so the records proven are
 * exactly those of the projects whose modules it is about to restore. A
 * watching session proves none: its cache holds only what its own deliveries
 * registered with the bridge, which moves their records as their inputs change.
 * A module carrying no delivery, or one no cache may serve, runs again, since
 * nothing proves its output.
 *
 * Each record's bytes are read at most once per build, and a delivery in the
 * build puts the digest it wrote in their place, so a project whose modules
 * Rollup restores costs one read of its record, not one per module. A move made
 * in mid-build by another process is read at the next build, which runs the
 * module again then.
 *
 * @param name The plugin's name, the key of its entry in a module's `meta`.
 * @param includes Whether the adapter transforms a module id.
 * @param options The identity of the options the build runs with
 *   (`rollupDeliveryOptions`).
 * @param proves Whether the build proves the records its cached modules name,
 *   which a build without a watching session's bridge does.
 *
 * @evidence contracts/common.md#principled-implementation Only adapter-owned modules with matching options and current recorded project digest may replay; absent, invalid, volatile, or unreadable evidence requests retransformation.
 * @evidence contracts/common.md#clear-and-simple-design Per-pass proven and digest tables back the existing begin/deliver/moved interface; shared record refresh owns filesystem-state proof.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The adapter does not patch Rollup's source-only cache or fabricate a record when no proof exists; it uses the host's retransformation hook.
 * @evidence contracts/common.md#meaningful-documentation Paragraphs explain watching versus one-shot proof and why a record is read once per pass, with explicit callback responsibilities.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral record access uses producer-supplied native paths and the shared native record refresh operation, without universal path case normalization or fixed storage directories.
 * @evidence contracts/performance.md#efficient-algorithms Module judgment uses option comparison and map lookup; each distinct record incurs at most one proof and one retained byte digest per pass.
 * @evidence contracts/performance.md#reuse-equivalent-work Modules sharing a project record reuse its pass proof and digest; a live delivery updates that digest from the bytes it actually wrote.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Begin clears both tables at every pass, and this helper opens no persistent filesystem handles or watchers.
 */
export function createRollupCachedModuleProof(
  name: string,
  includes: (id: string) => boolean,
  options: () => string,
  proves: () => boolean,
): RollupCachedModuleProof {
  const proven = new Set<string>();
  const digests = new Map<string, string | undefined>();
  const read = (record: string): string | undefined => {
    if (digests.has(record)) return digests.get(record);
    let digest: string | undefined;
    try {
      digest = projectRecordDigest(fs.readFileSync(record));
    } catch {
      // A record that cannot be read proves nothing.
    }
    digests.set(record, digest);
    return digest;
  };
  return {
    begin: () => {
      proven.clear();
      digests.clear();
    },
    deliver: (delivery) => {
      if (delivery?.record !== undefined)
        digests.set(delivery.record.file, delivery.record.digest);
      return { [name]: delivery };
    },
    moved: ({ id, meta }) => {
      if (!includes(id)) return false;
      const delivery = meta?.[name] as
        | Partial<NonNullable<TtscRollupDelivery>>
        | null
        | undefined;
      if (delivery?.options !== options()) return true;
      if (delivery.record === undefined) return false;
      const { digest, file } = (delivery.record ?? {}) as Partial<
        NonNullable<NonNullable<TtscRollupDelivery>["record"]>
      >;
      if (typeof file !== "string" || typeof digest !== "string") return true;
      if (proves() && !proven.has(file)) {
        proven.add(file);
        refreshProjectRecordFile(file);
        // What a delivery of this build wrote is what the proof ran over, and
        // a move it made is read from the file.
        digests.delete(file);
      }
      return read(file) !== digest;
    },
  };
}
