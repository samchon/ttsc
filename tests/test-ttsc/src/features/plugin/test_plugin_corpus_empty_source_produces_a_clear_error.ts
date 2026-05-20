import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: empty source produces a clear error.
 *
 * A descriptor with `source: ""` is structurally valid JSON but semantically
 * meaningless — there is no Go module to build. Rather than letting the Go
 * toolchain produce a confusing "no such file" error, ttsc must catch the empty
 * string early and emit `must declare source`.
 *
 * 1. Write a plugin descriptor whose `source` property is an empty string.
 * 2. Run ttsc with `--emit`.
 * 3. Assert non-zero exit and `must declare source` in stderr.
 */
export const test_plugin_corpus_empty_source_produces_a_clear_error = () => {
  const root = pluginProject(
    [{ transform: "./plugins/empty-source.cjs", name: "empty" }],
    {
      "plugins/empty-source.cjs": `
        module.exports = {
          name: "empty",
          source: "",
        };
      `,
    },
  );
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must declare source/);
};
