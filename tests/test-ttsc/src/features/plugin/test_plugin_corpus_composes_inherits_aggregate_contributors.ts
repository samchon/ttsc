import {
  assert,
  copyDirectory,
  fs,
  goPath,
  path,
  pluginProject,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: a composed plugin inherits the aggregate's
 * `contributors`.
 *
 * Regression lock for `loadProjectPlugins.ts::composePluginSources` (issue
 * #101). A composed plugin is rerouted to the aggregate's `source`; it must
 * ALSO inherit the aggregate's `contributors`, because `buildSourcePlugin` keys
 * its native-binary cache on `source` + `contributors`. Without the inheritance
 * the aggregate record (with contributors) and the composed record (without)
 * resolve to two divergent binaries, and ttsc aborts with "multiple compiler
 * native backends cannot share one emit pass". The separate guard that rejects
 * a composed plugin declaring its OWN `contributors` is unaffected — "inherits
 * the aggregate's" and "may not declare its own" are not in conflict.
 *
 * 1. Materialize an aggregate plugin that both `composes` a target transform and
 *    declares a `contributors` entry, plus the redirected target whose own
 *    `source` points at a missing directory.
 * 2. Run `ttsc --emit`.
 * 3. Assert a zero exit (the composed and aggregate records share one native host)
 *    and that the target's suffix transform still reached the emitted
 *    JavaScript.
 */
export const test_plugin_corpus_composes_inherits_aggregate_contributors =
  () => {
    const root = pluginProject(
      [
        { transform: "./plugins/aggregate.cjs" },
        { transform: "./plugins/target.cjs", suffix: ":Z" },
      ],
      {
        "plugins/aggregate.cjs": `module.exports = (context) => ({
  name: "compose-aggregate",
  source: require("node:path").resolve(context.dirname, "..", "go-plugin", "cmd", "ttsc-go-transformer"),
  composes: ["compose-target"],
  contributors: [
    {
      name: "demo",
      source: require("node:path").resolve(context.dirname, "contributor"),
    },
  ],
});\n`,
        "plugins/target.cjs": `module.exports = (context) => ({
  name: "compose-target",
  source: require("node:path").resolve(context.dirname, "missing-go-target"),
});\n`,
        "plugins/contributor/contributor.go": "package demo\n",
      },
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN:Z"/,
    );
  };
