import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import { nativePluginSource } from "../../../../internal/ttsc/internal/plugin-corpus";

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
 * @evidence contracts/testing.md#execution-ownership The generic named TestExecutor entry invokes the actual workspace CLI/raw driver host. It is not Linux-only selection or packed installation; one CLI request is not a measured process or Program count.
 * @evidence contracts/e2e.md#necessary-boundary Actual static-linked paths init must apply within the driver-selected raw emission path; loaded-record or path rewrite units cannot prove this assembly.
 * @evidence contracts/e2e.md#shared-execution Canonical raw-linked-host source and linked paths checkout supply this consumer with the suite cache available. No cache hit, shared compiler object, Program reuse or avoided build is asserted by the marker/output oracle. Shared-family activation and measured reduction remain unexecuted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh consumer config/source/marker/output isolate this raw-host observation; tracked consumer/shared producer inputs are retained before native preparation. Synchronous return/error/signal/status are observed separately and do not certify descendant join, cache-key validity or compiler object reuse.
 * @evidence contracts/e2e.md#preserved-coverage Original CLI success, exact driver-host-ran.txt value ok and relative import pattern remain with paths-first descriptor order and raw-linked-host producer. Existing producer mapping distinguishes EmitAllRaw from the separate own-transform lane; proposed shared-consumer registration/runtime/survival remains unverified.
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
  TestProject.retainTemporaryDirectory(
    root,
    "linked utility host synchronous return does not acknowledge native descendants",
  );
  TestProject.retainSharedPluginCache(
    "linked utility host native producer has no descendant join acknowledgement",
  );
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
  assert.equal(result.error, undefined, "linked utility host launch error");
  assert.equal(result.signal, null, "linked utility host terminated by signal");
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
