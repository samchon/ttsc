import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { TestBanner } from "../../internal/TestBanner";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies the @ttsc/banner plugin: shared host ignores future optional flags.
 *
 * The plugin host binary's `transform` subcommand is versioned separately from
 * the JS launcher. A newer launcher may pass flags that an older binary does
 * not know about (e.g. `--future-optional-flag`). The host must ignore unknown
 * optional flags and still run successfully, rather than exiting with an
 * "unknown flag" error. This ensures forward-compatibility without forcing a
 * synchronised binary upgrade.
 *
 * 1. Build a project with a `banner.config.cjs` file referenced via `configFile`,
 *    then use `loadProjectPlugins` to obtain the compiled native binary path.
 * 2. Invoke the binary's `transform` subcommand directly, passing an unrecognised
 *    `--future-optional-flag` alongside valid required flags.
 * 3. Assert zero exit status, parse stdout as a JSON transform envelope and
 *    verify the original source value in its relative-keyed TypeScript map.
 *
 * @evidence contracts/testing.md#behavioral-verification The resolved native transform binary must accept the future optional flag, exit zero and return a parseable transform envelope whose src/main.ts text retains future-flag.
 * @evidence contracts/testing.md#independent-expectations Host compatibility permits unknown optional flags; the transform envelope contract requires relative-keyed source text, and the authored future-flag literal must survive printing.
 * @evidence contracts/testing.md#distinguishing-cases A valid project plus an unrecognized flag rejects a strict unknown-flag parser. JSON parsing and the literal source-value check reject malformed marker-only output or a lost source; this case does not validate every optional envelope field.
 * @evidence contracts/testing.md#execution-ownership This named test_banner_shared_host_ignores_future_optional_flags entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary The actual native executable argument parser and transform protocol must accept launcher-forwarded optional arguments.
 * @evidence contracts/e2e.md#shared-execution The shared native artifact is resolved once and executed directly once; ordinary launcher emit cannot supply this future flag. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage The resolved native transform binary must accept the future optional flag, exit zero and return a parseable transform envelope whose src/main.ts text retains future-flag. All original assertions remain in this named entry. Direct preamble/config/map unit cases do not claim this launcher and serialization connection.
 */
export function test_banner_shared_host_ignores_future_optional_flags() {
  const root = TestProject.createProject({
    "banner.config.cjs": `module.exports = { text: "future flag" };\n`,
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [
          {
            transform: "@ttsc/banner",
            configFile: "banner.config.cjs",
          },
        ],
      },
      include: ["src"],
    }),
    "src/main.ts": `export const value: string = "future-flag";\n`,
  });
  TestBanner.seedPackage(root);

  const { loadProjectPlugins } = TestProject.REQUIRE_FROM_TEST(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "lib",
      "plugin",
      "internal",
      "load",
      "loadProjectPlugins.js",
    ),
  );
  const previousPath = process.env.PATH;
  const previousCacheDir = process.env.TTSC_CACHE_DIR;
  process.env.PATH = TestBanner.goPath();
  process.env.TTSC_CACHE_DIR = SHARED_PLUGIN_CACHE_DIR;
  let loaded;
  try {
    loaded = loadProjectPlugins({
      binary: TestProject.NATIVE_BINARY,
      cwd: root,
      tsconfig: path.join(root, "tsconfig.json"),
    });
  } finally {
    process.env.PATH = previousPath;
    if (previousCacheDir === undefined) {
      delete process.env.TTSC_CACHE_DIR;
    } else {
      process.env.TTSC_CACHE_DIR = previousCacheDir;
    }
  }
  const loadedBinary = loaded.nativePlugins[0]?.binary;
  assert.equal(typeof loadedBinary, "string");
  const pluginsJson = JSON.stringify(
    loaded.nativePlugins.map(
      (plugin: { config: unknown; name: string; stage: string }) => ({
        config: plugin.config,
        name: plugin.name,
        stage: plugin.stage,
      }),
    ),
  );

  const result = TestProject.spawn(
    loadedBinary,
    [
      "transform",
      "--cwd",
      root,
      "--tsconfig",
      path.join(root, "tsconfig.json"),
      "--plugins-json",
      pluginsJson,
      "--future-optional-flag",
      "ignored-value",
    ],
    { cwd: root },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"typescript"/);
  const envelope = JSON.parse(result.stdout);
  assert.equal(typeof envelope.typescript?.["src/main.ts"], "string");
  assert.match(envelope.typescript["src/main.ts"], /future-flag/);
}
