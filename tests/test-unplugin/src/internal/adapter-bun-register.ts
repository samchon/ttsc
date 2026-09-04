import {
  TestProject,
  TestUnpluginProject,
  TestUnpluginRuntime,
} from "@ttsc/testing";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const REQUIRE_FROM_TEST = createRequire(import.meta.url);

/** Shape the runtime preload forwards to `Bun.plugin`. */
interface CapturedPlugin {
  name: string;
  setup: (build: unknown) => unknown;
}

/** Minimal Bun load handler shape: path in, transformed contents + loader out. */
type BunLoader = (args: {
  path: string;
}) => Promise<{ contents: string; loader: string }>;

type BunRegister = (options?: unknown) => void;

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
async function importFreshBunRegister(): Promise<BunRegister> {
  const url = `${TestUnpluginRuntime.libUrl("bun-register")}?ra23=${Date.now()}-${Math.random()}`;
  const mod = await import(url);
  return mod.default as BunRegister;
}

/** Freshly evaluate the CommonJS condition beside the ESM preload condition. */
function requireFreshBunRegister(): BunRegister {
  const file = TestUnpluginRuntime.libPath("bun-register", "js");
  const resolved = REQUIRE_FROM_TEST.resolve(file);
  delete REQUIRE_FROM_TEST.cache[resolved];
  return (REQUIRE_FROM_TEST(file) as { default: BunRegister }).default;
}

/**
 * Drive a captured Bun plugin's single `onLoad` handler for one file and return
 * the transformed contents, mirroring how Bun invokes the loader.
 */
async function driveCapturedLoader(
  plugin: CapturedPlugin,
  file: string,
): Promise<string> {
  const loader = await captureLoader(plugin);
  return (await loader({ path: file })).contents;
}

/** Set up one captured runtime plugin and return its persistent load handler. */
async function captureLoader(plugin: CapturedPlugin): Promise<BunLoader> {
  let loader: BunLoader | undefined;
  await plugin.setup({
    onLoad(_options: { filter: RegExp }, handler: BunLoader) {
      loader = handler;
    },
  });
  assert.ok(loader, "captured plugin registered no onLoad handler");
  return loader;
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
  const register = mod.default as BunRegister;
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
 * explicit options are the ones that transform and then remain immutable.
 *
 * Bun uses the first matching `onLoad` hook and does not fall through to a
 * later overlapping plugin (oven-sh/bun#20583). The module auto-registers on
 * import, so a caller importing it to reach `register(options)` would, under
 * the old code, get a default plugin registered first that shadows the explicit
 * one. The entry must register exactly one Bun loader whose effective options
 * are resolved on first load, so calls before that boundary are last-write-wins
 * and calls after it cannot silently change the session. Evaluating the second
 * package condition must not erase options already supplied through the first.
 */
async function assertBunRegisterSameRuntimeExplicitOptionsWin(): Promise<void> {
  const preservationCaptured: CapturedPlugin[] = [];
  await withBunRuntime(preservationCaptured, async () => {
    const registerEsm = await importFreshBunRegister();
    const preserved = {
      plugins: [
        {
          transform: "./plugin.cjs",
          name: "prefix",
          prefix: "PRESERVED:",
        },
      ],
    };
    registerEsm(preserved);

    const registerCjs = requireFreshBunRegister();
    assert.equal(
      preservationCaptured.length,
      1,
      "evaluating the CommonJS condition must keep the existing loader",
    );
    const loader = await captureLoader(preservationCaptured[0]!);
    const missing = path.join(
      TestProject.tmpdir("ttsc-bun-register-pending-"),
      "missing.ts",
    );
    const pending = loader({ path: missing });

    assert.doesNotThrow(
      () => registerCjs(preserved),
      "the CommonJS condition must preserve options supplied through ESM",
    );
    await assert.rejects(pending, /ENOENT/);
  });

  const captured: CapturedPlugin[] = [];
  await withBunRuntime(captured, async () => {
    const registerEsm = await importFreshBunRegister();

    // Import-time auto-registration produced exactly one loader.
    assert.equal(captured.length, 1);
    const registerCjs = requireFreshBunRegister();
    assert.equal(
      captured.length,
      1,
      "requiring the CommonJS condition after the ESM preload must share its loader",
    );
    const loader = await captureLoader(captured[0]!);

    // Calls through both conditions after setup but before the first load
    // replace one detached snapshot without adding a shadowing loader.
    registerEsm({
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "A:" }],
    });
    const supplied = {
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "B:" }],
    };
    registerCjs(supplied);
    supplied.plugins[0]!.prefix = "MUTATED:";
    assert.equal(captured.length, 1);

    const root = TestUnpluginProject.createProject({ plugins: [] });
    const pending = loader({ path: TestUnpluginProject.mainFile(root) });

    // Handler entry locks synchronously before its first await. An equal call
    // is idempotent, while a different one cannot win an I/O race.
    registerEsm({
      plugins: [{ transform: "./plugin.cjs", name: "prefix", prefix: "B:" }],
    });
    assert.throws(
      () =>
        registerCjs({
          plugins: [
            { transform: "./plugin.cjs", name: "prefix", prefix: "C:" },
          ],
        }),
      /options are locked[\s\S]*Restart the Bun process/,
    );
    assert.equal(captured.length, 1);
    const output = await pending;
    assert.match(output.contents, /"B:plugin"/);
    assert.doesNotMatch(output.contents, /MUTATED:|"C:plugin"/);
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
    const registerCjs = requireFreshBunRegister();

    assert.equal(captured.length, 1);
    const registerEsm = await importFreshBunRegister();
    assert.equal(
      captured.length,
      1,
      "importing the ESM condition after a CommonJS preload must share its loader",
    );

    const root = TestUnpluginProject.createProject();
    const output = await driveCapturedLoader(
      captured[0]!,
      TestUnpluginProject.mainFile(root),
    );
    TestUnpluginProject.assertTransformedToPlugin(output);
    assert.doesNotThrow(() => {
      registerCjs();
      registerEsm();
    }, "both conditions must see the same locked default configuration");
  });
}

export {
  assertBunRegisterPreloadOnlyRegistersOneDefaultPlugin,
  assertBunRegisterRegistersRuntimePlugin,
  assertBunRegisterSameRuntimeExplicitOptionsWin,
};
