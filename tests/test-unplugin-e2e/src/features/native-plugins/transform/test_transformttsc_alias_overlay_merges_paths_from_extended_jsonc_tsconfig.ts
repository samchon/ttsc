import assert from "node:assert/strict";

import { createAliasProject } from "../../../internal/transform-alias-resolution/createAliasProject";
import { transformMain } from "../../../internal/transform-alias-resolution/transformMain";

/**
 * Verifies the alias overlay merges `paths` declared in an extended JSONC base
 * config.
 *
 * The overlay re-states the project's effective `paths` because the generated
 * tsconfig replaces them wholesale. It must walk the `extends` chain, tolerate
 * comments and trailing commas, and anchor relative targets at the declaring
 * config's directory, one level below the project root here. The probe is a
 * deliberate type error that can only be reported if the alias resolved to the
 * real type.
 *
 * 1. Create an alias project whose `paths` live in an extended JSONC base under
 *    `config/`.
 * 2. Transform a source that misuses a type imported through that alias.
 * 3. Assert the transform rejects with the type error.
 *
 * @evidence contracts/testing.md#behavioral-verification A real plugin-free compile through transformMain must reject the string-valued Bar.flag after preserving the tsconfig-only #lib alias inherited from a JSONC base under config/.
 * @evidence contracts/testing.md#independent-expectations The fixture declares Bar.flag as boolean and deliberately assigns "oops"; /not assignable/ is a language type error independent of the overlay's path computation. No valid-source twin is asserted here, so unrelated assignability failures remain an oracle limitation.
 * @evidence contracts/testing.md#distinguishing-cases Extended config directory anchoring plus JSONC comments/trailing comma and an unaliased inherited path are the owned boundaries. Leaf config and package-manifest presets have separate entries.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_alias_overlay_merges_paths_from_extended_jsonc_tsconfig in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary A generated alias wrapper reaches the actual TypeScript-Go resolver and checker through an inherited JSONC config. Parsing a paths map alone cannot prove real type identity survived wrapper replacement.
 * @evidence contracts/e2e.md#shared-execution One createAliasProject consumer with no plugins and one native compile serve this inherited-path assertion. transformMain loads the public API and writes the deliberate bad source; existing compiler artifact is shared rather than rebuilt per alias key.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique consumer/config/lib paths isolate inherited mappings; transformMain writes only this main.ts and uses no shared cache. Temporary roots and generated wrapper resources end with the runner.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_alias_overlay_merges_paths_from_extended_jsonc_tsconfig; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_alias_overlay_merges_paths_from_extended_jsonc_tsconfig(): Promise<void> {
  const root = createAliasProject({ basePathsInExtendedJsonc: true });
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
