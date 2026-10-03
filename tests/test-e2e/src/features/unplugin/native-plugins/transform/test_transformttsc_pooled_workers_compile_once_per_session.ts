import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runPooledWorker } from "../../../../internal/unplugin/internal/pooled-session/runPooledWorker";
import { createCacheProject } from "../../../../internal/unplugin/internal/transform-project-cache/createCacheProject";
import { projectModules } from "../../../../internal/unplugin/internal/transform-project-cache/projectModules";

/**
 * Verifies the worker processes of one pooled host session compile each project
 * state once between them (samchon/ttsc#1390).
 *
 * Turbopack and Metro run transforms in a pool of processes, each with its own
 * transform cache, and each compiled the whole project before answering its
 * first module: five workers meant five compiles of one program. Workers of a
 * session now compile under one lock per project state, and the others adopt
 * the publication once they have proven the same state.
 *
 * 1. Start one worker per module at once in a session, and assert every module is
 *    transformed by one compile.
 * 2. Edit a module and repeat, and assert one more compile, whose output carries
 *    the edit. Edit only the tsconfig and repeat, and assert one more compile,
 *    since the config is part of the state the workers share.
 * 3. Repeat with different compiler options, and assert those workers compile for
 *    themselves once, never sharing across options.
 *
 * @evidence contracts/testing.md#behavioral-verification Three workers return PROBED at count one, source edit produces edited/count two, config edit yields three, different compiler options yield four.
 * @evidence contracts/testing.md#independent-expectations Fixture run log and authored edited marker distinguish one producer per state/options key.
 * @evidence contracts/testing.md#distinguishing-cases Concurrent cold wave, source/config changes and noUnusedLocals option isolation.
 * @evidence contracts/testing.md#execution-ownership Named native-plugin E2E test_transformttsc_pooled_workers_compile_once_per_session is selected under native-plugins/transform by @ttsc/test-unplugin src/index.ts; this body and its invoked helpers own the distinctions above.
 * @evidence contracts/e2e.md#necessary-boundary Real native producer and separate Node workers exchange session publications for concurrent cold wave, source/config changes and noUnusedLocals option isolation. In-process cache calls cannot establish cross-process locks, publication transport or adoption.
 * @evidence contracts/e2e.md#shared-execution One fixture project and private session publication store are reused across this case's workers/attempts. Native artifact builds use shared cache identity; separate workers are needed for publication/adoption, and changed state or producer inputs legitimately require the compile counts above.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private project, run log and session/store roots prevent other workers' publications from satisfying this case. Worker processes complete before assertions inspect state, except the explicitly killed producer in the recovery case. Tracked roots are removed at process exit; cache instances used directly here have no explicit finally disposal, and abrupt cancellation is not exercised.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: Three workers return PROBED at count one, source edit produces edited/count two, config edit yields three, different compiler options yield four. These tags transfer no portable cases and remove no behavioral checks. Native setup and cleanup limitations above remain explicit.
 */
export async function test_transformttsc_pooled_workers_compile_once_per_session(): Promise<void> {
  const project = createCacheProject({ fileCount: 3 });
  const modules = projectModules(project.root);
  const session = TestProject.tmpdir("ttsc-unplugin-pooled-session-");
  const compiles = () =>
    fs.existsSync(project.runLog) ? fs.statSync(project.runLog).size : 0;
  const wave = async (options?: Record<string, unknown>) => {
    const results = await Promise.all(
      modules.map((file) => runPooledWorker({ file, options, session })),
    );
    for (const result of results) {
      assert.equal(result.error, undefined, result.error);
      assert.match(result.code ?? "", /PROBED/);
    }
    return results;
  };

  await wave();
  assert.equal(compiles(), 1, "three workers compile the project once");

  fs.appendFileSync(modules[0]!, "export const edited = 1;\n");
  const edited = await wave();
  assert.equal(compiles(), 2, "an edit recompiles once across the pool");
  assert.match(edited[0]!.code ?? "", /edited/);

  const tsconfig = path.join(project.root, "tsconfig.json");
  const config = JSON.parse(fs.readFileSync(tsconfig, "utf8"));
  config.compilerOptions.removeComments = true;
  fs.writeFileSync(tsconfig, JSON.stringify(config, null, 2));
  await wave();
  assert.equal(compiles(), 3, "a config edit recompiles once across the pool");

  await wave({ compilerOptions: { noUnusedLocals: true } });
  assert.equal(compiles(), 4, "other options compile, once, for themselves");
}
