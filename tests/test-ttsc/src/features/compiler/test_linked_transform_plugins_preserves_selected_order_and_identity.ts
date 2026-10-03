import assert from "node:assert/strict";

import { linkedTransformPlugins } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/linkedTransformPlugins";
import type { ITtscLoadedNativePlugin } from "../../../../../packages/ttsc/src/structures/internal/ITtscLoadedNativePlugin";

/**
 * Verifies linked transform selection keeps the caller's descriptor identities.
 *
 * A linked check source and an executable transform own different host roles;
 * neither belongs in a manifest of linked transform libraries.
 *
 * 1. Interleave two linked transforms with both neighboring ownership kinds.
 * 2. Require the authored transform order and each original object identity.
 * 3. Require an empty result for no descriptors or only excluded descriptors.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual linkedTransformPlugins collector and its ownership predicate, asserting selected descriptors, reference identity and unchanged input order rather than predicting the manifest through another filter.
 * @evidence contracts/testing.md#independent-expectations Two authored transform/linked descriptors are the literal accepted population. A check/linked descriptor lacks transform stage, and transform/executable lacks linked ownership; expected arrays list these contract distinctions independently of the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Interleaved accepted pairs establish order and identity, each adjacent stage/kind rejection is exercised, and empty/all-rejected input require empty arrays. The sidecar environment case separately owns publication and inherited payload clearing.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes the exported owning collector on full typed descriptor data. It starts no producer or host, reads no fixture filesystem and does not install a consumer.
 */
export function test_linked_transform_plugins_preserves_selected_order_and_identity(): void {
  const descriptor = (
    name: string,
    stage: ITtscLoadedNativePlugin["stage"],
    kind: ITtscLoadedNativePlugin["kind"],
  ): ITtscLoadedNativePlugin => ({
    binary: `${name}-host`,
    config: { name },
    kind,
    name,
    source: `${name}-source`,
    stage,
  });
  const first = descriptor("first", "transform", "linked");
  const check = descriptor("check", "check", "linked");
  const executable = descriptor("executable", "transform", "executable");
  const second = descriptor("second", "transform", "linked");
  const input = [first, check, executable, second];
  const selected = linkedTransformPlugins(input);
  assert.deepEqual(selected, [first, second]);
  assert.equal(selected[0], first);
  assert.equal(selected[1], second);
  assert.deepEqual(input, [first, check, executable, second]);
  assert.deepEqual(linkedTransformPlugins([check]), []);
  assert.deepEqual(linkedTransformPlugins([executable]), []);
  assert.deepEqual(linkedTransformPlugins([]), []);
}
