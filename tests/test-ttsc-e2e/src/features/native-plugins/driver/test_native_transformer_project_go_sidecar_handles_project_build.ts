import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
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
} from "../../../internal/native-transformer";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsc emission must contain GO NATIVE TRANSFORMER and direct Node execution must exit zero and print that exact transformed value.
 * @evidence contracts/testing.md#independent-expectations Original authored source and literal uppercase runtime output distinguish native transformation from source-only compilation.
 * @evidence contracts/testing.md#distinguishing-cases Owns a full project-sidecar descriptor build followed by actual emitted JavaScript execution.
 * @evidence contracts/testing.md#execution-ownership The matching named driver export executes the compiler and Node consumer once in the shared Linux boundary population.
 * @evidence contracts/e2e.md#necessary-boundary The project descriptor must pass its selected native source through build, transformation, emit and real Node consumption; semantic units cannot exercise that assembled path.
 * @evidence contracts/e2e.md#shared-execution The canonical immutable transformer source and shared TTSC_CACHE_DIR reuse the same producer as other transformer consumers, with no cold-build assertion.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer project/output files are independent; unchanged canonical source/toolchain keys determine native binary validity without reusing transformed consumer output.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, emitted literal, Node status and exact Node stdout assertions remain.
 */
export function test_native_transformer_project_go_sidecar_handles_project_build(): void {
    const root = copyProject("go-native-transformer");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_GO_TRANSFORMER_SOURCE: goTransformerSource(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const out = path.join(root, "dist", "main.js");
    const js = fs.readFileSync(out, "utf8");
    assert.match(js, /GO NATIVE TRANSFORMER/);
    const run = runNode(out, { cwd: root });
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "GO NATIVE TRANSFORMER");
  }
