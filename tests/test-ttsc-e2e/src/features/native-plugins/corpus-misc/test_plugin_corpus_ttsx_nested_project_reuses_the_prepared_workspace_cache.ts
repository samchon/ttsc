import { SHARED_GO_BUILD_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  nativePluginSource,
  pluginCacheEntryDirs,
  spawn,
  ttscBin,
  ttsxBin,
} from "../../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ttsx nested project reuses the prepared workspace
 * cache.
 *
 * Cache-path equality is only useful if the real source-plugin builder consumes
 * it. This case warms a manifest-less fixture at its outer install root, then
 * enters through a nested tsconfig and proves no second Go build occurs.
 *
 * 1. Copy the source-plugin fixture and add a nested tsconfig.
 * 2. Prepare that project with the default cache and observe one cold build.
 * 3. Run it through ttsx, assert the warm binary is reused, and find one cache.
 *
 * @evidence contracts/testing.md#behavioral-verification One cold prepare build followed by PLUGIN without another build and one plugin entry proves real reuse.
 * @evidence contracts/testing.md#independent-expectations Explicit outer installation and nested config determine expected cache ownership independently.
 * @evidence contracts/testing.md#distinguishing-cases Owns prepare-to-runtime reuse across nested config, absence of nested installation and exact entry count.
 * @evidence contracts/testing.md#execution-ownership The matching named native export executes two actual CLI calls in the shared Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary Actual prepare publication must reach runtime with identical workspace and native binary identity.
 * @evidence contracts/e2e.md#shared-execution Canonical immutable runtime producer and Go objects are shared; default plugin cache is independently cold.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh outer installation and nested files isolate cache placement; unchanged producer identity governs warm reuse.
 * @evidence contracts/e2e.md#preserved-coverage Every original status, build diagnostic, stdout, absent nested directory and one-entry assertion remains.
 */
export function test_plugin_corpus_ttsx_nested_project_reuses_the_prepared_workspace_cache(): void {
    const root = copyProject("go-source-plugin");
    fs.writeFileSync(path.join(root, "plugin.cjs"), `module.exports = () => ({
      name: "go-source-plugin",
      capabilities: { emitProvenance: true },
      source: ${JSON.stringify(nativePluginSource("runtime-source"))},
    });`);
    fs.mkdirSync(path.join(root, "node_modules"));
    fs.mkdirSync(path.join(root, "test", "src"), { recursive: true });
    fs.copyFileSync(
      path.join(root, "src", "main.ts"),
      path.join(root, "test", "src", "main.ts"),
    );
    fs.writeFileSync(
      path.join(root, "test", "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          outDir: "../dist",
          plugins: [{ transform: "../plugin.cjs" }],
          rootDir: "src",
          strict: true,
          target: "ES2022",
        },
        include: ["src"],
      }),
      "utf8",
    );
    // The Go objects are the suite's; the case observes the default plugin
    // cache.
    const env = {
      PATH: goPath(),
      TTSC_CACHE_DIR: "",
      TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
    };

    const prepared = spawn(
      ttscBin,
      ["prepare", "--cwd", root, "--project", "test/tsconfig.json"],
      { cwd: root, env },
    );
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.match(prepared.stderr, /building source plugin "go-source-plugin"/);

    const executed = spawn(
      ttsxBin,
      ["--cwd", root, "--project", "test/tsconfig.json", "test/src/main.ts"],
      { cwd: root, env },
    );
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal(executed.stdout.trim(), "PLUGIN");
    assert.doesNotMatch(executed.stderr, /building source plugin/);
    assert.equal(fs.existsSync(path.join(root, "test", "node_modules")), false);
    assert.equal(
      pluginCacheEntryDirs(
        path.join(root, "node_modules", ".cache", "ttsc", "plugins"),
      ).length,
      1,
    );
  }
