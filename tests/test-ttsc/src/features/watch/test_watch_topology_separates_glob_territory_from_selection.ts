import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { projectInputReloadEventShouldNotify } from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies a declared glob's root is data even inside a resolution directory.
 *
 * A project root is published as a reload directory because the config that
 * selects plugins lives there, so every entry appearing directly in it reads as
 * a selection change. A declared glob's root is the one entry that must not:
 * appearing is exactly what a declared population does, and the data lane
 * already reports it and invalidates the Program when its membership moved.
 * Classifying it as a selection change restarts the sidecar for ordinary data
 * and loses the process the transition was supposed to keep.
 *
 * The exemption stops at glob roots. A declared file sitting directly in the
 * same directory is still a selection surface, because a project rule reads its
 * bytes to decide, and that decision is made once per execution.
 *
 * 1. Take a resolution directory holding both a glob root and a declared file.
 * 2. Assert the glob root stays warm and the declared file stays cold.
 * 3. Assert the directory itself and its other entries stay cold.
 */
export const test_watch_topology_separates_glob_territory_from_selection =
  (): void => {
    const root = TestProject.tmpdir("ttsc-project-input-territory-");
    const globRoot = path.join(root, "api");
    const declaredFile = path.join(root, "guard-state.txt");
    const shared = {
      globs: [path.join(root, "api", "**", "*.json")],
      reloadDirectories: [root],
      reloadFiles: [path.join(root, "lint.config.json")],
    };

    for (const [label, changed, expected] of [
      ["a declared glob's root", globRoot, false],
      ["a member below that root", path.join(globRoot, "v1"), false],
      ["a declared file beside it", declaredFile, true],
      ["the resolution directory itself", root, true],
      ["an unrelated entry in it", path.join(root, "new-package"), true],
    ] as const) {
      assert.equal(
        projectInputReloadEventShouldNotify({
          changed,
          changedInputs: [],
          ...shared,
        }),
        expected,
        `${label} must select the ${expected ? "cold" : "warm"} lane`,
      );
    }
  };
