import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { TsgoArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/TsgoArguments";
import { singleRootProjectConfig } from "../../../../../packages/ttsc/src/launcher/internal/singleRootProjectConfig";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies plugin-free compiler argv retains configured suppression and guards.
 *
 * Configured noEmit suppresses ordinary builds, while an explicit emit
 * overrides it. A requested final guard follows forwarded user options, and an
 * extension import requires the explicit emit adapter to request native
 * rewriting.
 * Private runtime output coordinates clear independently located destinations
 * after forwarding, while root pinning preserves explicitly declared roots.
 *
 * 1. Resolve a real noEmit project with plugin loading disabled.
 * 2. Assert configured suppression and both explicit emit values.
 * 3. Compose exact compiler argv for suppression, guarded emission and terminal
 *    output.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual BuildExecution.resolveExecutionContext, applyProjectNoEmit and TsgoArguments.createTsgoBuildArgs/isolatedTsgoOutputArgs. Exact literal argv distinguishes suppression, runtime root pinning, final private output isolation, guarded emission and terminal forwarding. Actual singleRootProjectConfig projects checked/unchecked overlays with exact source/config/root, suppression overrides and empty inherited-population replacements.
 * @evidence contracts/testing.md#independent-expectations Authored option values establish configured suppression and explicit override. Literal ordered argv follows the supported command contract: project selection first, explicit emit defaults before user forwarding, and requested error guards last. No fake compiler reimplements emission or generates the expected arguments.
 * @evidence contracts/testing.md#distinguishing-cases Covers absent emit versus explicit true/false, configured noEmit, extension rewriting for explicit emit, a forwarded false error guard followed by authoritative true, and a terminal request with no requested guard. Three actual config populations contrast absent root/output, named published destinations and a composite declared root; final isolation clears bundled/declaration/build-info destinations and emitting absent-root pinning differs from disabled pinning/nonemission. Checked/unchecked overlays distinguish own noEmitOnError absence from false, host-native separators from opaque opposite separators and fresh returned arrays. Input options remain unchanged. Actual output and native Program multiplicity remain responsibilities of the shared compiler E2E; argv neither certifies inferred compiler roots nor actual published-output nonmutation.
 * @evidence contracts/testing.md#execution-ownership This exported source unit resolves owned temporary configs with plugins false and process.execPath as an existing unused binary. Resolution only reads paths/config; argv and overlay composition start no compiler or native artifact. The owned project is removed in finally.
 */
export function test_plugin_free_build_arguments_preserve_configured_emit_and_final_guards(): void {
  const root = TestProject.physicalPath(
    TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          noEmit: true,
          allowImportingTsExtensions: true,
          rootDir: "src",
        },
        include: ["src"],
      }),
      "src/main.ts": "export const value = 1;\n",
    }),
  );
  const failures: Error[] = [];
  const check = (name: string, action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  try {
    const context = BuildExecution.resolveExecutionContext({
      cwd: root,
      plugins: false,
      binary: process.execPath,
      emit: true,
    });
    const configPath = path.join(root, "tsconfig.json");
    check("configured suppression", () => {
      const supplied = {};
      const effective = BuildExecution.applyProjectNoEmit(supplied, context);
      assert.deepEqual(effective, { emit: false });
      assert.deepEqual(supplied, {});
      assert.deepEqual(
        TsgoArguments.createTsgoBuildArgs(context, effective, {
          listEmittedFiles: false,
          noEmitOnError: false,
        }),
        ["-p", configPath, "--noEmit"],
      );
    });
    check("explicit disabled emit", () => {
      const supplied = { emit: false };
      assert.equal(
        BuildExecution.applyProjectNoEmit(supplied, context),
        supplied,
      );
      assert.deepEqual(supplied, { emit: false });
    });
    check("explicit emit and authoritative guard", () => {
      const supplied = {
        emit: true,
        passthrough: ["--noEmitOnError", "false"],
      };
      const effective = BuildExecution.applyProjectNoEmit(supplied, context);
      assert.equal(effective, supplied);
      assert.deepEqual(
        TsgoArguments.createTsgoBuildArgs(context, effective, {
          listEmittedFiles: false,
          noEmitOnError: true,
        }),
        [
          "-p",
          configPath,
          "--noEmit",
          "false",
          "--emitDeclarationOnly",
          "false",
          "--rewriteRelativeImportExtensions",
          "--noEmitOnError",
          "false",
          "--noEmitOnError",
        ],
      );
      assert.deepEqual(supplied, {
        emit: true,
        passthrough: ["--noEmitOnError", "false"],
      });
    });
    check("terminal argv omits compile-only guard", () => {
      const supplied = { passthrough: ["--showconfig"] };
      const effective = BuildExecution.applyProjectNoEmit(supplied, context);
      assert.deepEqual(
        TsgoArguments.createTsgoBuildArgs(context, effective, {
          listEmittedFiles: false,
        }),
        ["-p", configPath, "--noEmit", "--showconfig"],
      );
      assert.deepEqual(supplied, { passthrough: ["--showconfig"] });
    });
    const privateOutput = path.join(root, "private runtime output");
    const isolated = ["--outFile", "null", "--declarationDir", "null", "--tsBuildInfoFile", "null", "--outDir", privateOutput];
    assert.deepEqual(TsgoArguments.isolatedTsgoOutputArgs({}), []);
    for (const [name, compilerOptions, rootPrefix] of [
      ["absent-root-output", { noEmit: true }, ["--rootDir", root]],
      ["named-published-output", { noEmit: true, outDir: "lib", declaration: true, declarationDir: "types", tsBuildInfoFile: "state/build.tsbuildinfo" }, ["--rootDir", root]],
      ["composite-declared-root", { composite: true, declaration: true, declarationMap: true, rootDir: "src", outDir: "lib" }, []],
    ] as const) check(`runtime-isolation/${name}`, () => {
      const config = path.join(root, `${name}.json`);
      fs.writeFileSync(config, JSON.stringify({ compilerOptions, include: ["src"] }));
      const actual = BuildExecution.resolveExecutionContext({ cwd: root, tsconfig: config, plugins: false, binary: process.execPath, emit: true });
      const forwarded = ["--outFile", "published.js", "--declarationDir", "published-types", "--tsBuildInfoFile", "published.tsbuildinfo"];
      const options = { emit: true, outDir: privateOutput, isolateOutputsTo: privateOutput, pinInferredRootDir: true, passthrough: forwarded };
      const before = JSON.stringify(options);
      const configBefore = JSON.stringify(actual.project.compilerOptions);
      assert.deepEqual(TsgoArguments.isolatedTsgoOutputArgs(options), isolated);
      assert.deepEqual(TsgoArguments.createTsgoBuildArgs(actual, options, { listEmittedFiles: false, noEmitOnError: false }), [
        "-p", config, "--noEmit", "false", "--emitDeclarationOnly", "false", ...rootPrefix,
        "--outDir", privateOutput, ...forwarded, ...isolated,
      ]);
      assert.equal(JSON.stringify(options), before);
      assert.equal(JSON.stringify(actual.project.compilerOptions), configBefore);
      if (name === "absent-root-output") {
        assert.deepEqual(TsgoArguments.createTsgoBuildArgs(actual, { emit: false, pinInferredRootDir: true }, { listEmittedFiles: false, noEmitOnError: false }), ["-p", config, "--noEmit"]);
        assert.deepEqual(TsgoArguments.createTsgoBuildArgs(actual, { emit: true, pinInferredRootDir: false }, { listEmittedFiles: false, noEmitOnError: false }), ["-p", config, "--noEmit", "false", "--emitDeclarationOnly", "false"]);
      }
    });
    for (const checked of [true, false]) check(`single-root-overlay/${checked}`, () => {
      const input = process.platform === "win32"
        ? { tsconfig: "C:\\fixtures\\owner.json", source: "C:\\fixtures\\scripts\\entry.ts", volumeRoot: "C:\\", checked }
        : { tsconfig: "/fixtures/owner.json", source: "/fixtures/scripts/entry.ts", volumeRoot: "/", checked };
      const before = JSON.stringify(input);
      const actual = singleRootProjectConfig(input);
      assert.deepEqual(actual, {
        extends: process.platform === "win32" ? "C:/fixtures/owner.json" : "/fixtures/owner.json",
        compilerOptions: {
          composite: false, declaration: false, declarationMap: false,
          ...(checked ? {} : { noEmitOnError: false }),
          rootDir: process.platform === "win32" ? "C:/" : "/",
        },
        files: [process.platform === "win32" ? "C:/fixtures/scripts/entry.ts" : "/fixtures/scripts/entry.ts"],
        include: [], exclude: [],
      });
      assert.equal(Object.hasOwn(actual.compilerOptions, "noEmitOnError"), !checked);
      const fresh = singleRootProjectConfig(input);
      assert.notEqual(fresh, actual);
      assert.notEqual(fresh.compilerOptions, actual.compilerOptions);
      assert.notEqual(fresh.files, actual.files);
      assert.notEqual(fresh.include, actual.include);
      assert.notEqual(fresh.exclude, actual.exclude);
      actual.files.push("mutated");
      actual.include.length = 1;
      assert.deepEqual(fresh.files, [process.platform === "win32" ? "C:/fixtures/scripts/entry.ts" : "/fixtures/scripts/entry.ts"]);
      assert.deepEqual(fresh.include, []);
      assert.equal(JSON.stringify(input), before);
    });
    if (process.platform !== "win32") check("single-root opposite separator is opaque", () => {
      const actual = singleRootProjectConfig({ tsconfig: "/fixtures/opaque\\owner.json", source: "/fixtures/opaque\\entry.ts", volumeRoot: "/", checked: true });
      assert.equal(actual.extends, "/fixtures/opaque\\owner.json");
      assert.deepEqual(actual.files, ["/fixtures/opaque\\entry.ts"]);
    });
    if (failures.length !== 0)
      throw new AggregateError(failures, "plugin-free compiler argv failures");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
