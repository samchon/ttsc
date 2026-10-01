import assert from "node:assert/strict";
import path from "node:path";

import { collectEntryWatchInputs } from "../../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies the completeness declaration survives a compile through the
 * generated tsconfig.
 *
 * A bundler alias makes the adapter compile through a wrapper tsconfig in the
 * system temp directory, so the host's working directory is no longer the
 * project root and every envelope section, `dependenciesComplete` included, is
 * keyed by absolute path instead of project-relative path. A declaration the
 * adapter cannot join back to its file would silently stop narrowing, which is
 * invisible except as the cost it was meant to remove.
 *
 * 1. Create a project whose only plugin is `@ttsc/banner`.
 * 2. Collect the entry module's watch inputs with a bundler alias.
 * 3. Assert the type-only sibling is absent.
 *
 * @evidence contracts/testing.md#behavioral-verification A real banner-only transform through the @lib alias wrapper must still omit the type-only sibling from entry watch registration, exposing failure to join absolute native completeness keys back to the delivered file.
 * @evidence contracts/testing.md#independent-expectations The literal fixture sibling path identifies content the syntactic preamble cannot consume. False watchesTypeSibling independently requires narrowing; this entry does not assert universal config retention, which the no-alias banner entry owns.
 * @evidence contracts/testing.md#distinguishing-cases Alias-generated wrapper with native absolute envelope keys is this variant. The adjacent direct-config banner entry owns the baseline and retained universal inputs; wider-bound plugin combinations are covered separately.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_banner_narrows_through_the_alias_overlay in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The actual linked banner hook declares contribution completeness through the native host, and the JS adapter combines that declaration with host dependency bounds. A fabricated completeness field cannot establish the real utility host reports it under the key spelling used by this compile.
 * @evidence contracts/e2e.md#shared-execution createLinkedPluginProject shares the suite native build cache across linked utility consumers; distinct plugin sets link only when their identity differs. One banner-only consumer and one collected entry delivery serve this case; an alias changes wrapper input rather than installing another plugin.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The fixture allocates a unique physical root and alias target under its src; shared producer code is unchanged. The collection helper creates a fresh watch array and performs one uncached delivery, so prior key normalization cannot hide the wrapper variant. TestProject owns paths through runner exit.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_banner_narrows_through_the_alias_overlay; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_banner_narrows_through_the_alias_overlay(): Promise<void> {
  const project = createLinkedPluginProject(["banner"]);
  const watched = await collectEntryWatchInputs(project, {
    "@lib": path.join(project.root, "src"),
  });

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `the declaration must survive the generated tsconfig's key convention; watched: ${watched.join(", ")}`,
  );
}
