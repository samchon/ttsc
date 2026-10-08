import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import type { RetireLockDirectoryOperations } from "../../../../../packages/ttsc/src/internal/RetireLockDirectoryOperations";
import { retireLockDirectory } from "../../../../../packages/ttsc/src/internal/retireLockDirectory";
import { CapabilityPluginResult } from "../../../../../packages/ttsc/src/plugin/internal/CapabilityPluginResult";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies cancelled cleanup fails without claiming refused retirement.
 *
 * Real sibling probes distinguish the shared retry policy from a
 * source-specific refusal; the resolver's actual catch must not erase ownership
 * failure.
 *
 * 1. Exercise permanent Windows retry refusals and legacy outcome conversion.
 * 2. Preserve immediate refusal identity and allow transient retirement.
 * 3. Keep ordinary uncancelled retries working beyond the cancellation grace.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual retirement primitive over real held/probe directories with injected Windows source refusals. Permanent EPERM/EACCES/EBUSY after cancellation must throw cleanup failure with the final refusal as cause and preserve held owner bytes. The actual CapabilityPluginResult.fromTask catches the EACCES case into unavailable, but the scope still retains the original cleanup failure and last refusal. An immediately refused probe preserves the original source refusal in both throw and scope report. A transient refusal still retires successfully; ordinary uncancelled retries remain successful beyond the cancelled grace.
 * @evidence contracts/testing.md#independent-expectations Only a real source-to-tombstone rename establishes retirement. Successful sibling moves cannot certify source-specific permission. A cancelled cleanup failure must expose its actual last native refusal, while an uncancelled owner retains the established retry contract.
 * @evidence contracts/testing.md#distinguishing-cases All three Windows retry codes distinguish permanent source refusal with successful sibling probes from transient recovery. Direct throwing and real resolver outcome conversion contrast failure transport. Cancellation begins during the first retry yield, so admission guards cannot substitute for cleanup. An ordinary retry deliberately yields past one second to distinguish scoped policy from a global timeout; existing peer tests own missing, occupied and refused-probe outcomes.
 * @evidence contracts/testing.md#execution-ownership One discoverable source unit owns temporary directories and explicitly injected operations without patching filesystem globals or building artifacts. Each case's real probe creation/rename/removal is preserved, synchronous yields use shared-memory sleep, and independent case failures are collected before throwing together.
 */
export function test_retirelockdirectory_bounds_cancelled_cleanup_without_false_retirement(): void {
  const failures: Error[] = [];
  const check = (name: string, callback: () => void): void => {
    try {
      callback();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  const fixture = () => {
    const root = TestProject.tmpdir("ttsc-cancelled-retirement-");
    const source = path.join(root, "held");
    const destination = path.join(root, "retired");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "owner"), "held-generation");
    return { root, source, destination };
  };
  const operations = (
    renameSync: RetireLockDirectoryOperations["renameSync"],
  ): RetireLockDirectoryOperations => ({
    renameSync,
    mkdirSync: (location) => fs.mkdirSync(location),
    rmSync: fs.rmSync,
    existsSync: fs.existsSync,
    platform: "win32",
  });
  const pause = (milliseconds: number): void => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
  };
  for (const code of ["EPERM", "EACCES", "EBUSY"])
    check(`permanent-${code}`, () => {
      const { root, source, destination } = fixture();
      const cancel = new SharedArrayBuffer(4);
      const ownershipFailures: unknown[] = [];
      let last: Error | undefined;
      let attempts = 0;
      let unavailable = false;
      const retire = (): boolean =>
        retireLockDirectory(
          source,
          destination,
          () => {
            Atomics.store(new Int32Array(cancel), 0, 1);
            pause(25);
          },
          operations((from, to) => {
            if (from === source) {
              last = Object.assign(new Error(`refusal-${++attempts}`), {
                code,
              });
              throw last;
            }
            fs.renameSync(from, to);
          }),
        );
      assert.throws(
        () =>
          OwnedSynchronousProcess.run(
            { cancel, failures: ownershipFailures },
            () => {
              if (code !== "EACCES") return retire();
              const outcome = CapabilityPluginResult.fromTask(() => {
                retire();
                return CapabilityPluginResult.unavailable();
              });
              unavailable = outcome.status === "unavailable";
              return false;
            },
          ),
        (error) =>
          error instanceof Error &&
          (code === "EACCES"
            ? error.name === "AbortError"
            : error === ownershipFailures[0]),
      );
      assert.equal(unavailable, code === "EACCES");
      assert.equal(ownershipFailures.length, 1);
      const failure = ownershipFailures[0];
      assert.ok(failure instanceof Error);
      assert.equal(failure.cause, last);
      assert.match(failure.message, /1000ms of cancelled cleanup contention/);
      assert.ok(attempts > 1);
      assert.equal(fs.existsSync(destination), false);
      assert.equal(
        fs.readFileSync(path.join(source, "owner"), "utf8"),
        "held-generation",
      );
      assert.deepEqual(fs.readdirSync(root), ["held"]);
    });

  check("cancelled-probe-refusal", () => {
    const { source, destination } = fixture();
    const cancel = new SharedArrayBuffer(4);
    const ownershipFailures: unknown[] = [];
    const refusal = Object.assign(new Error("original source refusal"), {
      code: "EPERM",
    });
    assert.throws(
      () =>
        OwnedSynchronousProcess.run(
          { cancel, failures: ownershipFailures },
          () =>
            retireLockDirectory(
              source,
              destination,
              () => assert.fail("a refused probe must not retry"),
              operations((from) => {
                if (from === source) {
                  Atomics.store(new Int32Array(cancel), 0, 1);
                  throw refusal;
                }
                throw Object.assign(new Error("probe permission refusal"), {
                  code: "EACCES",
                });
              }),
            ),
        ),
      (error) => error === refusal,
    );
    assert.deepEqual(ownershipFailures, [refusal]);
    assert.equal(fs.existsSync(source), true);
    assert.equal(fs.existsSync(destination), false);
  });

  check("cancelled-transient-recovery", () => {
    const { source, destination } = fixture();
    const cancel = new SharedArrayBuffer(4);
    let attempts = 0;
    let retired = false;
    assert.throws(
      () =>
        OwnedSynchronousProcess.run({ cancel }, () => {
          retired = retireLockDirectory(
            source,
            destination,
            () => Atomics.store(new Int32Array(cancel), 0, 1),
            operations((from, to) => {
              if (from === source && ++attempts <= 2)
                throw Object.assign(new Error("transient refusal"), {
                  code: "EPERM",
                });
              fs.renameSync(from, to);
            }),
          );
        }),
      { name: "AbortError" },
    );
    assert.equal(
      retired,
      true,
      "cleanup must finish before the scope reports cancellation",
    );
    assert.equal(attempts, 3);
    assert.equal(fs.existsSync(source), false);
    assert.equal(
      fs.readFileSync(path.join(destination, "owner"), "utf8"),
      "held-generation",
    );
  });

  check("ordinary-retry-remains-unbounded", () => {
    const { source, destination } = fixture();
    let attempts = 0;
    assert.equal(
      retireLockDirectory(
        source,
        destination,
        () => pause(1_100),
        operations((from, to) => {
          if (from === source && ++attempts <= 2)
            throw Object.assign(new Error("ordinary contention"), {
              code: "EBUSY",
            });
          fs.renameSync(from, to);
        }),
      ),
      true,
    );
    assert.equal(attempts, 3);
    assert.equal(fs.existsSync(source), false);
    assert.equal(
      fs.readFileSync(path.join(destination, "owner"), "utf8"),
      "held-generation",
    );
  });
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      "Lock retirement cancellation cases failed",
    );
}
