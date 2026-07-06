import {
  assert,
  copyProject,
  fs,
  goPath,
  goTransformerSource,
  path,
  runNode,
  spawn,
  ttscBin,
} from "../../internal/native-transformer";

/**
 * Verifies the native transformer project: a Go sidecar handles a full project
 * build end-to-end.
 *
 * The `go-native-transformer` fixture demonstrates the minimal Go sidecar
 * pattern where a project bundles its own transformer source. This test drives
 * the complete path: ttsc discovers the sidecar source, builds the binary, runs
 * the transform, emits JavaScript, and executes it — all as a single `--emit`
 * invocation.
 *
 * 1. Copy the `go-native-transformer` fixture into a temp directory.
 * 2. Run `ttsc --emit` with the Go SDK on PATH and the transformer source in env.
 * 3. Assert the emitted JS contains `GO NATIVE TRANSFORMER` and executes
 *    successfully.
 */
export const test_native_transformer_project_go_sidecar_handles_project_build =
  () => {
    const root = copyProject("go-native-transformer");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_GO_TRANSFORMER_SOURCE: goTransformerSource(),
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const out = path.join(root, "dist", "main.js");
    const js = fs.readFileSync(out, "utf8");
    assert.match(js, /GO NATIVE TRANSFORMER/);
    const run = runNode(out, { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "GO NATIVE TRANSFORMER");
  };
