import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies ttsx reports a type error that only an imported workspace package's
 * own project finds, and does not run the program as if it succeeded.
 *
 * A workspace package whose manifest points at its TypeScript source is built
 * under its own tsconfig when the entry imports it, since only that project
 * runs the package's transform plugins. An error its own options report, such
 * as `noUnusedLocals`, is invisible to the entry's check. ttsx 0.28.1 exited 0
 * with no output at all in that case: the program never ran, and a CLI invoked
 * through ttsx read the type error as success (samchon/ttsc#1503). The package
 * is now a checked root of its own project, so its diagnostics stop the run.
 *
 * 1. Create a CommonJS entry whose async `main` imports a symlinked workspace
 *    package and reports a rejection, as a CLI does; the package's tsconfig
 *    runs `@ttsc/banner` and enables `noUnusedLocals`, which its source
 *    breaks.
 * 2. Run the entry through ttsx.
 * 3. Assert the run fails naming the package's diagnostic, and the entry's success
 *    line never prints.
 */
export const test_ttsx_reports_a_type_error_in_an_imported_workspace_package_its_plugins_build =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "workspace-cli", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "CommonJS",
          target: "ES2022",
          strict: true,
          skipLibCheck: true,
          types: [],
          rootDir: "src",
          outDir: "lib",
        },
        include: ["src"],
      }),
      "src/main.ts": [
        "declare const process: { exitCode: number | undefined };",
        "async function main(): Promise<void> {",
        '  const dependency = await import("workspace-dep");',
        '  console.log("entry ran", dependency.hello());',
        "}",
        "main().catch((error: unknown) => {",
        "  console.error(error instanceof Error ? error.message : String(error));",
        "  process.exitCode = 1;",
        "});",
        "",
      ].join("\n"),
      "packages/dep/package.json": JSON.stringify({
        name: "workspace-dep",
        version: "1.0.0",
        main: "src/index.ts",
      }),
      "packages/dep/banner.config.cjs": `module.exports = { text: "dep" };\n`,
      "packages/dep/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "CommonJS",
          target: "ES2022",
          strict: true,
          skipLibCheck: true,
          types: [],
          noUnusedLocals: true,
          rootDir: "src",
          outDir: "lib",
          plugins: [
            { transform: "@ttsc/banner", configFile: "banner.config.cjs" },
          ],
        },
        include: ["src"],
      }),
      "packages/dep/src/index.ts": [
        "export function hello(): string {",
        "  const unused = 1;",
        '  return "hello";',
        "}",
        "",
      ].join("\n"),
    });
    TestUtilityPlugins.seedPackages(root, ["banner"]);
    fs.symlinkSync(
      path.join(root, "packages", "dep"),
      path.join(root, "node_modules", "workspace-dep"),
      "junction",
    );

    const result = TestProject.spawn(
      TestProject.TTSX_BIN,
      ["--cwd", root, "src/main.ts"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.notEqual(result.status, 0, result.stdout);
    assert.match(result.stderr, /TS6133/, result.stderr);
    assert.match(result.stderr, /packages[\\/]dep[\\/]src[\\/]index\.ts/);
    assert.doesNotMatch(result.stdout, /entry ran/);
  };
