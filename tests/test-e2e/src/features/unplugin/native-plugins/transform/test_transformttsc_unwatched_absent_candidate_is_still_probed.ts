import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies a candidate whose watch could not be opened is still probed.
 *
 * The bound samchon/ttsc#1261 rests on: only a candidate the tracker actually
 * covers may skip its own check. A host that refuses watch registrations —
 * inotify exhausted, a network filesystem, a sandbox — has no notification to
 * offer, so the delivery must go back to asking the filesystem rather than
 * trusting a channel that was never opened.
 *
 * 1. Build a project whose envelope stamps missing candidates, with a cache whose
 *    watch registration always fails.
 * 2. Deliver one module to capture the generation, then reset the counters.
 * 3. Deliver the rest and assert the candidate paths were checked.
 *
 * @evidence contracts/testing.md#behavioral-verification After cold compile with ENOSPC watches, remaining modules perform candidate probes while count remains one.
 * @evidence contracts/testing.md#independent-expectations Instrumentation counts only authored three preferred candidate paths; native byte log confirms fallback probing does not imply recompilation.
 * @evidence contracts/testing.md#distinguishing-cases Missing candidates under entirely refused watch registrations, stable remaining deliveries.
 * @evidence contracts/testing.md#execution-ownership Named E2E test_transformttsc_unwatched_absent_candidate_is_still_probed is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts. Its body owns the assertions above; the path-identity case also retains direct portable helper assertions here.
 * @evidence contracts/e2e.md#necessary-boundary Real native candidate envelope is validated through a cache whose watcher provider refuses registration; direct predicate tests cannot establish producer proof integration with the persistent fallback.
 * @evidence contracts/e2e.md#shared-execution One four-module native project/cache captures once; remaining module requests share the result while explicit probe counters isolate their fallback work. No watcher or per-module producer rebuild is introduced.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project and cache identities separate mutable inputs; tracked roots are removed on process exit. Cache-local providers and identity contexts avoid global filesystem patches. There is no finally cache-reset guarantee here; process exit bounds remaining observers.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: After cold compile with ENOSPC watches, remaining modules perform candidate probes while count remains one. No assertion is transferred or removed by these tags; mixed portable helpers and cleanup limits remain explicitly disclosed.
 */
export async function test_transformttsc_unwatched_absent_candidate_is_still_probed(): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const graphCandidates = 3;
  const project = createCacheProject({
    fileCount: 4,
    graphCandidates,
    graphFanout: 4,
  });
  const candidates = new Set(
    Array.from({ length: graphCandidates }, (_, index) =>
      path.resolve(
        path.join(project.root, "node_modules", `dep${index}`, "index.ts"),
      ),
    ),
  );
  const probes = { calls: 0 };
  const count = (location: string): void => {
    if (candidates.has(path.resolve(location))) probes.calls += 1;
  };
  const cache = createTtscTransformCache({
    exists: (location: string) => {
      count(location);
      return fs.existsSync(location);
    },
    lstat: (location: string) => {
      count(location);
      return fs.lstatSync(location, { bigint: true });
    },
    readFile: (location: string) => {
      count(location);
      return fs.readFileSync(location);
    },
    stat: (location: string) => {
      count(location);
      return fs.statSync(location);
    },
    statBigInt: (location: string) => {
      count(location);
      return fs.statSync(location, { bigint: true });
    },
    watch: () => {
      const error = new Error(
        "watch registration refused",
      ) as NodeJS.ErrnoException;
      error.code = "ENOSPC";
      throw error;
    },
  });
  const modules = projectModules(project.root);
  const options = resolveOptions();
  const deliver = async (file: string): Promise<void> => {
    const result = await transformTtsc(
      file,
      fs.readFileSync(file, "utf8"),
      options,
      undefined,
      cache,
    );
    assert.ok(result, `expected transformed output for ${file}`);
  };

  await deliver(modules[0]!);
  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);

  probes.calls = 0;
  for (const file of modules.slice(1)) {
    await deliver(file);
  }

  assert.equal(fs.readFileSync(project.runLog, "utf8").length, 1);
  assert.ok(
    probes.calls > 0,
    "a candidate no watcher covers must still be checked on the filesystem",
  );
}
