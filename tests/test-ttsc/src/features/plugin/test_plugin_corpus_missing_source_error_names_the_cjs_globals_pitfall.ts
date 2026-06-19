import {
  assert,
  goPath,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: a missing plugin source names the CJS-globals
 * pitfall.
 *
 * Pins the diagnostic added for #248. When a descriptor's `source` does not
 * exist, the bare not-found path hid the most common cause: a descriptor loaded
 * through ttsx or as ESM runs without `__dirname`/`__filename`/`require`, so a
 * path derived from them silently mis-resolves. The error now spells that out
 * and points at `context.projectRoot`, turning a baffling wrong-path failure
 * into actionable guidance.
 *
 * 1. Write a descriptor returning a `source` that does not exist on disk.
 * 2. Run ttsc with `--emit` against the fixture project.
 * 3. Assert non-zero exit and that stderr names the CJS-globals pitfall and
 *    `context.projectRoot`.
 */
export const test_plugin_corpus_missing_source_error_names_the_cjs_globals_pitfall =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/missing.cjs", name: "missing" }],
      {
        "plugins/missing.cjs": `
        const path = require("node:path");
        exports.createTtscPlugin = () => ({
          name: "missing",
          source: path.resolve(__dirname, "definitely-not-a-go-package"),
        });
      `,
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.notEqual(result.status, 0, result.stderr);
    assert.match(result.stderr, /source does not exist/);
    assert.match(result.stderr, /without CommonJS globals/);
    assert.match(result.stderr, /context\.projectRoot/);
  };
