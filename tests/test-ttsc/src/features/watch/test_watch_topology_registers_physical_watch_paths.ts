import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies watchers register physical paths while reporting declared ones.
 *
 * The two spellings must not be mixed. A watcher backend stores the string it
 * was given and matches delivered events against it after canonicalizing them,
 * so registering an aliased spelling breaks event delivery — on Windows libuv
 * expands each event to its long path and aborts the process when the stored
 * string is no longer its prefix, which any short (8.3) component produces.
 * Classification runs in the opposite domain: every compiler, config, and
 * plugin decision is expressed in the caller's own paths, so a notification
 * that arrived through the physical spelling would stop matching them.
 *
 * 1. Point a directory alias at a real project root.
 * 2. Watch the project through the alias and edit a tracked source file.
 * 3. Assert the change is reported under the alias, not the physical root.
 */
export const test_watch_topology_registers_physical_watch_paths =
  async (): Promise<void> => {
    const physicalRoot = TestProject.tmpdir("ttsc-watch-physical-");
    const aliasParent = TestProject.tmpdir("ttsc-watch-alias-");
    const root = path.join(aliasParent, "project");
    try {
      fs.symlinkSync(physicalRoot, root, "junction");
    } catch {
      // The filesystem cannot express a directory alias; the invariant this
      // case pins is unobservable here, so leave it to the platforms that can.
      return;
    }
    const physical = fs.realpathSync.native?.(root) ?? fs.realpathSync(root);
    if (physical === path.resolve(root)) return;

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
      const deadline = Date.now() + 5_000;
      while (changes.length === 0) {
        if (Date.now() >= deadline) {
          assert.fail("an aliased project root must still deliver events");
        }
        fs.writeFileSync(source, "export const value = 2;\n", "utf8");
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      // Only paths this class resolved from an event are in scope. A config
      // path arrives already canonicalized from the project reader, which owns
      // that normalization and is not what this case is about.
      const reported = changes
        .map((change) => change.path)
        .filter((location): location is string => location !== undefined)
        .filter((location) => path.basename(location) === "main.ts");
      assert.notEqual(reported.length, 0, JSON.stringify(changes));
      assert.equal(
        reported.every((location) => location === source),
        true,
        `declared spelling expected, got ${JSON.stringify(reported)}`,
      );
    } finally {
      topology.close();
    }
  };
