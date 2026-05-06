const assert = require("node:assert/strict");
const test = require("node:test");

const {
  libPath,
  libUrl,
  loadUnpluginAdapter,
  loadUnpluginApi,
} = require("./helpers/unplugin.cjs");

test("adapter entrypoints expose the expected plugin factories", async () => {
  await assertAdapterEntrypointsExposeFactories();
});

test("adapter entrypoints support Node ESM default import", async () => {
  await assertAdapterEntrypointsSupportEsmDefaultImport();
});

test("adapter entrypoints support Node CJS require", () => {
  assertAdapterEntrypointsSupportCjsRequire();
});

test("shared adapter filter accepts source files and skips declarations", async () => {
  await assertSharedAdapterFilter();
});

test("next adapter preserves an existing webpack hook", async () => {
  await assertNextAdapterPreservesWebpackHook();
});

async function assertAdapterEntrypointsExposeFactories() {
  const unpluginFarm = await loadUnpluginAdapter("farm");
  const unpluginRolldown = await loadUnpluginAdapter("rolldown");
  const unpluginRspack = await loadUnpluginAdapter("rspack");
  const unpluginWebpack = await loadUnpluginAdapter("webpack");
  assert.equal(typeof unpluginFarm, "function");
  assert.equal(typeof unpluginRolldown, "function");
  assert.equal(typeof unpluginRspack, "function");
  assert.equal(typeof unpluginWebpack, "function");
}

async function assertAdapterEntrypointsSupportEsmDefaultImport() {
  const root = await import(libUrl("index"));
  assert.equal(typeof root.default.vite, "function", "index");

  for (const entrypoint of [
    "bun",
    "esbuild",
    "farm",
    "next",
    "rolldown",
    "rollup",
    "rspack",
    "vite",
    "webpack",
  ]) {
    const mod = await import(libUrl(entrypoint));
    assert.equal(typeof mod.default, "function", entrypoint);
  }
}

function assertAdapterEntrypointsSupportCjsRequire() {
  const root = require(libPath("index", "js"));
  assert.equal(typeof root.default.vite, "function", "index");

  for (const entrypoint of [
    "bun",
    "esbuild",
    "farm",
    "next",
    "rolldown",
    "rollup",
    "rspack",
    "vite",
    "webpack",
  ]) {
    const mod = require(libPath(entrypoint, "js"));
    assert.equal(typeof mod.default, "function", entrypoint);
  }

  const api = require(libPath("api", "js"));
  assert.equal(typeof api.resolveOptions, "function");
  assert.equal(typeof api.transformTtsc, "function");
}

async function assertSharedAdapterFilter() {
  const { unplugin } = await loadUnpluginApi();
  const raw = unplugin.raw(undefined, {});
  assert.equal(raw.transformInclude?.("main.ts"), true);
  assert.equal(raw.transformInclude?.("main.tsx"), true);
  assert.equal(raw.transformInclude?.("main.css"), false);
  assert.equal(raw.transformInclude?.("node_modules/pkg/main.ts"), false);
  assert.equal(raw.transformInclude?.("main.d.ts"), false);
  assert.equal(raw.transformInclude?.("\0rolldown/runtime.js"), false);
}

async function assertNextAdapterPreservesWebpackHook() {
  const unpluginNext = await loadUnpluginAdapter("next");
  let called = false;
  const next = unpluginNext({
    webpack(config) {
      called = true;
      config.original = true;
      return config;
    },
  });
  const config = next.webpack?.({ plugins: [] }, {});
  assert.equal(called, true);
  assert.equal(config?.original, true);
  assert.equal(config?.plugins?.length, 1);
}
