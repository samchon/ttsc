import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

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
  const deadline = Date.now() + 5_000;
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
