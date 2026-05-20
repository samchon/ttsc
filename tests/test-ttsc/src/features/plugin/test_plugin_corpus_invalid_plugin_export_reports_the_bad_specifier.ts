import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: invalid plugin export reports the bad specifier.
 *
 * The descriptor loader accepts objects, factory functions, or named exports.
 * When a plugin file exports a primitive (e.g. `module.exports = 123`), ttsc
 * must name the offending file path in the error so the author can find it
 * immediately rather than seeing a generic "not a function" crash.
 *
 * 1. Write a plugin file that exports the number `123`.
 * 2. Run ttsc with `--emit`.
 * 3. Assert non-zero exit and `does not export a valid ttsc plugin` in stderr.
 */
export const test_plugin_corpus_invalid_plugin_export_reports_the_bad_specifier =
  () => {
    const root = pluginProject([{ transform: "./plugins/invalid.cjs" }], {
      "plugins/invalid.cjs": `module.exports = 123;\n`,
    });

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not export a valid ttsc plugin/);
  };
