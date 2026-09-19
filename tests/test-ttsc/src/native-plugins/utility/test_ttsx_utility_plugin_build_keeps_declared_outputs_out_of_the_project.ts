import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies ttsx keeps a plugin project's declared output locations out of the
 * project when a driver-based transform host compiles it.
 *
 * Every ttsx build writes into its private directory, and the launcher enforces
 * that by forwarding `--declarationDir null`, `--tsBuildInfoFile null`, and
 * `--outFile null` after the user's flags (samchon/ttsc#1404). A native host
 * receives them through `TTSC_TSGO_ARGS` and merges them over the tsconfig.
 * TypeScript-Go's parsed CompilerOptions cannot carry a reset, so the zero
 * value read as "not given" and the config's own locations survived: the
 * transform host wrote declarations into `types/` and build information into
 * `build/` inside the project. The host now hands the merge the command line's
 * raw options, as TypeScript-Go's own command line does.
 *
 * 1. Create an `incremental` project that declares `declarationDir` and
 *    `tsBuildInfoFile`, with `@ttsc/banner` as its transform plugin.
 * 2. Run its entry through ttsx.
 * 3. Assert the entry ran and no output location appeared in the project.
 */
export const test_ttsx_utility_plugin_build_keeps_declared_outputs_out_of_the_project =
  () => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({
        name: "declared-outputs",
        private: true,
      }),
      "banner.config.cjs": `module.exports = { text: "banner-ran" };\n`,
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          module: "CommonJS",
          target: "ES2022",
          strict: true,
          skipLibCheck: true,
          types: [],
          rootDir: "src",
          outDir: "lib",
          declaration: true,
          declarationDir: "types",
          incremental: true,
          tsBuildInfoFile: "build/app.tsbuildinfo",
          plugins: [
            { transform: "@ttsc/banner", configFile: "banner.config.cjs" },
          ],
        },
        include: ["src"],
      }),
      "src/main.ts": `export const value: string = "entry ran";\nconsole.log(value);\n`,
    });
    TestUtilityPlugins.seedPackages(root, ["banner"]);

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
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "entry ran");
    for (const location of ["types", "build", "lib"]) {
      assert.equal(
        fs.existsSync(path.join(root, location)),
        false,
        `the plugin build wrote ${location}/ into the project`,
      );
    }
  };
