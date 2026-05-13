import {
  assert,
  copyDirectory,
  fs,
  goPath,
  nativePlugin,
  path,
  pluginProject,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: ordered native plugins are passed to the Go sidecar.
 *
 * This ttsc plugin corpus scenario is isolated as one exported TypeScript
 * feature so failures identify the exact package contract under test without a
 * shared smoke wrapper or package-level switch statement.
 *
 * 1. Materialize the project fixture or module graph required by the case.
 * 2. Execute the real ttsc, ttsx, lint, or unplugin path under test.
 * 3. Assert the observable output, diagnostics, or plugin descriptor shape.
 */
export const test_plugin_corpus_ordered_native_plugins_are_passed_to_the_go_sidecar =
  () => {
    const root = pluginProject(
      [
        { transform: "./plugins/prefix.cjs", name: "prefix", prefix: "A:" },
        {
          transform: "./plugins/disabled.cjs",
          name: "disabled",
          enabled: false,
          suffix: ":NO",
        },
        { transform: "./plugins/upper.cjs", name: "upper" },
        { transform: "./plugins/suffix.cjs", name: "suffix", suffix: ":Z" },
      ],
      {
        "plugins/prefix.cjs": nativePlugin(),
        "plugins/disabled.cjs": nativePlugin(),
        "plugins/upper.cjs": nativePlugin(),
        "plugins/suffix.cjs": nativePlugin(),
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
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"A:PLUGIN:Z"/);
  };
