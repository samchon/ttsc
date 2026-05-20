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
 * When a descriptor's `source` path resolves to a string but the directory does
 * not exist on disk, ttsc must report `source does not exist` before attempting
 * a Go build. Without this guard the `go build` invocation fails with an
 * unhelpful "no such file" from the OS rather than a ttsc-level diagnosis.
 *
 * 1. Write a plugin descriptor whose `source` resolves to a directory path that is
 *    not created in the fixture.
 * 2. Run ttsc with `--emit`.
 * 3. Assert non-zero exit and `source does not exist` in stderr.
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
