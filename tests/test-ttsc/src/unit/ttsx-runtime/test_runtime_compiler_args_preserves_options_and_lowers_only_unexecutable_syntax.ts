import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { runtimeCompilerArgs } from "../../../../../packages/ttsc/src/launcher/internal/runtimeCompilerArgs";

/**
 * Verifies runtime arguments preserve checked options while making emit executable.
 *
 * Portable target, JSX and CLI precedence decisions do not require repeatedly
 * compiling decorators or starting Node. Actual decorator and JSX execution
 * remains in the surviving host cases, including compiler-owned response files.
 *
 * 1. Resolve one fixture project through the authored config reader.
 * 2. Apply the target and JSX decision matrix directly to the argument owner.
 * 3. Assert exact suffixes, original token preservation and invalid-reader behavior.
 *
 * @evidence contracts/testing.md#behavioral-verification runtimeCompilerArgs uses the real effective-option reader for visible arguments and returns exact runtime-only overrides while retaining the original tokens.
 * @evidence contracts/testing.md#independent-expectations Node cannot execute preserved JSX or proposal decorators; supported ES2025 and React emit modes, unchanged explicit libraries/modules and false emit suppression establish the independent suffix expectations.
 * @evidence contracts/testing.md#distinguishing-cases Config and alias/case/repeated target overrides, explicit module/lib/noLib, both preserved JSX modes, all classic declarations, automatic import-source precedence, executable JSX modes and null effective readers distinguish each policy branch.
 * @evidence contracts/testing.md#execution-ownership This named source unit resolves fixture configuration and calls authored functions in one process; no compiler binary, installation or product host executes.
 */
export function test_runtime_compiler_args_preserves_options_and_lowers_only_unexecutable_syntax() {
  const root = TestProject.createProject({ "tsconfig.json": "{}" });
  const project = readProjectConfig({ cwd: root, tsconfig: path.join(root, "tsconfig.json") });
  const tail = ["--noEmit", "false", "--emitDeclarationOnly", "false"];
  const implied = ["--target", "es2025", "--module", "esnext", "--lib", "esnext,dom,webworker.importscripts,scripthost,dom.iterable,dom.asynciterable"];
  const targetCases = [
    { options: { target: "ESNext" }, args: [] },
    { options: { target: "ES2019" }, args: ["-t", "esnext"] },
    { options: { target: "ES2019" }, args: ["--TARGET", "ESNEXT"] },
    { options: { target: "ES2019" }, args: ["--target", "es2019", "-target", "esnext"] },
  ];
  for (const scenario of targetCases) {
    project.compilerOptions = { plugins: [], ...scenario.options };
    assert.deepEqual(runtimeCompilerArgs(project, scenario.args), [...scenario.args, ...implied, ...tail]);
  }
  for (const scenario of [
    { options: { target: "ESNext", module: "commonjs", lib: [] }, suffix: ["--target", "es2025"] },
    { options: { target: "ESNext", module: "esnext", lib: ["esnext"] }, suffix: ["--target", "es2025"] },
    { options: { target: "ESNext", noLib: true }, suffix: ["--target", "es2025", "--module", "esnext"] },
    { options: { target: "ES2022" }, suffix: [] },
    { options: { jsx: "react", jsxFactory: "h" }, suffix: [] },
    { options: { jsx: "react-jsxdev", jsxImportSource: "myjsx" }, suffix: [] },
    { options: { jsx: "preserve" }, suffix: ["--jsx", "react-jsx"] },
    { options: { jsx: "react-native" }, suffix: ["--jsx", "react-jsx"] },
    { options: { jsx: "preserve", jsxFactory: "h" }, suffix: ["--jsx", "react"] },
    { options: { jsx: "preserve", jsxFragmentFactory: "F" }, suffix: ["--jsx", "react"] },
    { options: { jsx: "preserve", reactNamespace: "R" }, suffix: ["--jsx", "react"] },
    { options: { jsx: "preserve", jsxFactory: "h", jsxFragmentFactory: "F", reactNamespace: "R", jsxImportSource: "myjsx" }, suffix: ["--jsx", "react-jsx", "--jsxFactory", "null", "--jsxFragmentFactory", "null", "--reactNamespace", "null"] },
  ]) {
    project.compilerOptions = { plugins: [], ...scenario.options };
    assert.deepEqual(runtimeCompilerArgs(project), [...scenario.suffix, ...tail], JSON.stringify(scenario.options));
  }
  project.compilerOptions = { plugins: [], target: "ESNext" };
  assert.deepEqual(runtimeCompilerArgs(project, ["--noLib"]), ["--noLib", "--target", "es2025", "--module", "esnext", ...tail]);
  assert.deepEqual(runtimeCompilerArgs(project, ["--noLib", "false"]), ["--noLib", "false", ...implied, ...tail]);
  assert.deepEqual(runtimeCompilerArgs(project, ["--lib", "esnext"]), ["--lib", "esnext", "--target", "es2025", "--module", "esnext", ...tail]);
  assert.deepEqual(runtimeCompilerArgs(project, ["--noEmit", "true", "--emitDeclarationOnly", "true"], undefined, null), ["--noEmit", "true", "--emitDeclarationOnly", "true"]);
}

