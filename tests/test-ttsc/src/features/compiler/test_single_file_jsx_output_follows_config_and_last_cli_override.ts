import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveSingleFileOutput } from "../../../../../packages/ttsc/src/launcher/internal/resolveSingleFileOutput";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies positional JSX output follows configuration and the last CLI value.
 *
 * The copied output must use the native preserve suffix or the transformed
 * JavaScript suffix. A forwarded override wins over the configured JSX mode,
 * while an attached equals spelling cannot supply a compiler option value.
 *
 * 1. Resolve configured preserve output in a real temporary project.
 * 2. Override both configured modes with authored separate CLI values.
 * 3. Assert repeated-value precedence and unchanged input argv.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolveSingleFileOutput with the same src/view.tsx project and mutates its configured JSX mode. Exact dist/view.jsx or dist/view.js assertions distinguish configuration fallback, both CLI override directions, case normalization and last separate-value precedence.
 * @evidence contracts/testing.md#independent-expectations Literal suffixes come from the TypeScript JSX contract: preserve keeps JSX and uses .jsx; react-native retains JSX syntax in a .js output. Literal src-to-dist placement follows the authored rootDir/outDir. Expected paths are not read from resolver or compiler output.
 * @evidence contracts/testing.md#distinguishing-cases Covers configured preserve and react-native without CLI input, each opposite CLI override, uppercase value and single-dash mixed-case option, repeated values in both orders, malformed inline spelling and a near-miss option. Every case preserves its caller tokens. The existing inline/separate source unit owns its original canonical pair; the E2E compiler population retains native production and watcher feedback assertions.
 * @evidence contracts/testing.md#execution-ownership This discoverable source-unit export calls the actual output resolver against one temporary project and removes its owned filesystem state in finally. It starts no native compiler, installed consumer or product host.
 */
export function test_single_file_jsx_output_follows_config_and_last_cli_override(): void {
  const root = TestProject.physicalPath(
    TestProject.commonJsProject({
      "src/view.tsx": "export const view = 1;\n",
    }),
  );
  const configPath = path.join(root, "tsconfig.json");
  const failures: Error[] = [];
  const cases: readonly [string, readonly string[], string][] = [
    ["preserve", [], "view.jsx"],
    ["react-native", [], "view.js"],
    ["preserve", ["--jsx", "react-native"], "view.js"],
    ["react-native", ["--jsx", "preserve"], "view.jsx"],
    ["react-native", ["-JsX", "PRESERVE"], "view.jsx"],
    ["preserve", ["--jsx", "preserve", "--jsx", "react-native"], "view.js"],
    [
      "react-native",
      ["--jsx", "react-native", "--jsx", "preserve"],
      "view.jsx",
    ],
    ["preserve", ["--jsx=react-native"], "view.jsx"],
    ["react-native", ["--jsx=preserve"], "view.js"],
    ["react-native", ["--jsx2", "preserve"], "view.js"],
  ];
  try {
    const baseline = JSON.parse(fs.readFileSync(configPath, "utf8"));
    for (const [jsx, passthrough, filename] of cases) {
      try {
        fs.writeFileSync(
          configPath,
          JSON.stringify({
            ...baseline,
            compilerOptions: { ...baseline.compilerOptions, jsx },
          }),
        );
        const original = [...passthrough];
        assert.equal(
          resolveSingleFileOutput({
            cwd: root,
            file: path.join(root, "src", "view.tsx"),
            passthrough,
          }),
          path.join(root, "dist", filename),
        );
        assert.deepEqual(passthrough, original);
      } catch (cause) {
        failures.push(
          new Error(JSON.stringify({ jsx, passthrough }), { cause }),
        );
      }
    }
    if (failures.length !== 0)
      throw new AggregateError(
        failures,
        "positional JSX output policy failures",
      );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
