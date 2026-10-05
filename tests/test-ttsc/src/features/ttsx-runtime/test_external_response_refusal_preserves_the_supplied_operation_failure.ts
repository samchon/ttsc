import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { runExternalEmitProvenance } from "../../../../../packages/ttsc/src/compiler/internal/build/runExternalEmitProvenance";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies refusal delegates original arguments and preserves caller failure.
 *
 * When provenance inspection is refused, the callback must still run the
 * original producer exactly once with the original arguments, and a failure it
 * throws belongs to the caller and must escape unchanged.
 *
 * 1. Author cyclic, plain, missing-operand and unknown-option response files;
 *    independently require the selected compiler path to be absent.
 * 2. Call the adapter for those four frames plus plain module, missing rootDir and
 *    composite option records with a callback that records argv and throws.
 * 3. Require one producer call with unchanged arguments, the same error identity
 *    and an unmodified caller argument array.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual adapter receives an A-to-B-to-A response cycle and a caller-owned emitting operation that throws its own Error. It must reach that operation once within the work deadline, pass exact original argv and propagate the same Error object; adjacent acyclic input preserves the same supplied-operation contract.
 * @evidence contracts/testing.md#independent-expectations A separately constructed sentinel object and literal argv establish delegation/failure identity. A VM execution deadline independently rejects unbounded response traversal rather than awaiting an infinitely recursive native compiler.
 * @evidence contracts/testing.md#distinguishing-cases Cyclic and acyclic response frames use the same deliberately unavailable selected binary. The implementation's response inspection precedes executable admission; this unit proves bounded public refusal and caller-failure propagation, not a separately observable internal refusal reason or native cycle diagnostics.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the authored public operation inside one process with fixture response files and a supplied failing callback. No executable, installed consumer, native artifact build or product host runs, and no successful compiler status or ownership metadata is fabricated.
 */
export function test_external_response_refusal_preserves_the_supplied_operation_failure(): void {
  const root = TestProject.createProject({
    "a.rsp": "@b.rsp\n",
    "b.rsp": "@a.rsp\n",
    "plain.rsp": "--module commonjs\n",
    "missing.rsp": "--rootDir\n",
    "unknown.rsp": "--unknown-native-option\n",
  });
  const binary = path.join(root, "unavailable-selected-compiler");
  assert.equal(fs.existsSync(binary), false);
  const failures: Error[] = [];
  for (const args of [
    ["@a.rsp"],
    ["@plain.rsp"],
    ["--module", "commonjs"],
    ["@missing.rsp"],
    ["@unknown.rsp"],
    ["--rootDir"],
    ["--composite", "true"],
  ]) {
    const original = [...args];
    const failure = new Error("caller-owned emission failure");
    let calls = 0;
    const invoke = () =>
      runExternalEmitProvenance({
        args,
        binary,
        cwd: root,
        env: {},
        run: (actual) => {
          calls++;
          assert.deepEqual(actual, original);
          throw failure;
        },
      });
    try {
      assert.throws(
        () => vm.runInNewContext("invoke()", { invoke }, { timeout: 500 }),
        (error) => error === failure,
      );
      assert.equal(calls, 1);
      assert.deepEqual(args, original);
    } catch (cause) {
      failures.push(new Error(args.join(" "), { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "external refusal argument matrix failed",
    );
}
