import assert from "node:assert/strict";
import path from "node:path";

import { selectPluginModuleReplaceDirectories } from "../../../../../packages/ttsc/src/plugin/internal/source/selectPluginModuleReplaceDirectories";

/**
 * Verifies local replacement selection preserves observed module boundaries.
 *
 * Supplied physical observations distinguish lexical spelling from containment.
 * They do not prove native link identity or Go's parsing of replace directives.
 *
 * 1. Contrast internal, observed internal aliases and external local targets.
 * 2. Preserve module/version/spelling and sort selected records.
 * 3. Reject nonlocal/versioned shapes and propagate observer failures.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls production-used selectPluginModuleReplaceDirectories with literal parsed records and an ordinary physical-path observer, requiring exact records/order/callback sequence, unchanged inputs and error identity.
 * @evidence contracts/testing.md#independent-expectations Authored physical identities define internal versus external membership; explicit records and event lists independently require original-root resolution, preservation of original spelling/version and lexical module/version order.
 * @evidence contracts/testing.md#distinguishing-cases Equal/internal roots and a lexically external alias observed inside are omitted; dot-relative and absolute external targets survive. Missing old/new paths, versioned new targets and bare module names are rejected without target observations. A supported native backslash spelling follows the platform syntax; failed root/target observations propagate unchanged.
 * @evidence contracts/testing.md#execution-ownership One in-process source unit supplies the actual supported observation callback without Go, child, compiler, host, fixture or monkeypatch. Supplied aliases are policy inputs, not a native realpath or module-parser certificate; selection/runtime remain unexecuted.
 */
export function test_plugin_module_replace_selection_preserves_observed_boundaries(): void {
  const root = path.resolve("plugin-module");
  const outside = path.resolve(root, "../outside");
  const alias = path.resolve(root, "../linked-internal");
  const absolute = path.resolve(root, "../absolute");
  const records = [
    { Old: { Path: "z/module", Version: "v2" }, New: { Path: "../outside" } },
    { Old: { Path: "internal" }, New: { Path: "./internal" } },
    { Old: { Path: "same-root" }, New: { Path: "./" } },
    { Old: { Path: "alias" }, New: { Path: "../linked-internal" } },
    { Old: { Path: "a/module", Version: "v1" }, New: { Path: absolute } },
    { Old: { Path: "z/module", Version: "v1" }, New: { Path: "../outside" } },
    { New: { Path: "../ignored" } },
    { Old: { Path: "missing-new" } },
    { Old: { Path: "remote" }, New: { Path: "example.com/remote" } },
    { Old: { Path: "versioned" }, New: { Path: "../ignored", Version: "v1" } },
  ];
  const before = JSON.stringify(records);
  const events: string[] = [];
  const actual = selectPluginModuleReplaceDirectories(root, records, (location) => {
    events.push(location);
    return location === alias ? path.join(root, "internal") : location;
  });
  assert.deepEqual(actual, [
    { directory: absolute, modulePath: "a/module", spelled: absolute, version: "v1" },
    { directory: outside, modulePath: "z/module", spelled: "../outside", version: "v1" },
    { directory: outside, modulePath: "z/module", spelled: "../outside", version: "v2" },
  ]);
  assert.deepEqual(events, [root, outside, path.join(root, "internal"), root, alias, absolute, outside]);
  assert.equal(JSON.stringify(records), before);
  const separatorTarget = "..\\native-outside";
  const nativeRows = [{ Old: { Path: "native" }, New: { Path: separatorTarget } }];
  const nativeEvents: string[] = [];
  const native = selectPluginModuleReplaceDirectories(root, nativeRows, (location) => {
    nativeEvents.push(location);
    return location;
  });
  assert.deepEqual(native, process.platform === "win32" ? [{ directory: path.resolve(root, separatorTarget), modulePath: "native", spelled: separatorTarget }] : []);
  assert.deepEqual(nativeEvents, process.platform === "win32" ? [root, path.resolve(root, separatorTarget)] : [root]);
  assert.deepEqual(selectPluginModuleReplaceDirectories(root, [], (location) => location), []);
  for (const stage of ["root", "target"]) {
    const failure = new Error(`authored ${stage} observation failure`);
    assert.throws(() => selectPluginModuleReplaceDirectories(root, [{ Old: { Path: "external" }, New: { Path: "../outside" } }], (location) => {
      if ((stage === "root") === (location === root)) throw failure;
      return location;
    }), (error: unknown) => error === failure);
  }
}
