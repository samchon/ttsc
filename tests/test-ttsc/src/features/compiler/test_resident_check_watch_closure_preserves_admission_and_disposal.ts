import assert from "node:assert/strict";

import { ResidentCheckWatchSession } from "../../../../../packages/ttsc/src/compiler/internal/build/ResidentCheckWatchSession";

/**
 * Verifies terminal closure and reusable disposal of a resident watch session
 * before compiler admission.
 *
 * Every run is interrupted before its first await resumes, so these cases own
 * session admission without constructing a project or spawning a native host.
 * Actual EOF, IPC, failed transport and OS close belong to watch E2E tests.
 *
 * 1. Close and dispose a fresh session repeatedly and require one shared close
 *    result and a closed rejection for later runs.
 * 2. Dispose a session while a run is admitted, twice, and require each admitted
 *    run to retire while the session stays reusable until closed.
 * 3. Close a session while a run is admitted and require that run to reject as
 *    closed and the close to join.
 *
 * @evidence contracts/testing.md#behavioral-verification Terminal close rejects later run calls, repeated close shares one promise, and reusable disposal cancels admitted cycles across two fresh generations.
 * @evidence contracts/testing.md#independent-expectations Closed sessions cannot acquire a compiler; disposal releases one invocation while allowing another to be admitted. Literal error categories and promise identity distinguish those public lifecycle contracts.
 * @evidence contracts/testing.md#distinguishing-cases The cases cover repeated terminal close, dispose after close, two interrupted reusable generations, and terminal close during admission; they do not claim native process or transport verification.
 * @evidence contracts/testing.md#execution-ownership The unit-module executor discovers this unit/compiler export and invokes the actual source session. No producer, global replacement, filesystem fixture or process is created.
 */
export const test_resident_check_watch_closure_preserves_admission_and_disposal =
  async (): Promise<void> => {
    const terminal = new ResidentCheckWatchSession();
    const closed = terminal.close();
    assert.equal(terminal.close(), closed);
    terminal.dispose();
    assert.equal(terminal.close(), closed);
    await closed;
    await assert.rejects(terminal.run({}), /watch session closed/);

    const reusable = new ResidentCheckWatchSession();
    for (let generation = 0; generation !== 2; ++generation) {
      const admitted = reusable.run({});
      reusable.dispose();
      await assert.rejects(admitted, /watch cycle retired/);
    }
    await reusable.close();
    await assert.rejects(reusable.run({}), /watch session closed/);

    const active = new ResidentCheckWatchSession();
    const admitted = active.run({});
    const joined = active.close();
    await assert.rejects(admitted, /watch session closed/);
    await joined;
    assert.equal(active.close(), joined);
  };
