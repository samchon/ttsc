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
 * Verifies plugin corpus: `--singleThreaded` does not break a native plugin build.
 *
 * Pins the compatibility regression from #113: `runBuild.ts` used to forward
 * `--singleThreaded` / `--checkers` to native plugin hosts as bare CLI flags.
 * A third-party host built before #113 has no such flag in its `flag.FlagSet`,
 * and a host that parses with `flag.ContinueOnError` exits 2 on the unknown
 * flag instead of ignoring it — so `ttsc --singleThreaded` failed
 * deterministically on any project carrying a typia/nestia transform plugin.
 * The threading knobs are ttsc-owned and now stay on the no-plugin `tsgo`
 * lane; native hosts never see them. The `go-transformer` fixture is a
 * deliberately strict host (`flag.ContinueOnError`, no `singleThreaded` flag),
 * so it reproduces the exact crash.
 *
 * 1. Configure a native plugin backed by the strict `go-transformer` host.
 * 2. Run ttsc with `--emit --singleThreaded`.
 * 3. Assert zero exit and the emitted JS still contains the transformed value.
 */
export const test_plugin_corpus_single_threaded_flag_does_not_break_a_native_plugin_build =
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

    const result = spawn(
      ttscBin,
      ["--cwd", root, "--emit", "--singleThreaded"],
      {
        cwd: root,
        env: { PATH: goPath() },
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /"PLUGIN"/);
  };
