import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { CommonJsRuntimeSource } from "../../../../packages/ttsc/src/launcher/internal/runtime/CommonJsRuntimeSource";

/**
 * Verifies owned requires share the caller's live extension registry.
 *
 * Native requires share one registry so later registrations affect every
 * consumer. A snapshot can preserve initial handlers while hiding later edits.
 *
 * 1. Construct two owned requires over registries with present or absent source
 *    handlers.
 * 2. Verify construction shares identity without changing registry contents.
 * 3. Register, replace and delete entries from both sides and compare the views.
 * 4. Verify missing original metadata falls back to Node's native registry.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls CommonJsRuntimeSource.create with caller-owned registries and observes shared identity plus bidirectional registration, replacement and deletion. Construction must not overwrite handlers or manufacture source-extension capabilities.
 * @evidence contracts/testing.md#independent-expectations Node's public require.extensions registration contract and caller-owned function identities require one live object, independent of the adapter's implementation. The native registry supplies the fallback identity and remains unchanged throughout the unit.
 * @evidence contracts/testing.md#distinguishing-cases Present .ts/.tsx/.cts/.mts handlers survive, absent entries remain absent, unrelated handlers survive construction, two adapters see later edits in both directions, and missing original metadata selects the native registry while callable/cache behavior remains native.
 * @evidence contracts/testing.md#execution-ownership This discoverable source unit changes only caller-owned registry objects and invokes builtins through the real callable; it replaces no native method or process registry entry. Installed global advertisement and TypeScript loading remain with runtime E2E acceptance.
 */
export function test_commonjs_runtime_source_preserves_extension_handlers(): void {
  const native = createRequire(import.meta.url);
  const nativeBefore = { ...native.extensions };
  const filename = path.resolve("owned-extension-handlers.cjs");
  const typescript = () => undefined;
  const tsx = () => undefined;
  const commonjs = () => undefined;
  const esm = () => undefined;
  const unrelated = () => undefined;
  for (const supplied of [
    { ".ts": typescript, ".tsx": tsx, ".cts": commonjs, ".mts": esm },
    {},
  ]) {
    const extensions: NodeJS.RequireExtensions = {
      ".js": native.extensions[".js"]!,
      ".json": native.extensions[".json"],
      ".node": native.extensions[".node"],
      ".custom": unrelated,
      ...supplied,
    };
    const before = { ...extensions };
    const original = Object.assign((id: string) => native(id), native, {
      extensions,
    }) as NodeJS.Require;
    const owned = CommonJsRuntimeSource.create(original, filename);
    const peer = CommonJsRuntimeSource.create(original, filename);
    assert.equal(owned.extensions, extensions);
    assert.equal(peer.extensions, extensions);
    assert.deepEqual({ ...owned.extensions }, before);
    for (const extension of [".ts", ".tsx", ".cts", ".mts"])
      assert.equal(owned.extensions[extension], before[extension], extension);
    assert.equal(owned.extensions[".custom"], unrelated);
    assert.deepEqual(extensions, before);
    extensions[".external"] = typescript;
    assert.equal(owned.extensions[".external"], typescript);
    assert.equal(peer.extensions[".external"], typescript);
    owned.extensions[".owned"] = tsx;
    assert.equal(extensions[".owned"], tsx);
    assert.equal(peer.extensions[".owned"], tsx);
    extensions[".custom"] = commonjs;
    assert.equal(owned.extensions[".custom"], commonjs);
    owned.extensions[".custom"] = esm;
    assert.equal(extensions[".custom"], esm);
    delete extensions[".external"];
    assert.equal(Object.hasOwn(owned.extensions, ".external"), false);
    delete owned.extensions[".owned"];
    assert.equal(Object.hasOwn(extensions, ".owned"), false);
    assert.equal(Object.hasOwn(peer.extensions, ".owned"), false);
  }
  const withoutMetadata = Object.assign((id: string) => native(id), native, {
    extensions: undefined,
  }) as unknown as NodeJS.Require;
  const fallback = CommonJsRuntimeSource.create(withoutMetadata, filename);
  assert.equal(fallback.extensions, native.extensions);
  assert.equal(fallback.cache, native.cache);
  assert.equal(fallback("node:path"), native("node:path"));
  assert.deepEqual({ ...native.extensions }, nativeBefore);
}
