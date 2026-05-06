const assert = require("node:assert/strict");
const test = require("node:test");

const { unplugin } = require("../../packages/unplugin/lib/api.js");
const unpluginFarm = require("../../packages/unplugin/lib/farm.js").default;
const unpluginNext = require("../../packages/unplugin/lib/next.js").default;
const unpluginRolldown =
  require("../../packages/unplugin/lib/rolldown.js").default;
const unpluginRspack = require("../../packages/unplugin/lib/rspack.js").default;
const unpluginWebpack =
  require("../../packages/unplugin/lib/webpack.js").default;

test("adapter entrypoints expose the expected plugin factories", () => {
  assertAdapterEntrypointsExposeFactories();
});

test("shared adapter filter accepts source files and skips declarations", () => {
  assertSharedAdapterFilter();
});

test("next adapter preserves an existing webpack hook", () => {
  assertNextAdapterPreservesWebpackHook();
});

function assertAdapterEntrypointsExposeFactories() {
  assert.equal(typeof unpluginFarm, "function");
  assert.equal(typeof unpluginRolldown, "function");
  assert.equal(typeof unpluginRspack, "function");
  assert.equal(typeof unpluginWebpack, "function");
}

function assertSharedAdapterFilter() {
  const raw = unplugin.raw(undefined, {});
  assert.equal(raw.transformInclude?.("main.ts"), true);
  assert.equal(raw.transformInclude?.("main.tsx"), true);
  assert.equal(raw.transformInclude?.("main.css"), false);
  assert.equal(raw.transformInclude?.("node_modules/pkg/main.ts"), false);
  assert.equal(raw.transformInclude?.("main.d.ts"), false);
}

function assertNextAdapterPreservesWebpackHook() {
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
