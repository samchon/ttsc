import { TestProject } from "@ttsc/testing";
import { createRequire } from "node:module";
import path from "node:path";

/**
 * Resolve `require()` calls from the test-lint package root so that
 * `REQUIRE_FROM_TEST(DESCRIPTOR_PATH)` picks up the built `lib/index.js` even
 * when the test process CWD is elsewhere.
 */
const REQUIRE_FROM_TEST = createRequire(
  path.join(TestProject.WORKSPACE_ROOT, "tests", "test-lint", "package.json"),
);

/**
 * Shared helpers for tests that exercise the `@ttsc/lint` plugin descriptor
 * (the JS factory exported by `packages/lint/lib/index.js`).
 *
 * Centralises well-known paths and the two factory calls so each plugin test
 * can stay focused on the specific contract it verifies.
 */
export namespace TestLintPlugin {
  /** Absolute path to `packages/lint` (the workspace package root). */
  export const PACKAGE_ROOT = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "lint",
  );
  /** Absolute path to the built JS descriptor entry (`lib/index.js`). */
  export const DESCRIPTOR_PATH = path.join(PACKAGE_ROOT, "lib", "index.js");
  /** Absolute path to the Go plugin source directory (`plugin/`). */
  export const NATIVE_PLUGIN_DIR = path.join(PACKAGE_ROOT, "plugin");

  /**
   * Load the `createTtscPlugin` factory from the built `lib/index.js`.
   *
   * Falls back through `mod.default` and the bare module export to handle both
   * ESM-transpiled and CommonJS build shapes.
   */
  export function loadFactory() {
    const mod = REQUIRE_FROM_TEST(DESCRIPTOR_PATH);
    return mod.createTtscPlugin ?? mod.default ?? mod;
  }

  /**
   * Build a minimal factory context for `@ttsc/lint`.
   *
   * @param plugin - The raw plugin descriptor object from tsconfig's
   *   `compilerOptions.plugins` entry; passed through unchanged so individual
   *   tests can inject arbitrary shapes.
   */
  export function factoryContext(plugin: Record<string, unknown>) {
    return {
      binary: "",
      cwd: process.cwd(),
      plugin,
      projectRoot: PACKAGE_ROOT,
      tsconfig: path.join(PACKAGE_ROOT, "tsconfig.json"),
    };
  }
}
