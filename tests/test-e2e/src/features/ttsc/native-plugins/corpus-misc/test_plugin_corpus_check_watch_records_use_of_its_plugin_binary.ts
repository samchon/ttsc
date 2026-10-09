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
 * Verifies a watch session records each cycle's use of the plugin binary it
 * keeps running, so the cache's collector does not take it for unused.
 *
 * A `ttsc --watch` session resolves its check plugins once and reuses the
 * resident sidecar across compatible edits, which records no use in the
 * binary's cache entry: only a build or a cache hit did. The collector removes
 * an entry whose last use is old, so a long session's binary aged out while the
 * session still ran it (samchon/ttsc#1556). Each cycle now records the use. The
 * session builds into a cache of its own, since the test ages an entry.
 *
 * 1. Start `ttsc --noEmit --watch` on a lint project, wait for it to settle, and
 *    look up the lint binary the session resolved.
 * 2. Age the binary's cache entry and make an edit the resident sidecar serves.
 * 3. Assert the cycle reached the same sidecar and recorded its use.
 *
 * @evidence contracts/testing.md#behavioral-verification Real watch updates the aged last-used timestamp after the edited source reaches the same resident PID.
 * @evidence contracts/testing.md#independent-expectations The explicitly forty-day-old stamp and twenty-four-hour-later lower bound distinguish actual refresh from untouched metadata; a literal edited source line confirms the relevant cycle occurred.
 * @evidence contracts/testing.md#distinguishing-cases Owns compatible resident reuse and cache-use refresh while a binary is already running, distinct from physically missing binary restoration.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-misc export runs actual WatchSession, loader lookup and native cache metadata operations in the generic corpus-misc population; no platform filter is present in this body.
 * @evidence contracts/e2e.md#necessary-boundary Each watcher cycle must record real use despite reusing an existing sidecar instead of resolving a new binary; a cache writer unit cannot prove the watch cycle invokes it.
 * @evidence contracts/e2e.md#shared-execution One private plugin cache is necessary because its stamp is aged; the suite Go-cache location is available and reported resident PID equality is asserted. No object-cache hit, recompilation count or loaded-image identity is measured.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only the isolated cache entry stamp is mutated, the source lives in a private consumer fixture, a positive non-self reported PID is required before equality, and the private cache is tracked for retention on uncertain close. Body and close failures are retained independently; arbitrary descendant termination is not certified.
 * @evidence contracts/e2e.md#preserved-coverage Original edited-line wait, same PID and refreshed timestamp threshold remain. The private cache cannot be replaced by a globally warm entry because metadata aging is the tested transition.
 */
export async function test_plugin_corpus_check_watch_records_use_of_its_plugin_binary(): Promise<void> {
  const root = setupLintProject("lint-violations");
  fs.writeFileSync(
    path.join(root, "lint.config.json"),
    JSON.stringify({ rules: { "no-var": "error" } }),
  );
  const source = path.join(root, "src", "main.ts");
  fs.writeFileSync(source, "var legacy = 1;\nJSON.stringify(legacy);\n");
  const cacheDir = TestProject.tmpdir("ttsc-watch-plugin-use-");
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
    await session.waitForBuilds(1);
    await session.waitForSettled();
    const binary = loadProjectPlugins({
      binary: "",
      cacheDir,
      cwd: root,
      env: { ...process.env, ...env },
      tsconfig: path.join(root, "tsconfig.json"),
    }).nativePlugins.find((plugin) => plugin.name === "@ttsc/lint")!.binary;
    const lastUsed = path.join(path.dirname(binary), ".last-used");
    const residents = (): string[] =>
      [
        ...session
          .transcript()
          .matchAll(/@ttsc\/lint resident check: pid=(\d+)/g),
      ].map((match) => match[1]!);
    const resident = residents().at(-1);
    assert.ok(
      resident !== undefined &&
        Number.isSafeInteger(Number(resident)) &&
        Number(resident) > 0 &&
        Number(resident) !== process.pid,
      session.transcript(),
    );
    const aged = Date.now() - 40 * 24 * 60 * 60 * 1000;
    fs.writeFileSync(lastUsed, `${aged}\n`);

    fs.writeFileSync(source, "var legacy = 2;\nJSON.stringify(legacy);\n");
    // The edit's own cycle, which started after the entry was aged, is the
    // one that reports the edited line.
    const deadline = Date.now() + 120_000;
    while (!session.transcript().includes("var legacy = 2")) {
      assert.ok(
        Date.now() < deadline,
        `the edit never reached the sidecar:\n${session.transcript()}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(
      residents().at(-1),
      resident,
      `the cycle reused the resident sidecar:\n${session.transcript()}`,
    );
    const recorded = Number(fs.readFileSync(lastUsed, "utf8"));
    assert.ok(
      recorded > aged + 24 * 60 * 60 * 1000,
      `the cycle recorded its use of the binary:\n${session.transcript()}`,
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
      "Watch use recording and shutdown failed",
    );
}
