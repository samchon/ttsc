import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies a referenced-project build-info output stays quiet while absolute
 * inputs outside the logical project remain live.
 *
 * A solution watch owns every referenced compiler configuration, but project
 * rules may also depend on a sibling documentation checkout. Output filtering
 * must therefore retain per-reference exact products without constraining
 * declared inputs to the TypeScript solution root.
 *
 * TypeScript-Go 7 removed `outFile`, so a configured JSON bundle is not a
 * product and must not be used as the quiet twin. The referenced project's
 * explicit `tsBuildInfoFile` remains a real exact JSON product.
 *
 * 1. Build a solution with one referenced project and one JSON build-info file.
 * 2. Declare a referenced-project JSON glob and a missing external exact file.
 * 3. Prove the build-info product is quiet and both legitimate inputs wake.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: a referenced-project build-info output stays quiet while absolute inputs outside the logical project remain live. 1. Build a solution with one referenced project and one JSON build-info file. 2. Declare a referenced-project JSON glob and a missing external exact file. 3. Prove the build-info product is quiet and both legitimate inputs wake.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Build a solution with one referenced project and one JSON build-info file. 2. Declare a referenced-project JSON glob and a missing external exact file. 3. Prove the build-info product is quiet and both legitimate inputs wake.
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage 1. Build a solution with one referenced project and one JSON build-info file. 2. Declare a referenced-project JSON glob and a missing external exact file. 3. Prove the build-info product is quiet and both legitimate inputs wake. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_tracks_external_inputs_across_project_references =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-solution-");
    const external = TestProject.tmpdir("ttsc-project-input-external-");
    const referenced = path.join(root, "packages", "contract");
    fs.mkdirSync(path.join(referenced, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(referenced, "src", "index.ts"),
      "export const contract = 1;\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(referenced, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          composite: true,
          tsBuildInfoFile: "api/state.json",
        },
        files: ["src/index.ts"],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        files: [],
        references: [{ path: "./packages/contract" }],
      }),
      "utf8",
    );
    fs.mkdirSync(path.join(referenced, "api"), { recursive: true });

    const changes: WatchInputChange[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => {},
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        root,
        files: [path.join(external, "docs", "spec.md")],
        globs: [path.join(referenced, "api", "**", "*.json")],
      });

      fs.writeFileSync(path.join(referenced, "api", "state.json"), "{}\n");
      await quiet(changes);

      fs.mkdirSync(path.join(external, "docs"), { recursive: true });
      let previous = projectChanges(changes);
      fs.writeFileSync(
        path.join(external, "docs", "spec.md"),
        "# External\n",
        "utf8",
      );
      await nextProjectChange(changes, previous);

      previous = projectChanges(changes);
      fs.writeFileSync(
        path.join(referenced, "api", "openapi.json"),
        "{}\n",
        "utf8",
      );
      await nextProjectChange(changes, previous);
    } finally {
      topology.close();
    }
  };

function projectChanges(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "project").length;
}

async function nextProjectChange(
  changes: readonly WatchInputChange[],
  previous: number,
): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (projectChanges(changes) <= previous) {
    if (Date.now() >= deadline) {
      assert.fail(`expected a project change after ${previous}`);
    }
    await delay(25);
  }
  await delay();
}

async function quiet(changes: readonly WatchInputChange[]): Promise<void> {
  const count = changes.length;
  await delay();
  assert.equal(changes.length, count, JSON.stringify(changes.slice(count)));
}

function delay(milliseconds = 250): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
