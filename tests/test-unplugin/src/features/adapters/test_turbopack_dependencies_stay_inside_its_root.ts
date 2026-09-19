import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { HostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/HostWatchBridge.js";
import { registerBuildWatchInputs } from "../../../../../packages/unplugin/lib/core/bridge/registerBuildWatchInputs.js";
import { resolveTurbopackRoot } from "../../../../../packages/unplugin/lib/core/turbopack/resolveTurbopackRoot.js";
import { turbopackProcessMarker } from "../../../../../packages/unplugin/lib/core/turbopack/turbopackProcessMarker.js";

/**
 * Verifies the Turbopack loader keeps every dependency inside the roots the
 * configuration names, hands Turbopack only the inputs inside them, and marks a
 * module with inputs it cannot track (samchon/ttsc#1422).
 *
 * Turbopack fails a whole module whose dependency climbs above its project
 * filesystem root. The loader registered every compiler input, so an input
 * outside the root, such as a `typeRoots` entry beyond the workspace, answered
 * the page with an error.
 *
 * 1. Resolve the root from no named root, one, two in either order, a relative
 *    one, and one that does not contain the project, and assert the deepest
 *    named ancestor of the project, or the project itself.
 * 2. Register inputs inside and outside a root, with and without a bridge, and
 *    assert only the inside ones reach the channels, the bridge takes the rest,
 *    and `untracked` is called once, and never when every input is inside.
 * 3. Create the process marker twice and assert one file in a directory named for
 *    this process.
 */
export async function test_turbopack_dependencies_stay_inside_its_root(): Promise<void> {
  const workspace = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-turbopack-root-"),
  );
  const project = path.join(workspace, "apps", "web");
  const apps = path.join(workspace, "apps");
  const rows: [string, readonly string[] | undefined, string][] = [
    ["a rule that names none", undefined, project],
    ["a configuration that names none", [], project],
    ["one named root", [workspace], workspace],
    ["the deepest of two named roots", [workspace, apps], apps],
    ["the same, in the other order", [apps, workspace], apps],
    ["a relative root", [path.relative(process.cwd(), apps)], apps],
    [
      "a named root that does not contain the project",
      [path.join(workspace, "elsewhere")],
      project,
    ],
  ];
  for (const [label, configured, expected] of rows) {
    assert.equal(resolveTurbopackRoot(project, configured), expected, label);
  }

  const inside = path.join(project, "src", "types.d.ts");
  const outside = path.join(workspace, "..", "global", "types.d.ts");
  const inputs = [inside, outside].map((file) => ({
    evidence: {
      identity: file,
      missing: false,
      state: {
        codec: "predicates" as const,
        observation: { fileExists: true },
      },
    },
    file,
  }));
  const registerThrough = (
    bridge: boolean,
    registered: typeof inputs,
  ): { bridged: string[]; channel: string[]; untracked: number } => {
    const channel: string[] = [];
    const bridged: string[] = [];
    let untracked = 0;
    const instance: HostWatchBridge = {
      begin: () => 0,
      close: async () => undefined,
      register: (_importer, handed) => {
        bridged.push(...handed.map((input) => input.file));
        return path.join(project, "node_modules", ".cache", "main.signal");
      },
    };
    registerBuildWatchInputs({
      addWatchFile: (file) => channel.push(file),
      ...(bridge
        ? { bridge: { instance, kinds: new Set(), startedAt: 0 } }
        : {}),
      file: path.join(project, "src", "main.ts"),
      inputs: registered,
      loader: {
        accepts: (file) => !path.relative(project, file).startsWith(".."),
        addContextDependency: (file) => channel.push(file),
        addDependency: (file) => channel.push(file),
        addMissingDependency: (file) => channel.push(file),
      },
      untracked: () => {
        untracked += 1;
      },
    });
    return {
      bridged,
      channel: channel.filter((file) => !file.endsWith(".signal")),
      untracked,
    };
  };
  assert.deepEqual(registerThrough(true, inputs), {
    bridged: [outside],
    channel: [inside],
    untracked: 1,
  });
  assert.deepEqual(registerThrough(false, inputs), {
    bridged: [],
    channel: [inside],
    untracked: 1,
  });
  assert.deepEqual(registerThrough(true, [inputs[0]!]).untracked, 0);

  const cache = path.join(project, "node_modules", ".cache", "ttsc");
  const marker = turbopackProcessMarker(cache);
  assert.equal(turbopackProcessMarker(cache), marker);
  assert.equal(path.dirname(path.dirname(marker)), cache);
  assert.match(
    path.basename(path.dirname(marker)),
    new RegExp(`^ttsc-watch-bridge-${process.pid}-`),
  );
  assert.ok(fs.existsSync(marker));
}
