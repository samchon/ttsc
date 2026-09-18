import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";

import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies events seen only by the trackers opened after the compile never fail
 * generation capture (samchon/ttsc#1383).
 *
 * The host-input and candidate trackers open after the compile returns, so they
 * cannot witness what it read. A change in their window before the capture's
 * post-compile reads is caught by those reads, and one after them stays queued
 * as a path witness for the next delivery. Their events used to fail the
 * attempt anyway, so `vitest` writing its cache under `node_modules` next to a
 * dev server turned into a terminal "could not capture a reusable transform
 * generation" overlay. The project tracker opened before the compile is the
 * compile's A-B-A witness and keeps deciding the verdict.
 *
 * 1. Compile a project with graph and candidate inputs through a cache whose watch
 *    seam fires an unattributed rename on every watcher registered after the
 *    compile.
 * 2. Assert the first delivery is published after one compile, and the sibling is
 *    served from that generation.
 * 3. Fire the event on every watcher, the pre-compile project watcher included,
 *    and assert the attempt fails through that watcher alone.
 */
export async function test_transformttsc_events_after_the_compile_do_not_fail_capture(): Promise<void> {
  const {
    createTtscTransformCache,
    resetTtscTransformCache,
    resolveOptions,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const run = async (everyWatcher: boolean) => {
    const project = createCacheProject({
      fileCount: 2,
      graphCandidates: 1,
      graphFanout: 2,
    });
    const compiles = () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0;
    let postCompileWatchers = 0;
    const cache = createTtscTransformCache({
      watch: (
        _directory: string,
        listener: (eventType: string, filename: string | null) => void,
      ) => {
        const afterCompile = compiles() !== 0;
        if (afterCompile) postCompileWatchers += 1;
        // An unattributed rename counts for every tracker that hears it, the
        // shape of a burst of unrelated writes a backend coalesces.
        if (afterCompile || everyWatcher) {
          queueMicrotask(() => listener("rename", null));
        }
        return { close: () => undefined };
      },
    });
    const deliver = (file: string) =>
      transformTtsc(
        file,
        fs.readFileSync(file, "utf8"),
        resolveOptions(),
        undefined,
        cache,
        { addWatchFile: () => undefined },
      );
    return {
      cache,
      compiles,
      deliver,
      modules: projectModules(project.root),
      postCompileWatchers: () => postCompileWatchers,
      reset: () => resetTtscTransformCache(cache),
    };
  };

  const quiet = await run(false);
  try {
    assert.ok(await quiet.deliver(quiet.modules[0]!));
    assert.ok(
      quiet.postCompileWatchers() >= 2,
      "the host-input and candidate trackers must both have heard the event",
    );
    assert.equal(quiet.compiles(), 1, "the generation must be published");
    assert.ok(await quiet.deliver(quiet.modules[1]!));
    assert.equal(
      quiet.compiles(),
      1,
      "the sibling must be served from the published generation",
    );
  } finally {
    quiet.reset();
  }

  const raced = await run(true);
  try {
    await assert.rejects(
      () => raced.deliver(raced.modules[0]!),
      (error: Error) => {
        assert.match(error.message, /project-membership-event/);
        assert.doesNotMatch(error.message, /host-input-event|candidate-event/);
        return true;
      },
      "an event on the pre-compile project watcher must still fail the attempt",
    );
  } finally {
    raced.reset();
  }
}
