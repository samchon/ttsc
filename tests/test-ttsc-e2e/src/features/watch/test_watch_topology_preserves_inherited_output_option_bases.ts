import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies inherited path-valued compiler outputs remain relative to the
 * tsconfig that declared them.
 *
 * 1. Declare `outDir` and `tsBuildInfoFile` in a nested base config.
 * 2. Suppress writes at the base config's output paths.
 * 3. Treat the old project-root-relative interpretations as external inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: inherited path-valued compiler outputs remain relative to the tsconfig that declared them. 1. Declare `outDir` and `tsBuildInfoFile` in a nested base config. 2. Suppress writes at the base config's output paths. 3. Treat the old project-root-relative interpretations as external inputs.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Declare `outDir` and `tsBuildInfoFile` in a nested base config. 2. Suppress writes at the base config's output paths. 3. Treat the old project-root-relative interpretations as external inputs.
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage 1. Declare `outDir` and `tsBuildInfoFile` in a nested base config. 2. Suppress writes at the base config's output paths. 3. Treat the old project-root-relative interpretations as external inputs. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_preserves_inherited_output_option_bases =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-inherited-watch-outputs-");
    const source = path.join(root, "src", "main.ts");
    const base = path.join(root, "config", "base.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.mkdirSync(path.dirname(base), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(
      base,
      JSON.stringify({
        compilerOptions: {
          composite: true,
          outDir: "generated",
          tsBuildInfoFile: "cache/base.tsbuildinfo",
        },
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        extends: "./config/base.json",
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        emit: true,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
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
      const declaredOutputs = [
        path.join(root, "config", "generated", "main.js"),
        path.join(root, "config", "cache", "base.tsbuildinfo"),
      ];
      topology.setProjectInputs({
        root,
        files: declaredOutputs,
        globs: [],
      });
      for (const output of declaredOutputs) {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, "{}\n", "utf8");
      }
      await expectProjectQuiet(changes);

      const rootRelativeTwins = [
        path.join(root, "generated", "main.js"),
        path.join(root, "cache", "base.tsbuildinfo"),
      ];
      for (const output of rootRelativeTwins) {
        topology.setProjectInputs({
          root,
          files: [output],
          globs: [],
        });
        const previous = projectChangeCount(changes);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, "{}\n", "utf8");
        await waitForProjectChange(changes, previous);
      }
    } finally {
      topology.close();
    }
  };

async function expectProjectQuiet(
  changes: readonly WatchInputChange[],
): Promise<void> {
  const count = projectChangeCount(changes);
  await delay();
  assert.equal(projectChangeCount(changes), count);
}

async function waitForProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (projectChangeCount(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a project change after ${previous}`);
    }
    await delay(25);
  }
}

function projectChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

function delay(milliseconds = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
