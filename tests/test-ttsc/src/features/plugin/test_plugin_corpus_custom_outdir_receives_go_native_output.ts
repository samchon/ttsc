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
 * Verifies plugin corpus: custom outDir receives Go native output.
 *
 * The `--outDir` CLI flag must be forwarded into the Go sidecar invocation so
 * that plugin-transformed JS lands in the overridden directory rather than the
 * `outDir` recorded in tsconfig. Without this forwarding a custom output path
 * silently falls back to the tsconfig value.
 *
 * 1. Configure a native plugin project whose tsconfig uses the default `dist/`.
 * 2. Run ttsc with `--emit --outDir custom`.
 * 3. Assert zero exit and the emitted `main.js` (containing `"PLUGIN"`) appears
 *    under `custom/` rather than `dist/`.
 */
export const test_plugin_corpus_custom_outdir_receives_go_native_output =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/out.cjs", name: "out" }],
      {
        "plugins/out.cjs": nativePlugin(),
      },
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );
    const output = path.join(root, "custom", "main.js");

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--outDir", "custom"],
      {
        cwd: root,
        env: { PATH: goPath() },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(output, "utf8"), /"PLUGIN"/);
  };
