import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  loadProjectPlugins,
  path,
} from "../../../internal/ttsc/internal/project";
import { createFakeGoBinary } from "../../../internal/ttsc/internal/source-build";

/**
 * Verifies a cold CommonJS descriptor evaluation preloads runtime hooks without
 * loading the TypeScript build chain into `require.cache`.
 *
 * A cold `loadProjectPlugins` call spawns an isolated Node evaluator with
 * `--require runtimeHookPreload.js`. Plain `.cjs` descriptors never compile
 * TypeScript sources, so the preload must install the hooks without eagerly
 * loading `runBuild`, `buildSingleRootProject`, `RuntimeBuildCache`,
 * `RuntimeManifestRegistry`, or the rest of the build path.
 *
 * 1. Create a cold project with one `.cjs` plugin descriptor that snapshots
 *    `Object.keys(require.cache)` on its first line before returning a valid
 *    descriptor backed by a scripted Go module.
 * 2. Run `loadProjectPlugins` with Node as `TTSC_NODE_BINARY` and a fresh cache
 *    directory so the real isolated evaluator executes with
 *    `runtimeHookPreload.js`.
 * 3. Assert `runtimeHookPreload.js` and `installRuntimeHooks.js` were loaded, the
 *    plugin descriptor succeeded, and none of the build-chain modules entered
 *    `require.cache`.
 *
 * @evidence contracts/testing.md#behavioral-verification Cold loadProjectPlugins evaluates a real CommonJS descriptor under runtimeHookPreload.js, returning the authored plugin while proving runtimeHookPreload.js and installRuntimeHooks.js ran and no build-chain module entered require.cache at descriptor entry.
 * @evidence contracts/testing.md#independent-expectations The descriptor records Node's own require.cache keys on its first line and checks them against explicit built lib paths for both required preload modules and prohibited build-chain modules, independently of hook internals.
 * @evidence contracts/testing.md#distinguishing-cases Positive membership of runtimeHookPreload.js and installRuntimeHooks.js separates lazy deferral from skipping preload altogether, while negative checks cover the full build and TypeScript-serving closure; TypeScript descriptor compilation belongs to the existing TypeScript-descriptor and ttsx-runtime tests.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch owns this E2E entry under ttsc/project; it exercises the built loader and isolated Node evaluator with a scripted Go binary rather than mocking module loading.
 * @evidence contracts/e2e.md#necessary-boundary The real loadProjectPlugins-to-Node `--require runtimeHookPreload.js` child boundary decides what enters require.cache before descriptor execution; unit calls to hook helpers cannot observe cold preload module graphs.
 * @evidence contracts/e2e.md#shared-execution One temporary project, one fresh cache root and one scripted Go module serve the single cold evaluator launch without rebuilding real Go sources or launching extra processes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject allocates and retains an isolated temporary root with a fresh cache directory so no prior descriptor cache entry can answer; call-local env leaves ambient process.env unchanged, and synchronous loadProjectPlugins finishes before assertions.
 * @evidence contracts/e2e.md#preserved-coverage This new regression adds cold CommonJS preload cache bounds without altering any existing descriptor or runtime-hook test coverage.
 */
export const test_loadprojectplugins_cjs_descriptor_defers_runtime_build_modules =
  (): void => {
    const root = TestProject.tmpdir("ttsc-cjs-descriptor-lazy-build-");
    TestProject.retainTemporaryDirectory(
      root,
      "Descriptor evaluation descendants are not joined",
    );
    const project = path.join(root, "project");
    const goModule = path.join(root, "plugin-go");
    const reportPath = path.join(root, "require-cache.json");
    write(
      path.join(goModule, "go.mod"),
      "module example.com/lazy-build\n\ngo 1.26\n",
    );
    write(path.join(goModule, "main.go"), "package main\n");
    for (const relative of [
      "vendor/local/value.go",
      "lib/helper.go",
      "dist/generated.go",
      "build/generated.go",
    ]) {
      write(path.join(goModule, relative), "package generated\n");
    }
    write(
      path.join(project, "package.json"),
      JSON.stringify({ private: true }),
    );
    write(
      path.join(project, "plugin.cjs"),
      [
        "const loadedAtEntry = Object.keys(require.cache);",
        'const fs = require("node:fs");',
        "fs.writeFileSync(process.env.TTSC_TEST_CACHE_REPORT, JSON.stringify(loadedAtEntry), 'utf8');",
        `module.exports = () => (${JSON.stringify({
          name: "lazy-cjs-descriptor",
          source: goModule,
        })});`,
        "",
      ].join("\n"),
    );
    const tsconfig = path.join(project, "tsconfig.json");
    write(
      tsconfig,
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          plugins: [{ transform: "./plugin.cjs" }],
        },
      }),
    );
    const fakeGo = path.join(root, "fake-go");
    fs.mkdirSync(fakeGo, { recursive: true });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      TTSC_GO_BINARY: createFakeGoBinary(fakeGo),
      TTSC_GO_CACHE_DIR: path.join(root, "go-cache"),
      TTSC_NODE_BINARY: process.execPath,
      TTSC_TEST_CACHE_REPORT: reportPath,
    };
    const loaded = loadProjectPlugins({
      binary: "",
      cacheDir: path.join(root, "cache"),
      cwd: project,
      env,
      tsconfig,
    });
    assert.equal(loaded.nativePlugins[0]?.name, "lazy-cjs-descriptor");

    const cacheKeys = (
      JSON.parse(fs.readFileSync(reportPath, "utf8")) as string[]
    ).map((entry) => entry.replace(/\\/g, "/"));
    assert.ok(
      cacheKeys.some((entry) =>
        entry.endsWith(
          "/packages/ttsc/lib/launcher/internal/runtimeHookPreload.js",
        ),
      ),
      "expected runtimeHookPreload.js to be loaded",
    );
    assert.ok(
      cacheKeys.some((entry) =>
        entry.endsWith(
          "/packages/ttsc/lib/launcher/internal/runtime/installRuntimeHooks.js",
        ),
      ),
      "expected installRuntimeHooks.js to be loaded",
    );

    const prohibitedSuffixes = [
      "/packages/ttsc/lib/compiler/internal/EmitOwnershipIndex.js",
      "/packages/ttsc/lib/compiler/internal/build/RuntimeBuildCache.js",
      "/packages/ttsc/lib/compiler/internal/build/RuntimeBuildExplanation.js",
      "/packages/ttsc/lib/compiler/internal/build/privateRuntimeRootDir.js",
      "/packages/ttsc/lib/compiler/internal/build/runBuild.js",
      "/packages/ttsc/lib/compiler/internal/build/BuildExecution.js",
      "/packages/ttsc/lib/compiler/internal/build/RuntimeEmitBundle.js",
      "/packages/ttsc/lib/compiler/internal/project/readProjectConfig.js",
      "/packages/ttsc/lib/compiler/internal/project/resolveOwningProjectConfig.js",
      "/packages/ttsc/lib/compiler/internal/resolveTsgo.js",
      "/packages/ttsc/lib/compiler/internal/sharedHost/SidecarEnvironment.js",
      "/packages/ttsc/lib/compiler/internal/spawnNative.js",
      "/packages/ttsc/lib/internal/createCanonicalTempDirectory.js",
      "/packages/ttsc/lib/internal/runtimeExecutableIdentity.js",
      "/packages/ttsc/lib/plugin/internal/load/loadProjectPlugins.js",
      "/packages/ttsc/lib/plugin/internal/source/PluginContentIdentities.js",
      "/packages/ttsc/lib/plugin/internal/source/SourceBuildCacheLayout.js",
      "/packages/ttsc/lib/plugin/internal/source/recordCacheFileUse.js",
      "/packages/ttsc/lib/plugin/internal/source/resolveSourceBuildCachePaths.js",
      "/packages/ttsc/lib/launcher/internal/buildSingleRootProject.js",
      "/packages/ttsc/lib/launcher/internal/runtimeCompilerArgs.js",
      "/packages/ttsc/lib/launcher/internal/runtime/DependencyBuildAdmission.js",
      "/packages/ttsc/lib/launcher/internal/runtime/DependencyBuildGeneration.js",
      "/packages/ttsc/lib/launcher/internal/runtime/OwnedProjectSource.js",
      "/packages/ttsc/lib/launcher/internal/runtime/RuntimeBuildPath.js",
      "/packages/ttsc/lib/launcher/internal/runtime/RuntimeDependencyPrebuild.js",
      "/packages/ttsc/lib/launcher/internal/runtime/RuntimeEmitProvenance.js",
      "/packages/ttsc/lib/launcher/internal/runtime/RuntimeEntrySources.js",
      "/packages/ttsc/lib/launcher/internal/runtime/RuntimeIsolatedEmit.js",
      "/packages/ttsc/lib/launcher/internal/runtime/RuntimeManifestRegistry.js",
      "/packages/ttsc/lib/launcher/internal/runtime/RuntimeModuleFormat.js",
      "/packages/ttsc/lib/launcher/internal/runtime/RuntimeProjectOwnership.js",
      "/packages/ttsc/lib/launcher/internal/runtime/dependencyCacheKey.js",
      "/packages/ttsc/lib/launcher/internal/runtime/dependencyCacheRoot.js",
      "/packages/ttsc/lib/launcher/internal/runtime/projectModuleOptions.js",
      "/packages/ttsc/lib/launcher/internal/runtime/readDependencyCache.js",
      "/packages/ttsc/lib/launcher/internal/runtime/selectRuntimePluginPolicy.js",
    ];
    const unexpected = prohibitedSuffixes.filter((suffix) =>
      cacheKeys.some((entry) => entry.endsWith(suffix)),
    );
    assert.deepEqual(
      unexpected,
      [],
      `build-chain modules were loaded eagerly before a .cjs descriptor ran:\n${unexpected.join("\n")}`,
    );
    const compilerLoaded = cacheKeys.filter((entry) =>
      entry.includes("/packages/ttsc/lib/compiler/"),
    );
    assert.deepEqual(
      compilerLoaded,
      [],
      `compiler modules were loaded eagerly before a .cjs descriptor ran:\n${compilerLoaded.join("\n")}`,
    );
  };

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}
