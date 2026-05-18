import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies ttsc utility plugins: removed output stage descriptor is rejected.
 *
 * This scenario stays in the compiler package because it verifies descriptor
 * validation near the utility plugin coverage.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads an invalid plugin descriptor.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_utility_plugins_removed_output_stage_descriptor_is_rejected =
  () => {
    const root = TestProject.commonJsProject(
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
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      { cwd: root },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /removed stage "output"/);
  };
