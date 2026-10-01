import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestPaths } from "../../../internal/TestPaths";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";

/**
 * Verifies the @ttsc/paths plugin: NodeNext output extensions come from
 * tsconfig.
 *
 * This project-shaped case keeps module-kind extension rewriting in the paths
 * package instead of hiding it inside a Go-only unit test. The temporary files
 * mix `.mts` and `.cts` inputs so the emitted specifiers must become `.mjs` and
 * `.cjs` under the same `compilerOptions.paths` rewrite table.
 *
 * 1. Build a NodeNext project with alias targets pointing at `.mts` and `.cts`.
 * 2. Run real ttsc with `@ttsc/paths` loaded from that project's tsconfig.
 * 3. Assert JavaScript and declaration outputs use the correct runtime suffixes.
 *
 * @evidence contracts/testing.md#behavioral-verification One NodeNext project must publish .mjs imports, .cjs require and .d.mts import types with aliases absent.
 * @evidence contracts/testing.md#independent-expectations The .mts/.cts compiler output contract independently defines .mjs/.cjs suffixes.
 * @evidence contracts/testing.md#distinguishing-cases Typed ESM and CommonJS targets share one aliases table while declaration import types retain the runtime suffix.
 * @evidence contracts/testing.md#execution-ownership This named test_paths_uses_nodenext_output_extensions_from_tsconfig entry runs through TestExecutor and the real built launcher or native host; portable decisions are separate Go units.
 * @evidence contracts/e2e.md#necessary-boundary Native output-path prediction must agree with compiler module-kind serialization in both JavaScript and declarations.
 * @evidence contracts/e2e.md#shared-execution One project batches typed .mts/.cts targets and declaration types; allowJs and JSON copying use different option contexts. Other unchanged native preparations reuse TestProject.sharedPluginCache, whose identity covers compiler, SDK, sources and overlays.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns fresh fixture directories until process exit, including failure; synchronous child processes finish before assertions. Sources/config remain fixed for their compilation, and only unchanged artifact inputs share the cache, never consumer results.
 * @evidence contracts/e2e.md#preserved-coverage One NodeNext project must publish .mjs imports, .cjs require and .d.mts import types with aliases absent. All original assertions remain in this named entry. TestLinkedProgramRewritesModuleSyntaxWithoutChangingOtherLiterals owns eligible syntax, adjacent ordinary literals and lexical require controls in the Go unit population; these emit assertions retain serializer and copied-output responsibility.
 */
export function test_paths_uses_nodenext_output_extensions_from_tsconfig() {
  const files: Record<string, string> = {
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        declaration: true,
        strict: true,
        paths: {
          "@lib/constant": ["./src/modules/constant.cts"],
          "@lib/message": ["./src/modules/message.mts"],
        },
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/paths" }],
      },
      include: ["src"],
    }),
    "src/main.mts": [
      `import { message } from "@lib/message";`,
      `export type ImportedMessage = import("@lib/message").Message;`,
      `export const value = message;`,
      ``,
    ].join("\n"),
    "src/modules/constant.cts": `export const constant = "cjs" as const;\n`,
    "src/modules/message.mts": [
      `export interface Message { value: string }`,
      `export const message = "esm" as const;`,
      ``,
    ].join("\n"),
    "src/require-consumer.cts": [
      `declare const require: (id: string) => unknown;`,
      `export const loaded = require("@lib/constant");`,
      ``,
    ].join("\n"),
  };
  const root = TestProject.createProject(files);
  TestPaths.seedPackage(root);

  const result = TestProject.spawn(
    TestProject.TTSC_BIN,
    ["--cwd", root, "--emit"],
    {
      cwd: root,
      env: {
        PATH: TestPaths.goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);

  const mjs = fs.readFileSync(path.join(root, "dist", "main.mjs"), "utf8");
  assert.match(mjs, /from "\.\/modules\/message\.mjs"/);
  assert.doesNotMatch(mjs, /@lib\/message/);

  const cjs = fs.readFileSync(
    path.join(root, "dist", "require-consumer.cjs"),
    "utf8",
  );
  assert.match(cjs, /require\("\.\/modules\/constant\.cjs"\)/);
  assert.doesNotMatch(cjs, /@lib\/constant/);

  const dts = fs.readFileSync(path.join(root, "dist", "main.d.mts"), "utf8");
  assert.match(dts, /import\("\.\/modules\/message\.mjs"\)/);
  assert.doesNotMatch(dts, /@lib\/message/);
}
