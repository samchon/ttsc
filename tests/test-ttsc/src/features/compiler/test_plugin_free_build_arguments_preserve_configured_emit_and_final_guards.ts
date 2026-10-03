import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { TsgoArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/TsgoArguments";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies plugin-free compiler argv retains configured suppression and guards.
 *
 * Configured noEmit suppresses ordinary builds, while an explicit emit
 * overrides it. A requested final guard follows forwarded user options, and an
 * extension import requires the explicit emit adapter to request native
 * rewriting.
 *
 * 1. Resolve a real noEmit project with plugin loading disabled.
 * 2. Assert configured suppression and both explicit emit values.
 * 3. Compose exact compiler argv for suppression, guarded emission and terminal
 *    output.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual BuildExecution.resolveExecutionContext, applyProjectNoEmit and TsgoArguments.createTsgoBuildArgs. Exact literal argv distinguishes noEmit without a compile guard, explicit emit with extension rewriting and authoritative trailing noEmitOnError, and terminal forwarding without injected guards.
 * @evidence contracts/testing.md#independent-expectations Authored option values establish configured suppression and explicit override. Literal ordered argv follows the supported command contract: project selection first, explicit emit defaults before user forwarding, and requested error guards last. No fake compiler reimplements emission or generates the expected arguments.
 * @evidence contracts/testing.md#distinguishing-cases Covers absent emit versus explicit true/false, configured noEmit, extension rewriting for explicit emit, a forwarded false error guard followed by authoritative true, and a terminal request with no requested guard. Input options remain unchanged. Actual output and native Program multiplicity remain responsibilities of the shared compiler E2E.
 * @evidence contracts/testing.md#execution-ownership This exported source unit resolves one temporary project with plugins false and process.execPath as an existing unused binary. Resolution only reads paths/config; argv composition starts no compiler or native artifact. The owned project is removed in finally.
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
    if (failures.length !== 0)
      throw new AggregateError(failures, "plugin-free compiler argv failures");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
