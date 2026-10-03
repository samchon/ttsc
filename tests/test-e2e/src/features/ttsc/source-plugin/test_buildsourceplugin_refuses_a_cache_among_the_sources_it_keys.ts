import { TestProject } from "@ttsc/testing";

import {
  assert,
  buildSourcePlugin,
  createFakeGoBinary,
  fs,
  path,
} from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a plugin build refuses a cache that lies among the sources its key
 * digests, and accepts one below a directory the sources never include.
 *
 * A build writes its binary, its lock, and Go's objects below its caches. A
 * cache inside a keyed source directory therefore changes the source while the
 * build runs, so the binary can never be published under the key it was built
 * for (samchon/ttsc#1505) and each later build keys a new state. The build says
 * so before creating publication caches, after key metadata queries. The
 * default cache sits in `node_modules`, which the
 * sources never include, and so does any cache placed there.
 *
 * 1. Build a plugin whose explicit cache is a directory of its own module: the
 *    build fails naming the cache and the module, and nothing is written
 *    there.
 * 2. Build it with its Go build cache there instead: the same refusal.
 * 3. Build it with both caches below the module's `node_modules`: it succeeds.
 *
 * @evidence contracts/testing.md#behavioral-verification buildSourcePlugin refuses plugin and Go caches within keyed source, leaves the refused plugin cache absent, and accepts both below excluded node_modules.
 * @evidence contracts/testing.md#independent-expectations Writes among keyed inputs cannot name a stable source binary; the documented excluded node_modules location is the permitted boundary.
 * @evidence contracts/testing.md#distinguishing-cases Plugin cache and Go object cache each get a rejection case, with an excluded-directory success control.
 * @evidence contracts/testing.md#execution-ownership The exported test_buildsourceplugin_refuses_a_cache_among_the_sources_it_keys entry is discovered by TestExecutor from features/source-plugin in the E2E runner population. Helper callbacks and embedded worker scripts execute beneath this named owner and are not separately selectable Evidence hosts.
 * @evidence contracts/e2e.md#necessary-boundary buildSourcePlugin passes actual executable arguments, cwd, environment and copied workspace inputs through a child process before publication. The fake Go script can fail or record those inputs independently; it proves build orchestration at this process boundary and does not certify native Go compilation.
 * @evidence contracts/e2e.md#shared-execution Three explicit cache-authority requests share one six-file module/fake tool, with independently collected inside-plugin/inside-Go/excluded-directory outcomes. Actual key metadata commands precede admission, so rejected publication is not zero subprocesses. Accepted cache paths are a distinct control, not a shared cache-hit or actual Go compilation certificate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Tracked root is retained before preparation; environments/cache pairs are call-local with ambient fallback preserved. Original order and source topology remain, rejected plugin-cache absence is asserted but rejected Go-cache absence is not. Unexpected writes/failures remain failures rather than resetting keyed inputs to hide them; direct synchronous return is not arbitrary descendant join.
 * @evidence contracts/e2e.md#preserved-coverage Original named plugin-cache refusal/absent, named Go-cache refusal and node_modules two-cache binary-exists control remain; each outcome is collected independently. Existing source predicate owner tests/test-ttsc/src/features/api/test_plugin_source_covers_answers_by_the_build_prune_rule.ts owns directory containment/pruned node_modules distinction, not builder metadata order/process/publication or actual execution certification. Actual builder cache admission assembly remains here. New callable0, runtime/selection/survival unverified and donor retained.
 */
export const test_buildsourceplugin_refuses_a_cache_among_the_sources_it_keys =
  () => {
    const root = TestProject.tmpdir("ttsc-plugin-cache-in-source-");
    TestProject.retainTemporaryDirectory(root, "Cache admission tool descendants are not joined");
    const plugin = path.join(root, "plugin");
    write(
      path.join(plugin, "go.mod"),
      "module example.com/plugin\n\ngo 1.26\n",
    );
    write(path.join(plugin, "main.go"), "package main\n");
    // The files the fake Go build requires of the module it compiles.
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ])
      write(path.join(plugin, relative), "package generated\n");
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const goBinary = createFakeGoBinary(fakeGo);
    const outside = path.join(root, "outside");
    const build = (cacheDir: string, goCacheDir: string): string =>
      buildSourcePlugin({
        baseDir: root,
        cacheDir,
        env: {
          ...process.env,
          TTSC_GO_BINARY: goBinary,
          TTSC_GO_CACHE_DIR: goCacheDir,
        },
        overlayDirs: [],
        pluginName: "cache-in-source",
        quiet: true,
        source: plugin,
        ttscVersion: "1.0.0",
        tsgoVersion: "7.0.0-dev",
      });
    const refused = (cache: string) => (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      return (
        message.includes(`the cache ${cache} lies inside the plugin source`) &&
        message.includes(plugin)
      );
    };
    const failures: unknown[] = [];

    // 1. The plugin cache inside the module.
    const pluginCache = path.join(plugin, "cache");
    try {
      assert.throws(
        () => build(pluginCache, path.join(outside, "go")),
        refused(pluginCache),
      );
      assert.equal(
        fs.existsSync(pluginCache),
        false,
        "nothing was written there",
      );
    } catch (error) {
      failures.push(new Error("Plugin cache among keyed sources", { cause: error }));
    }

    // 2. The Go build cache inside the module.
    const goCache = path.join(plugin, "go-cache");
    try {
      assert.throws(
        () => build(path.join(outside, "plugins"), goCache),
        refused(goCache),
      );
    } catch (error) {
      failures.push(new Error("Go cache among keyed sources", { cause: error }));
    }

    // 3. Both below the module's node_modules, which the sources never include.
    try {
      const binary = build(
        path.join(plugin, "node_modules", ".cache", "plugins"),
        path.join(plugin, "node_modules", ".cache", "go"),
      );
      assert.ok(fs.existsSync(binary), binary);
    } catch (error) {
      failures.push(new Error("Excluded node_modules cache control", { cause: error }));
    }
    if (failures.length) throw new AggregateError(failures, "Source cache admission outcomes");
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
