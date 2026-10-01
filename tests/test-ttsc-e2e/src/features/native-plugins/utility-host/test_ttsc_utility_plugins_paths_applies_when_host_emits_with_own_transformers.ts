import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../../internal/TestUtilityPlugins";
import { nativePluginSource } from "../../../internal/plugin-corpus";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

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
 * @evidence contracts/testing.md#execution-ownership The matching named utility-host export owns one real emit pass in the shared Linux native population.
 * @evidence contracts/e2e.md#necessary-boundary The native driver emit funnel must compose statically registered paths hooks with an executable host transformer; either pure transform unit alone cannot verify the combined native pipeline.
 * @evidence contracts/e2e.md#shared-execution Unchanged own-transform Go source is canonical in its maintained fixture cmd; native source and paths contributor keys reuse the same producer across consumers.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh consumer TypeScript/config/output isolate the AST inputs; immutable host and linked contributor source determine shared binary validity.
 * @evidence contracts/e2e.md#preserved-coverage Original CLI success and both exact host-transform and path-transform output assertions remain; the cooked Go program was transferred unchanged.
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
    const main = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(main, /from "\.\/lib\/value\.js"/);
    assert.match(main, /marker = 100/);
  }
