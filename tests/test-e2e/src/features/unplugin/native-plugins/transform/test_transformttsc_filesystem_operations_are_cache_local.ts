import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies concurrent caches neither share filesystem operations nor propagate
 * each other's faults.
 *
 * Filesystem operations are injected per cache. If one cache's operations
 * leaked into module-level state, a second project would be read through the
 * first project's hooks and fail with its injected fault.
 *
 * 1. Create two projects, each with a cache whose operations count reads and the
 *    first of which injects a directory-listing failure.
 * 2. Transform both concurrently.
 * 3. Assert only the first rejects, both caches performed reads, and the first
 *    cache's fault never observed the second project.
 *
 * @evidence contracts/testing.md#behavioral-verification Concurrent caches independently read; injected first-project listing faults reject after two attempts while the second succeeds and never enters the first hook.
 * @evidence contracts/testing.md#independent-expectations Distinct roots and two per-cache counters establish ownership; the explicit EACCES seam controls only first-project locations.
 * @evidence contracts/testing.md#distinguishing-cases Faulting cache and healthy simultaneous cache are the negative/positive pair; all settled results are inspected before assertions finish.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_filesystem_operations_are_cache_local in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The built transform API must hand an actual native fixture envelope to generation capture/validation and then serve the selected modules. The native run log and reported graph/proofs expose that connection; synthetic graph options test envelope transport and admission, not correctness of TypeScript-Go graph construction.
 * @evidence contracts/e2e.md#shared-execution createCacheProject reuses the materialized cache Go fixture and content-addressed build cache unless this case requests isolatedPluginSource; unique consumer and run-log roots keep mutable inputs private. Within each consumer/cache scenario, repeated deliveries reuse that scenario's transform cache; distinct consumers or policies keep separate caches. Changed declared inputs or rejected capture require the counted new invocation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Concurrent caches independently read; injected first-project listing faults reject after two attempts while the second succeeds and never enters the first hook. These assertions remain in test_transformttsc_filesystem_operations_are_cache_local, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_filesystem_operations_are_cache_local(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const firstProject = createCacheProject({ fileCount: 1 });
  const secondProject = createCacheProject({ fileCount: 1 });
  const firstFile = projectModules(firstProject.root)[0]!;
  const secondFile = projectModules(secondProject.root)[0]!;
  const options = resolveOptions();
  const reads = { first: 0, second: 0 };
  const firstOperationLocations: string[] = [];
  let firstFaults = 0;
  const isWithin = (root: string, location: string): boolean => {
    const relative = path.relative(root, location);
    return (
      relative === "" ||
      (relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) &&
        !path.isAbsolute(relative))
    );
  };
  const first = createTtscTransformCache({
    readFile: (location: string) => {
      reads.first += 1;
      return fs.readFileSync(location);
    },
    readdir: (location: string) => {
      if (fs.existsSync(firstProject.runLog)) {
        const absolute = path.resolve(location);
        firstOperationLocations.push(absolute);
        if (isWithin(firstProject.root, absolute)) {
          firstFaults += 1;
          const error = new Error(
            "first cache injected readdir failure",
          ) as NodeJS.ErrnoException;
          error.code = "EACCES";
          throw error;
        }
      }
      return fs.readdirSync(location, { withFileTypes: true });
    },
  });
  const second = createTtscTransformCache({
    readFile: (location: string) => {
      reads.second += 1;
      return fs.readFileSync(location);
    },
    readdir: (location: string) =>
      fs.readdirSync(location, { withFileTypes: true }),
  });

  const [firstResult, secondResult] = await Promise.allSettled([
    transformTtsc(
      firstFile,
      fs.readFileSync(firstFile, "utf8"),
      options,
      undefined,
      first,
    ),
    transformTtsc(
      secondFile,
      fs.readFileSync(secondFile, "utf8"),
      options,
      undefined,
      second,
    ),
  ]);
  assert.equal(firstResult.status, "rejected");
  assert.match(
    (firstResult as PromiseRejectedResult).reason.message,
    /after 2 attempts/,
  );
  assert.match(
    (firstResult as PromiseRejectedResult).reason.message,
    /project\/directory-read-failed/,
  );
  assert.equal(secondResult.status, "fulfilled");
  assert.ok((secondResult as PromiseFulfilledResult<unknown>).value);
  assert.ok(reads.first > 0);
  assert.ok(reads.second > 0);
  assert.ok(firstFaults > 0);
  assert.ok(
    firstOperationLocations.every(
      (location) => !isWithin(secondProject.root, location),
    ),
    "the first cache's injected failure must never observe the second project",
  );
}
