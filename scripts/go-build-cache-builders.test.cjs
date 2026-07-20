const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const {
  createCacheOptions: createWasmCacheOptions,
} = require("../packages/wasm/build/build-wasm.cjs");
const {
  createCacheOptions: createWebsiteCacheOptions,
} = require("../website/build/compiler.cjs");

test("WASM builders share the Go input identity contract", () => {
  const bridge = path.resolve("fixture-wasm_exec.js");
  const typiaRoot = path.resolve("fixture-typia");
  const wasm = createWasmCacheOptions({ force: false, wasmExecSrc: bridge });
  const website = createWebsiteCacheOptions({
    force: false,
    typiaGraph: { typiaRoot },
  });

  assert.deepEqual(wasm.environment, { GOOS: "js", GOARCH: "wasm" });
  assert.deepEqual(website.environment, wasm.environment);
  assert.deepEqual(wasm.dependencyPackages, ["./cmd/ttsc-wasm"]);
  assert.deepEqual(website.dependencyPackages, ["./cmd/playground"]);
  assert.ok(wasm.extraFiles.includes(bridge));
  assert.ok(
    wasm.inputDirectories.some((entry) => path.basename(entry) === "shim"),
  );
  assert.ok(website.extraFiles.includes(path.join(typiaRoot, "package.json")));
  assert.ok(website.extraFiles.some((entry) => entry.endsWith("wasm_exec.js")));
});
