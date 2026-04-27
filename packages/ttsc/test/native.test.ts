const assert = require("node:assert/strict");
const test = require("node:test");

const { resolveNativeBackend } = require("../src/native.ts");

test("resolveNativeBackend accepts versioned native backend descriptors", () => {
  const backend = resolveNativeBackend({
    name: "native-test",
    native: {
      mode: "native-test",
      binary: "/tmp/ttsc-native-test",
      contractVersion: 1,
      capabilities: ["rewrite", "diagnostics"],
    },
  });

  assert.deepEqual(backend, {
    mode: "native-test",
    binary: "/tmp/ttsc-native-test",
    contractVersion: 1,
    capabilities: ["rewrite", "diagnostics"],
  });
});

test("resolveNativeBackend keeps nativeMode/nativeBinary as a legacy alias", () => {
  const backend = resolveNativeBackend({
    name: "legacy-native-test",
    nativeMode: "legacy-native-test",
    nativeBinary: "/tmp/ttsc-legacy-native-test",
  });

  assert.deepEqual(backend, {
    mode: "legacy-native-test",
    binary: "/tmp/ttsc-legacy-native-test",
    contractVersion: 1,
  });
});

test("resolveNativeBackend rejects ambiguous native declarations", () => {
  assert.throws(
    () =>
      resolveNativeBackend({
        name: "bad-native-test",
        native: { mode: "native-test" },
        nativeMode: "native-test",
      }),
    /must use either native or nativeMode\/nativeBinary/,
  );
});

test("resolveNativeBackend rejects unsupported native contract versions", () => {
  assert.throws(
    () =>
      resolveNativeBackend({
        name: "future-native-test",
        native: { mode: "native-test", contractVersion: 2 },
      }),
    /unsupported native contract version 2/,
  );
});

test("resolveNativeBackend accepts native.source descriptors", () => {
  const backend = resolveNativeBackend({
    name: "source-test",
    native: {
      mode: "native-test",
      source: { dir: "/abs/path/to/plugin", entry: "./cmd/host" },
      contractVersion: 1,
    },
  });

  assert.deepEqual(backend, {
    mode: "native-test",
    source: { dir: "/abs/path/to/plugin", entry: "./cmd/host" },
    contractVersion: 1,
  });
});

test("resolveNativeBackend rejects native.source + native.binary together", () => {
  assert.throws(
    () =>
      resolveNativeBackend({
        name: "conflict-source-test",
        native: {
          mode: "native-test",
          binary: "/tmp/binary",
          source: { dir: "/tmp/source" },
        },
      }),
    /must use either native\.binary or native\.source, not both/,
  );
});

test("resolveNativeBackend rejects empty native.source.dir", () => {
  assert.throws(
    () =>
      resolveNativeBackend({
        name: "empty-source-test",
        native: { mode: "native-test", source: { dir: "" } },
      }),
    /native\.source\.dir must be a non-empty string/,
  );
});
