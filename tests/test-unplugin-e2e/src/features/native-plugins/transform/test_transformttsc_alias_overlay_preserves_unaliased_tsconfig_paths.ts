import assert from "node:assert/strict";

import { createAliasProject } from "../../../internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../../internal/transform-alias-resolution/transformMain";

/**
 * Verifies a tsconfig-only `paths` key keeps resolving while the alias overlay
 * is active.
 *
 * The generated tsconfig replaces `paths` wholesale through `extends`
 * semantics, so the overlay must re-state the project's own mappings, or an
 * import through `#lib/*`, absent from the bundler aliases, silently resolves
 * to `any`. The probe is a deliberate type error that can only be reported if
 * the alias resolved.
 *
 * 1. Create an alias project with a tsconfig-only `#lib/*` mapping.
 * 2. Transform a source that misuses a type imported through it.
 * 3. Assert the transform rejects with the type error.
 *
 * @evidence contracts/testing.md#behavioral-verification transformMain activates a bundler alias while a type import uses the independent #lib path mapping; native compilation must reject the deliberate string assignment to Bar.flag.
 * @evidence contracts/testing.md#independent-expectations Bar.flag is declared boolean in the fixture, so literal string assignment requires /not assignable/ independently of overlay merge logic. The test has no well-typed twin and does not inspect diagnostic code/path, leaving unrelated assignability failures outside its discrimination.
 * @evidence contracts/testing.md#distinguishing-cases A tsconfig-only alias must survive an unrelated active bundler alias. The extended JSONC and manifest-preset variants own inherited-mapping boundaries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_alias_overlay_preserves_unaliased_tsconfig_paths in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary Actual wrapper config replacement meets TypeScript-Go resolution and type checking; a unit path-map merge cannot establish the native checker still sees the declared Bar type.
 * @evidence contracts/e2e.md#shared-execution One plugin-free createAliasProject and one compile use the shared built compiler artifact. Only deliberate source input is written for this connection; no native plugin installation or additional consumer preparation is needed.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique consumer/src/lib roots isolate the leaf mappings, and transformMain writes its own main source without a supplied cache. TestProject owns roots and wrappers until runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_alias_overlay_preserves_unaliased_tsconfig_paths; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_alias_overlay_preserves_unaliased_tsconfig_paths(): Promise<void> {
  const root = createAliasProject();
  await assert.rejects(
    () =>
      transformMain(
        root,
        [
          'import type { Bar } from "#lib/other";',
          'export const bad: Bar = { flag: "oops" };',
          "",
        ].join("\n"),
      ),
    /not assignable/,
  );
}
