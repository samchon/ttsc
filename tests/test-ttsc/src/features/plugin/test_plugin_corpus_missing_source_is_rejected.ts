import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: missing source is rejected.
 *
 * A descriptor object that omits the `source` property entirely is different
 * from one that sets `source: ""` — the key is absent rather than empty. Both
 * cases share the same `must declare source` check so users get the same
 * guidance regardless of how they omitted the field.
 *
 * 1. Write a plugin descriptor with no `source` property.
 * 2. Run ttsc with `--emit`.
 * 3. Assert non-zero exit and `must declare source` in stderr.
 */
export const test_plugin_corpus_missing_source_is_rejected = () => {
  const root = pluginProject(
    [{ transform: "./plugins/missing-source.cjs", name: "missing-source" }],
    {
      "plugins/missing-source.cjs": `
        module.exports = {
          name: "missing-source",
        };
      `,
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must declare source/);
};
