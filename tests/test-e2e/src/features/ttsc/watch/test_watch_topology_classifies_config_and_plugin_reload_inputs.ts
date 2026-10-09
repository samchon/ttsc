import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { waitFor } from "../../../../../utils/src/internal/waitFor";

/**
 * Verifies one native observer session classifies config and selected sources.
 *
 * One copied compiler baseline and one package-owned Go input tree serve
 * config, module, nested-source, pruned-directory and newly populated directory
 * events. The source unit owns unchanged notifications and fresh-session
 * fingerprint decisions; this boundary requires actual native delivery for each
 * changed path.
 *
 * 1. Register the shared config, positional source and selected plugin tree.
 * 2. Deliver config, module and nested-source edits amid pruned writes.
 * 3. Create a populated package before its own subscription exists.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual native WatchTopology subscriptions deliver config, go.mod, nested Go source and newly created package inputs with config/plugin kinds. Writes under node_modules and .git never become plugin events.
 * @evidence contracts/testing.md#independent-expectations The authored config and selected plugin tree define literal paths and kinds; the independent source unit contrasts changed bytes with unchanged and excluded entries rather than generating expected events from topology output.
 * @evidence contracts/testing.md#distinguishing-cases Config mutation, module and nested-source mutation, pruned-directory noise and a newly populated directory retain distinct observable transitions. The source unit preserves fresh-session quietness and unchanged-plugin attention.
 * @evidence contracts/testing.md#execution-ownership Selected esbuild calls this built WatchTopology body with native observer defaults on upfront tools/native-topology. Its positional source does not request a compiler list; direct source units own portable event classification and content decisions. The existing direct entry remains callable but is not another selected host.
 * @evidence contracts/e2e.md#necessary-boundary Actual backend delivery and registration of a newly populated plugin directory cannot be established by supplied callbacks. This one session retains the OS connection previously repeated by the config/plugin, pruning and new-directory entries.
 * @evidence contracts/e2e.md#shared-execution Three former private roots and four topology sessions become one upfront project, one package-owned Go input copy and one native topology lifetime. Existing built libraries are reused; copied Go bytes are inputs, not a Go build or new install. The selected esbuild delivery collects this disjoint observer independently alongside service and CLI-watch outcomes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One TestProject root owns the copied project and module. Each transition records its prior ledger position, every stimulus changes the asserted path, and finally closes the one live topology. Pruned noise changes only excluded directories.
 * @evidence contracts/e2e.md#preserved-coverage The former config/plugin classification, pruned-directory exclusion and newly registered package delivery assertions execute here. test_watch_plugin_notifications_report_only_keyed_source_changes preserves unchanged-plugin attention, both nested edits, pruned negative twins and two stable fresh-session refreshes through actual source operations.
 */
export const test_watch_topology_classifies_config_and_plugin_reload_inputs =
  async (preparedRoot?: string, onClosed?: () => void): Promise<void> => {
    const root =
      preparedRoot ?? TestProject.tmpdir("ttsc-native-plugin-watch-");
    if (preparedRoot === undefined)
      TestProject.copyDirectory(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "tests",
          "test-e2e",
          "fixtures",
          "ttsc",
          "api",
          "baseline",
        ),
        root,
      );
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    const plugin = path.join(root, "plugin");
    if (preparedRoot === undefined)
      TestProject.copyDirectory(
        path.join(
          TestProject.WORKSPACE_ROOT,
          "packages",
          "ttsc",
          "test",
          "fixtures",
          "e2e",
          "plugin_source_state_holds_takes_a_digest_the_caller_vouches_for",
          "inputs-1",
        ),
        plugin,
      );
    const goMod = path.join(plugin, "go.mod");
    const nested = path.join(plugin, "internal", "rules", "rule.go");
    const pruned = [
      path.join(plugin, "node_modules"),
      path.join(plugin, ".git"),
    ];
    for (const directory of pruned)
      fs.mkdirSync(path.join(directory, "inner"), { recursive: true });
    const changes: WatchInputChange[] = [];
    let topologyFailure: Error | undefined;
    const owner = {
      check: () => {
        if (topologyFailure) throw topologyFailure;
      },
    };
    const failures: unknown[] = [];
    const topology = new WatchTopology(
      { cwd: root, files: [source], projectRoot: root, tsconfig: config },
      {
        onError: (location, error) => {
          const failure = new Error(`watch error on ${location}`, { cause: error });
          topologyFailure ??= failure;
          failures.push(failure);
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
    );
    const verify = async (
      name: string,
      run: () => Promise<void>,
    ): Promise<void> => {
      topologyFailure = undefined;
      try {
        await run();
      } catch (error) {
        failures.push(new Error(name, { cause: error }));
      }
    };
    let pollution = 0;
    const pollute = (): void => {
      for (const directory of pruned) {
        fs.writeFileSync(
          path.join(directory, "inner", `write-${++pollution}.txt`),
          "x\n",
        );
        fs.writeFileSync(path.join(directory, `entry-${pollution}.txt`), "x\n");
      }
    };
    try {
      topology.refresh(false);
      topology.setExtraInputs([plugin]);
      await verify("config reload", async () => {
        const original = JSON.parse(fs.readFileSync(config, "utf8"));
        await waitForPath(owner, changes, config, "config", () =>
          fs.writeFileSync(
            config,
            JSON.stringify({
              ...original,
              compilerOptions: {
                ...original.compilerOptions,
                noUnusedLocals: true,
              },
            }),
          ),
        );
      });
      for (const edited of [goMod, nested]) {
        await verify(
          `plugin edit ${path.relative(plugin, edited)}`,
          async () => {
            await waitForPath(owner, changes, edited, "plugin", () => {
              pollute();
              fs.appendFileSync(edited, "// edited\n");
            });
          },
        );
      }
      await verify("populated new directory", async () => {
        const created = path.join(plugin, "internal", "newpkg");
        const added = path.join(created, "x.go");
        fs.mkdirSync(created);
        fs.copyFileSync(nested, added);
        fs.mkdirSync(path.join(created, "node_modules", "pkg"), {
          recursive: true,
        });
        fs.copyFileSync(
          nested,
          path.join(created, "node_modules", "pkg", "ignored.go"),
        );
        await waitForPath(owner, changes, added, "plugin", () => undefined);
      });
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      await verify("pruned paths and lane classification", async () => {
        const leaked = changes.filter(
          (change) =>
            change.kind === "plugin" &&
            change.path !== undefined &&
            (pruned.some((directory) => within(directory, change.path!)) ||
              change.path!.includes(`${path.sep}node_modules${path.sep}`)),
        );
        assert.deepEqual(leaked, [], JSON.stringify(changes));
        const pluginChanges = changes.filter(
          (change) => change.path !== undefined && within(plugin, change.path),
        );
        assert.notEqual(pluginChanges.length, 0, JSON.stringify(changes));
        assert.ok(
          pluginChanges.every((change) => change.kind === "plugin"),
          JSON.stringify(changes),
        );
        assert.ok(
          changes.every(
            (change) => change.kind === "config" || change.kind === "plugin",
          ),
          JSON.stringify(changes),
        );
      });
    } finally {
      topology.close();
      onClosed?.();
    }
    if (failures.length !== 0)
      throw new AggregateError(
        failures,
        "native plugin watch scenarios failed",
      );
  };

async function waitForPath(
  owner: { check: () => void },
  changes: readonly WatchInputChange[],
  file: string,
  kind: WatchInputChange["kind"],
  stimulus: () => void,
): Promise<void> {
  const before = changes.length;
  await waitFor(() => {
    owner.check();
    if (changes.slice(before).some((change) => change.kind === kind && change.path === file)) return true;
    stimulus();
    return false;
  }, `expected ${kind} change for ${file}`, owner);
}

function within(root: string, location: string): boolean {
  const relative = path.relative(root, location);
  return (
    relative === "" ||
    (relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}
