import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  type WatchInputChange,
  WatchTopology,
} from "../../../../../packages/ttsc/lib/launcher/internal/watchTopology.js";

/**
 * Verifies tsconfig noEmit gets the same resident Program fast path as
 * --noEmit.
 *
 * A JSON project input can also be a resolveJsonModule Program member. Removing
 * it must cold-load the Program without escalating to an execution reload.
 */
export const test_watch_topology_config_no_emit_uses_program_invalidation =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-config-no-emit-");
    const source = path.join(root, "src", "main.ts");
    const json = path.join(root, "src", "member.json");
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(
      source,
      'import member from "./member.json";\nexport default member;\n',
      "utf8",
    );
    fs.writeFileSync(json, '{"value":1}\n', "utf8");
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          esModuleInterop: true,
          noEmit: true,
          resolveJsonModule: true,
        },
        files: ["src/main.ts"],
      }),
      "utf8",
    );

    const changes: WatchInputChange[] = [];
    let topologyChanges = 0;
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (location, error) => {
          throw new Error(`watch error on ${location}`, { cause: error });
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => {
          topologyChanges++;
        },
      },
    );
    try {
      topology.refresh(false);
      topology.setProjectInputs({
        files: [json],
        globs: [],
        root,
      });
      fs.rmSync(json);
      await waitFor(() =>
        changes.some(
          (change) => change.kind === "project" && change.invalidate === true,
        ),
      );
      assert.equal(
        topologyChanges,
        0,
        "config noEmit must not escalate Program membership to execution reload",
      );
    } finally {
      topology.close();
    }
  };

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("timed out waiting for Program invalidation");
}
