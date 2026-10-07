import assert from "node:assert/strict";
import path from "node:path";

import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/src/core/transform/session/TtscSharedCompilePublication";
import { adoptedExternalInputMismatch } from "../../../../../packages/unplugin/src/core/transform/session/adoptedExternalInputMismatch";
import { sharedCompileIdentity } from "../../../../../packages/unplugin/src/core/transform/session/sharedCompileIdentity";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies compile configuration identity and publisher/adopter input
 * agreement.
 *
 * Compile identity must separate option and resolved-compiler changes before
 * any worker shares output. Adoption additionally requires the same external
 * content and physical identity on both sides. These decisions need no process
 * ownership or publication store; their literal counterexamples execute here.
 *
 * 1. Compare equal configurations and change each identity-bearing field.
 * 2. Resolve an authored compiler-version manifest in another fixture project.
 * 3. Compare matching, changed, missing and extra external-input snapshots.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls source sharedCompileIdentity and adoptedExternalInputMismatch directly; equal options retain a 32-hex identity while aliases/options/plugins/resolved compiler/tsconfig changes separate it. Matching external snapshots agree; changed content, changed realpath, missing and extra inputs report their exact literal path.
 * @evidence contracts/testing.md#independent-expectations The public sharing contract requires unequal identities for different compile inputs and equal publisher/adopter key sets and values. Authored manifest version 0.0.0-other is interpreted by the actual resolver rather than checked as repository shape; literal helper/other paths establish mismatch results independently.
 * @evidence contracts/testing.md#distinguishing-cases Preserves all seven identity assertions and five external comparison assertions formerly mixed into the PID/store E2E. Equal versus changed configurations and each missing/extra/content/physical-identity case retain their failure labels; no collision-resistance claim follows from the hash-format assertion.
 * @evidence contracts/testing.md#execution-ownership test-unplugin discovers this direct authored-source entry before a build. Temporary manifest files are actual resolver inputs, not a consumer installation, and these operations start no compiler, native producer, watcher or child process. The real dead-PID takeover and publication-store cases remain E2E.
 */
export function test_shared_compile_identity_and_external_input_adoption(): void {
  const publication: TtscSharedCompilePublication = {
    externalInputHashes: { [path.resolve("/outside/helper.ts")]: "hash" },
    externalInputRealpaths: {
      [path.resolve("/outside/helper.ts")]: path.resolve("/real/helper.ts"),
    },
    result: {
      type: "success",
      typescript: {},
    } as unknown as TtscSharedCompilePublication["result"],
    scratchDirectory: path.resolve("/scratch"),
  };
  const compile = {
    aliasPaths: { "@/*": ["/project/src/*"] },
    compilerOptions: { removeComments: true },
    plugins: [{ transform: "typia/lib/transform" }],
    projectRoot: process.cwd(),
    tsconfig: path.resolve("/project/tsconfig.json"),
  };
  // A project that resolves a TypeScript-Go of another version.
  const otherCompiler = TestProject.tmpdir("ttsc-unplugin-shared-compiler-");
  TestProject.writeFiles(otherCompiler, {
    "package.json": '{"private":true}',
    "node_modules/typescript/package.json":
      '{"name":"typescript","version":"0.0.0-other"}',
    "child/package.json": '{"private":true}',
  });
  const id = sharedCompileIdentity(compile);
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.equal(sharedCompileIdentity({ ...compile }), id);
  for (const changed of [
    { aliasPaths: {} },
    { compilerOptions: {} },
    { plugins: undefined },
    { projectRoot: otherCompiler },
    { tsconfig: path.resolve("/project/tsconfig.app.json") },
  ]) {
    assert.notEqual(
      sharedCompileIdentity({ ...compile, ...changed }),
      id,
      JSON.stringify(changed),
    );
  }
  assert.notEqual(
    sharedCompileIdentity({ ...compile, projectRoot: otherCompiler }),
    sharedCompileIdentity({
      ...compile,
      projectRoot: path.join(otherCompiler, "child"),
    }),
    "different source roots must not share output even when they resolve the same compiler",
  );

  const helper = path.resolve("/outside/helper.ts");
  const other = path.resolve("/outside/other.ts");
  const current = {
    hashes: { ...publication.externalInputHashes },
    realpaths: { ...publication.externalInputRealpaths },
  };
  assert.equal(adoptedExternalInputMismatch(publication, current), undefined);
  for (const [label, changed] of [
    ["content", { ...current, hashes: { [helper]: "edited" } }],
    [
      "physical identity",
      { ...current, realpaths: { [helper]: path.resolve("/moved/helper.ts") } },
    ],
    ["a missing input", { ...current, hashes: {} }],
    [
      "an input the publisher never recorded",
      { ...current, hashes: { ...current.hashes, [other]: "hash" } },
    ],
  ] as const) {
    assert.equal(
      adoptedExternalInputMismatch(publication, changed),
      label === "an input the publisher never recorded" ? other : helper,
      label,
    );
  }
}
