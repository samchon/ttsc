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
 * The same directory's fingerprint moves whenever anything appears directly
 * inside it, data included, so a digest delta on the directory alone cannot
 * tell a new package from a new data directory. Only the event's own name can,
 * which is why the directory-itself rule belongs to the named event and the
 * fingerprint lane keys on the entry that changed.
 *
 * 1. Take a resolution directory holding both a glob root and a declared file.
 * 2. Assert the glob root stays warm and the declared file stays cold.
 * 3. Assert the directory itself and its other entries stay cold when named.
 * 4. Assert the directory's own digest delta alone does not select cold.
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

    // The digest delta on the directory is the only signal there is when what
    // appeared is not a declared match, so it survives on its own — and yields
    // only to an event that names data in the same pass.
    assert.equal(
      projectInputReloadEventShouldNotify({
        changedInputs: [root],
        ...shared,
      }),
      true,
      "an unexplained digest delta on a resolution directory selects the cold lane",
    );
    assert.equal(
      projectInputReloadEventShouldNotify({
        changed: globRoot,
        changedInputs: [root],
        ...shared,
      }),
      false,
      "a digest delta explained by a data event stays warm",
    );
    assert.equal(
      projectInputReloadEventShouldNotify({
        changed: path.join(root, "new-package", "index.js"),
        changedInputs: [root],
        ...shared,
      }),
      true,
      "a digest delta explained by a non-data event stays cold",
    );
    assert.equal(
      projectInputReloadEventShouldNotify({
        changedInputs: [path.join(root, "new-package", "package.json")],
        ...shared,
      }),
      false,
      "a delta below an immediate entry is not a selection change either",
    );
    assert.equal(
      projectInputReloadEventShouldNotify({
        changedInputs: [path.join(root, "new-package")],
        ...shared,
      }),
      true,
      "a delta on an immediate entry still selects the cold lane",
    );

    // Data carves out below a resolution directory, never at it. A glob rooted
    // on the directory itself would otherwise exempt everything that directory
    // exists to classify, and the selection lane would retire without a sound.
    assert.equal(
      projectInputReloadEventShouldNotify({
        changed: path.join(root, "new-package"),
        changedInputs: [],
        globs: [path.join(root, "**", "*.md")],
        reloadDirectories: [root],
        reloadFiles: shared.reloadFiles,
      }),
      true,
      "a glob rooted on the resolution directory must not exempt it",
    );
    assert.equal(
      projectInputReloadEventShouldNotify({
        changed: path.join(root, "new-package"),
        changedInputs: [],
        globs: [path.join(path.parse(root).root, "**", "*.json")],
        reloadDirectories: [root],
        reloadFiles: shared.reloadFiles,
      }),
      true,
      "a glob rooted above the resolution directory must not exempt it either",
    );

    // Nested resolution directories are the ordinary case, not the exotic one:
    // a config graph records the directory it searched, each node_modules level
    // above it, and every ancestor between. Each one's digest answers only for
    // its own immediate entries, so one directory's exemption must not speak
    // for another's evidence.
    const modules = path.join(root, "node_modules");
    const nested = {
      globs: [path.join(root, "api", "**", "*.json")],
      reloadDirectories: [root, modules],
      reloadFiles: shared.reloadFiles,
    };
    assert.equal(
      projectInputReloadEventShouldNotify({
        changed: globRoot,
        changedInputs: [modules],
        ...nested,
      }),
      true,
      "a data event under one directory must not cancel another's delta",
    );
    assert.equal(
      projectInputReloadEventShouldNotify({
        changed: path.join(modules, "left-pad"),
        changedInputs: [modules],
        ...nested,
      }),
      true,
      "an installed package stays cold with a glob declared elsewhere",
    );
    assert.equal(
      projectInputReloadEventShouldNotify({
        changed: globRoot,
        changedInputs: [root],
        ...nested,
      }),
      false,
      "the directory the data actually moved still yields",
    );
  };
