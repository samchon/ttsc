import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies ttsc first-party plugins: removed output stage descriptor is
 * rejected.
 *
 * This first-party plugin scenario stays in the compiler package because it
 * verifies shared host behavior across package boundaries.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc path that loads one or more first-party plugin
 *    descriptors.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_ttsc_first_party_plugins_removed_output_stage_descriptor_is_rejected =
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
