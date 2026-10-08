import assert from "node:assert/strict";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Verifies complete worker environment adoption preserves native name identity.
 *
 * A Windows worker has case-sensitive properties despite native environment
 * names being case-insensitive. Adoption must select one authoritative spelling
 * and remove earlier requests' values, without conflating POSIX aliases.
 *
 * 1. Adopt lower-case runtime and preload names over stale worker state.
 * 2. Replace them with duplicate spellings, then undefined and absent names.
 * 3. Confirm the supplied snapshot is unchanged and self-replacement is safe.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production SidecarEnvironment.replace and read operations on complete supplied snapshots, asserting exact preload/runtime authority, alias presence and stale-name removal across sequential requests.
 * @evidence contracts/testing.md#independent-expectations Windows case-insensitive environment identity and Node's lexicographically first duplicate rule prescribe uppercase values; POSIX exact names prescribe distinct aliases. Literal authored values and own-key expectations do not come from the implementation's output.
 * @evidence contracts/testing.md#distinguishing-cases Lowercase-only, duplicate spelling with opposite insertion order, undefined removal, missing removal, empty value and self-aliasing snapshots distinguish authoritative presence from stale state; POSIX retains both independent spellings.
 * @evidence contracts/testing.md#execution-ownership This direct source unit invokes pure supplied-object operations without replacing process.env, starting workers, installing packages or running a native compiler. The real capability-worker boundary is verified separately in E2E.
 */
export function test_sidecarenvironment_replaces_worker_snapshots_with_native_name_identity(): void {
  const target: NodeJS.ProcessEnv = { NODE_OPTIONS: "stale", stale: "old" };
  const snapshot = {
    node_options: "--trace-warnings",
    ttsc_node_binary: "relative-node",
  };
  SidecarEnvironment.replace(target, snapshot);
  assert.deepEqual(snapshot, {
    node_options: "--trace-warnings",
    ttsc_node_binary: "relative-node",
  });
  assert.equal(target.stale, undefined);
  assert.equal(
    SidecarEnvironment.read(target, "NODE_OPTIONS"),
    process.platform === "win32" ? "--trace-warnings" : undefined,
  );
  assert.equal(
    SidecarEnvironment.read(target, "TTSC_NODE_BINARY"),
    process.platform === "win32" ? "relative-node" : undefined,
  );
  assert.deepEqual(
    Object.keys(target).sort(),
    process.platform === "win32"
      ? ["NODE_OPTIONS", "TTSC_NODE_BINARY"]
      : ["node_options", "ttsc_node_binary"],
  );
  for (const duplicate of [
    { node_options: "lower", NODE_OPTIONS: "upper" },
    { NODE_OPTIONS: "upper", node_options: "lower" },
  ]) {
    SidecarEnvironment.replace(target, duplicate);
    assert.equal(target.NODE_OPTIONS, "upper");
    assert.equal(
      target.node_options,
      process.platform === "win32" ? undefined : "lower",
    );
  }
  SidecarEnvironment.replace(target, {
    NODE_OPTIONS: undefined,
    node_options: "lower",
    EMPTY: "",
  });
  assert.equal(target.NODE_OPTIONS, undefined);
  assert.equal(
    target.node_options,
    process.platform === "win32" ? undefined : "lower",
  );
  assert.equal(target.EMPTY, "");
  SidecarEnvironment.replace(target, target);
  assert.equal(target.EMPTY, "");
  SidecarEnvironment.replace(target, {});
  assert.deepEqual(Object.keys(target), []);
}
