import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies a project emitting in place still watches its declared inputs.
 *
 * Compiler outputs are excluded from the project-input lane so a build cannot
 * feed its own rebuild. That exclusion reads the configured output directory,
 * and a project may configure it as the project itself — emitting beside the
 * sources is an ordinary layout, and `outDir` set to the project directory says
 * exactly that. Honouring it literally makes every declared input a build
 * product, so nothing is watched and nothing reports it: the build keeps
 * succeeding and simply stops reacting.
 *
 * Watching is the safe side of this one. A product that gets watched costs a
 * spare rebuild; an input that does not is never seen again.
 *
 * 1. Configure a project whose output directory is the project itself.
 * 2. Declare an input inside it.
 * 3. Assert the input is still watched and its edit is still reported.
 */
export const test_watch_topology_keeps_inputs_when_the_project_emits_in_place =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-project-input-in-place-");
    const source = path.join(root, "src", "main.ts");
    const declared = path.join(root, "docs", "spec.md");
    for (const file of [source, declared]) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    fs.writeFileSync(declared, "# Contract\n", "utf8");
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { outDir: "." },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: string[] = [];
    let watchRoots: readonly string[] = [];
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
        onInputChange: (change) => changes.push(change.kind),
        onProjectInputWatchRoots: (roots) => {
          watchRoots = [...roots];
        },
        onTopologyChange: () => {},
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({ root, files: [declared], globs: [] });
      assert.notEqual(
        watchRoots.length,
        0,
        "an in-place output directory must not leave the declared input unwatched",
      );

      const deadline = Date.now() + 5_000;
      fs.writeFileSync(declared, "# Revised contract\n", "utf8");
      while (changes.length === 0) {
        if (Date.now() >= deadline) {
          assert.fail("an edit to the declared input was never reported");
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    } finally {
      topology.close();
    }
  };
