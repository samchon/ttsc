import {
  TtscCompiler,
  assert,
  createProject,
  expectArrayValue,
  expectRecordValue,
  tsgo,
} from "../../../../internal/ttsc/internal/compiler";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies TtscCompiler can disable project plugin loading.
 *
 * Pins the `plugins: false` escape hatch that lets an embedded host skip all
 * plugin discovery without removing the `plugins` array from tsconfig. Without
 * this path a missing-plugin entry would fail compilation even when the caller
 * knows plugins are irrelevant for its use-case (e.g. a formatter-only pass).
 *
 * 1. Create a project whose tsconfig references a plugin that does not exist.
 * 2. Construct a TtscCompiler with `plugins: false`.
 * 3. Call `compile()` and assert the result is success despite the missing plugin.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual public TtscCompiler compile succeeds despite a nonexistent descriptor when the caller supplies plugins:false.
 * @evidence contracts/testing.md#independent-expectations The authored descriptor path is physically absent and the literal success discriminant is expected for plugins:false. This body does not run an enabled-discovery failure baseline.
 * @evidence contracts/testing.md#distinguishing-cases Owns the public API disable-discovery connection, distinct from CLI argument parser decisions.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named driver export in the generic E2E population; it invokes the actual public compiler API with the selected native compiler, not an independently selected Linux-only entry.
 * @evidence contracts/e2e.md#necessary-boundary The API must carry plugins:false into compilation before descriptor discovery; a CLI parser unit does not execute that API assembly.
 * @evidence contracts/e2e.md#shared-execution The prepared native compiler is available for this public API request with project plugin loading disabled. The success discriminant does not independently observe every child/preparation or certify zero Go work, Program reuse, loaded executable bytes or minimum process cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked fresh project retains its configured descriptor, checked absent before and after synchronous compile; the test does not insert a descriptor/cache response to obtain success. API return is not an arbitrary descendant/loaded-image certificate, and the selected compiler spelling is not executable-byte equality.
 * @evidence contracts/e2e.md#preserved-coverage Keeps the original actual compile result success assertion with the same absent descriptor and API option.
 */
export function test_ttsccompiler_can_disable_project_plugin_loading(): void {
  const root = createProject({
    plugins: [{ transform: "./missing-plugin.cjs" }],
  });
  const missingDescriptor = path.join(root, "missing-plugin.cjs");
  assert.equal(fs.existsSync(missingDescriptor), false);
  const compiler = new TtscCompiler({
    binary: tsgo,
    cwd: root,
    plugins: false,
  });

  const result = compiler.compile();

  assert.equal(result.type, "success");
  assert.equal(fs.existsSync(missingDescriptor), false);
}
