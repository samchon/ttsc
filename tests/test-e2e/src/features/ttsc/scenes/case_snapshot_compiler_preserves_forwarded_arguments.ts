import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../../../../../packages/ttsc/lib/compiler/internal/build/BuildExecution.js";
import { BuildTiming } from "../../../../../../packages/ttsc/lib/compiler/internal/build/BuildTiming.js";
import { TestProject } from "../../../../../utils/src/TestProject";

/**
 * Verifies check-stage builds forward compiler arguments to snapshot emission.
 * A real native compiler must receive an argv array after the check completes.
 *
 * 1. Prepare a project and a check-only host recording its invocation.
 * 2. Request snapshot emission with a forwarded declaration option.
 * 3. Assert JavaScript, declarations and source ownership.
 *
 * @evidence contracts/testing.md#behavioral-verification runPreparedBuild executes a check-only fixture and the real api-compile host; emitted files and provenance prove the snapshot branch completed.
 * @evidence contracts/testing.md#independent-expectations Authored value 42 and the declaration option establish expected output independently of transport encoding.
 * @evidence contracts/testing.md#distinguishing-cases A check-only host forces default compiler snapshot emission rather than transform or custom compiler dispatch; a forwarded option and a private path containing spaces exercise argv boundaries. Argument units own absent and empty payloads.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch owns this named E2E scenario and its real native compiler process.
 * @evidence contracts/e2e.md#necessary-boundary JavaScript environment serialization must agree with the real Go driver's array decoding, which pure argument units cannot establish.
 * @evidence contracts/e2e.md#shared-execution One project and check host precede one native compile, reusing the normal shared compiler artifact cache.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the unique fixture and outputs through exit cleanup; synchronous children complete before assertions and no global environment changes.
 * @evidence contracts/e2e.md#preserved-coverage Existing snapshot race scenarios remain unchanged; this adds their missing check-only dispatch branch.
 */
export function case_snapshot_compiler_preserves_forwarded_arguments(): void {
  const root = TestProject.createProject({
    "package.json": '{"private":true,"type":"commonjs"}',
    "tsconfig.json": JSON.stringify({
      compilerOptions: { target: "es2020", module: "commonjs", types: [] },
      files: ["entry.ts"],
    }),
    "entry.ts": "export const value: number = 42;\n",
    "check.cjs":
      "require('node:assert/strict').equal(process.argv[2], 'check'); require('node:fs').writeFileSync('checked', 'yes');\n",
  });
  fs.symlinkSync(
    path.join(TestProject.WORKSPACE_ROOT, "tests", "test-e2e", "node_modules"),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const options = {
    cwd: root,
    plugins: false as const,
    emit: true,
    forceEmitProvenance: true,
    isolateOutputsTo: path.join(root, "private output"),
    pinInferredRootDir: true,
    passthrough: ["--declaration"],
  };
  const execution = BuildExecution.resolveExecutionContext(options);
  execution.nativePlugins.push({
    binary: path.join(root, "check.cjs"),
    source: path.join(root, "check.cjs"),
    config: {},
    kind: "executable",
    stage: "check",
  });
  const result = BuildExecution.runPreparedBuild(
    options,
    BuildTiming.createBuildTiming(options),
    execution,
    options,
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.readFileSync(path.join(root, "checked"), "utf8"), "yes");
  const javascript = result.emittedFiles?.find((name) =>
    name.endsWith("entry.js"),
  );
  const declaration = result.emittedFiles?.find((name) =>
    name.endsWith("entry.d.ts"),
  );
  assert.ok(javascript);
  assert.ok(declaration);
  assert.match(fs.readFileSync(javascript, "utf8"), /value = 42/);
  assert.match(fs.readFileSync(declaration, "utf8"), /value: number/);
  assert.deepEqual(result.emittedSources?.[javascript], [
    path.join(root, "entry.ts"),
  ]);
}
