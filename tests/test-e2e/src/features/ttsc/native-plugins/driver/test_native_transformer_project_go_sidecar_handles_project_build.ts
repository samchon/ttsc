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
} from "../../../../internal/ttsc/internal/native-transformer";
import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";

/**
 * Verifies the native transformer project: a Go sidecar handles a full project
 * build end-to-end.
 *
 * The copied consumer selects canonical Go transformer source through its
 * descriptor environment. One public emit produces the transformed JavaScript;
 * a separate direct Node command consumes it. This is not one child process or
 * a cold-build assertion.
 *
 * 1. Copy the `go-native-transformer` fixture into a temp directory.
 * 2. Run `ttsc --emit` with the Go SDK on PATH and the transformer source in env.
 * 3. Assert the emitted JS contains `GO NATIVE TRANSFORMER` and executes
 *    successfully.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsc emission must contain GO NATIVE TRANSFORMER and direct Node execution must exit zero and print that exact transformed value.
 * @evidence contracts/testing.md#independent-expectations Original authored source and literal uppercase runtime output distinguish native transformation from source-only compilation.
 * @evidence contracts/testing.md#distinguishing-cases Owns a full project-sidecar descriptor build followed by actual emitted JavaScript execution.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named driver export in the generic E2E population. Its body owns one public compiler request followed by one direct Node consumer; nested native preparation/processes are not inferred from this request count.
 * @evidence contracts/e2e.md#necessary-boundary The project descriptor must pass its selected native source through build, transformation, emit and real Node consumption; semantic units cannot exercise that assembled path.
 * @evidence contracts/e2e.md#shared-execution Canonical immutable transformer source and the explicit suite-owned TTSC_CACHE_DIR are available for reuse, without a cold-build assertion or independently observed cache hit, build/Program/process total or minimum preparation cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked copied consumer owns its initially absent main output. Compiler and Node results each check error/signal/status before consuming subsequent output; unchanged source/toolchain identity governs production cache eligibility. Synchronous return does not certify arbitrary descendants or loaded-image equality, and suite cache/canonical source are not consumer cleanup targets.
 * @evidence contracts/e2e.md#preserved-coverage All original CLI status, emitted literal, Node status and exact Node stdout assertions remain.
 */
export function test_native_transformer_project_go_sidecar_handles_project_build(): void {
  const root = copyProject("go-native-transformer");
  const out = path.join(root, "dist", "main.js");
  assert.equal(fs.existsSync(out), false);
  const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
    cwd: root,
    env: {
      PATH: goPath(),
      TTSC_GO_TRANSFORMER_SOURCE: goTransformerSource(),
      TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const js = fs.readFileSync(out, "utf8");
  assert.match(js, /GO NATIVE TRANSFORMER/);
  const run = runNode(out, { cwd: root });
  assert.equal(run.error, undefined);
  assert.equal(run.signal, null);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), "GO NATIVE TRANSFORMER");
}
