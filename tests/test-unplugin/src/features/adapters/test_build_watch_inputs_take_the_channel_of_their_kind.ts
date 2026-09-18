import assert from "node:assert/strict";

import { BRIDGED_WATCH_INPUT_KINDS } from "../../../../../packages/unplugin/lib/core/bridge/BRIDGED_WATCH_INPUT_KINDS.js";
import type { HostWatchBridge } from "../../../../../packages/unplugin/lib/core/bridge/HostWatchBridge.js";
import { registerBuildWatchInputs } from "../../../../../packages/unplugin/lib/core/bridge/registerBuildWatchInputs.js";
import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.js";

/**
 * Verifies a build host receives each watch input through the channel its kind
 * needs, and the project's root-file membership only through a bridge
 * (samchon/ttsc#1388, samchon/ttsc#1419).
 *
 * A one-shot host's directory channel is recursive, so handing it the project's
 * directories would invalidate every module on any edit below them; only a
 * watching session's bridge observes membership, by re-walking the project.
 * Presence-only directories reach no host at all.
 *
 * 1. Register one input of every kind through webpack-style loader channels and
 *    through a bare `addWatchFile`, and assert each kind's channel, with
 *    presence and membership dropped.
 * 2. Register them through a watching session's bridge and assert the bridged
 *    kinds, membership included, reach the bridge and its sentinel the file
 *    channel.
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
    begin: () => 0,
    close: async () => undefined,
    register: (_importer, registered) => {
      bridged.push(...registered.map((input) => input.file));
      return "/tmp/bridge/main.signal";
    },
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
}
