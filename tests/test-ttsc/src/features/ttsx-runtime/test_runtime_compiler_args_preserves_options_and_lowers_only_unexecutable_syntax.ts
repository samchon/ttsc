import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../../../../packages/ttsc/src/compiler/internal/readEffectiveCompilerOptions";
import { runtimeCompilerArgs } from "../../../../../packages/ttsc/src/launcher/internal/runtimeCompilerArgs";

/**
 * Verifies runtime arguments preserve checked options while making emit executable.
 *
 * Portable target, JSX and CLI precedence decisions can be checked on the
 * argument list alone, without compiling decorators or starting Node. The
 * forwarded-`@file` path, which asks the native compiler for `--showConfig`, is
 * not exercised here.
 * Visible target frames matching the response examples check only downstream
 * policy, not native expansion, diagnostics, decorator effects, library type
 * checking or output isolation.
 *
 * 1. Resolve one fixture project through the authored config reader.
 * 2. Apply the target and JSX decision matrix directly to the argument owner.
 * 3. Assert exact suffixes, original token preservation and invalid-reader behavior.
 *
 * @evidence contracts/testing.md#behavioral-verification runtimeCompilerArgs uses the real effective-option reader for visible arguments and returns exact runtime-only overrides while retaining the original tokens.
 * @evidence contracts/testing.md#independent-expectations Node cannot execute preserved JSX or proposal decorators; supported ES2025 and React emit modes, unchanged explicit libraries/modules and false emit suppression establish the independent suffix expectations.
 * @evidence contracts/testing.md#distinguishing-cases Default, ES2025, ES2019, CLI ES2019/null and alias/case/repeated target overrides, explicit module/lib/noLib, both preserved JSX modes, all classic declarations, automatic import-source precedence, executable JSX modes and null effective readers distinguish each policy branch.
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
    { target: undefined, args: [] },
    { target: "ES2025", args: [] },
    { target: "ES2019", args: [] },
    { target: "ESNext", args: ["-t", "es2019"] },
    { target: "ESNext", args: ["--target", "null"] },
  ]) {
    project.compilerOptions = { plugins: [], target: scenario.target };
    assert.deepEqual(runtimeCompilerArgs(project, scenario.args), [...scenario.args, ...tail]);
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
    { options: { jsx: "preserve", jsxImportSource: "myjsx" }, suffix: ["--jsx", "react-jsx"] },
    { options: { jsx: "react-native", jsxImportSource: "myjsx" }, suffix: ["--jsx", "react-jsx"] },
    { options: { jsx: "preserve", jsxFactory: "h" }, suffix: ["--jsx", "react"] },
    { options: { jsx: "preserve", jsxFragmentFactory: "F" }, suffix: ["--jsx", "react"] },
    { options: { jsx: "preserve", reactNamespace: "R" }, suffix: ["--jsx", "react"] },
    { options: { jsx: "preserve", jsxFactory: "h", jsxFragmentFactory: "F", reactNamespace: "R", jsxImportSource: "myjsx" }, suffix: ["--jsx", "react-jsx", "--jsxFactory", "null", "--jsxFragmentFactory", "null", "--reactNamespace", "null"] },
    { options: { jsx: "preserve", jsxFactory: "h", jsxFragmentFactory: "Fragment", jsxImportSource: "myjsx" }, suffix: ["--jsx", "react-jsx", "--jsxFactory", "null", "--jsxFragmentFactory", "null"] },
    { options: { jsx: "preserve", reactNamespace: "R", jsxImportSource: "myjsx" }, suffix: ["--jsx", "react-jsx", "--reactNamespace", "null"] },
  ]) {
    project.compilerOptions = { plugins: [], ...scenario.options };
    assert.deepEqual(runtimeCompilerArgs(project), [...scenario.suffix, ...tail], JSON.stringify(scenario.options));
  }
  project.compilerOptions = { plugins: [], target: "ESNext" };
  assert.deepEqual(runtimeCompilerArgs(project, ["--noLib"]), ["--noLib", "--target", "es2025", "--module", "esnext", ...tail]);
  assert.deepEqual(runtimeCompilerArgs(project, ["--noLib", "false"]), ["--noLib", "false", ...implied, ...tail]);
  assert.deepEqual(runtimeCompilerArgs(project, ["--lib", "esnext"]), ["--lib", "esnext", "--target", "es2025", "--module", "esnext", ...tail]);
  assert.deepEqual(runtimeCompilerArgs(project, ["--noEmit", "true", "--emitDeclarationOnly", "true"], undefined, null), ["--noEmit", "true", "--emitDeclarationOnly", "true"]);
  project.compilerOptions = { plugins: [], target: "ES2022", module: "commonjs" };
  for (const flags of [["--noEmit"], ["--emitDeclarationOnly", "--declaration"], ["--noEmit", "--emitDeclarationOnly", "--declaration"]]) {
    assert.deepEqual(runtimeCompilerArgs(project, flags), [...flags, ...tail]);
  }
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try { operation(); }
    catch (error) { failures.push(new Error(name, { cause: error })); }
  };
  // Visible-token counterparts do not supply a native response-file oracle.
  const responseSuffix = ["--target", "es2025", "--lib", "esnext,dom,webworker.importscripts,scripthost,dom.iterable,dom.asynciterable"];
  for (const [target, args, suffix] of [
    ["ES2022", ["--target", "esnext"], responseSuffix],
    ["ESNext", ["--target", "es2019"], []],
    ["ESNext", ["--target", "es2019", "--target", "esnext"], responseSuffix],
    ["ESNext", ["--target", "esnext", "--target", "es2019"], []],
  ] as [string, string[], string[]][]) {
    check("visible-response-counterpart/" + args.join(" "), () => {
      project.compilerOptions = { plugins: [], target, module: "commonjs", strict: true, outDir: "dist", rootDir: "src" };
      const before = [...args];
      const optionsBefore = JSON.stringify(project.compilerOptions);
      const reader = readEffectiveCompilerOptions(project, args);
      assert.notEqual(reader, null);
      assert.deepEqual(runtimeCompilerArgs(project, args, undefined, reader), [...args, ...suffix, ...tail]);
      assert.deepEqual(args, before);
      assert.equal(JSON.stringify(project.compilerOptions), optionsBefore);
    });
  }
  check("explicit-esnext-library-and-module", () => {
    project.compilerOptions = { plugins: [], target: "ESNext", module: "esnext", lib: ["esnext"] };
    const before = JSON.stringify(project.compilerOptions);
    assert.deepEqual(runtimeCompilerArgs(project), ["--target", "es2025", ...tail]);
    assert.equal(JSON.stringify(project.compilerOptions), before);
  });
  // Token retention does not establish the native emitter's output locations.
  for (const flags of [
    ["--outDir", "distx"],
    ["--declaration", "--declarationDir", "typesx"],
    ["--incremental", "--tsBuildInfoFile", "state/run.tsbuildinfo"],
    ["--outFile", "bundle.js"],
  ]) check("forwarded-output/" + flags.join(" "), () => {
    project.compilerOptions = { plugins: [], target: "ES2022", module: "commonjs", rootDir: "src", outDir: "lib" };
    const before = [...flags];
    assert.deepEqual(runtimeCompilerArgs(project, flags), [...flags, ...tail]);
    assert.deepEqual(flags, before);
  });
  if (failures.length) throw new AggregateError(failures, "runtime compiler policy counterparts failed");
}

