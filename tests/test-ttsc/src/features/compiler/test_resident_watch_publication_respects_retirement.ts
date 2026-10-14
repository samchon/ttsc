import assert from "node:assert/strict";
import fs from "node:fs";

import { ResidentCheckWatchSession } from "../../../../../packages/ttsc/src/compiler/internal/build/ResidentCheckWatchSession";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a retired watch cycle cannot resume from an unfinished publication.
 *
 * A publication can settle after the watch owner closes or disposes its cycle;
 * completing that handoff must not authorize a check in the retired
 * generation.
 *
 * 1. Pause plugin-free resident preparation at its project-input handoff.
 * 2. Close or dispose the session before completing the publication.
 * 3. Assert the original cycle rejects and terminal close rejects later work.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual session run, dispose and close operations reject a cycle whose project publication completes after retirement; no compiler is reached before the registration barrier.
 * @evidence contracts/testing.md#independent-expectations Authored promise gates determine publication order, and the session's documented generation/terminal admission contract independently requires rejection after retirement.
 * @evidence contracts/testing.md#distinguishing-cases Reusable disposal and terminal closure both invalidate pending publication; repeated close remains joinable and a terminal owner rejects a later run. Native child ownership and warm replay with actual project-rule hosts belong to watch E2E tests.
 * @evidence contracts/testing.md#execution-ownership This exported unit prepares an owned temporary empty project with plugins false and an unused existing binary. It retires before compilation, starts no resident process or watcher, and joins the pending cycle before cleanup.
 */
export async function test_resident_watch_publication_respects_retirement(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.createProject({ "tsconfig.json": '{"files":[]}' }),
  );
  const options = {
    binary: process.execPath,
    cwd: root,
    emit: false,
    plugins: false as const,
    skipDiagnosticsCheck: true,
  };
  try {
    for (const terminal of [false, true]) {
      const publication = Promise.withResolvers<void>();
      const started = Promise.withResolvers<void>();
      const session = new ResidentCheckWatchSession();
      const operation = session.run({
        ...options,
        onProjectInputs: () => {
          started.resolve();
          return publication.promise;
        },
      });
      const rejected = assert.rejects(
        operation,
        /session closed|cycle retired/,
      );
      try {
        await Promise.race([
          started.promise,
          operation.then(
            () => {
              throw new Error(
                "the resident cycle completed before publication",
              );
            },
            (error: unknown) => {
              throw error;
            },
          ),
        ]);
        if (terminal) await session.close();
        else session.dispose();
        publication.resolve();
        await rejected;
        if (terminal)
          await assert.rejects(session.run(options), /session closed/);
      } finally {
        publication.resolve();
        await rejected;
        await session.close();
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
