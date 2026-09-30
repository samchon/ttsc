import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";

/**
 * Verifies native watch resources stay constant as the compiler graph grows.
 *
 * A dev server can register tens of thousands of compiler inputs. Opening a
 * native watcher per input would exhaust descriptors, so every input below the
 * project root must share the one pinned recursive observer, which lives as
 * long as the attached server.
 *
 * 1. Attach a watcher and register 12,000 generated inputs below the project root.
 * 2. Assert only the pinned project observer is open, and removing inputs does not
 *    reopen it.
 * 3. Dispose and assert no observer remains and none is closed twice.
 * @evidence contracts/testing.md#behavioral-verification
 *   Registers 12000 project inputs in createViteServeInputWatch and asserts one active scope, no reopen after removal, bounded registration duration and exactly one final close.
 * @evidence contracts/testing.md#independent-expectations
 *   All inputs below the attached project share one pinned recursive observer. Its lifetime is the server lifetime, not input count; the literal one-observer expectation is independent of its implementation.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Includes large registration, complete input withdrawal and disposal, checking active handles and close counts at each transition. The existing five-second regression bound remains unchanged.
 * @evidence contracts/testing.md#execution-ownership
 *   This source-function unit captures injected scope handles and calls the
 *   authored attach/replace/dispose lifecycle directly; no module graph or Vite
 *   server is started. TestProject tracks fixture cleanup and finally disposes
 *   the watcher. Packed Vite cases own actual host notification connections.
 */
export async function test_vite_compiler_watch_resources_are_bounded_by_scope(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watch-cardinality-"),
  );
  const opened: string[] = [];
  let active = 0;
  let closed = 0;
  const watch = createViteServeInputWatch({
    watch(scope) {
      opened.push(path.resolve(scope));
      active += 1;
      let live = true;
      return {
        close() {
          if (!live) return;
          live = false;
          active -= 1;
          closed += 1;
        },
      };
    },
  });
  watch.attach({ config: { root } });
  const count = 12_000;
  const inputs = Array.from({ length: count }, (_value, index) => {
    const file = path.join(root, "generated", `${index}.d.ts`);
    return {
      file,
      evidence: {
        identity: file,
        missing: true,
        state: {
          codec: "predicates" as const,
          observation: { fileExists: false },
        },
      },
    };
  });
  try {
    const before = performance.now();
    const startedAt = watch.begin();
    watch.replace(path.join(root, "src", "main.ts"), inputs, false, startedAt);
    assert.deepEqual(
      opened,
      [root],
      `${count} project inputs must share the project-root subscription`,
    );
    assert.equal(
      active,
      1,
      "one recursive project observer must remain active",
    );

    watch.replace(path.join(root, "src", "main.ts"), []);
    assert.equal(
      active,
      1,
      "the project observer must remain live through the attached server",
    );
    assert.equal(closed, 0, "input removal must not reopen the race window");
    assert.ok(
      performance.now() - before < 5_000,
      `${count} registrations and removals must remain linear and finish within 5 seconds`,
    );
  } finally {
    await watch.dispose();
  }
  assert.equal(active, 0, "final disposal must leave no native observer");
  assert.equal(
    closed,
    1,
    "final disposal must not re-close a detached observer",
  );
}
