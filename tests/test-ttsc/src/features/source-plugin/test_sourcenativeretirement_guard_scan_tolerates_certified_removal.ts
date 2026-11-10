import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SourceNativeRetirement } from "../../../../../packages/ttsc/src/internal/SourceNativeRetirement";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a guard retired after enumeration is absent rather than malformed.
 *
 * A normal owner can remove its guard while another task reads the listing.
 * Remaining ownership and genuine read failures must still block reclamation.
 *
 * 1. Certify a never-started boundary exactly when its listed guard is read.
 * 2. Observe absence through admission, protection, generations and diagnostics.
 * 3. Preserve an independent pending guard and refuse a real read-error oracle.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls maintained guard observers over real metadata; task-local read operations settle the original never-started boundary between actual enumeration and the original filesystem read, producing a real ENOENT. Independent pending ownership and an authored EACCES remain protected.
 * @evidence contracts/testing.md#independent-expectations Explicit absent, pending and unreadable states prescribe admission, generation sets and diagnostics without reproducing JSON validation or filename hashing.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts a removed final guard with a removed guard beside an independent live generation; permission refusal remains malformed protection rather than absence. Existing protocol units retain malformed-JSON controls and the worker unit owns actual native-close coverage.
 * @evidence contracts/testing.md#execution-ownership One portable source unit owns real temporary guard directories and task-local IO ports without replacing filesystem methods. Original scope settlement removes each guard before cleanup. No native command starts; not-started certification claims no process join or actual OS permission refusal.
 */
export function test_sourcenativeretirement_guard_scan_tolerates_certified_removal(): void {
  const root = TestProject.tmpdir("ttsc-retirement-guard-read-");
  const failures: unknown[] = [];
  const cases: {
    name: string;
    pending?: boolean;
    unreadable?: boolean;
    observe: (directory: string) => void;
  }[] = [
    {
      name: "admission",
      observe: (directory) => SourceNativeRetirement.assertAvailable(directory),
    },
    {
      name: "protection",
      observe: (directory) =>
        assert.equal(SourceNativeRetirement.isProtected(directory), false),
    },
    {
      name: "generations",
      observe: (directory) =>
        assert.deepEqual(
          SourceNativeRetirement.protectedGenerations(directory),
          new Set(),
        ),
    },
    {
      name: "diagnostic",
      observe: (directory) =>
        assert.equal(
          SourceNativeRetirement.describeProtection(directory),
          undefined,
        ),
    },
    {
      name: "release",
      observe: (directory) =>
        SourceNativeRetirement.assertReleasable(directory),
    },
    {
      name: "remaining-generation",
      pending: true,
      observe: (directory) => {
        assert.deepEqual(
          SourceNativeRetirement.protectedGenerations(directory),
          new Set(["live"]),
        );
        SourceNativeRetirement.assertAvailable(directory);
        assert.equal(SourceNativeRetirement.isProtected(directory), true);
        assert.throws(
          () => SourceNativeRetirement.assertReleasable(directory),
          /protected|retirement/,
        );
      },
    },
    {
      name: "unreadable",
      unreadable: true,
      observe: (directory) => {
        assert.throws(
          () => SourceNativeRetirement.assertAvailable(directory),
          /quarantined/,
        );
        assert.equal(SourceNativeRetirement.isProtected(directory), true);
        assert.equal(
          SourceNativeRetirement.protectedGenerations(directory),
          undefined,
        );
      },
    },
  ];
  try {
    for (const test of cases) {
      const directory = path.join(root, test.name);
      fs.mkdirSync(directory);
      const retiring = SourceNativeRetirement.createScope("retiring");
      const live = SourceNativeRetirement.createScope("live");
      const observer = SourceNativeRetirement.createScope("observer");
      const begin = (scope: SourceNativeRetirement.Scope, generation: string) =>
        SourceNativeRetirement.run(scope, () => {
          SourceNativeRetirement.register({
            fenceRoot: directory,
            retainedPaths: [directory],
            generation,
          });
          SourceNativeRetirement.begin("boundary");
        });
      const settle = (scope: SourceNativeRetirement.Scope) =>
        SourceNativeRetirement.run(scope, () =>
          SourceNativeRetirement.settle("boundary", "not-started"),
        );
      begin(retiring, "retired");
      const guards = path.join(directory, ".ttsc-native-retirements");
      const file = path.join(guards, fs.readdirSync(guards)[0]!);
      if (test.pending) begin(live, "live");
      let reached = false;
      observer.guardFileOperations = {
        ...fs,
        readFileSync: (input, encoding) => {
          if (input === file) {
            reached = true;
            if (test.unreadable)
              throw Object.assign(new Error("authored metadata read refusal"), {
                code: "EACCES",
              });
            settle(retiring);
          }
          return fs.readFileSync(input, encoding);
        },
      };
      try {
        SourceNativeRetirement.run(observer, () => test.observe(directory));
        assert.equal(reached, true, "the original guard read must be reached");
      } catch (error) {
        failures.push(new Error(test.name, { cause: error }));
      } finally {
        settle(retiring);
        if (test.pending) settle(live);
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "Guard observation cases failed");
}
