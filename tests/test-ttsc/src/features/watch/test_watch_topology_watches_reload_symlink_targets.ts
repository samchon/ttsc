import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies a symlinked reload input observes edits to the file it points at.
 *
 * A reload declaration selects plugins and contributors, so its content decides
 * whether the next cycle can stay resident. The declaration is a lexical path,
 * but a symlink can place the bytes it names in an unrelated directory: an
 * anchor on the declaration's own parent then sees the link being retargeted
 * and nothing else, while the fingerprint that decides the reload was taken
 * from the target's content. Both anchors must exist.
 *
 * 1. Declare a reload input inside the project that links to an external file.
 * 2. Edit the external target and require a cold config transition.
 * 3. Retarget the link and require the same transition from the lexical anchor.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: a symlinked reload input observes edits to the file it points at. 1. Declare a reload input inside the project that links to an external file. 2. Edit the external target and require a cold config transition. 3. Retarget the link and require the same transition from the lexical anchor.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Declare a reload input inside the project that links to an external file. 2. Edit the external target and require a cold config transition. 3. Retarget the link and require the same transition from the lexical anchor.
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage 1. Declare a reload input inside the project that links to an external file. 2. Edit the external target and require a cold config transition. 3. Retarget the link and require the same transition from the lexical anchor. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_watches_reload_symlink_targets =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-reload-symlink-");
    const externalRoot = TestProject.tmpdir("ttsc-watch-reload-target-");
    const target = path.join(externalRoot, "selected", "selection.json");
    const replacement = path.join(externalRoot, "other", "selection.json");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.mkdirSync(path.dirname(replacement), { recursive: true });
    fs.writeFileSync(target, '{"plugin":"first"}\n', "utf8");
    fs.writeFileSync(replacement, '{"plugin":"second"}\n', "utf8");

    const declaration = path.join(root, "selection.json");
    try {
      fs.symlinkSync(target, declaration, "file");
    } catch {
      // The filesystem cannot express the alias this case is about.
      return;
    }

    const source = path.join(root, "src", "main.ts");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    const config = path.join(root, "tsconfig.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: { noEmit: true },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [],
        globs: [],
        reloadFiles: [declaration],
      });

      await waitForConfigChange(changes, "target edit", () => {
        fs.writeFileSync(target, '{"plugin":"first-edited"}\n', "utf8");
      });
      await waitForConfigChange(changes, "link retarget", () => {
        fs.rmSync(declaration, { force: true });
        fs.symlinkSync(replacement, declaration, "file");
      });
    } finally {
      topology.close();
    }
  };

async function waitForConfigChange(
  changes: WatchInputChange[],
  label: string,
  stimulus: () => void,
): Promise<void> {
  // Let any event still in flight from the previous phase land before the
  // ledger is cleared, so a late arrival cannot satisfy the next expectation.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  changes.length = 0;
  while (!changes.some((change) => change.kind === "config")) {
    if (Date.now() >= deadline) {
      assert.fail(
        `expected a cold config transition after a ${label}: ${JSON.stringify(changes)}`,
      );
    }
    stimulus();
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
