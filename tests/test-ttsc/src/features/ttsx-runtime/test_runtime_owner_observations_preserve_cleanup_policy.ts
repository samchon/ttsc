import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ProcessOwnedDirectory } from "../../../../../packages/ttsc/src/launcher/internal/runtime/ProcessOwnedDirectory";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies owner diagnostics preserve the actual scan and its cleanup policy.
 *
 * Diagnostics must identify the record responsible for conservative retention
 * without probing again or turning a failing diagnostic into deletion
 * authority. These owned inputs exercise an actually live local pid, a remote
 * claim and invalid JSON; no guessed dead pid or replaced native probe is
 * used.
 *
 * 1. Inspect separate local, remote and malformed owner records.
 * 2. Assert literal classifications and their observed record/owner provenance.
 * 3. Repeat with a throwing observer and preserve both policy and record bytes.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual ProcessOwnedDirectory.ownership with real records and the native current-pid probe, asserting classification, diagnostic provenance and unchanged bytes with working and throwing observers.
 * @evidence contracts/testing.md#independent-expectations The current process is alive, another hostname cannot establish local absence, and malformed JSON establishes no owner; literal present/remote/invalid-record observations and live/live/unknown states follow those independent facts.
 * @evidence contracts/testing.md#distinguishing-cases A valid local owner contrasts with a remote same-pid owner and malformed evidence; enabled, disabled and throwing observers must preserve the same classifications. Native denial/death combinations remain owned by actual runtime observations rather than fabricated pids here.
 * @evidence contracts/testing.md#execution-ownership One discoverable unit entry uses its tracked physical scratch and direct maintained source operations, without a compiler, installed consumer, child process, global replacement or private inspection.
 */
export function test_runtime_owner_observations_preserve_cleanup_policy(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("owner-observation-"),
  );
  const record = `owner-${process.pid}.json`;
  const local = { hostname: os.hostname(), pid: process.pid };
  const remote = { hostname: `${os.hostname()}-elsewhere`, pid: process.pid };
  const failures: Error[] = [];
  for (const scenario of [
    {
      name: "local",
      bytes: JSON.stringify(local),
      state: "live",
      observation: { record, owner: local, result: "present" },
    },
    {
      name: "remote",
      bytes: JSON.stringify(remote),
      state: "live",
      observation: { record, owner: remote, result: "remote" },
    },
    {
      name: "malformed",
      bytes: "{",
      state: "unknown",
      observation: { record, result: "invalid-record" },
    },
  ] as const) {
    try {
      const directory = path.join(root, scenario.name);
      fs.mkdirSync(directory);
      const file = path.join(directory, record);
      fs.writeFileSync(file, scenario.bytes, "utf8");
      const observed: ProcessOwnedDirectory.Observation[] = [];
      assert.equal(ProcessOwnedDirectory.ownership(directory), scenario.state);
      assert.equal(
        ProcessOwnedDirectory.ownership(directory, false, (value) =>
          observed.push(value),
        ),
        scenario.state,
      );
      assert.deepEqual(observed, [scenario.observation]);
      let calls = 0;
      assert.equal(
        ProcessOwnedDirectory.ownership(directory, false, () => {
          calls++;
          throw new Error("diagnostic sink rejected observation");
        }),
        scenario.state,
      );
      assert.equal(calls, 1);
      assert.equal(fs.readFileSync(file, "utf8"), scenario.bytes);
    } catch (cause) {
      failures.push(new Error(scenario.name, { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "owner diagnostics changed cleanup policy",
    );
}
