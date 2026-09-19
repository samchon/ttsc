import assert from "node:assert/strict";

import { BRIDGED_WATCH_INPUT_KINDS } from "../../../../../packages/unplugin/lib/core/bridge/BRIDGED_WATCH_INPUT_KINDS.js";
import type { HostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/HostWatchBridge.js";
import { hostWatchIgnores } from "../../../../../packages/unplugin/lib/core/bridge/hostWatchIgnores.js";
import { registerBuildWatchInputs } from "../../../../../packages/unplugin/lib/core/bridge/registerBuildWatchInputs.js";
import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.js";

/**
 * Verifies a build host receives each watch input through the channel its kind
 * needs, the project's root-file membership only through a bridge, and a path
 * its own watcher skips through the bridge as well (samchon/ttsc#1388,
 * samchon/ttsc#1419).
 *
 * A one-shot host's directory channel is recursive, so handing it the project's
 * directories would invalidate every module on any edit below them; only a
 * watching session's bridge observes membership, by re-walking the project.
 * Presence-only directories reach no host at all. Rspack's watcher skips
 * `node_modules` unless configured otherwise, so a declaration package created
 * there reached its channel and never rebuilt.
 *
 * 1. Register one input of every kind through webpack-style loader channels and
 *    through a bare `addWatchFile`, and assert each kind's channel, with
 *    presence and membership dropped.
 * 2. Register them through a watching session's bridge and assert the bridged
 *    kinds, membership included, reach the bridge and its sentinel the file
 *    channel.
 * 3. Decide `watchOptions.ignored` values, Rspack's default among them, and assert
 *    an input the watcher skips keeps its channel and reaches the bridge as
 *    well.
 */
export async function test_build_watch_inputs_take_the_channel_of_their_kind(): Promise<void> {
  const observed = (file: string, observation: object): TtscWatchInput => ({
    evidence: {
      identity: file,
      missing: false,
      state: { codec: "predicates", observation },
    },
    file,
  });
  const inputs: TtscWatchInput[] = [
    observed("/p/read.d.ts", { fileExists: true }),
    observed("/p/absent.d.ts", { fileExists: false }),
    observed("/p/types", {
      accessibleEntries: { directories: [], files: [] },
      directoryExists: true,
    }),
    observed("/p/node_modules", { directoryExists: true }),
    {
      evidence: {
        identity: "/p",
        missing: false,
        state: {
          codec: "membership",
          digest: "d",
          directories: ["/p", "/p/src"],
          policy: {
            excludedDirectories: [],
            inputExtensions: [".ts"],
            sources: [],
          },
        },
      },
      file: "/p",
    },
  ];
  const loaderChannels = () => {
    const channels = {
      context: [] as string[],
      file: [] as string[],
      missing: [] as string[],
      watch: [] as string[],
    };
    return {
      channels,
      loader: {
        addContextDependency: (file: string) => channels.context.push(file),
        addDependency: (file: string) => channels.file.push(file),
        addMissingDependency: (file: string) => channels.missing.push(file),
      },
      watch: (file: string) => channels.watch.push(file),
    };
  };

  const loader = loaderChannels();
  registerBuildWatchInputs({
    addWatchFile: loader.watch,
    file: "/p/src/main.ts",
    inputs,
    loader: loader.loader,
  });
  assert.deepEqual(loader.channels, {
    context: ["/p/types"],
    file: ["/p/read.d.ts"],
    missing: ["/p/absent.d.ts"],
    watch: [],
  });

  const bare = loaderChannels();
  registerBuildWatchInputs({
    addWatchFile: bare.watch,
    file: "/p/src/main.ts",
    inputs,
  });
  assert.deepEqual(
    bare.channels.watch,
    ["/p/read.d.ts", "/p/absent.d.ts", "/p/types"],
    "a bare file channel takes files, creations, and listings, never membership",
  );

  const bridged: string[] = [];
  const bridge: HostWatchBridge = {
    acknowledge: () => undefined,
    begin: () => 0,
    close: async () => undefined,
    register: (_importer, registered) => {
      bridged.push(...registered.map((input) => input.file));
      return "/tmp/bridge/main.signal";
    },
    signal: () => undefined,
  };
  const watching = loaderChannels();
  registerBuildWatchInputs({
    addWatchFile: watching.watch,
    bridge: {
      instance: bridge,
      kinds: BRIDGED_WATCH_INPUT_KINDS.recursiveDirectoryChannel,
      startedAt: 0,
    },
    file: "/p/src/main.ts",
    inputs,
    loader: watching.loader,
  });
  assert.deepEqual(bridged, ["/p/types", "/p"], "listings and membership");
  assert.deepEqual(watching.channels, {
    context: [],
    file: ["/p/read.d.ts", "/tmp/bridge/main.signal"],
    missing: ["/p/absent.d.ts"],
    watch: [],
  });
  for (const kinds of Object.values(BRIDGED_WATCH_INPUT_KINDS)) {
    assert.ok(kinds.has("membership"), "every bridge observes membership");
  }

  const rspackDefault = hostWatchIgnores(/[\\/](?:\.git|node_modules)[\\/]/);
  const everyGlobal = hostWatchIgnores(/node_modules/g);
  const rows: [string, (file: string) => boolean, string, boolean][] = [
    ["unset", hostWatchIgnores(undefined), "/p/node_modules/a", false],
    ["Rspack's default", rspackDefault, "/p/node_modules/a/b.d.ts", true],
    ["Rspack's default", rspackDefault, "C:\\p\\node_modules\\a", true],
    ["Rspack's default", rspackDefault, "/p/node_modules", false],
    ["Rspack's default", rspackDefault, "/p/src/a.ts", false],
    ["a global expression", everyGlobal, "/p/node_modules/a", true],
    ["a global expression", everyGlobal, "/p/node_modules/a", true],
    [
      "a function",
      hostWatchIgnores((file: string) => file.includes("vendor")),
      "/p/vendor/a.d.ts",
      true,
    ],
    [
      "a function",
      hostWatchIgnores((file: string) => file.includes("vendor")),
      "/p/src/a.ts",
      false,
    ],
    [
      "a throwing function",
      hostWatchIgnores(() => {
        throw new Error("no");
      }),
      "/p/src/a.ts",
      true,
    ],
    ["a glob", hostWatchIgnores("**/dist/**"), "/p/src/a.ts", true],
    ["an empty glob list", hostWatchIgnores([]), "/p/src/a.ts", false],
    ["an empty glob", hostWatchIgnores(""), "/p/src/a.ts", false],
  ];
  for (const [label, ignores, file, expected] of rows) {
    assert.equal(ignores(file), expected, `${label}: ${file}`);
  }

  bridged.length = 0;
  const skipping = loaderChannels();
  registerBuildWatchInputs({
    addWatchFile: skipping.watch,
    bridge: {
      ignores: rspackDefault,
      instance: bridge,
      kinds: BRIDGED_WATCH_INPUT_KINDS.recursiveDirectoryChannel,
      startedAt: 0,
    },
    file: "/p/src/main.ts",
    inputs: [
      observed("/p/read.d.ts", { fileExists: true }),
      observed("/p/node_modules/dep/index.d.ts", { fileExists: true }),
      observed("/p/node_modules/@types/dep", { directoryExists: false }),
    ],
    loader: skipping.loader,
  });
  assert.deepEqual(
    bridged,
    ["/p/node_modules/dep/index.d.ts", "/p/node_modules/@types/dep"],
    "only the skipped paths reach the bridge",
  );
  assert.deepEqual(skipping.channels, {
    context: [],
    file: [
      "/p/read.d.ts",
      "/p/node_modules/dep/index.d.ts",
      "/tmp/bridge/main.signal",
    ],
    missing: ["/p/node_modules/@types/dep"],
    watch: [],
  });
}
