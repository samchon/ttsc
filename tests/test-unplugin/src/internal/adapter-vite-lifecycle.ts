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
  await invokeVitePluginHook(plugin.buildStart, {});
  return {
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
}
