import { TestProject } from "@ttsc/testing";

import { SHARED_GO_BUILD_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  os,
  path,
  nativePluginSource,
  spawn,
  ttsxBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx relative cache dir builds source plugin under
 * cwd option.
 *
 * `ttsx` accepts the same `--cwd` and `--cache-dir` flags as `ttsc`, and a
 * relative `--cache-dir` must anchor to `--cwd`, not the process working
 * directory. This mirrors the `ttsc` behaviour tested in
 * `test_plugin_corpus_relative_cache_dir_resolves_from_cwd_option` but
 * validates the ttsx code path separately since ttsx has its own argument
 * parsing.
 *
 * 1. Copy `go-source-plugin` and create a separate `driverCwd`.
 * 2. Run ttsx from `driverCwd` with `--cwd <root> --cache-dir .ttsx-cache`.
 * 3. Assert zero exit, stdout `"PLUGIN"`, plugin cache under
 *    `<root>/.ttsx-cache/`, cleaned project output, and no cache under
 *    `<driverCwd>/.ttsx-cache/`.
 *
 * @evidence contracts/testing.md#behavioral-verification Zero exit, literal PLUGIN and positive/negative cache directories distinguish project cwd from driver cwd.
 * @evidence contracts/testing.md#independent-expectations Literal output and separately created driver path establish independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases Owns relative cache anchoring, transient project-output cleanup and absence of driver cache.
 * @evidence contracts/testing.md#execution-ownership The matching named native export owns one runtime invocation in the Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary Actual runtime passes cwd through native producer build and consumption; path units do not execute this connection.
 * @evidence contracts/e2e.md#shared-execution Immutable runtime producer and Go objects are shared; the observed relative plugin cache remains fresh.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh consumer and driver paths isolate the case; immutable source and production keys establish object reuse.
 * @evidence contracts/e2e.md#preserved-coverage All original status, stdout and cache directory assertions remain; compiler provenance replaces the unsupported handmade emitter.
 */
export function test_plugin_corpus_ttsx_relative_cache_dir_builds_source_plugin_under_cwd_option(): void {
    const root = copyProject("go-source-plugin");
    fs.writeFileSync(path.join(root, "plugin.cjs"), `module.exports = () => ({
      name: "go-source-plugin",
      capabilities: { emitProvenance: true },
      source: ${JSON.stringify(nativePluginSource("runtime-source"))},
    });`);
    const driverCwd = TestProject.tmpdir("ttsx-driver-");
    const cacheDir = ".ttsx-cache";

    const result = spawn(
      ttsxBin,
      ["--cwd", root, "--cache-dir", cacheDir, "src/main.ts"],
      {
        cwd: driverCwd,
        // The Go objects are the suite's; the case observes the plugin cache.
        env: { PATH: goPath(), TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "PLUGIN");
    const projectCache = path.join(root, cacheDir, "project");
    assert.equal(fs.existsSync(projectCache), true);
    assert.deepEqual(fs.readdirSync(projectCache), []);
    assert.equal(fs.existsSync(path.join(root, cacheDir, "plugins")), true);
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "project")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(driverCwd, cacheDir, "plugins")),
      false,
    );
  }
