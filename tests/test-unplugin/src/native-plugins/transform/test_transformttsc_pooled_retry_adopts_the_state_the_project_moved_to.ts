import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runPooledWorker } from "../../internal/pooled-session/runPooledWorker";
import { createCacheProject } from "../../internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../internal/transform-project-cache/projectModules";

/**
 * Verifies a pooled worker whose adopted compile failed because the project
 * moved adopts the publication of the state the project moved to, instead of
 * compiling that state again (samchon/ttsc#1390).
 *
 * A retry refuses the publication its attempt adopted and could not prove,
 * since it would find the same publication again. It found that only for the
 * same state: a worker that adopted a state while an edit landed retried with
 * every publication refused, and compiled the new state another worker had just
 * published. Measured on a Turbopack pool on macOS, that compile was still
 * running when the next edit landed, and the pool compiled the edit twice.
 *
 * 1. Publish a project's state from one worker process, edit a module, and publish
 *    the edited state from another; then restore the first state.
 * 2. Deliver another module in this process, which adopts the first state's
 *    publication, and move the project to the edited state while the attempt
 *    reads it back, so the attempt fails and retries.
 * 3. Assert the retry compiled nothing, having adopted the edited state's
 *    publication, and that the module was delivered.
 */
export async function test_transformttsc_pooled_retry_adopts_the_state_the_project_moved_to(): Promise<void> {
  const {
    createTtscTransformCache,
    resolveOptions,
    shareTtscTransformCache,
    transformTtsc,
  } = await TestUnpluginRuntime.loadUnpluginApi();
  const project = createCacheProject({ fileCount: 3 });
  const modules = projectModules(project.root);
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-retry-");
  const compiles = () =>
    fs.existsSync(project.runLog) ? fs.statSync(project.runLog).size : 0;
  const edited = modules[0]!;
  const first = fs.readFileSync(edited, "utf8");
  const second = `${first}export const moved = 1;\n`;

  for (const content of [first, second]) {
    fs.writeFileSync(edited, content);
    const result = await runPooledWorker({ file: edited, session });
    assert.equal(result.error, undefined, result.error);
  }
  assert.equal(compiles(), 2, "each state compiles once and is published");
  fs.writeFileSync(edited, first);

  // The first read takes the snapshot that names the adopted state; the edit
  // lands as the attempt reads the module again to prove it.
  let reads = 0;
  const cache = createTtscTransformCache({
    readFile: (location: string) => {
      const contents = fs.readFileSync(location);
      if (path.resolve(location) === path.resolve(edited) && ++reads === 2) {
        fs.writeFileSync(edited, second);
      }
      return contents;
    },
  });
  shareTtscTransformCache(cache, session);
  const delivered = modules[1]!;
  const result = await transformTtsc(
    delivered,
    fs.readFileSync(delivered, "utf8"),
    resolveOptions(),
    undefined,
    cache,
  );
  assert.ok(reads >= 3, `the attempt retried after the edit: ${reads} reads`);
  assert.equal(
    compiles(),
    2,
    "the retry adopts the state the project moved to rather than compiling it",
  );
  assert.match(result?.code ?? "", /PROBED/);
}
