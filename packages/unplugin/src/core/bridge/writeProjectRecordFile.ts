import fs from "node:fs";
import path from "node:path";

import type { TtscProjectRecord } from "./TtscProjectRecord";
import { projectRecordDigest } from "./projectRecordDigest";

/**
 * Write a project record (`projectRecordFile`) only when its bytes would
 * change. Exact current-byte comparison suppresses an unchanged rewrite;
 * changed serialization requests a move through the host's dependency channel,
 * without guaranteeing a host event or an atomic view for concurrent readers.
 *
 * The record is valid JSON with its keys in one order, whichever process writes
 * it. Equal JSON-representable records produce equal text; array order and
 * retry signal remain part of that representation.
 *
 * The bytes go into the file the host watches rather than into a replacement of
 * it; the comment below the comparison says why, what that costs, and what
 * answers it.
 *
 * @returns The intended text's digest (`projectRecordDigest`) after equal-byte
 *   observation or successful write. A concurrent writer can change the file
 *   before return; no read-back or exclusive-writer guarantee is supplied.
 * @evidence contracts/common.md#principled-implementation
 *   Sorted JSON keys make equivalent record states byte-identical; an exact
 *   existing-byte comparison suppresses no-op writes. In-place updates preserve
 *   inode-backed host watchers, and readers invalidate unreadable/torn records.
 * @evidence contracts/common.md#clear-and-simple-design
 *   One operation owns serialization, byte comparison and persistence; record
 *   validation and host refresh behavior stay with their respective consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   In-place writes address measured host watcher replacement semantics rather
 *   than hiding state mismatches; no consumer path or expected output is hardcoded.
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain idempotence, returned digest and non-atomic update
 *   consequences; descriptive prose/tag spacing follows documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation Native parent creation and in-place writes preserve watched file identity across Windows and POSIX host watcher differences; torn or unreadable records are rejected by readers instead of claiming atomic replacement semantics.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Serialization sorts each dictionary's K keys in O(K log K) comparisons,
 *   traverses arrays/values and allocates sorted dictionaries and JSON text.
 *   Hashing and current-byte read/comparison follow text bytes; a changed file
 *   also pays native parent-component creation and write. Equal bytes avoid
 *   that write, not serialization/hash/read costs.
 * @evidence contracts/performance.md#reuse-equivalent-work Exact persisted bytes permit sharing the existing record file across equivalent delivery states, while changed state requires a write; this does not replace filesystem validation of the recorded generation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous native operations and serialization buffers are call-local; persisted record files deliberately outlive the process under the host cache protocol, whose deletion policy is owned by project refresh.
 */
export function writeProjectRecordFile(
  file: string,
  record: TtscProjectRecord,
): string {
  const text = JSON.stringify(record, (_key, value: unknown) =>
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.keys(value as Record<string, unknown>)
            .sort()
            .map((key) => [key, (value as Record<string, unknown>)[key]]),
        )
      : value,
  );
  const digest = projectRecordDigest(text);
  try {
    if (fs.readFileSync(file, "utf8") === text) return digest;
  } catch {
    // Absent or unreadable: written below.
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // In place, into the file the host is watching, never beside it and over
  // it. A host watches the record by its path, and replacing the path's file
  // detaches a watcher that holds the one behind it: Rollup's, whose own
  // source says a file "unlinked and immediately recreated would create a
  // change event but then no longer any further events" on Linux, and whose
  // re-arm loses the watch for good when a replacement lands inside it
  // (measured: six moves of the record, seventeen seconds, not one of them
  // reported, while the adapter's own observer had heard the edit).
  //
  // A reader can therefore catch the file mid-write, and so can a second
  // writer. Two processes holding one generation write the same bytes, since
  // the record is a function of the project's state; two holding different
  // ones can leave mixed bytes. A malformed mix reads as no record; a
  // structurally readable mix still requires the recorded evidence's replay.
  // Those checks belong where the record is read: an unreadable record counts
  // as a record whose state moved (`refreshProjectRecordFiles`), which is the
  // answer a proof that cannot run already gives. Continued concurrent writes
  // or failed deliveries can repeat invalidation; no one-rebuild bound exists.
  fs.writeFileSync(file, text);
  return digest;
}
