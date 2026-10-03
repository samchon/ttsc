import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { GoBuildCacheCoordination } from "../../../../../packages/ttsc/src/plugin/internal/source/GoBuildCacheCoordination";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies Go cache records are collected by task status and heartbeat age.
 *
 * A PID does not prove whether a build task has ended. The collector's declared
 * one-hour build grace and one-minute maintenance grace apply to the actual
 * record mtime, including records whose owner fields cannot identify a process.
 *
 * 1. Collect missing and empty coordination directories without creating records.
 * 2. Compare fresh, exactly-at-grace and expired records across owner identities.
 * 3. Age the same retained synthetic lease by two hours and require its removal.
 * 4. Remove completed records immediately and apply age policy to malformed JSON.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual collector over ordinary owned directories and asserts returned paths, exact retained bytes and deletion of expired or completed records. It never infers object pruning or callback execution from record collection.
 * @evidence contracts/testing.md#independent-expectations Literal one-hour and one-minute coordination policy boundaries define retention, complete status overrides freshness, and PID/hostname are not liveness authority. The supplied clock is the independently observed native mtime plus an authored age, avoiding filesystem timestamp precision assumptions; no product result generates an expectation.
 * @evidence contracts/testing.md#distinguishing-cases Missing/empty populations, fresh/exact-limit/expired active records, fresh completed records and malformed fresh/expired JSON contrast across current, synthetic, invalid and remote owner fields. The same synthetic record transitions from fresh to two-hours-old without changing its owner or bytes. Real heartbeat publication, child lifetime, callbacks, object pruning and clock-skew repair remain separate owners.
 * @evidence contracts/testing.md#execution-ownership This matching named source unit directly calls collectLiveGoBuildCacheCoordinationRecords with a supplied clock and actual filesystem metadata. It starts no worker, process, Go build or product host, collects independent failures and finally removes its owned root.
 */
export function test_go_build_cache_coordination_collects_by_status_and_heartbeat_age(): void {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-coordination-policy-"));
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  const directories = [
    ["lease", GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR, 3_600_000],
    ["maintenance", GoBuildCacheCoordination.GO_BUILD_CACHE_MAINTENANCE_DIR, 60_000],
  ] as const;
  const owners = [
    ["current", process.pid, os.hostname()],
    ["synthetic", 2_147_483_647, "localhost"],
    ["invalid", -1, "localhost"],
    ["remote", process.pid, "unrelated-host.example"],
  ] as const;
  let sequence = 0;
  const collect = (name: string, directoryName: string, bytes: string, age: number, retained: boolean): void => {
    check(`${name}/operation`, () => {
      const cache = path.join(root, String(sequence++));
      const directory = path.join(cache, directoryName);
      fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, "record.json");
      fs.writeFileSync(file, bytes, "utf8");
      const timestamp = new Date(Math.floor(Date.now() / 1000) * 1000);
      fs.utimesSync(file, timestamp, timestamp);
      const now = fs.statSync(file).mtimeMs + age;
      const actual = GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(cache, directoryName, now);
      check(`${name}/returned-paths`, () => assert.deepEqual(actual, retained ? [file] : []));
      check(`${name}/record-presence`, () => assert.equal(fs.existsSync(file), retained));
      if (retained) check(`${name}/retained-bytes`, () => assert.equal(fs.readFileSync(file, "utf8"), bytes));
    });
  };
  try {
    check("synthetic/same-record-transition", () => {
      const cache = path.join(root, "synthetic-transition");
      const directoryName = GoBuildCacheCoordination.GO_BUILD_CACHE_LEASE_DIR;
      const directory = path.join(cache, directoryName);
      fs.mkdirSync(directory, { recursive: true });
      const file = path.join(directory, "synthetic-2147483647.json");
      const now = Date.now();
      const bytes = `${JSON.stringify({ directoryName, hostname: "localhost", pid: 2_147_483_647, startedAt: now, status: "active", version: 1 })}\n`;
      fs.writeFileSync(file, bytes, "utf8");
      const fresh = new Date(now);
      fs.utimesSync(file, fresh, fresh);
      const live = GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(cache, directoryName, now);
      check("synthetic/transition/fresh-path", () => assert.deepEqual(live, [file]));
      check("synthetic/transition/fresh-bytes", () => assert.equal(fs.readFileSync(file, "utf8"), bytes));
      const expired = new Date(now - 7_200_000);
      fs.utimesSync(file, expired, expired);
      const stale = GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(cache, directoryName, now);
      check("synthetic/transition/stale-path", () => assert.deepEqual(stale, []));
      check("synthetic/transition/deleted", () => assert.equal(fs.existsSync(file), false));
    });
    for (const [kind, directoryName, grace] of directories) {
      check(`${kind}/missing`, () => assert.deepEqual(GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(root, directoryName, Date.now()), []));
      fs.mkdirSync(path.join(root, directoryName));
      check(`${kind}/empty`, () => assert.deepEqual(GoBuildCacheCoordination.collectLiveGoBuildCacheCoordinationRecords(root, directoryName, Date.now()), []));
      for (const [owner, pid, hostname] of owners) {
        const active = JSON.stringify({ directoryName, hostname, pid, status: "active", version: 1 });
        collect(`${kind}/${owner}/fresh`, directoryName, active, 0, true);
        collect(`${kind}/${owner}/at-grace`, directoryName, active, grace, true);
        collect(`${kind}/${owner}/expired`, directoryName, active, grace + 1_000, false);
        collect(`${kind}/${owner}/complete`, directoryName, JSON.stringify({ directoryName, hostname, pid, status: "complete", version: 1 }), 0, false);
      }
      collect(`${kind}/malformed/fresh`, directoryName, "{", 0, true);
      collect(`${kind}/malformed/expired`, directoryName, "{", grace + 1_000, false);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  if (failures.length !== 0) throw new AggregateError(failures, "Go cache coordination task policy");
}
