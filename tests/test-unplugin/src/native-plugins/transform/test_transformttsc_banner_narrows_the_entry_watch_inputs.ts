import assert from "node:assert/strict";
import path from "node:path";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies a preamble plugin's completeness declaration narrows the entry's
 * watch inputs.
 *
 * `@ttsc/banner` prepends one text derived from `banner.config.*` to every
 * file, so nothing in a sibling's content can reach the output. Its
 * declaration, made through `SourcePreamble`, the hook that never sees the
 * Program, plus the host's own syntactic printing, lets the adapter drop the
 * reference closure, while the config file, being a host input, stays
 * universal.
 *
 * 1. Create a project whose only plugin is `@ttsc/banner`.
 * 2. Collect the entry module's watch inputs.
 * 3. Assert the type-only sibling is absent while `tsconfig.json` and
 *    `banner.config.json` are present.
 *
 * @evidence contracts/testing.md#behavioral-verification collectEntryWatchInputs runs a real banner-only transform. The type-only sibling must be absent while tsconfig.json and banner.config.json remain in addWatchFile registrations, catching both lost narrowing and overaggressive removal of universal host inputs.
 * @evidence contracts/testing.md#independent-expectations SourcePreamble never reads the Program, so sibling content cannot influence its preamble, whereas the literal config does. Fixture sibling/config paths independently specify inclusion and exclusion; the helper normalizes physical identity but does not compute expected dependency closure.
 * @evidence contracts/testing.md#distinguishing-cases The omitted type-only dependency and retained compiler/plugin configs form negative/positive controls within one entry. Paths and mixed-plugin sets own wider host-bound cases elsewhere.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_banner_narrows_the_entry_watch_inputs in native-plugins/transform. This exported E2E entry owns its local scenario callbacks and assertions; the suite runner selects the native population independently of unit cases.
 * @evidence contracts/e2e.md#necessary-boundary The actual linked banner hook declares contribution completeness through the native host, and the JS adapter combines that declaration with host dependency bounds. A fabricated completeness field cannot establish the real utility host reports it under the key spelling used by this compile.
 * @evidence contracts/e2e.md#shared-execution createLinkedPluginProject shares the suite native build cache across linked utility consumers; distinct plugin sets link only when their identity differs. One banner-only consumer and one collected entry delivery serve this case; an alias changes wrapper input rather than installing another plugin.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The linked fixture uses a unique physical root to avoid short-path identity aliases influencing completeness. Its plugin/config/source stay fixed and the collection helper owns its one registration array; no supplied persistent cache is reused. Temporary consumer paths end with runner cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All assertions described above remain in test_transformttsc_banner_narrows_the_entry_watch_inputs; no case or assertion is removed or transferred. This entry retains its actual boundary checks, while synthetic fixture envelopes do not establish native compiler semantics.
 */
export async function test_transformttsc_banner_narrows_the_entry_watch_inputs(): Promise<void> {
  const project = createLinkedPluginProject(["banner"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    false,
    `a banner-only project must not register the entry's type-only sibling; watched: ${watched.join(", ")}`,
  );
  assert.ok(
    watched.includes(path.resolve(path.join(project.root, "tsconfig.json"))),
    "the config chain stays universal for a file declared complete",
  );
  assert.ok(
    watched.includes(
      path.resolve(path.join(project.root, "banner.config.json")),
    ),
    "the plugin's own config remains a universal host input",
  );
}
