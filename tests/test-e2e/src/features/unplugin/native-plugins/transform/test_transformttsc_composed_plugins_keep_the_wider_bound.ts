import assert from "node:assert/strict";

import { collectEntryWatchInputs } from "../../../../internal/unplugin/internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../../../internal/unplugin/internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../../../internal/unplugin/internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies a completeness declaration beside a silent plugin keeps the wider
 * watch bound.
 *
 * Completeness is per plugin and per file, and a consumer cannot attribute one
 * plugin's reported inputs back to it, so a file is complete only when every
 * contributing plugin declared it. A declaring plugin beside a silent one
 * therefore keeps the union bound, not the narrower one.
 *
 * 1. Create a project with `@ttsc/banner`, which declares completeness, and
 *    `@ttsc/paths`, which does not.
 * 2. Collect the entry module's watch inputs.
 * 3. Assert the type-only sibling is still registered.
 *
 * @evidence contracts/testing.md#behavioral-verification A real banner-plus-paths native host still registers the type-only sibling.
 * @evidence contracts/testing.md#independent-expectations The fixture imports the sibling and paths makes no completeness declaration; every contributing plugin must opt in before narrowing.
 * @evidence contracts/testing.md#distinguishing-cases One declaring plugin beside a silent plugin retains the union bound; paths-only and complete-plugin cases are complementary.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_composed_plugins_keep_the_wider_bound in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The real linked utility plugin reads consumer configuration and produces code, completeness, graph or source-map fields consumed by the built adapter. The asserted selection/output/registration cannot be established by an in-memory config or dependency-list unit alone.
 * @evidence contracts/e2e.md#shared-execution The utility fixture seeds the workspace plugin package and shares the native Go build cache; each distinct plugin/contributor set retains its own content-keyed host artifact. This case reuses its consumer and cache across configuration/content transitions where supplied; changed config options are inputs, not repeated package installations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage A real banner-plus-paths native host still registers the type-only sibling. These assertions remain in test_transformttsc_composed_plugins_keep_the_wider_bound, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_composed_plugins_keep_the_wider_bound(): Promise<void> {
  const project = createLinkedPluginProject(["banner", "paths"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    true,
    `a declaring plugin beside a silent one must keep the union bound; watched: ${watched.join(", ")}`,
  );
}
