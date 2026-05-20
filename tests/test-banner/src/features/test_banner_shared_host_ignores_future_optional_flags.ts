import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

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
 * 1. Build a project and load its plugins via `loadProjectPlugins` to obtain the
 *    compiled native binary path.
 * 2. Invoke the binary's `transform` subcommand directly, passing an unrecognised
 *    `--future-optional-flag` alongside valid required flags.
 * 3. Assert zero exit status and that stdout contains valid JSON output (the
 *    `"typescript"` version field).
 */
export const test_banner_shared_host_ignores_future_optional_flags = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/banner", text: "future flag" }],
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
      "loadProjectPlugins.js",
    ),
  );
  const previousPath = process.env.PATH;
  const previousCacheDir = process.env.TTSC_CACHE_DIR;
  process.env.PATH = TestBanner.goPath();
  process.env.TTSC_CACHE_DIR = TestProject.tmpdir("ttsc-banner-future-flag-");
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
};
