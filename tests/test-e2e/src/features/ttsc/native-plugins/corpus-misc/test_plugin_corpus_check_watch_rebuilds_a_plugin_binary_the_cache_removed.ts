import { TestProject } from "@ttsc/testing";

import { SHARED_GO_BUILD_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
} from "../../../../internal/ttsc/internal/plugin-corpus";
import { loadProjectPlugins } from "../../../../internal/ttsc/internal/project";
import { WatchSession } from "../../../../internal/ttsc/internal/watch";

/**
 * Verifies a watch session rebuilds a plugin binary the cache removed while the
 * session still used it.
 *
 * A `ttsc --watch` session resolves its check plugins once and keeps their
 * binary paths across cycles. When the cache's collector removed an entry the
 * session still used, the session went on naming the removed path, and the
 * sidecar respawn or one-shot fallback that needed it could not start the
 * plugin (samchon/ttsc#1556). A cycle that finds a binary gone now sends the
 * session back through plugin resolution, which builds it again.
 *
 * The binary is moved aside rather than deleted: a running executable cannot be
 * deleted on Windows but can be renamed, and either way the session's path
 * names nothing. The session builds into a cache of its own, since the test
 * removes an entry's binary.
 *
 * 1. Start `ttsc --noEmit --watch` on a lint project, wait for it to settle, and
 *    look up the lint binary the session resolved.
 * 2. Move the binary aside and edit a source.
 * 3. Assert the cycle built the binary again at its path and still checks.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watch restores the missing binary pathname and processes the edited source after the running binary is moved aside.
 * @evidence contracts/testing.md#independent-expectations The controlled rename makes the selected executable path absent, and filesystem existence plus the literal changed source line independently establish restoration and continued checking.
 * @evidence contracts/testing.md#distinguishing-cases Owns a binary disappearing after initial resolution, contrasting metadata refresh with an existing binary and ordinary compatible resident reuse.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-misc export runs the real watcher and source-plugin resolver/cache in the corpus-misc population; this body has no platform admission filter.
 * @evidence contracts/e2e.md#necessary-boundary The persistent watch execution must detect a gone executable and return through native resolution before the next cycle can spawn it; direct cache-admission units cannot prove that reload connection.
 * @evidence contracts/e2e.md#shared-execution One isolated plugin cache and watcher preserve the missing-path transition with the suite Go-cache location available. Restored pathname availability is asserted; compiler-object reuse, build counts and loaded-image equality are not measured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The rename touches only this private cache, which is an owned input root retained on uncertain WatchSession close. Body/close failures are retained separately. Actual native rename must succeed on the executing host, without certifying other platforms or arbitrary descendant termination.
 * @evidence contracts/e2e.md#preserved-coverage Original restored-path existence and edited-source checks remain with their bounded waits. They establish availability and continued checking, not a build-count or binary-content oracle absent from the original case.
 */
export async function test_plugin_corpus_check_watch_rebuilds_a_plugin_binary_the_cache_removed(): Promise<void> {
  const root = setupLintProject("lint-violations");
  fs.writeFileSync(
    path.join(root, "lint.config.json"),
    JSON.stringify({ rules: { "no-var": "error" } }),
  );
  const source = path.join(root, "src", "main.ts");
  fs.writeFileSync(source, "var legacy = 1;\nJSON.stringify(legacy);\n");
  const cacheDir = TestProject.tmpdir("ttsc-watch-plugin-removed-");
  // The plugin cache is the case's own; the Go objects it builds from are
  // the suite's, which the case never reads.
  const env = {
    PATH: goPath(),
    TTSC_CACHE_DIR: cacheDir,
    TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
  };
  const session = new WatchSession(root, {
    args: ["--noEmit", "--diagnostics"],
    ownedInputRoots: [cacheDir],
    env,
  });
  const failures: unknown[] = [];
  try {
    await session.waitForBuilds(1, 300_000);
    await session.waitForSettled();
    const binary = loadProjectPlugins({
      binary: "",
      cacheDir,
      cwd: root,
      env: { ...process.env, ...env },
      tsconfig: path.join(root, "tsconfig.json"),
    }).nativePlugins.find((plugin) => plugin.name === "@ttsc/lint")!.binary;
    fs.renameSync(binary, `${binary}.removed`);
    assert.equal(
      fs.existsSync(binary),
      false,
      "the selected binary path is absent after rename",
    );

    // A cycle queued before the move may still run on the old binary; the
    // edit's own cycle is the one that must find it gone.
    fs.writeFileSync(source, "var legacy = 2;\nJSON.stringify(legacy);\n");
    await waitFor(
      () => fs.existsSync(binary),
      `the removed binary is built again:\n${session.transcript()}`,
    );
    await waitFor(
      () => session.transcript().includes("var legacy = 2"),
      `the session checks the edit:\n${session.transcript()}`,
    );
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      await session.close();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Resident check watch and shutdown failed",
    );
}

async function waitFor(
  condition: () => boolean,
  message: string,
): Promise<void> {
  const deadline = Date.now() + 300_000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
