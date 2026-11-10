import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import type { TtscSharedCompilePublication } from "../../../../../packages/unplugin/src/core/transform/session/TtscSharedCompilePublication";
import { claimSharedCompile } from "../../../../../packages/unplugin/src/core/transform/session/claimSharedCompile";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies persisted environment witnesses retain the native record contract. A
 * malformed field cannot mean that the generation read no environment.
 *
 * 1. Publish a valid result, then edit its owned JSON at the persistence boundary.
 * 2. Require malformed publications to yield compile ownership and malformed
 *    project records to be rejected, collecting every case's verdict.
 * 3. Preserve valid omission, absence, empty values and literal dictionary names;
 *    changed valid reads must still decline shared adoption.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual shared-store publication/claim and project-record readers on owned JSON files. Invalid whole fields, names and values must not be adopted or returned; valid records retain matching adoption and mismatching compile ownership.
 * @evidence contracts/testing.md#independent-expectations Authored JSON shapes and literal environment values define record validity and read equality independently of either reader or its validation helper. Invalid data requires a fresh compile, not an undefined claim or entry dropping.
 * @evidence contracts/testing.md#distinguishing-cases Covers omitted and empty records, null absence, present-empty and changed values, prototype-like literal names, null/array/string/number/boolean whole fields, empty names and invalid entry values. Both persistence readers see the same matrix, and errors are collected across all cases.
 * @evidence contracts/testing.md#execution-ownership A source unit owns temporary store/record files and real compile claims, releasing every claim in finally. It changes only its own serialized test data and replaces no filesystem method, global environment, compiler, worker or installed consumer.
 */
export async function test_persisted_environment_inputs_reject_malformed_records(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-persisted-environment-record-");
  const identity = "a".repeat(32);
  const state = "b".repeat(32);
  const failures: unknown[] = [];
  const cases: {
    name: string;
    recorded?: unknown;
    environment?: NodeJS.ProcessEnv;
    valid?: boolean;
    adopt?: boolean;
  }[] = [
    { name: "omitted", valid: true, adopt: true },
    { name: "empty", recorded: {}, valid: true, adopt: true },
    { name: "unset", recorded: { MODE: null }, valid: true, adopt: true },
    {
      name: "empty-value",
      recorded: { MODE: "" },
      environment: { MODE: "" },
      valid: true,
      adopt: true,
    },
    {
      name: "matching",
      recorded: { MODE: "production" },
      environment: { MODE: "production" },
      valid: true,
      adopt: true,
    },
    {
      name: "changed",
      recorded: { MODE: "production" },
      environment: { MODE: "development" },
      valid: true,
    },
    {
      name: "unset-became-empty",
      recorded: { MODE: null },
      environment: { MODE: "" },
      valid: true,
    },
    {
      name: "literal-names",
      recorded: Object.fromEntries([
        ["__proto__", "literal"],
        ["constructor", null],
      ]),
      environment: Object.fromEntries([["__proto__", "literal"]]),
      valid: true,
      adopt: true,
    },
    { name: "null", recorded: null },
    { name: "empty-array", recorded: [] },
    { name: "array", recorded: ["MODE"] },
    { name: "empty-string", recorded: "" },
    { name: "number", recorded: 42 },
    { name: "boolean", recorded: false },
    { name: "empty-name", recorded: { "": null } },
    { name: "number-value", recorded: { MODE: 42 } },
    { name: "object-value", recorded: { MODE: {} } },
    {
      name: "mixed-invalid",
      recorded: { MODE: "production", BROKEN: [] },
      environment: { MODE: "production" },
    },
  ];
  for (const test of cases) {
    const directory = path.join(root, test.name);
    fs.mkdirSync(directory);
    const fields =
      test.recorded === undefined ? {} : { environmentInputs: test.recorded };
    const recordFile = path.join(directory, "record.json");
    fs.writeFileSync(
      recordFile,
      JSON.stringify({
        ...fields,
        inputs: {},
        membership: null,
        root: directory,
        signal: 0,
        tsconfig: path.join(directory, "tsconfig.json"),
      }),
    );
    try {
      assert.equal(
        readProjectRecordFile(recordFile) !== undefined,
        test.valid === true,
      );
    } catch (error) {
      failures.push(
        new Error(`${test.name}: project record`, { cause: error }),
      );
    }
    const publication: TtscSharedCompilePublication = {
      externalInputHashes: {},
      externalInputRealpaths: {},
      result: {
        type: "success",
        typescript: { "main.ts": "export const value = 1;\n" },
      },
      scratchDirectory: directory,
    };
    const owner = await claimSharedCompile(directory, identity, state, {
      adopt: false,
    });
    assert.ok(owner?.kind === "compile");
    try {
      await owner.publish(publication);
    } finally {
      owner.release();
    }
    fs.writeFileSync(
      path.join(directory, `${identity}-${state}.json`),
      JSON.stringify({
        ...publication,
        result: { ...publication.result, ...fields },
      }),
    );
    const claim = await claimSharedCompile(directory, identity, state, {
      adopt: true,
      environment: test.environment ?? {},
    });
    try {
      assert.equal(claim?.kind, test.adopt ? "adopt" : "compile");
      if (claim?.kind === "adopt") {
        assert.ok(claim.publication.result.type === "success");
        assert.deepEqual(
          claim.publication.result.environmentInputs,
          test.recorded,
        );
      }
    } catch (error) {
      failures.push(
        new Error(`${test.name}: shared publication`, { cause: error }),
      );
    } finally {
      if (claim?.kind === "compile") claim.release();
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "Persisted environment record cases failed",
    );
}
