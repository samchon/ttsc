import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: two contributors with the same name fail
 * validation before the host binary is built.
 *
 * Pins one half of the contributor uniqueness invariant: the synthesized
 * `ttsc_contributions.go` blank-imports one Go sub-package per name, so a
 * duplicate would either silently overwrite the earlier copy or trigger an
 * opaque Go build error far downstream. ttsc must reject the descriptor at
 * load time with a message that names both the host plugin and the
 * offending name.
 *
 * 1. Materialize a host plugin whose factory declares two contributors that
 *    share the same `name`.
 * 2. Run ttsc and capture its stderr.
 * 3. Assert non-zero exit and a stderr that contains "duplicate" and the
 *    repeated name.
 */
export const test_plugin_corpus_contributor_duplicate_names_are_rejected =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/host.cjs", name: "host" }],
      {
        "plugins/host.cjs": `
          const path = require("node:path");
          module.exports = (context) => ({
            name: "host",
            source: path.resolve(context.cwd, "plugins/source"),
            contributors: [
              {
                name: "dupe",
                source: path.resolve(context.cwd, "plugins/contrib_a"),
              },
              {
                name: "dupe",
                source: path.resolve(context.cwd, "plugins/contrib_b"),
              },
            ],
          });
        `,
        "plugins/source/go.mod":
          "module example.com/host\n\ngo 1.26\n",
        "plugins/source/main.go":
          "package main\n\nfunc main() {}\n",
        "plugins/contrib_a/a.go": "package dupe\n",
        "plugins/contrib_b/b.go": "package dupe\n",
      },
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], { cwd: root });
    assert.notEqual(
      result.status,
      0,
      `expected non-zero exit; stderr:\n${result.stderr}`,
    );
    assert.match(result.stderr, /contributors\[\d+\] duplicate name "dupe"/);
  };
