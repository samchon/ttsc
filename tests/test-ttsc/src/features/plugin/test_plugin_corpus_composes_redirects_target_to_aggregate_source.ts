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
 * Verifies plugin corpus: composes redirects target to aggregate source.
 *
 * Happy-path lock for `loadProjectPlugins.ts::composePluginSources`. The target
 * descriptor deliberately points at a missing source directory; the project can
 * compile only if ttsc redirects that target to the aggregate's Go source
 * before validating and building native plugins. Both plugin configs remain in
 * `--plugins-json`, so the aggregate sidecar still applies the target's suffix
 * operation.
 */
export const test_plugin_corpus_composes_redirects_target_to_aggregate_source =
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
});\n`,
        "plugins/target.cjs": `module.exports = (context) => ({
  name: "compose-target",
  source: require("node:path").resolve(context.dirname, "missing-go-target"),
});\n`,
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
