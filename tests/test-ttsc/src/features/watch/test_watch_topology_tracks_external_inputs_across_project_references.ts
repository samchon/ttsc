import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies referenced-project outputs stay quiet while absolute inputs outside
 * the logical project remain live.
 *
 * A solution watch owns every referenced compiler configuration, but project
 * rules may also depend on a sibling documentation checkout. Output filtering
 * must therefore retain per-reference exact outputs without constraining
 * declared inputs to the TypeScript solution root.
 *
 * 1. Build a solution with one referenced project and exact JSON outputs.
 * 2. Declare a referenced-project JSON glob and a missing external exact file.
 * 3. Prove compiler outputs are quiet and both legitimate locations wake.
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
          outFile: "api/bundle.json",
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

      fs.mkdirSync(path.join(referenced, "api"), { recursive: true });
      fs.writeFileSync(path.join(referenced, "api", "state.json"), "{}\n");
      fs.writeFileSync(path.join(referenced, "api", "bundle.json"), "{}\n");
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
  const deadline = Date.now() + 5_000;
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
