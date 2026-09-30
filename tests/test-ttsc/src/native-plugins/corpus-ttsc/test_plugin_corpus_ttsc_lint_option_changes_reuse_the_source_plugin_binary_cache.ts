import { SHARED_GO_BUILD_CACHE_DIR } from "../../internal/plugin-cache";
import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  goPath,
  path,
  pluginCacheEntryDirs,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: @ttsc/lint option changes reuse the source plugin
 * binary cache.
 *
 * Rule configuration is passed at runtime as `--plugins-json`; it is not baked
 * into the binary. Changing which rules are enabled must not trigger a Go
 * rebuild because the binary itself is unchanged — only the runtime arguments
 * differ. Rebuilding on every config change would make lint impractically
 * slow.
 *
 * 1. Run ttsc with `no-var: error` (cold build) and assert the binary is built.
 * 2. Swap `lint.config.json` to `no-explicit-any` and `prefer-template` and run
 *    again.
 * 3. Assert no rebuild occurs, JS is emitted to the custom outDir, and only one
 *    binary entry exists in the plugin cache.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual cold lint check builds one producer, then changed rule options plus --emit/--outDir custom reuse that binary and override tsconfig noEmit without writing dist/main.js.
 * @evidence contracts/testing.md#independent-expectations Literal build-message presence then absence, one cache entry and custom-versus-dist output distinguish a cold build, runtime-only options and explicit CLI output overrides independently.
 * @evidence contracts/testing.md#distinguishing-cases Owns cold-to-warm binary reuse with changed runtime rules and emit/outDir overrides; consumer options change while producer source identity does not.
 * @evidence contracts/testing.md#execution-ownership The matching named corpus-ttsc export owns the two real CLI calls and both former cache/emit scenarios in the Linux native batch.
 * @evidence contracts/e2e.md#necessary-boundary The real descriptor cache and native launcher must retain runtime-only rule options while forwarding output overrides; an isolated cache-key or argument unit cannot prove the assembled transition.
 * @evidence contracts/e2e.md#shared-execution One immutable authored lint producer and an isolated cold plugin cache are necessary for the build assertion; shared Go object cache avoids recompiling equivalent compiler objects while the actual producer binary still must be published once.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The test owns its fresh plugin cache and mutable lint config, reuses only unchanged native source/Go objects, and checks a single published entry after both invocations; both CLI result groups are collected before failure is reported, and TestProject owns these directories.
 * @evidence contracts/e2e.md#preserved-coverage Original cold build, second no-build, successful statuses, custom output and one-entry assertions remain. The former independent emit case contributes noEmit true and absent dist output to the same second invocation.
 */
export function test_plugin_corpus_ttsc_lint_option_changes_reuse_the_source_plugin_binary_cache(): void {
  const root = setupLintProject("lint-violations", { nativeProducer: "snapshot" });
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
    assert.equal(first.status, 0, first.stderr);
    assert.match(first.stderr, /building source plugin "@ttsc\/lint"/);
  } catch (error) {
    failures.push(new Error("cold source-plugin publication", { cause: error }));
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
    assert.equal(second.status, 0, second.stderr);
    assert.doesNotMatch(second.stderr, /building source plugin "@ttsc\/lint"/);
    assert.equal(fs.existsSync(path.join(root, "custom", "main.js")), true);

    assert.equal(fs.existsSync(path.join(root, "dist", "main.js")), false);

    const pluginCache = path.join(cacheDir, "plugins");
    const entries = pluginCacheEntryDirs(pluginCache);
    assert.equal(entries.length, 1);
  } catch (error) {
    failures.push(new Error("warm options and emit/outDir overrides", { cause: error }));
  }
  if (failures.length) throw new AggregateError(failures, "Cold/warm lint cache and emit scenarios failed");
}
