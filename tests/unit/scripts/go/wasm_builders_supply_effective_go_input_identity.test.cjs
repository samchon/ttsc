const assert = require("node:assert/strict");
const path = require("node:path");
const { test } = require("node:test");

const {
  createCacheOptions: createWasmCacheOptions,
} = require("../../../../packages/wasm/build/build-wasm.cjs");
const {
  createCacheOptions: createWebsiteCacheOptions,
} = require("../../../../website/build/compiler.cjs");

/**
 * @evidence contracts/testing.md#behavioral-verification Calls both real WASM cache-option builders and checks target architecture, command dependency packages and bridge/shim/typia manifest inputs.
 * @evidence contracts/testing.md#independent-expectations Literal js/wasm values and independently authored bridge and typia roots determine the expected effective input identities.
 * @evidence contracts/testing.md#distinguishing-cases The library WASM command and website playground command must remain distinct while both retain the shared runtime bridge and required authored inputs.
 * @evidence contracts/testing.md#execution-ownership Both builders are called in process with path values; this tests returned cache inputs rather than repository file existence and executes no Go builder.
 */
const test_wasm_builders_supply_effective_go_input_identity = () => {
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
};

module.exports = { test_wasm_builders_supply_effective_go_input_identity };

test("WASM builders share the Go input identity contract", test_wasm_builders_supply_effective_go_input_identity);
