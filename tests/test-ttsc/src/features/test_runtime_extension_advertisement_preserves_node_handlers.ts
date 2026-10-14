import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { advertiseTypeScriptExtensions } from "../../../../packages/ttsc/src/launcher/internal/runtime/advertiseTypeScriptExtensions";

/**
 * Verifies source-extension advertisement preserves native and foreign
 * handlers.
 *
 * Consumers inspect extension keys before resolution, while the installed
 * public hooks supply the compiled source. The registry needs capability
 * entries without a replacement loader or reordered native extensions.
 *
 * 1. Advertise into an owned copy of Node's native registry.
 * 2. Compare handler identities, key order and a repeated advertisement.
 * 3. Repeat with another loader's existing source handlers.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production advertisement with owned registries and observes keys and exact handler identities; catches absent capability signals, replaced handlers and reordered native precedence.
 * @evidence contracts/testing.md#independent-expectations Node's native extension order and JavaScript handler are the baseline; independent foreign functions must retain their exact identities and .mts remains outside process-wide CommonJS advertisement.
 * @evidence contracts/testing.md#distinguishing-cases Missing .ts/.tsx/.cts entries are appended once, each existing source handler stays unchanged, an unrelated handler survives and .mts is not added. The input native registry is never modified by this unit.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes the helper directly with owned registry objects without installing hooks or a host; the shared runtime detector and actual third-party acceptance own the installed process boundary.
 */
export function test_runtime_extension_advertisement_preserves_node_handlers(): void {
  const native = createRequire(import.meta.url).extensions;
  const nativeBefore = { ...native };
  const javascript = native[".js"]!;
  const foreign = () => undefined;
  const unrelated = () => undefined;
  const nativeEntries = { ...native };
  for (const extension of [".ts", ".tsx", ".cts", ".mts"])
    delete nativeEntries[extension];
  for (const supplied of [
    {},
    { ".ts": foreign },
    { ".tsx": foreign },
    { ".cts": foreign },
    { ".ts": foreign, ".tsx": foreign, ".cts": foreign },
  ]) {
    const extensions: NodeJS.RequireExtensions = {
      ...nativeEntries,
      ".custom": unrelated,
      ...supplied,
    };
    const before = { ...extensions };
    advertiseTypeScriptExtensions(extensions);
    for (const extension of [".ts", ".tsx", ".cts"])
      assert.equal(extensions[extension], before[extension] ?? javascript);
    assert.deepEqual(
      Object.keys(extensions).slice(0, Object.keys(before).length),
      Object.keys(before),
    );
    assert.equal(extensions[".custom"], unrelated);
    assert.equal(Object.hasOwn(extensions, ".mts"), false);
    const advertised = { ...extensions };
    advertiseTypeScriptExtensions(extensions);
    assert.deepEqual(extensions, advertised);
  }
  assert.deepEqual({ ...native }, nativeBefore);
}
