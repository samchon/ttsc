import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies ttsc utility plugins: forced emit confines output to outDir.
 *
 * Locks the outputEscapesOutDir guard in the native utility host's emit lane
 * (issue #293). A project nested inside a dependency package's directory
 * resolves the dependency's name by package self-reference — no node_modules
 * hop — so the dependency's raw `.ts` sources are not external-library files
 * and stay in the forced-emit set. Their output paths resolve outside the
 * project's `outDir`, right next to the dependency's own sources; without the
 * guard every plugin `--emit` build pollutes the dependency's source tree with
 * stray `.js` files.
 *
 * 1. Materialize a dependency package whose `exports` points at raw `.ts`, with a
 *    plugin-configured project nested inside the package directory.
 * 2. Run `ttsc --emit` so the build routes through the native utility host.
 * 3. Assert the project's own `dist/main.js` was emitted.
 * 4. Assert no `.js` was written into the dependency's `src/` tree.
 */
export const test_ttsc_utility_plugins_forced_emit_confines_output_to_outdir =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "selfdep",
        version: "1.0.0",
        exports: { ".": "./src/index.ts" },
      }),
      "src/index.ts": `export const dep: number = 1;\n`,
      "proj/banner.config.cjs": `module.exports = { text: "confined" };\n`,
      "proj/tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "CommonJS",
          moduleResolution: "bundler",
          target: "ES2022",
          strict: true,
          skipLibCheck: true,
          rootDir: "src",
          outDir: "dist",
          plugins: [
            {
              transform: "@ttsc/banner",
              configFile: "banner.config.cjs",
            },
          ],
        },
        include: ["src"],
      }),
      "proj/src/main.ts": [
        `import { dep } from "selfdep";`,
        `export const x: number = dep;`,
        ``,
      ].join("\n"),
    });
    TestUtilityPlugins.seedPackages(root, ["banner"]);
    const project = path.join(root, "proj");
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", project, "--emit"],
      {
        cwd: project,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const mainJs = fs.readFileSync(
      path.join(project, "dist", "main.js"),
      "utf8",
    );
    assert.match(mainJs, /confined/);
    const leaked = fs
      .readdirSync(path.join(root, "src"), { recursive: true })
      .map(String)
      .filter((file) => file.endsWith(".js"));
    assert.deepEqual(
      leaked,
      [],
      `dependency source tree was polluted: ${leaked.join(", ")}`,
    );
  };
