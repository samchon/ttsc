import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { createViteServeInputWatch } from "../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";

/** Prove native watch resources stay constant as the compiler graph grows. */
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
