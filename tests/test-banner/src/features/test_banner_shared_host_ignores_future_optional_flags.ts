import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { TestBanner } from "../internal/TestBanner";

/**
 * Verifies the @ttsc/banner plugin: shared host ignores future optional flags.
 *
 * This banner feature is isolated as one exported TypeScript test so failures
 * identify the exact package contract without a shared smoke wrapper.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads @ttsc/banner as a project plugin.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
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
  process.env.TTSC_CACHE_DIR = fs.mkdtempSync(
    path.join(os.tmpdir(), "ttsc-banner-future-flag-"),
  );
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
