import fs from "node:fs";

import { projectRecordDigest } from "../bridge/projectRecordDigest";
import { refreshProjectRecordFile } from "../bridge/refreshProjectRecordFile";
import type { RollupCachedModuleProof } from "./RollupCachedModuleProof";
import type { TtscRollupDelivery } from "./TtscRollupDelivery";

/**
 * Answer Rollup's cache for the modules the adapter delivers to it.
 *
 * When the host would otherwise restore a module from its supplied cache,
 * shouldTransformCachedModule can request transformation again. This adapter
 * uses that hook to compare its delivered options and project-record state,
 * including a build that has no live watcher to hear earlier input edits
 * (samchon/ttsc#1491).
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
 * An owned module carrying no delivery, or one no cache may serve, runs again,
 * since nothing proves its output.
 *
 * A record read is cached, including unavailable results, until begin clears it
 * or a first proof attempt invalidates it. Deliveries replace the saved digest
 * with their own recorded bytes. A later judgment need not reread a record
 * moved by another process in mid-build; the next pass observes it. A changed
 * proves callback can invalidate an already read digest within this pass.
 * Refresh errors propagate after the key enters the attempted-proof set.
 *
 * @param name The plugin's name, the key of its entry in a module's `meta`.
 * @param includes Whether the adapter transforms a module id.
 * @param options The identity of the options the build runs with
 *   (`rollupDeliveryOptions`).
 * @param proves Whether the build proves the records its cached modules name,
 *   which a build without a watching session's bridge does.
 * @evidence contracts/common.md#principled-implementation Adapter-owned modules compare options and pass-observed record digest; matching record-less metadata follows the no-project rule. Missing delivery, malformed record, null or unreadable record requests retransformation.
 * @evidence contracts/common.md#clear-and-simple-design Per-pass proven and digest tables back the existing begin/deliver/moved interface; shared record refresh owns filesystem-state proof.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The adapter uses the host retransformation hook without patching its cache or inventing a record when no proof exists.
 * @evidence contracts/common.md#meaningful-documentation Paragraphs explain optional record refresh, pass observation reuse and invalidation, including callback failure and record-less delivery semantics.
 * @evidence contracts/portability.md#os-neutral-implementation OS-neutral record access uses producer-supplied native paths and the shared native record refresh operation, without universal path case normalization or fixed storage directories.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Judgment adds module filtering, current-option work and metadata/text
 *   comparison. Each lexical record gets one refresh attempt per pass, including
 *   native input/walk/record I/O work. Digest reads/hash follow record bytes
 *   and can repeat after proof invalidation; delivery updates avoid a reread.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   Modules with the same lexical record reuse a pass's refresh attempt and
 *   observed digest. Begin ends the window; first refresh invalidates an older
 *   read and delivery updates the digest. Quiet mid-pass observation is a
 *   defined reuse window, not independently fresh native state for every module.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   The returned proof owner retains attempted keys and optional digests for R
 *   lexical records until begin clears them or the owner becomes unreachable.
 *   There is no count/byte cap within a pass or dedicated close. Thrown refresh
 *   leaves existing table state until that reset; no native handle/task is held.
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
