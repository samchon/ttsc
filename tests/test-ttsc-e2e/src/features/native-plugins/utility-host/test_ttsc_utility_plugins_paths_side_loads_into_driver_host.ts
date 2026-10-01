import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../../internal/TestUtilityPlugins";
import { nativePluginSource } from "../../../internal/plugin-corpus";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies ttsc linked plugins: paths side-loads into a driver host.
 *
 * Locks the mixed-host regression where one linked transform and one executable
 * transform resolved to separate native binaries. The linked source must not
 * become the compiler owner; it is applied inside the selected
 * driver.LoadProgram host.
 *
 * 1. Put `@ttsc/paths` before a custom driver-based transform plugin.
 * 2. Run ttsc so host selection cannot depend on descriptor order.
 * 3. Assert the custom host ran and emitted imports were path-rewritten.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual CLI success, raw-host marker ok and relative rewritten import require both executable ownership and linked paths behavior.
 * @evidence contracts/testing.md#independent-expectations Literal marker and relative import distinguish the real custom driver from selection of the linked library as compiler owner.
 * @evidence contracts/testing.md#distinguishing-cases Owns linked paths before an executable raw-emitting driver host and actual marker publication.
 * @evidence contracts/testing.md#execution-ownership The matching named utility-host export invokes one real compiler pass in the shared Linux native population.
 * @evidence contracts/e2e.md#necessary-boundary Actual static-linked paths init must apply within the driver-selected raw emission path; loaded-record or path rewrite units cannot prove this assembly.
 * @evidence contracts/e2e.md#shared-execution Unchanged raw-host Go source lives in the canonical maintained fixture cmd and its native binary and compiler objects share the suite cache.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer config, sources, marker and outputs remain fresh; only immutable producer code and unchanged paths contributor identity are shared under production keys.
 * @evidence contracts/e2e.md#preserved-coverage All original success, marker and rewritten-import assertions remain; only the producer location changed from consumer copies to canonical source.
 */
export function test_ttsc_utility_plugins_paths_side_loads_into_driver_host(): void {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          paths: {
            "@lib/*": ["./src/lib/*"],
          },
          outDir: "dist",
          rootDir: "src",
          plugins: [
            { transform: "@ttsc/paths" },
            { transform: "./plugins/driver-host.cjs" },
          ],
        },
        include: ["src"],
      }),
      "plugins/driver-host.cjs": `
        module.exports = (context) => ({
          name: "driver-host",
          source: ${JSON.stringify(nativePluginSource("raw-linked-host"))},
        });
      `,
      "src/lib/value.ts": `export const value = "ok";\n`,
      "src/main.ts": [
        `import { value } from "@lib/value";`,
        `export const result = value;`,
        ``,
      ].join("\n"),
    });
    TestUtilityPlugins.seedPackages(root, ["paths"]);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(path.join(root, "driver-host-ran.txt"), "utf8"),
      "ok",
    );
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /from "\.\/lib\/value\.js"/,
    );
  }
