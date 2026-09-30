import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { projectInputReloadEventShouldNotify } from "../../../../../packages/ttsc/lib/launcher/internal/watch/projectInputReloadEventShouldNotify.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies reload project inputs dominate the ordinary external-data lane.
 *
 * A lint config remains in `files` for old/LSP decoders, but CLI watch must
 * replace plugin selection whenever that same exact path changes. The retained
 * ancestor watcher must preserve the classification across every filesystem
 * lifecycle, including events that do not name the changed file.
 *
 * 1. Create, edit, delete, and atomically replace one initially missing file.
 * 2. Create and rename entries in one resolution-topology directory.
 * 3. Require cold config events for both executable reload declarations.
 * 4. Keep an ordinary project file warm and classify filename-less deltas.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: reload project inputs dominate the ordinary external-data lane. 1. Create, edit, delete, and atomically replace one initially missing file. 2. Create and rename entries in one resolution-topology directory. 3. Require cold config events for both executable reload declarations. 4. Keep an ordinary project file warm and classify filename-less deltas.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Create, edit, delete, and atomically replace one initially missing file. 2. Create and rename entries in one resolution-topology directory. 3. Require cold config events for both executable reload declarations. 4. Keep an ordinary project file warm and classify filename-less deltas.
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage 1. Create, edit, delete, and atomically replace one initially missing file. 2. Create and rename entries in one resolution-topology directory. 3. Require cold config events for both executable reload declarations. 4. Keep an ordinary project file warm and classify filename-less deltas. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_treats_reload_project_inputs_as_cold_transitions =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-reload-");
    const source = path.join(root, "src", "main.ts");
    const tsconfig = path.join(root, "tsconfig.json");
    const reloadFile = path.join(root, "config", "lint.config.json");
    const reloadDirectory = path.join(root, "config-deps");
    const warmFile = path.join(root, "docs", "spec.md");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.mkdirSync(path.dirname(warmFile), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(warmFile, "initial\n", "utf8");
    fs.writeFileSync(
      tsconfig,
      JSON.stringify({ files: ["src/main.ts"] }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [source],
        projectRoot: root,
        tsconfig,
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
        files: [reloadFile, warmFile],
        globs: [],
        reloadDirectories: [reloadDirectory],
        reloadFiles: [reloadFile],
      });
      await delay();

      fs.mkdirSync(path.dirname(reloadFile), { recursive: true });
      await expectNextKind(changes, "config", () =>
        fs.writeFileSync(reloadFile, '{"rules":{}}\n', "utf8"),
      );
      await expectNextKind(changes, "config", () =>
        fs.writeFileSync(reloadFile, '{"rules":{"no-var":"error"}}\n', "utf8"),
      );
      await expectNextKind(changes, "config", () => fs.rmSync(reloadFile));

      const replacement = path.join(root, "config", "lint.config.next.json");
      fs.writeFileSync(replacement, '{"rules":{"eqeqeq":"error"}}\n', "utf8");
      await delay();
      await expectNextKind(changes, "config", () =>
        fs.renameSync(replacement, reloadFile),
      );

      // Drain the directory's own creation first. It is a cold event in its
      // own right, so without waiting for it the wait below can be satisfied
      // by that late arrival and say nothing about how the manifest was
      // classified.
      await expectNextKind(changes, "config", () =>
        fs.mkdirSync(reloadDirectory, { recursive: true }),
      );
      const packageManifest = path.join(reloadDirectory, "package.json");
      await expectNextKind(changes, "config", () =>
        fs.writeFileSync(packageManifest, '{"main":"index.cjs"}\n', "utf8"),
      );
      const replacementManifest = path.join(
        reloadDirectory,
        "package.next.json",
      );
      await expectNextKind(changes, "config", () =>
        fs.renameSync(packageManifest, replacementManifest),
      );

      await expectNextKind(changes, "project", () =>
        fs.writeFileSync(warmFile, "warm edit\n", "utf8"),
      );
      assert.equal(
        changes.some(
          (change) =>
            change.kind === "project" &&
            change.path !== undefined &&
            path.resolve(change.path) === path.resolve(reloadFile),
        ),
        false,
        JSON.stringify(changes),
      );

      assert.equal(
        projectInputReloadEventShouldNotify({
          changedInputs: [packageManifest],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
        }),
        true,
        "a directory member fingerprint delta must select the cold lane",
      );
      assert.equal(
        projectInputReloadEventShouldNotify({
          changedInputs: [warmFile],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
        }),
        false,
        "a filename-less warm-data delta must remain a project event",
      );
      assert.equal(
        projectInputReloadEventShouldNotify({
          changed: reloadFile,
          changedInputs: [],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
        }),
        true,
        "a named reload event stays cold even when bytes are unchanged",
      );
      assert.equal(
        projectInputReloadEventShouldNotify({
          changed: path.join(reloadDirectory, "new-package"),
          changedInputs: [],
          reloadDirectories: [reloadDirectory],
          reloadFiles: [reloadFile],
        }),
        true,
        "a named resolution-topology event must select the cold lane",
      );
    } finally {
      topology.close();
    }
  };

async function expectNextKind(
  changes: readonly WatchInputChange[],
  kind: WatchInputChange["kind"],
  mutate: () => void,
): Promise<void> {
  const previous = changes.filter((change) => change.kind === kind).length;
  mutate();
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (changes.filter((change) => change.kind === kind).length === previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected ${kind}: ${JSON.stringify(changes)}`);
    }
    await delay(25);
  }
  await delay();
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
