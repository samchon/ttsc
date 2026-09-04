import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  invokeVitePluginHook,
  loadViteAdapterPlugin,
} from "./adapter-vite-serve";
import { createCacheProject, projectModules } from "./transform-project-cache";

/**
 * One driven Vite adapter session over a multi-module fixture project.
 *
 * The cache lifecycle is a decision the adapter makes in `buildStart` from the
 * resolved config, so a scenario that asserts it needs a resolved config and a
 * transform context, not a running server. Driving the hooks directly also
 * keeps every scenario free of a live chokidar watcher, which can outlive
 * `server.close()` and hold the test runner process open.
 */
interface IViteAdapterSession {
  /** End the driven Vite lifecycle and dispose its private cache. */
  close: () => Promise<void>;
  /** Deliver one module through the adapter's `transform` hook. */
  deliver: (file: string) => Promise<unknown>;
  /** Absolute module paths of the fixture, sorted. */
  modules: string[];
  /** How many whole-project compiles the fixture plugin has run so far. */
  projectCompiles: () => number;
  /** Absolute path of one project input that is not a module source. */
  unrelatedInput: string;
}

/**
 * Start a Vite adapter session over a fresh fixture project.
 *
 * `watching` selects the two configurations the lifecycle decision separates: a
 * dev server with a live watcher, and one configured with `server.watch: null`,
 * which is what a one-shot consumer (`vitest --run` above all) resolves to.
 */
export async function startViteAdapterSession(options: {
  fileCount?: number;
  watching: boolean;
}): Promise<IViteAdapterSession> {
  const plugin = await loadViteAdapterPlugin();
  const lifecycle = {};
  const project = createCacheProject({ fileCount: options.fileCount ?? 4 });
  invokeVitePluginHook(
    plugin.configResolved,
    {},
    {
      command: "serve",
      resolve: { alias: [] },
      server: options.watching ? { watch: {} } : { watch: null },
    },
  );
  await invokeVitePluginHook(plugin.buildStart, lifecycle);
  return {
    close: async () => {
      await invokeVitePluginHook(plugin.buildEnd, lifecycle);
    },
    deliver: async (file: string) =>
      invokeVitePluginHook(
        plugin.transform,
        { addWatchFile: () => undefined },
        fs.readFileSync(file, "utf8"),
        file,
      ),
    modules: projectModules(project.root),
    projectCompiles: () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0,
    unrelatedInput: path.join(project.root, "plugin.cjs"),
  };
}

/** Change a project input that every module's validation covers. */
function touchUnrelatedInput(session: IViteAdapterSession): void {
  fs.appendFileSync(
    session.unrelatedInput,
    "\n// changed after the session's generation was captured\n",
    "utf8",
  );
}

/**
 * Asserts samchon/ttsc#1260: a watcherless dev server settles each module's
 * first delivery from the supplied source alone.
 *
 * The session declared it will observe no edit, so it can neither learn of one
 * nor invalidate what one touched. Recompiling mid-session would only hand the
 * remaining modules a second compilation of the same program, so the session
 * keeps serving the generation it started from, exactly as a build does.
 */
export async function assertWatcherlessServeTakesTheBuildScopedCache(): Promise<void> {
  const session = await startViteAdapterSession({ watching: false });
  try {
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);

    touchUnrelatedInput(session);
    for (const file of session.modules.slice(1)) {
      assert.ok(await session.deliver(file));
    }
    assert.equal(
      session.projectCompiles(),
      1,
      "a watcherless serve session must deliver every remaining module from the one generation it already compiled",
    );
  } finally {
    await session.close();
  }
}

/**
 * Asserts a watching dev server keeps persistent validation.
 *
 * Its single `buildStart` spans every later edit, so the build-scoped shortcut
 * would serve a module compiled before an edit the server can observe and is
 * expected to hot-update. This is the negative twin of the watcherless case:
 * the same fixture, the same edit, the opposite verdict.
 */
export async function assertWatchingServeKeepsPersistentValidation(): Promise<void> {
  const session = await startViteAdapterSession({ watching: true });
  try {
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);

    touchUnrelatedInput(session);
    for (const file of session.modules.slice(1)) {
      assert.ok(await session.deliver(file));
    }
    assert.equal(
      session.projectCompiles(),
      2,
      "a watching dev server must replace the generation the changed input invalidated, then reuse the replacement",
    );
  } finally {
    await session.close();
  }
}

/**
 * Asserts the build-scoped shortcut still stops at a module's second delivery.
 *
 * `beginTtscTransformBuild` settles only a module's _first_ delivery in the
 * session from the supplied source; a repeated request revalidates, because the
 * bundler asking again is the one signal a session without a watcher still
 * has.
 */
export async function assertWatcherlessServeRevalidatesARepeatedModule(): Promise<void> {
  const session = await startViteAdapterSession({ watching: false });
  try {
    const first = session.modules[0]!;
    assert.ok(await session.deliver(first));
    assert.equal(session.projectCompiles(), 1);

    touchUnrelatedInput(session);
    assert.ok(await session.deliver(first));
    assert.equal(
      session.projectCompiles(),
      2,
      "a module delivered twice in one watcherless session must validate on its second delivery",
    );
  } finally {
    await session.close();
  }
}

/**
 * Assert overlapping Vite containers retain only their newest live cache.
 *
 * Vite constructs a replacement container before ending the old one during a
 * restart. The old buildEnd must not clear the replacement generation, while
 * the replacement's eventual buildEnd must dispose it and its trackers.
 */
export async function assertViteBuildEndDisposesTheLastOverlappingCacheOwner(): Promise<void> {
  const plugin = await loadViteAdapterPlugin();
  const unstartedLifecycle = {};
  const oldLifecycle = {};
  const replacementLifecycle = {};
  const project = createCacheProject({
    fileCount: 4,
    graphCandidates: 1,
    graphFanout: 1,
  });
  const modules = projectModules(project.root);
  const runCount = () =>
    fs.existsSync(project.runLog)
      ? fs.readFileSync(project.runLog, "utf8").length
      : 0;
  const deliver = async (file: string) =>
    invokeVitePluginHook(
      plugin.transform,
      { addWatchFile: () => undefined },
      fs.readFileSync(file, "utf8"),
      file,
    );
  invokeVitePluginHook(
    plugin.configResolved,
    {},
    {
      command: "serve",
      resolve: { alias: [] },
      server: { watch: null },
    },
  );
  invokeVitePluginHook(plugin.configureServer, {}, {});
  const countPollerDisposals = async (lifecycle: object): Promise<number> => {
    const host = globalThis as typeof globalThis & {
      clearInterval: typeof clearInterval;
    };
    const original = host.clearInterval;
    let disposals = 0;
    host.clearInterval = ((timer: Parameters<typeof clearInterval>[0]) => {
      disposals += 1;
      original(timer);
    }) as typeof clearInterval;
    try {
      await invokeVitePluginHook(plugin.buildEnd, lifecycle);
    } finally {
      host.clearInterval = original;
    }
    return disposals;
  };

  try {
    await invokeVitePluginHook(plugin.buildStart, oldLifecycle);
    assert.ok(await deliver(modules[0]!));
    assert.equal(runCount(), 1);

    // Vite closes even a container that never reached buildStart. Its buildEnd
    // must not consume the live lifecycle owned by a different container.
    assert.equal(
      await countPollerDisposals(unstartedLifecycle),
      0,
      "an unstarted container must not stop the live missing-input poll",
    );
    fs.appendFileSync(
      path.join(project.root, "plugin.cjs"),
      "\n// changed after an unstarted container ended\n",
      "utf8",
    );
    assert.ok(await deliver(modules[1]!));
    assert.equal(
      runCount(),
      1,
      "an unstarted container's buildEnd must not reset the live build-scoped generation",
    );

    // Model Vite restart ordering: replacement buildStart precedes old buildEnd.
    await invokeVitePluginHook(plugin.buildStart, replacementLifecycle);
    assert.ok(await deliver(modules[2]!));
    assert.equal(runCount(), 2);
    assert.equal(
      await countPollerDisposals(oldLifecycle),
      0,
      "a superseded container must not stop the replacement's missing-input poll",
    );

    fs.appendFileSync(
      path.join(project.root, "plugin.cjs"),
      "\n// changed after the replacement generation was captured\n",
      "utf8",
    );
    assert.ok(await deliver(modules[3]!));
    assert.equal(
      runCount(),
      2,
      "the old container's buildEnd must not reset the replacement's build-scoped generation",
    );

    assert.equal(
      await countPollerDisposals(replacementLifecycle),
      1,
      "the final container must stop the shared missing-input poll exactly once",
    );
    assert.ok(await deliver(modules[0]!));
    assert.equal(
      runCount(),
      3,
      "the last container's buildEnd must dispose its generation before any later transform",
    );
  } finally {
    // buildEnd is idempotent per context. End every modeled owner even when a
    // transform/assertion failed, then pair one fresh lifecycle to reset any
    // ownerless persistent generation created by the post-close diagnostic.
    await invokeVitePluginHook(plugin.buildEnd, unstartedLifecycle);
    await invokeVitePluginHook(plugin.buildEnd, oldLifecycle);
    await invokeVitePluginHook(plugin.buildEnd, replacementLifecycle);
    const cleanupLifecycle = {};
    await invokeVitePluginHook(plugin.buildStart, cleanupLifecycle);
    await invokeVitePluginHook(plugin.buildEnd, cleanupLifecycle);
  }
}

/**
 * One driven `vite build` session over a fixture project, watching or not.
 *
 * Rollup's watcher repeats a whole build phase per rebuild, so the real hook
 * order across two rebuilds is `buildStart -> buildEnd -> writeBundle ->
 * closeBundle -> buildStart -> ... -> closeWatcher`, with only `closeWatcher`
 * firing once. An ordinary build closes its bundle instead and never reaches
 * `closeWatcher` at all. Driving the hooks directly reproduces both orders
 * exactly while keeping the scenarios free of a live watcher that can outlive
 * the runner.
 */
async function startViteBuildSession(watching: boolean): Promise<{
  close: () => Promise<void>;
  resolveAs: (watching: boolean) => void;
  deliver: (file: string) => Promise<unknown>;
  endPass: () => Promise<void>;
  modules: string[];
  projectCompiles: () => number;
  startPass: () => Promise<void>;
  unrelatedInput: string;
}> {
  const plugin = await loadViteAdapterPlugin();
  const project = createCacheProject({ fileCount: 4 });
  let lifecycle = {};
  const resolveAs = (nextWatching: boolean): void => {
    invokeVitePluginHook(
      plugin.configResolved,
      {},
      {
        // `build.watch` is the axis the disposal boundary turns on: `null` for
        // an ordinary build, an object under `--watch`. Modelling only one of
        // them is what made the non-watching regression invisible.
        build: { watch: nextWatching ? {} : null },
        command: "build",
        resolve: { alias: [] },
        server: {},
      },
    );
  };
  resolveAs(watching);
  return {
    resolveAs,
    close: async () => {
      await invokeVitePluginHook(plugin.closeWatcher, {});
    },
    deliver: async (file: string) =>
      invokeVitePluginHook(
        plugin.transform,
        { addWatchFile: () => undefined },
        fs.readFileSync(file, "utf8"),
        file,
      ),
    endPass: async () => {
      await invokeVitePluginHook(plugin.buildEnd, lifecycle);
    },
    modules: projectModules(project.root),
    projectCompiles: () =>
      fs.existsSync(project.runLog)
        ? fs.readFileSync(project.runLog, "utf8").length
        : 0,
    startPass: async () => {
      lifecycle = {};
      await invokeVitePluginHook(plugin.buildStart, lifecycle);
    },
    unrelatedInput: path.join(project.root, "plugin.cjs"),
  };
}

/**
 * Asserts samchon/ttsc#1301: `vite build --watch` reuses the generation across
 * rebuilds.
 *
 * `buildEnd` disposes the generation only where it means the session ended,
 * which is `serve`. Under `build` Rollup calls it at the end of every build
 * phase, so disposing there discarded the generation once per rebuild
 * independently of the `buildStart` clear — which is why fixing one of the two
 * sites alone left this host recompiling the whole project per edit.
 */
export async function assertViteBuildWatchReusesTheGenerationAcrossRebuilds(): Promise<void> {
  const session = await startViteBuildSession(true);
  try {
    for (let rebuild = 0; rebuild < 3; rebuild += 1) {
      await session.startPass();
      for (const file of session.modules) {
        assert.ok(await session.deliver(file));
      }
      await session.endPass();
    }
    assert.equal(
      session.projectCompiles(),
      1,
      "every rebuild that changed no compiler input must reuse the one generation",
    );
  } finally {
    await session.close();
  }
}

/**
 * Asserts the retained generation is still disposed at the watch session's real
 * teardown.
 *
 * Retaining it across passes means nothing releases its directory watchers at a
 * pass boundary any more, so the boundary that does mean teardown has to. Of
 * the hooks a `vite build --watch` trace produces, `closeWatcher` is the only
 * one that fires exactly once.
 */
export async function assertViteBuildWatchDisposesOnCloseWatcher(): Promise<void> {
  const session = await startViteBuildSession(true);
  try {
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);
    await session.endPass();

    await session.close();
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.projectCompiles(),
      2,
      "closeWatcher must dispose the generation, so the next session compiles again",
    );
  } finally {
    await session.close();
  }
}

/**
 * Asserts an ordinary `vite build` still disposes its generation at `buildEnd`.
 *
 * The disposal boundary turns on whether the host is watching, not on which
 * command it is running. Vite takes Rollup's watcher only when `build.watch` is
 * set; an ordinary build closes its bundle instead and never emits
 * `closeWatcher`, so gating the `buildEnd` reset on `command === "serve"` alone
 * would leave a one-shot build with no disposal site at all, and a process that
 * runs repeated programmatic builds accumulating one live generation and its
 * directory watchers per build.
 */
export async function assertViteBuildDisposesTheGenerationAtBuildEnd(): Promise<void> {
  const session = await startViteBuildSession(false);
  try {
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);
    await session.endPass();

    // No `closeWatcher` here: an ordinary build never emits one. If `buildEnd`
    // did not dispose, this delivery would reuse the generation instead.
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.projectCompiles(),
      2,
      "a non-watching build must dispose at buildEnd, so the next session compiles again",
    );
  } finally {
    await session.close();
  }
}

/**
 * Asserts a watcher closed mid-rebuild does not strand the container counter.
 *
 * `closeWatcher` has to replace the container owner set, not merely zero the
 * count beside it. A watcher closed while a build phase is open leaves that
 * container still registered, so its later `buildEnd` takes the delete branch
 * and decrements a counter that is already zero. Stranded below zero the count
 * can never reach zero again, and the `buildEnd` disposal is dead for the rest
 * of that plugin instance's life.
 *
 * The consequence only becomes observable once a _non-watching_ session
 * follows, because `buildEnd` deliberately never disposes for a watching build.
 * So the instance is resolved again as an ordinary build, which is also the
 * shape a host that reuses one plugin across configurations produces. A pass
 * opened and never closed before teardown is what Ctrl+C during a rebuild
 * leaves behind.
 */
export async function assertCloseWatcherMidPassKeepsTheCounterSound(): Promise<void> {
  const session = await startViteBuildSession(true);
  try {
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 1);

    // Teardown arrives with the pass still open, then that pass's own buildEnd
    // lands afterwards against a counter the teardown already zeroed.
    await session.close();
    await session.endPass();

    // An ordinary build on the same instance: here buildEnd is the disposal
    // site, and it can only fire if the counter still reaches zero.
    session.resolveAs(false);
    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(session.projectCompiles(), 2);
    await session.endPass();

    await session.startPass();
    assert.ok(await session.deliver(session.modules[0]!));
    assert.equal(
      session.projectCompiles(),
      3,
      "a mid-pass teardown must leave the container counter able to reach zero again",
    );
  } finally {
    await session.close();
  }
}
