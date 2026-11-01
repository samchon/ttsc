import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { RuntimeBuildInputs } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildInputs";
import { resolveTsgo } from "../../../../../packages/ttsc/src/compiler/internal/resolveTsgo";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies custom executable selection alone cannot authorize persistent emits.
 *
 * A wrapper can read inputs outside its own executable bytes. Inherited hints
 * naming the actual packaged compiler must still support dependency reuse.
 *
 * 1. Resolve a real package-backed compiler from an isolated source project.
 * 2. Contrast its default and explicitly inherited selection with a different
 *    actual executable selected through the same custom-binary resolver.
 * 3. Require proof owners only for the package-backed selections.
 *
 * @evidence contracts/testing.md#behavioral-verification The production proof factory receives real execution context and actual resolveTsgo provenance. It must admit the installed compiler and its explicit path, while declining a different existing executable before any native query or compilation is needed.
 * @evidence contracts/testing.md#independent-expectations The installed TypeScript package owns the native compiler identity; process.execPath independently names a different real executable. Matching the packaged path supports ttsx's inherited compiler hint, while custom selection alone supplies no transitive-input contract.
 * @evidence contracts/testing.md#distinguishing-cases Default discovery, explicit selection of that same compiler and a different custom executable distinguish known compiler authority from mere executable availability. Content, membership and native producer replay belong to the existing cache and input-proof tests.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export. Existing filesystem/configuration resolvers and the proof factory run directly over an owned temporary project linked to the existing dependency installation; no consumer installation, compiler process or native artifact build runs.
 */
export function test_runtimebuildinputs_requires_packaged_compiler_authority(): void {
  const root = TestProject.physicalPath(
    TestProject.createProject({
      "package.json": '{"private":true}',
      "tsconfig.json": '{"compilerOptions":{},"include":["src"]}',
      "src/main.ts": "export const value = 1;\n",
    }),
  );
  fs.symlinkSync(
    TestProject.physicalPath(
      path.join(TestProject.WORKSPACE_ROOT, "node_modules"),
    ),
    path.join(root, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const selected = BuildExecution.resolveExecutionContext({
    cwd: root,
    plugins: false,
    env: { TTSC_TSGO_BINARY: undefined },
  });
  assert.notEqual(selected.tsgo.packageJson, "");
  const options = {
    emit: true,
    isolateOutputsTo: path.join(root, "private-emit"),
    runtimeCacheDir: path.join(root, "cache/runtime-builds"),
  };
  assert.notEqual(RuntimeBuildInputs.create(options, selected), undefined);
  assert.notEqual(
    RuntimeBuildInputs.create(options, {
      ...selected,
      tsgo: resolveTsgo({ binary: selected.tsgo.binary }),
    }),
    undefined,
  );
  assert.equal(
    RuntimeBuildInputs.create(options, {
      ...selected,
      tsgo: resolveTsgo({ binary: process.execPath }),
    }),
    undefined,
  );
}
