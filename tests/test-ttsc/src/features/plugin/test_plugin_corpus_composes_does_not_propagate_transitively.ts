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
 * Verifies plugin corpus: composes does not propagate transitively.
 *
 * Locks the one-hop semantic of `loadProjectPlugins.ts::composePluginSources`.
 * `B.composes = ["C"]` redirects B's binary to C's source, but if some other
 * descriptor A lists B in `composes` ttsc must NOT cascade A through B to C.
 *
 * Setup: 3 descriptors A, B, C. A.composes = [B], B.composes = [C]. A and B
 * point at separate valid Go sources, while C points at a missing source. The
 * one-hop result is A(source A), B(source A), C(source B), which leaves two
 * compiler hosts and must fail the shared-host compatibility check. A
 * transitive implementation would incorrectly send C to source A and compile.
 */
export const test_plugin_corpus_composes_does_not_propagate_transitively =
  () => {
    const root = pluginProject(
      [
        { transform: "./plugins/a.cjs" },
        { transform: "./plugins/b.cjs" },
        { transform: "./plugins/c.cjs" },
      ],
      {
        "plugins/a.cjs": `module.exports = (context) => ({
  name: "compose-a",
  source: require("node:path").resolve(context.dirname, "..", "go-a", "cmd", "ttsc-go-transformer"),
  composes: ["compose-b"],
});\n`,
        "plugins/b.cjs": `module.exports = (context) => ({
  name: "compose-b",
  source: require("node:path").resolve(context.dirname, "..", "go-b", "cmd", "ttsc-go-transformer"),
  composes: ["compose-c"],
});\n`,
        "plugins/c.cjs": `module.exports = (context) => ({
  name: "compose-c",
  source: require("node:path").resolve(context.dirname, "missing-go-c"),
});\n`,
      },
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-a"),
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-b"),
    );
    fs.writeFileSync(path.join(root, "go-b", "marker.go"), "package marker\n");

    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /multiple compiler native backends cannot share one emit pass/,
    );
    assert.doesNotMatch(result.stderr, /composes cycle detected/);
  };
