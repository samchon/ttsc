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
 * The `--plugins-json` payload forwarded to the native binary must preserve
 * tsconfig order and honour the `enabled: false` flag. Enabled plugins that
 * carry `prefix`/`suffix` options compose in declaration order; a disabled
 * plugin (`enabled: false`) must be silently dropped so its suffix never
 * appears in the output.
 *
 * 1. Configure four native plugins: prefix `A:`, a disabled suffix `:NO`, an
 *    identity plugin, and a suffix `:Z`.
 * 2. Run ttsc with `--emit`.
 * 3. Assert zero exit and the emitted JS contains `"A:PLUGIN:Z"` (with no `:NO`
 *    from the disabled entry).
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
