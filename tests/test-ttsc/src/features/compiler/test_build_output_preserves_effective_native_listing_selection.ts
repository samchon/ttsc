import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { CompilerArgumentsInspection } from "../../../../../packages/ttsc/src/compiler/internal/CompilerArgumentsInspection";
import { readProjectConfig } from "../../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
import { readEffectiveCompilerOptions } from "../../../../../packages/ttsc/src/compiler/internal/readEffectiveCompilerOptions";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies effective listing selection owns display while metadata survives.
 *
 * The actual production display operation preserves failure status and diagnostics.
 * Literal config and native boolean assignments establish independent selection;
 * observed response projection checks frame consumption without running a compiler.
 * The unit projects observed frames and calls the direct effective reader; it does
 * not exercise the native response-reader branch or certify showConfig omissions.
 * Actual selected-producer response expansion and emission remain E2E-owned.
 *
 * 1. Apply config, ordered CLI and observed response selections.
 * 2. Preserve metadata while hiding internal listing or displaying user listing.
 * 3. Retain failure facts, adjacent output and caller-owned input objects.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual BuildExecution.applyEmittedFileListing used by runTsgoBuild, actual effective option reader and actual observed argument inspector; TSFILE display changes while status, diagnostics, stderr and emitted paths remain intact.
 * @evidence contracts/testing.md#independent-expectations Literal config booleans and native last-assignment true/false/null rules define display selection. Literal TSFILE paths define reported metadata and existing listing-line removal trims trailing newlines; when no TSFILE exists, every original byte remains. Status 7 is independent of association success.
 * @evidence contracts/testing.md#distinguishing-cases Config absent/false/true, bare and explicit booleans, null, repeated last winners, case/alias spelling, scalar dash operands, observed response true/false/bare/null/absence and cross-frame last winners plus independent empty/LF/CRLF reporting contrasts distinguish effective selection from spelling presence. Input objects and diagnostic identity remain unchanged.
 * @evidence contracts/testing.md#execution-ownership One source unit calls maintained operations directly with real temporary config/response files and literal captured streams; no foreign import binding, compiler process, SDK build or native ownership claim is supplied.
 */
export function test_build_output_preserves_effective_native_listing_selection(): void {
  const root = TestProject.createProject({
    "tsconfig.json": "{}",
    "listing.rsp": "--listEmittedFiles true\n",
    "false.rsp": "--listEmittedFiles false\n",
    "null.rsp": "--listEmittedFiles null\n",
    "bare.rsp": "--listEmittedFiles\n",
    "strict.rsp": "--strict\n",
  });
  const failures: unknown[] = [];
  const profiles = [
    { name: "none", args: [], value: undefined },
    { name: "bare", args: ["--listEmittedFiles"], value: true },
    { name: "true", args: ["--listEmittedFiles", "true"], value: true },
    { name: "false", args: ["--listEmittedFiles", "false"], value: false },
    { name: "null", args: ["--listEmittedFiles", "null"], value: null },
    {
      name: "lastfalse",
      args: ["--listEmittedFiles", "true", "--listEmittedFiles", "false"],
      value: false,
    },
    {
      name: "lasttrue",
      args: ["--listEmittedFiles", "false", "--listEmittedFiles", "true"],
      value: true,
    },
    { name: "casefalse", args: ["-LiStEmItTeDfIlEs", "false"], value: false },
    {
      name: "scalar",
      args: ["--rootDir", "--listEmittedFiles", "--strict"],
      value: undefined,
    },
    { name: "response", args: ["@listing.rsp"], value: true },
    {
      name: "response-lastfalse",
      args: ["@listing.rsp", "--listEmittedFiles", "false"],
      value: false,
    },
    { name: "response-false", args: ["@false.rsp"], value: false },
    { name: "response-null", args: ["@null.rsp"], value: null },
    { name: "response-bare", args: ["@bare.rsp"], value: true },
    { name: "response-absence", args: ["@strict.rsp"], value: undefined },
    {
      name: "response-false-directtrue",
      args: ["@false.rsp", "--listEmittedFiles", "true"],
      value: true,
    },
    {
      name: "directtrue-responsefalse",
      args: ["--listEmittedFiles", "true", "@false.rsp"],
      value: false,
    },
  ];
  for (const configured of [undefined, false, true]) {
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions:
          configured === undefined ? {} : { listEmittedFiles: configured },
      }),
    );
    const project = readProjectConfig({ cwd: root });
    for (const profile of profiles) {
      try {
        const original = Object.freeze([...profile.args]);
        const inspected = CompilerArgumentsInspection.inspect(original, root);
        const reader = readEffectiveCompilerOptions(project, inspected.args)!;
        const expected =
          (profile.value === undefined ? configured : profile.value) === true;
        assert.equal(reader("listEmittedFiles") === true, expected);
        const diagnostics: [] = [];
        const output = path.join(root, "main.js");
        const stdout = "ordinary message\nTSFILE: " + output + "\n";
        const source = {
          status: 7,
          stdout,
          stderr: "caller failure",
          diagnostics,
        };
        const result = BuildExecution.applyEmittedFileListing(
          source,
          reader("listEmittedFiles") === true,
        );
        assert.equal(result.stdout, expected ? stdout : "ordinary message");
        assert.deepEqual(result.emittedFiles, [output]);
        assert.equal(result.status, 7);
        assert.equal(result.stderr, "caller failure");
        assert.equal(result.diagnostics, diagnostics);
        assert.equal(source.stdout, stdout);
        assert.deepEqual(original, profile.args);
      } catch (cause) {
        failures.push(new Error(`${configured}/${profile.name}`, { cause }));
      }
    }
  }
  for (const display of [false, true]) {
    for (const stdout of [
      "",
      "ordinary message\n",
      "ordinary message\r\n\r\n",
    ]) {
      try {
        const result = BuildExecution.applyEmittedFileListing(
          { status: 7, stdout, stderr: "unchanged", diagnostics: [] },
          display,
        );
        assert.equal(result.stdout, stdout);
        assert.deepEqual(result.emittedFiles, []);
        assert.equal(result.status, 7);
        assert.equal(result.stderr, "unchanged");
      } catch (cause) {
        failures.push(
          new Error(`no TSFILE ${display}/${JSON.stringify(stdout)}`, {
            cause,
          }),
        );
      }
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "effective listing cases failed");
}
