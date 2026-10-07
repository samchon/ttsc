import fs from "node:fs";
import path from "node:path";

import { retainNativeLintProducer } from "../NativeLintProducer";

/**
 * Records fixture inputs whose process readers have not been joined.
 *
 * Unknown closure is permanent for this test process: a later launcher exit
 * cannot establish that an earlier descendant released the same inputs. Cleanup
 * and phase writers use the same admission check.
 *
 * @evidence contracts/common.md#principled-implementation An explicit unknown-reader transition refuses subsequent writes and removal of that exact fixture identity; signal delivery or parent closure cannot erase it.
 * @evidence contracts/common.md#clear-and-simple-design One process-local owner links each fixture to its actually used cache paths and native identities; the first unresolved-reader reason reaches fixture writers, cleanup and later shared-cache consumers.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown descendants remain an observable blocking failure rather than being treated as joined or hidden by fixture deletion.
 * @evidence contracts/common.md#meaningful-documentation Explains why unknown closure is sticky and why writers and release operations share admission.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath resolves cache aliases, while existing directories also carry dev/ino/birth identity without guessing filesystem case policy. Missing paths resolve through their nearest existing ancestor. Cache admission claims no deletion authority over environment paths; shared allocation retention stays with its owner.
 * @evidence contracts/performance.md#efficient-algorithms Fixture and cache-key maps use constant expected membership checks; missing cache paths visit their ancestor depth and retention visits only that fixture's recorded cache keys. The existing producer owner performs physical allocation retention once per unknown transition.
 * @evidence contracts/performance.md#reuse-equivalent-work Repeated unknown transitions preserve the first recorded reason and do not repeat producer retention. Admission is checked anew before each controlled phase write, process operation or cleanup, and unknown state is never reused as release proof.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Used fixture/cache bindings and unresolved reasons remain for this finite test process, growing with its fixtures and distinct cache inputs. No cache is allocated or deleted here; unresolved admission blocks both the actual reader spelling and recorded physical path after retargeting, removal or replacement. A distinct cache reached through an independent spelling remains separate.
 */
export namespace EvidenceProcessOwnership {
  const shared = create(retainNativeLintProducer);

  /**
   * Creates one isolated process-input owner with an explicit shared-input
   * delegate.
   *
   * The callback transfers existing producer/cache retention and may throw; it
   * cannot declare reader closure or clear this owner's sticky admission. The
   * default owner passes the actual NativeLintProducer retention operation.
   * Independently owned operations can use separate instances without resetting
   * a running owner's state or replacing filesystem and process methods.
   *
   * @evidence contracts/common.md#principled-implementation Each instance records first unknown-reader causes and their used cache identities before delegation, so a throwing retention callback cannot reopen admission.
   * @evidence contracts/common.md#clear-and-simple-design The returned operations share private fixture and cache maps, while cacheKeys centralizes native spelling and identity observations.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts An explicit retention delegate is the injection boundary; unknown descendants are never declared joined and foreign cache deletion authority is not granted.
   * @evidence contracts/common.md#meaningful-documentation The native paragraphs identify isolated ownership, sticky state and delegate failure semantics.
   * @evidence contracts/portability.md#os-neutral-implementation cacheKeys uses native realpath, stat and nearest existing ancestors; original reader spelling remains alongside physical path and directory identity without case guessing.
   * @evidence contracts/performance.md#efficient-algorithms Map/set checks are expected constant time per key; cache-key discovery visits missing ancestors and retention visits the fixture's recorded keys.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated unknown transitions keep the first reason and delegate once. Admission is checked on every operation; no quiet path or later parent exit clears sticky state.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The instance owns maps growing with registered fixtures and distinct cache keys for its lifetime. There is no release/reset API; unresolved state intentionally survives, and actual allocations stay with external owners.
   */
  export function create(retainSharedInputs: (reason: string) => void) {
    const unknown = new Map<string, unknown>();
    const caches = new Map<string, Set<string>>();
    const unresolvedCaches = new Map<string, unknown>();
    const owner = {
      /**
       * Records one fixture's first unresolved reason and delegates retention
       * once. Cache bindings become sticky before delegation, so a throwing
       * delegate cannot reopen admission. Fixture refusal exposes both failures
       * together.
       */
      retain(directory: string, reason: unknown): void {
        if (unknown.has(directory)) return;
        unknown.set(directory, reason);
        for (const key of caches.get(directory) ?? [])
          if (!unresolvedCaches.has(key)) unresolvedCaches.set(key, reason);
        const failures: unknown[] = [reason];
        const explanation =
          reason instanceof Error ? reason.message : "Unknown process closure.";
        try {
          retainSharedInputs(explanation);
        } catch (error) {
          failures.push(error);
        }
        if (failures.length > 1)
          unknown.set(
            directory,
            new AggregateError(
              failures,
              "Unknown Evidence reader and shared input retention failures.",
            ),
          );
        console.error(
          "Retained Evidence fixture inputs: " + directory,
          unknown.get(directory),
        );
      },
      /**
       * Refuses this fixture's writes or removal with its recorded failure
       * cause.
       */
      assertAvailable(directory: string): void {
        if (unknown.has(directory))
          throw new Error(
            "Evidence fixture inputs are retained because process closure is unknown: " +
              directory,
            { cause: unknown.get(directory) },
          );
      },
      /**
       * Refuses a previously used spelling or physical identity before cache
       * IO. Retargeting a reader's spelling cannot make that same input
       * available. This check grants no authority to remove an external
       * directory.
       */
      assertCacheAvailable(location: string): void {
        for (const key of cacheKeys(location))
          if (unresolvedCaches.has(key))
            throw new Error(
              "Evidence cache has unresolved process readers: " + location,
              { cause: unresolvedCaches.get(key) },
            );
      },
      /**
       * Binds admitted cache spellings and native identities before reader
       * startup. The caller passes the actual absolute cacheDir/environment
       * value, not a different alias that the reader never received.
       */
      registerCache(directory: string, location: string): void {
        owner.assertAvailable(directory);
        owner.assertCacheAvailable(location);
        let keys = caches.get(directory);
        if (keys === undefined) caches.set(directory, (keys = new Set()));
        for (const key of cacheKeys(location)) keys.add(key);
      },
    };
    return owner;
  }

  /**
   * Permanently retain the first reason closure could not be established.
   *
   * @evidence contracts/common.md#principled-implementation The shared instance records the fixture's first unresolved closure reason and delegates existing shared-input retention.
   * @evidence contracts/common.md#clear-and-simple-design This facade preserves one process-wide admission owner without exposing its maps.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A later launcher exit cannot clear unknown descendant ownership or manufacture a join.
   * @evidence contracts/common.md#meaningful-documentation The headline states permanent first-reason retention.
   * @evidence contracts/portability.md#os-neutral-implementation The delegated owner binds native cache paths and identities; the fixture key is the exact spelling supplied by its caller.
   * @evidence contracts/performance.md#efficient-algorithms One delegation visits only that fixture's registered cache keys and allocation-retention checks.
   * @evidence contracts/performance.md#reuse-equivalent-work Repeated retention of the same fixture preserves the first reason and does not repeat the shared-input delegate.
   * @evidence contracts/performance.md#bound-retention-and-release-resources No new root or child is acquired; sticky process-local records keep unresolved inputs unavailable and reclamation remains with their owner.
   */
  export function retain(directory: string, reason: unknown): void {
    shared.retain(directory, reason);
  }

  /**
   * Refuse mutation or removal while an earlier reader may still exist.
   *
   * @evidence contracts/common.md#principled-implementation The shared owner refuses mutation or cleanup when that exact fixture key has an unknown-reader reason.
   * @evidence contracts/common.md#clear-and-simple-design One facade connects writers and cleanup to the same admission map.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Absence from this registry is not a kernel liveness or descendant-join assertion.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies the mutation/removal admission boundary.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This operation checks the supplied fixture key in a process-local map and performs no native observation.
   * @evidence contracts/performance.md#efficient-algorithms One expected constant-time map lookup determines registered refusal.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Admission is recomputed for each request rather than cached as process closure proof.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This check acquires no resource or retained state; the shared owner holds existing refusal records.
   */
  export function assertAvailable(directory: string): void {
    shared.assertAvailable(directory);
  }

  /**
   * Refuse a cache path or actual directory identity with unresolved readers.
   *
   * @evidence contracts/common.md#principled-implementation Current native spelling and identity keys are compared with sticky unresolved cache keys before cache IO.
   * @evidence contracts/common.md#clear-and-simple-design The facade delegates all cache identity policy to the common instance.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Retargeting an earlier reader's path cannot erase that recorded path refusal; this grants no deletion authority.
   * @evidence contracts/common.md#meaningful-documentation The headline identifies cache-path and actual-directory refusal.
   * @evidence contracts/portability.md#os-neutral-implementation The delegated native realpath/stat discovery keeps reader spelling, physical spelling and directory identity separate without case folding.
   * @evidence contracts/performance.md#efficient-algorithms Key discovery scales with missing ancestor depth, followed by a fixed number of expected constant-time map checks.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each request reobserves its current native path; prior admission is not cached as future validity.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous observations leave no handle or task; this check adds no retained records.
   */
  export function assertCacheAvailable(location: string): void {
    shared.assertCacheAvailable(location);
  }

  /**
   * Record the actual cache inputs before a fixture starts its reader.
   *
   * @evidence contracts/common.md#principled-implementation Fixture and cache admission are checked before the exact reader spelling and native identity keys are bound to the fixture.
   * @evidence contracts/common.md#clear-and-simple-design The facade shares one registration owner with retention and later cache access.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Registration observes actual cache inputs; it neither allocates a substitute root nor declares successful process completion.
   * @evidence contracts/common.md#meaningful-documentation The headline states before-reader-start registration of actual inputs.
   * @evidence contracts/portability.md#os-neutral-implementation The delegated native path observations preserve original spelling alongside physical path and existing directory identity.
   * @evidence contracts/performance.md#efficient-algorithms Two admission checks and key discovery scale with ancestor depth, while set insertion is expected constant time per key.
   * @evidence contracts/performance.md#reuse-equivalent-work The fixture set deduplicates repeated equal keys; changed paths or native identities produce separate keys and admission is checked again.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The shared instance retains fixture/key bindings for the finite process; this adapter owns no native handle or allocation and does not prune historical registrations.
   */
  export function registerCache(directory: string, location: string): void {
    shared.registerCache(directory, location);
  }
}

/** Keep actual reader spelling sticky alongside physical paths and identities. */
function cacheKeys(location: string): string[] {
  const spelling = path.resolve(location);
  let ancestor = spelling;
  const missing: string[] = [];
  while (!fs.existsSync(ancestor)) {
    missing.unshift(path.basename(ancestor));
    const parent = path.dirname(ancestor);
    if (parent === ancestor)
      throw new Error("Evidence cache has no existing ancestor: " + location);
    ancestor = parent;
  }
  const physical = path.join(fs.realpathSync.native(ancestor), ...missing);
  const keys = ["path:" + spelling, "path:" + physical];
  if (missing.length === 0) {
    const stat = fs.statSync(physical);
    if (!stat.isDirectory())
      throw new Error("Evidence cache must name a directory: " + location);
    keys.push("identity:" + stat.dev + ":" + stat.ino + ":" + stat.birthtimeMs);
  }
  return keys;
}
