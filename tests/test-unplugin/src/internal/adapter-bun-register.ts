import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

/** Shape the runtime preload forwards to `Bun.plugin`. */
interface CapturedPlugin {
  name: string;
  setup: (build: unknown) => unknown;
}

/** Minimal Bun load handler shape: path in, transformed contents + loader out. */
type BunLoader = (args: {
  path: string;
}) => Promise<{ contents: string; loader: string }>;

/**
 * Run `body` with a Bun-like global installed for the whole scope, so both the
 * import-time auto-registration and any explicit `register(options)` call see
 * the same runtime. Every `Bun.plugin` registration is appended to `captured`.
 * The prior global is restored afterwards.
 */
async function withBunRuntime(
  captured: CapturedPlugin[],
  body: () => Promise<void>,
): Promise<void> {
  const holder = globalThis as { Bun?: unknown };
  const priorBun = holder.Bun;
  holder.Bun = { plugin: (plugin: CapturedPlugin) => captured.push(plugin) };
  try {
    await body();
  } finally {
    if (priorBun === undefined) delete holder.Bun;
    else holder.Bun = priorBun;
  }
}

/**
 * Freshly evaluate the built `bun-register` entry, so the module-level
 * auto-registration runs during import exactly as it would inside a Bun
 * preload. A unique query busts the ESM module cache so each call re-runs the
 * module's registration state. The caller must already have a Bun-like global
 * installed (see {@link withBunRuntime}).
 */
async function importFreshBunRegister(): Promise<(options?: unknown) => void> {
  const url = `${TestUnpluginRuntime.libUrl("bun-register")}?ra23=${Date.now()}-${Math.random()}`;
  const mod = await import(url);
  return mod.default as (options?: unknown) => void;
}

/**
 * Drive a captured Bun plugin's single `onLoad` handler for one file and return
 * the transformed contents, mirroring how Bun invokes the loader.
 */
async function driveCapturedLoader(
  plugin: CapturedPlugin,
  file: string,
): Promise<string> {
  let loader: BunLoader | undefined;
  await plugin.setup({
    onLoad(_options: { filter: RegExp }, handler: BunLoader) {
      loader = handler;
    },
  });
  assert.ok(loader, "captured plugin registered no onLoad handler");
  return (await loader({ path: file })).contents;
}

/**
 * Asserts the `bun-register` runtime entry: importing it off Bun is a harmless
 * no-op, an explicit `register()` off Bun throws a clear error, and under a
 * Bun-like global it forwards the `ttsc-unplugin` adapter to `Bun.plugin`.
 *
 * Stubs `globalThis.Bun` so no real Bun runtime is required; loads the built
 * entrypoint via `TestUnpluginRuntime.libUrl("bun-register")`.
 */
async function assertBunRegisterRegistersRuntimePlugin() {
  const mod = await import(TestUnpluginRuntime.libUrl("bun-register"));
  const register = mod.default as (options?: unknown) => void;
  assert.equal(typeof register, "function");

  // Off Bun, an explicit register() must fail loud rather than silently no-op.
  assert.throws(() => register(), /Bun runtime/);

  // Under a Bun-like global, register() forwards the adapter to Bun.plugin.
  const captured: CapturedPlugin[] = [];
  const holder = globalThis as { Bun?: unknown };
  const priorBun = holder.Bun;
  holder.Bun = {
    plugin: (plugin: CapturedPlugin) => captured.push(plugin),
  };
  try {
    register();
  } finally {
    if (priorBun === undefined) delete holder.Bun;
    else holder.Bun = priorBun;
  }
  assert.equal(captured.length, 1);
  assert.equal(captured[0]?.name, "ttsc-unplugin");
  assert.equal(typeof captured[0]?.setup, "function");
}

/**
 * Asserts that accessing the explicit `register(options)` API in the real
 * same-runtime order cannot install a shadowing default loader, and that the
 * explicit options are the ones that transform.
 *
 * Bun uses the first matching `onLoad` hook and does not fall through to a
 * later overlapping plugin (oven-sh/bun#20583). The module auto-registers on
 * import, so a caller importing it to reach `register(options)` would, under
 * the old code, get a default plugin registered first that shadows the explicit
 * one. The entry must register exactly one Bun loader whose effective options
 * are resolved on first load, so the later explicit call wins.
 */
async function assertBunRegisterSameRuntimeExplicitOptionsWin(): Promise<void> {
  const captured: CapturedPlugin[] = [];
  await withBunRuntime(captured, async () => {
    const register = await importFreshBunRegister();

    // Import-time auto-registration produced exactly one loader.
    assert.equal(captured.length, 1);

    // Accessing the explicit API afterwards must not add a second, shadowing
    // loader; it updates the single loader's effective options.
    register({
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "A:" }],
    });
    assert.equal(captured.length, 1);

    // The single effective loader must apply the explicit options, not
    // defaults: the fixture's tsconfig declares no such prefix plugin.
    const root = TestUnpluginProject.createProject({ plugins: [] });
    const output = await driveCapturedLoader(
      captured[0]!,
      TestUnpluginProject.mainFile(root),
    );
    assert.match(output, /"A:plugin"/);
  });
}

/**
 * Asserts the negative twin: a pure preload import with no explicit call
 * registers exactly one default loader that transforms with the project's own
 * tsconfig configuration.
 *
 * The one-line `bunfig.toml` preload convenience must keep working: importing
 * the side-effect entry under Bun registers a single default plugin, and that
 * plugin applies the fixture's tsconfig-declared transform.
 */
async function assertBunRegisterPreloadOnlyRegistersOneDefaultPlugin(): Promise<void> {
  const captured: CapturedPlugin[] = [];
  await withBunRuntime(captured, async () => {
    await importFreshBunRegister();

    assert.equal(captured.length, 1);

    const root = TestUnpluginProject.createProject();
    const output = await driveCapturedLoader(
      captured[0]!,
      TestUnpluginProject.mainFile(root),
    );
    TestUnpluginProject.assertTransformedToPlugin(output);
  });
}

export {
  assertBunRegisterPreloadOnlyRegistersOneDefaultPlugin,
  assertBunRegisterRegistersRuntimePlugin,
  assertBunRegisterSameRuntimeExplicitOptionsWin,
};
