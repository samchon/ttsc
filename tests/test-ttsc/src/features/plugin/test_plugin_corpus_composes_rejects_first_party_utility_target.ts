import {
  assert,
  pluginProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: composes rejects first-party utility target.
 *
 * Locks the first-party-target rejection branch added in
 * `loadProjectPlugins.ts::composePluginSources`. First-party utility plugins
 * (`@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip`) have their own auto-composition
 * path through the manifest-pinned shared compiler host. Letting a third-party
 * descriptor list one of those names in `composes` would bypass the
 * manifest pin and turn `composes` into a supply-chain redirect vector.
 *
 * 1. A third-party descriptor lists `@ttsc/banner` in its `composes` array.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and `cannot compose first-party utility` in stderr.
 */
export const test_plugin_corpus_composes_rejects_first_party_utility_target =
  () => {
    const root = pluginProject([{ transform: "./plugins/aggregate.cjs" }], {
      "plugins/aggregate.cjs": `module.exports = {
  name: "third-party-aggregate",
  source: require("node:path").resolve(__dirname, "go-aggregate"),
  composes: ["@ttsc/banner"],
};\n`,
      "plugins/go-aggregate/go.mod":
        "module example.com/aggregate\n\ngo 1.26\n",
      "plugins/go-aggregate/main.go": "package main\nfunc main() {}\n",
    });

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], { cwd: root });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot compose first-party utility/);
  };
