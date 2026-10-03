import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../../../internal/ttsc/internal/TestUtilityPlugins";
import { nativePluginSource } from "../../../../internal/ttsc/internal/plugin-corpus";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";

/**
 * Verifies ttsc linked plugins: paths applies when the host emits through
 * EmitWithPluginTransformers with only its own transform.
 *
 * Locks the regression where a third-party transform host shaped like typia's
 * `ttsc-typia build` — LoadProgram, Diagnostics, then
 * `EmitWithPluginTransformers([own transform])` — never ran the linked plugins
 * compiled into its binary: `@ttsc/paths` registered via init() but its
 * ApplyProgram never fired, so tsconfig paths aliases survived into the emitted
 * JavaScript. The driver must honor linked hooks at the emit funnel itself;
 * hosts do not know which linked packages ttsc merged into them.
 *
 * 1. Configure `@ttsc/paths` alongside a custom executable host whose build
 *    command emits via EmitWithPluginTransformers with its own transform
 *    (numeric 0 -> 100), never calling ApplyLinkedPlugins by hand.
 * 2. Run ttsc with --emit.
 * 3. Assert the emitted main.js carries BOTH the host transform's rewrite and the
 *    paths alias rewrite.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual CLI emission must contain both the relative paths rewrite and marker 100 from the host-only AST transform.
 * @evidence contracts/testing.md#independent-expectations The original numeric literal is zero and path alias is @lib, so the two literal output patterns independently prove both transforms executed.
 * @evidence contracts/testing.md#distinguishing-cases Owns EmitWithPluginTransformers with only the custom host transform, without manually invoking linked hooks.
 * @evidence contracts/testing.md#execution-ownership The generic named TestExecutor entry invokes the actual workspace CLI/native emit host. It is not Linux-only selection or packed installation; one CLI request is not an independently measured process or Program total.
 * @evidence contracts/e2e.md#necessary-boundary The native driver emit funnel must compose statically registered paths hooks with an executable host transformer; either pure transform unit alone cannot verify the combined native pipeline.
 * @evidence contracts/e2e.md#shared-execution Canonical own-linked-host source and linked paths checkout supply this consumer. The production cache is available under its selected keys, but this case does not independently prove a hit, binary identity or avoided construction. The shared-family activation and cost comparison remain unexecuted.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh consumer TypeScript/config/output isolate AST inputs and the tracked consumer/shared producer root are retained before native preparation. Original synchronous return/error/signal/status are distinct from arbitrary descendant closure; no reset or binary-validity certification is inferred from cache availability.
 * @evidence contracts/e2e.md#preserved-coverage Original CLI success, paths import and numeric0-to-marker100 output assertions and selected own-linked-host descriptor remain. The existing producer mapping preserves EmitWithPluginTransformers without manual linked-hook invocation; registration/runtime/survival of the proposed shared consumer remains unverified.
 */
export function test_ttsc_utility_plugins_paths_applies_when_host_emits_with_own_transformers(): void {
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
            { transform: "./plugins/emit-host.cjs" },
          ],
        },
        include: ["src"],
      }),
      "plugins/emit-host.cjs": `
        module.exports = (context) => ({
          name: "emit-host",
          source: ${JSON.stringify(nativePluginSource("own-linked-host"))},
        });
      `,
      "src/lib/value.ts": `export const value = "ok";\n`,
      "src/main.ts": [
        `import { value } from "@lib/value";`,
        `export const result = value;`,
        `export const marker = 0;`,
        ``,
      ].join("\n"),
    });
    TestProject.retainTemporaryDirectory(root, "linked utility host synchronous return does not acknowledge native descendants");
    TestProject.retainSharedPluginCache("linked utility host native producer has no descendant join acknowledgement");
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
    const main = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(main, /from "\.\/lib\/value\.js"/);
    assert.match(main, /marker = 100/);
  }
