import assert from "node:assert/strict";
import type fs from "node:fs";

import { createFilesystemPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createFilesystemPathIdentityContext";

/**
 * Verifies read-only case probing stops once current names establish policy.
 *
 * A directory listing can outlive an entry. Only an alternate-name miss with an
 * original still present establishes sensitivity; vanished names and failed
 * observations must remain unavailable evidence.
 *
 * 1. Probe a large sensitive directory and require only two metadata reads.
 * 2. Contrast insensitive aliases, distinct names, vanished entries and errors.
 * 3. Check each independent case even if another one fails.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual filesystem identity context with its supported native-operation injection, checks policy and read counts, and repeats the query to verify transaction-local reuse. It distinguishes probing every entry from stopping on current evidence and rejects sensitivity inferred from vanished names.
 * @evidence contracts/testing.md#independent-expectations A present original whose alternate is absent distinguishes sensitive lookup; two spellings resolving to one physical entry distinguish insensitive lookup. Missing both or inaccessible metadata supplies neither answer. The two-read bound follows from these necessary observations, independently of the probe algorithm.
 * @evidence contracts/testing.md#distinguishing-cases Covers a 512-entry sensitive directory, insensitive aliases after a vanished entry, coexisting case-distinct names, wholly vanished entries, unavailable original metadata, and an alias disappearing during realpath. A complete folded-name scan still detects a pair at the end of the listing without metadata probes.
 * @evidence contracts/testing.md#execution-ownership This named test-ttsc unit calls the owning source operation through supported filesystem primitives and collects all matrix failures. It starts no compiler, watcher or installed host; the injected filesystem models one native POSIX namespace and controlled observation races.
 */
export function test_filesystem_case_probe_stops_at_current_name_evidence(): void {
  const names = Array.from({ length: 512 }, (_, index) => `entry${index}`);
  const missing = () => Object.assign(new Error("missing"), { code: "ENOENT" });
  const stats = { dev: 1 } as fs.Stats;
  const failures: Error[] = [];
  for (const scenario of [
    {
      name: "sensitive",
      entries: names,
      lstat: (location: string) => {
        if (location === "/root/entry0") return stats;
        throw missing();
      },
      physical: (location: string) => location,
      expected: true,
      reads: 2,
    },
    {
      name: "late distinct pair",
      entries: [...names, "last", "LAST"],
      lstat: (_location: string) => {
        throw new Error("unnecessary read");
      },
      physical: (location: string) => location,
      expected: true,
      reads: 0,
    },
    {
      name: "vanished then insensitive",
      entries: ["gone", "live"],
      lstat: (location: string) => {
        if (location.toLowerCase() === "/root/live") return stats;
        throw missing();
      },
      physical: (location: string) => location.toLowerCase(),
      expected: false,
      reads: 3,
    },
    {
      name: "all vanished",
      entries: ["gone"],
      lstat: (_location: string) => {
        throw missing();
      },
      physical: (location: string) => location,
      expected: undefined,
      reads: 2,
    },
    {
      name: "original inaccessible",
      entries: ["live"],
      lstat: (location: string) => {
        if (location === "/root/LIVE") throw missing();
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      },
      physical: (location: string) => location,
      expected: undefined,
      reads: 2,
    },
    {
      name: "alias disappears after metadata",
      entries: ["live"],
      lstat: (_location: string) => stats,
      physical: (location: string) => {
        if (location === "/root/LIVE") throw missing();
        return location;
      },
      expected: undefined,
      reads: 1,
    },
  ]) {
    try {
      let reads = 0;
      const context = createFilesystemPathIdentityContext({
        platform: "linux",
        realpath: scenario.physical,
        readdir: () => scenario.entries,
        lstat: (location) => {
          reads += 1;
          return scenario.lstat(location);
        },
      });
      assert.equal(context.caseSensitive("/root"), scenario.expected);
      assert.equal(reads, scenario.reads);
      assert.equal(context.caseSensitive("/root"), scenario.expected);
      assert.equal(
        reads,
        scenario.reads,
        "one transaction reuses the observation",
      );
    } catch (cause) {
      failures.push(new Error(scenario.name, { cause }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "case probe evidence");
}
