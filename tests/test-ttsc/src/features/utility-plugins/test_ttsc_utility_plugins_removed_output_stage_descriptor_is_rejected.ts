import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies ttsc utility plugins: removed output stage descriptor is rejected.
 *
 * The `"output"` plugin stage was removed in an earlier release. Descriptors
 * that still declare `stage: "output"` must be rejected by the loader with an
 * explicit error, so authors receive a clear migration message instead of a
 * silent no-op or a crash inside the Go host.
 *
 * 1. Create a project whose plugin descriptor uses `stage: "output"`.
 * 2. Run `ttsc --emit`.
 * 3. Assert a non-zero exit and the `removed stage "output"` diagnostic in stderr.
 */
export const test_ttsc_utility_plugins_removed_output_stage_descriptor_is_rejected =
  () => {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
        "plugins/output.cjs": `
        module.exports = (context) => ({
          name: "legacy-output",
          source: require("node:path").resolve(context.dirname, "..", "plugin"),
          stage: "output",
        });
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
