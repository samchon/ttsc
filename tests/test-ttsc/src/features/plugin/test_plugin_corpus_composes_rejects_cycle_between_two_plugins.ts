import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: composes rejects cycle between two plugins.
 *
 * Locks the cycle-detection branch added in
 * `loadProjectPlugins.ts::composePluginSources`. Composition is one hop only;
 * reciprocal `composes` arrays would silently reswap the binaries of both
 * plugins, so ttsc throws an explicit error instead of routing to the wrong
 * binary.
 *
 * 1. Two plugin descriptors each list the other in `composes`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and `composes cycle detected` in stderr.
 */
export const test_plugin_corpus_composes_rejects_cycle_between_two_plugins =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/a.cjs" }, { transform: "./plugins/b.cjs" }],
      {
        "plugins/a.cjs": `module.exports = (context) => ({
  name: "compose-a",
  source: require("node:path").resolve(context.dirname, "go-a"),
  composes: ["compose-b"],
});\n`,
        "plugins/b.cjs": `module.exports = (context) => ({
  name: "compose-b",
  source: require("node:path").resolve(context.dirname, "go-b"),
  composes: ["compose-a"],
});\n`,
        "plugins/go-a/go.mod": "module example.com/composea\n\ngo 1.26\n",
        "plugins/go-a/main.go": "package main\nfunc main() {}\n",
        "plugins/go-b/go.mod": "module example.com/composeb\n\ngo 1.26\n",
        "plugins/go-b/main.go": "package main\nfunc main() {}\n",
      },
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /composes cycle detected/);
  };
