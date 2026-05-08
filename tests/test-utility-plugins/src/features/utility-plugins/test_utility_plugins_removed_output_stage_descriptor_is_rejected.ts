import assert from "node:assert/strict";
import path from "node:path";
import { commonJsProject, spawn, ttscBin } from "@ttsc/testing";

/**
 * Verifies utility plugins: removed output stage descriptor is rejected.
 *
 * This utility plugin scenario is isolated as one exported TypeScript feature
 * so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_utility_plugins_removed_output_stage_descriptor_is_rejected =
  () => {
    const root = commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
        "plugins/output.cjs": `
        module.exports = {
          name: "legacy-output",
          source: require("node:path").resolve(__dirname, "..", "plugin"),
          stage: "output",
        };
      `,
        "plugin/go.mod": "module example.com/legacyoutput\n\ngo 1.26\n",
        "plugin/main.go": "package main\n\nfunc main() {}\n",
      },
      {
        compilerOptions: {
          plugins: [{ transform: "./plugins/output.cjs" }],
        },
      },
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /removed stage "output"/);
  };
