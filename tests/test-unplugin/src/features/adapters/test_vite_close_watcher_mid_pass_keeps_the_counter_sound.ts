import { assertCloseWatcherMidPassKeepsTheCounterSound } from "../../internal/adapter-vite-lifecycle";

/**
 * Verifies a watcher closed mid-rebuild does not strand the container counter.
 *
 * `closeWatcher` has to replace the container owner set, not merely zero the
 * count beside it. A watcher closed while a build phase is open leaves that
 * container registered, so its later `buildEnd` decrements a counter that is
 * already zero; stranded below zero it can never reach zero again, and the
 * `buildEnd` disposal is dead for the rest of that plugin instance's life. A
 * pass opened and never closed before teardown is exactly what Ctrl+C during a
 * rebuild produces.
 *
 * 1. Open a pass, deliver, then tear down with that pass still open.
 * 2. Let the aborted pass's own buildEnd land afterwards.
 * 3. Drive two more sessions and assert each still disposes.
 */
export const test_vite_close_watcher_mid_pass_keeps_the_counter_sound =
  async () => {
    await assertCloseWatcherMidPassKeepsTheCounterSound();
  };
