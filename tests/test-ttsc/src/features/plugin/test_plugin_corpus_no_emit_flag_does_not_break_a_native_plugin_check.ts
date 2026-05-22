import {
  assert,
  copyDirectory,
  goPath,
  nativePlugin,
  path,
  pluginProject,
  spawn,
  ttscBin,
  workspaceRoot,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: `--noEmit` does not break a native plugin check.
 *
 * Pins the compatibility regression found while benchmarking typia/nestia
 * consumers: `runBuild.ts` used to translate `ttsc --noEmit` into a native
 * host `check` invocation with extra ttsc-owned flags like `--noEmit` and
 * `--quiet`. Third-party transform hosts already use the `check` subcommand
 * to mean no emit, and older strict hosts reject the extra flags before
 * analysis starts.
 *
 * 1. Configure a native transform plugin backed by the strict test sidecar.
 * 2. Run ttsc with `--noEmit`.
 * 3. Assert the sidecar accepts the check invocation and exits cleanly.
 */
export const test_plugin_corpus_no_emit_flag_does_not_break_a_native_plugin_check =
  () => {
    const root = pluginProject(
      [{ transform: "./plugins/upper.cjs", name: "upper" }],
      {
        "plugins/upper.cjs": nativePlugin(),
      },
    );
    copyDirectory(
      path.join(workspaceRoot, "tests", "go-transformer"),
      path.join(root, "go-plugin"),
    );

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: { PATH: goPath() },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  };
