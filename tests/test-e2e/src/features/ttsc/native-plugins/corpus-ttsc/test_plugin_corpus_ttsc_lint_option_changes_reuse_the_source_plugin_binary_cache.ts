import { TestProject } from "@ttsc/testing";

import { SHARED_GO_BUILD_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  pluginCacheEntryDirs,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint option changes reuse the source plugin
 * binary cache.
 *
 * Consumer rule options change while the snapshotted producer source stays
 * unchanged. The observed build-message polarity, cache entry and output
 * placement constrain that transition without independently certifying binary
 * byte reuse or the new rules' warning delivery on this clean source.
 *
 * 1. Run ttsc with `no-var: error` (cold build) and assert the binary is built.
 * 2. Swap `lint.config.json` to `no-explicit-any` and `prefer-template` and run
 *    again.
 * 3. Assert no build message appears, JS is emitted to the custom outDir, and one
 *    binary entry exists in the plugin cache.
 *
 * @evidence contracts/testing.md#behavioral-verification Cold lint check succeeds with a source-build message; changed rule options plus --emit/--outDir custom then succeed without that message, publish custom/main.js and leave dist/main.js absent, with one filtered cache entry. These observations do not independently count actual builds or certify binary-byte reuse.
 * @evidence contracts/testing.md#independent-expectations Literal build-message presence/absence, one cache entry and custom-versus-dist output are independent expectations. New rule options are input controls; this clean source does not independently assert their warning behavior or full native serialized payload.
 * @evidence contracts/testing.md#distinguishing-cases Owns cold-to-warm cache/output observations with changed runtime-rule inputs and emit/outDir overrides while snapshotted source remains unchanged. It does not certify Program reuse or each changed rule's semantic result.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-ttsc export in the generic E2E population. It owns two public CLI requests and both original cache/emit observation groups, with the workspace-linked lint package and actual snapshotted producer rather than a packed installation or Linux-only selection claim.
 * @evidence contracts/e2e.md#necessary-boundary The real descriptor/source cache and native launcher execute the changed-input transition while forwarding output overrides; an isolated cache-key or argument unit cannot prove these actual publication/output observations. Rule option delivery is not independently witnessed by a warning on this clean source.
 * @evidence contracts/e2e.md#shared-execution Snapshot producer preparation retains native Go-list/source hashing and copy-validation costs; it is not free setup. Initially empty private plugin cache preserves publication observations, with suite Go-object cache available for reuse. One cache entry/message polarity is not actual process/build total, Program reuse, executable-byte equality or minimum preparation cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject tracks copied consumer/snapshot/private cache; cache and both observed outputs start empty or absent. Rule changes remain consumer-owned. Both synchronous result groups check error/signal/status and retain independent failure collection before reporting. Arbitrary descendants/loaded-image equality are not certified; shared Go cache is not a consumer cleanup target.
 * @evidence contracts/e2e.md#preserved-coverage Original cold build-message presence, second build-message absence, successful statuses, custom output and one-entry assertions remain. The original emit input contributes noEmit true and absent dist/main.js to the second request; no observation is removed or strengthened into unobserved actual-build or rule-warning proof.
 */
export function test_plugin_corpus_ttsc_lint_option_changes_reuse_the_source_plugin_binary_cache(): void {
  const root = setupLintProject("lint-violations", {
    nativeProducer: "snapshot",
  });
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const value: string = "cache-options";\n`,
  );
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        noEmit: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/lint" }],
      },
      include: ["src"],
    }),
  );
  const writeConfig = (rules: Record<string, string>) => {
    fs.writeFileSync(
      path.join(root, "lint.config.json"),
      JSON.stringify({ rules }),
    );
  };
  const cacheDir = TestProject.tmpdir("ttsc-lint-cache-options-");
  assert.deepEqual(fs.readdirSync(cacheDir), []);
  assert.equal(fs.existsSync(path.join(root, "custom", "main.js")), false);
  assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);
  const env = {
    PATH: goPath(),
    TTSC_CACHE_DIR: cacheDir,
    TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
  };

  writeConfig({ "no-var": "error" });
  const first = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
    cwd: root,
    env,
  });
  const failures: unknown[] = [];
  try {
    assert.equal(first.error, undefined);
    assert.equal(first.signal, null);
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stderr, /building source plugin "@ttsc\/lint"/);
  } catch (error) {
    failures.push(
      new Error("cold source-plugin publication", { cause: error }),
    );
  }

  writeConfig({ "no-explicit-any": "warning", "prefer-template": "warning" });
  const second = spawn(
    ttscBin,
    ["--cwd", root, "--emit", "--outDir", "custom"],
    {
      cwd: root,
      env,
    },
  );
  try {
    assert.equal(second.error, undefined);
    assert.equal(second.signal, null);
    assert.equal(second.status, 0, second.stderr);
    assert.doesNotMatch(second.stderr, /building source plugin "@ttsc\/lint"/);
    assert.equal(fs.existsSync(path.join(root, "custom", "main.js")), true);

    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);

    const pluginCache = path.join(cacheDir, "plugins");
    const entries = pluginCacheEntryDirs(pluginCache);
    assert.equal(entries.length, 1);
  } catch (error) {
    failures.push(
      new Error("warm options and emit/outDir overrides", { cause: error }),
    );
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Cold/warm lint cache and emit scenarios failed",
    );
}
