import {
  __dirname,
  assert,
  goPath,
  path,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: nonexistent source produces a clear error.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_nonexistent_source_produces_a_clear_error =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/missing-dir.cjs", name: "missing" }],
      {
        "plugins/missing-dir.cjs": `
        const path = require("node:path");
        module.exports = {
          name: "missing",
          source: path.resolve(__dirname, "..", "no-such-dir"),
        };
      `,
      },
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source does not exist/);
  };
