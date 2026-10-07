import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { disposeFilesystemClockReference } from "../../../../../packages/unplugin/src/core/transform/clock/disposeFilesystemClockReference";
import { refreshFilesystemClockReference } from "../../../../../packages/unplugin/src/core/transform/clock/refreshFilesystemClockReference";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { releaseCaptureResources } from "../../../../../packages/unplugin/src/core/transform/generation/releaseCaptureResources";
import type { TtscProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/TtscProjectMutationTracker";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies capture cleanup preserves transfer and selected error ownership.
 *
 * An admitted resource can transfer only after local cleanup succeeds. Native
 * watcher close capabilities may throw, so independent owners must still be
 * attempted; an already escaping capture failure must not be replaced.
 *
 * 1. Close all unretained trackers and remove real scratch and clock storage.
 * 2. Preserve retained trackers and clock storage after healthy local cleanup.
 * 3. Contrast nested unretained-close precedence with retained rollback errors.
 * 4. Consume cleanup failure only when the caller already failed its capture.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual releaseCaptureResources with actual tracker constructors whose supported watch close capabilities log and optionally throw. Native scratch descendants and a minted clock probe distinguish removal from ownership transfer. Every tracker receives its close attempt despite errors; last nested close failure wins, retained rollback errors preserve the selected local failure, and captureFailed resolves rather than replacing the caller's prior exception.
 * @evidence contracts/testing.md#independent-expectations Literal project/host/candidate close order and distinct Error object identities specify precedence. Independently observed native storage presence, content and disappearance distinguish retained clock from rejected transfer; expected results are not derived from cleanup internals. The caller's captureFailed flag is a supported input, not a fabricated native exception receipt.
 * @evidence contracts/testing.md#distinguishing-cases Healthy all-unretained and all-retained owners contrast with two unretained close failures and a failing unretained owner plus failing retained rollback owners. Both captureFailed values preserve the same attempted cleanup while changing rejection versus resolution. Native scratch removal still happens after watcher close failure, and a retained probe is rolled back only after failed local cleanup.
 * @evidence contracts/testing.md#execution-ownership One discoverable source unit invokes the actual production cleanup operation in process on native temporary storage and constructor-owned scripted watch handles. It starts no native watcher, compiler, producer, process or host, and certifies neither resource acquisition nor capture/IPC nor a throwing backend's actual native release. Shared claim release and final clock registration remain caller responsibilities. Finally attempts remaining tracker closes and known clock cleanup.
 */
export async function test_capture_resource_release_preserves_transfer_and_error_ownership(): Promise<void> {
  for (const mode of [
    "unretained",
    "retained",
    "nested-errors",
    "rollback",
    "prior-capture-error",
  ] as const) {
    const root = fs.realpathSync.native(
      TestProject.createProject({ "input.json": "{}\n" }),
    );
    const input = path.join(root, "input.json");
    const scratch = TestProject.tmpdir("ttsc-cleanup-scratch-");
    TestProject.writeFiles(scratch, {
      "nested/generated.json": "owned scratch\n",
    });
    const clock = TestProject.tmpdir("ttsc-cleanup-clock-");
    refreshFilesystemClockReference(clock, {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
    });
    const probe = path.join(clock, "clock-reference");
    assert.equal(fs.statSync(probe).isFile(), true);
    const clockBytes = fs.readFileSync(probe);
    const closes: string[] = [];
    const projectError = new Error("project close failed");
    const hostError = new Error("host close failed");
    const candidateError = new Error("candidate close failed");
    const trackers: TtscProjectMutationTracker[] = [];
    try {
      for (const name of ["project", "host", "candidate"] as const) {
        let opened = 0;
        const error =
          mode === "nested-errors"
            ? name === "project"
              ? projectError
              : name === "candidate"
                ? candidateError
                : undefined
            : mode === "rollback" || mode === "prior-capture-error"
              ? name === "project"
                ? projectError
                : name === "host"
                  ? hostError
                  : candidateError
              : undefined;
        const tracker = await createHostInputMutationTracker(
          [input],
          {
            ...DEFAULT_FILESYSTEM_OPERATIONS,
            caseSensitive: () => true,
            watch: () => {
              opened++;
              return {
                close: () => {
                  closes.push(name);
                  if (error !== undefined) throw error;
                },
              };
            },
          },
          new Set([input]),
          "all",
          root,
        );
        trackers.push(tracker);
        assert.equal(
          opened,
          1,
          "one actual constructor owns one supplied root handle",
        );
        assert.equal(tracker.failed, false);
      }
      const retained = mode === "retained";
      const rollback = mode === "rollback" || mode === "prior-capture-error";
      const releasing = releaseCaptureResources({
        project: trackers[0],
        host: trackers[1],
        candidate: trackers[2],
        retainProject: retained,
        retainHost: retained || rollback,
        retainCandidate: retained || rollback,
        scratchDirectory: scratch,
        clockReferenceDirectory: clock,
        retainClockReference: retained || rollback,
        captureFailed: mode === "prior-capture-error",
      });
      if (mode === "nested-errors")
        await assert.rejects(
          releasing,
          (error: unknown) => error === candidateError,
        );
      else if (mode === "rollback")
        await assert.rejects(
          releasing,
          (error: unknown) => error === projectError,
        );
      else await releasing;
      assert.equal(
        fs.existsSync(scratch),
        false,
        "scratch removal follows all local close attempts",
      );
      assert.deepEqual(
        closes,
        retained ? [] : ["project", "host", "candidate"],
      );
      assert.equal(fs.existsSync(probe), retained);
      assert.equal(fs.existsSync(clock), retained);
      if (retained) {
        assert.deepEqual(
          fs.readFileSync(probe),
          clockBytes,
          "transferred reference is untouched",
        );
        assert.deepEqual(
          trackers.map((tracker) => tracker.failed),
          [false, false, false],
        );
      } else {
        assert.deepEqual(
          trackers.map((tracker) => tracker.failed),
          [true, true, true],
        );
      }
    } finally {
      for (const tracker of trackers) {
        try {
          tracker.close();
        } catch {}
      }
      disposeFilesystemClockReference(clock);
    }
  }
}
