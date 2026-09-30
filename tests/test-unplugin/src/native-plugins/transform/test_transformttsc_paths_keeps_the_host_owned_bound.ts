import assert from "node:assert/strict";

import { collectEntryWatchInputs } from "../../internal/transform-linked-completeness/collectEntryWatchInputs";
import { createLinkedPluginProject } from "../../internal/transform-linked-completeness/createLinkedPluginProject";
import { watchesTypeSibling } from "../../internal/transform-linked-completeness/watchesTypeSibling";

/**
 * Verifies a plugin that declares no completeness keeps the host-owned watch
 * bound.
 *
 * `@ttsc/paths` deliberately declares nothing: which source files the program
 * contains decides whether an alias target resolves, and the Checker decides
 * whether a bare `require` is the module loader. This negative twin also pins
 * that narrowing comes from the declaration rather than from the host stamping
 * every linked-plugin envelope.
 *
 * 1. Create a project whose only plugin is `@ttsc/paths`.
 * 2. Collect the entry module's watch inputs.
 * 3. Assert the type-only sibling is still registered.
 *
 * @evidence contracts/testing.md#behavioral-verification A real paths-only utility host registers the type-only sibling.
 * @evidence contracts/testing.md#independent-expectations The authored type import and paths absence of completeness define the reference closure independently of adapter watch derivation.
 * @evidence contracts/testing.md#distinguishing-cases Silent plugin retains host-owned closure; banner-plus-paths and declared-complete variants establish complementary bounds.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers test_transformttsc_paths_keeps_the_host_owned_bound in native-plugins/transform in the E2E population. Its local callbacks and helper-driven module matrix execute under this named entry; embedded native operations are fixture inputs, not separately selectable test hosts.
 * @evidence contracts/e2e.md#necessary-boundary The real linked utility plugin reads consumer configuration and produces code, completeness, graph or source-map fields consumed by the built adapter. The asserted selection/output/registration cannot be established by an in-memory config or dependency-list unit alone.
 * @evidence contracts/e2e.md#shared-execution The utility fixture seeds the workspace plugin package and shares the native Go build cache; each distinct plugin/contributor set retains its own content-keyed host artifact. This case reuses its consumer and cache across configuration/content transitions where supplied; changed config options are inputs, not repeated package installations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Consumer, source edits, hook counters and transform cache belong to this case; shared producer inputs remain equivalent or their changed content selects a new build key. TestProject owns its managed temporary roots through runner cleanup. This case does not explicitly reset every retained transform cache; generation disposal and runner termination bound native observer lifetime, rather than a claimed per-case cleanup.
 * @evidence contracts/e2e.md#preserved-coverage A real paths-only utility host registers the type-only sibling. These assertions remain in test_transformttsc_paths_keeps_the_host_owned_bound, with their stated fixture/oracle limits; portable decisions are not claimed covered by an unnamed unit or by a synthetic envelope alone.
 */
export async function test_transformttsc_paths_keeps_the_host_owned_bound(): Promise<void> {
  const project = createLinkedPluginProject(["paths"]);
  const watched = await collectEntryWatchInputs(project);

  assert.equal(
    watchesTypeSibling(watched, project),
    true,
    `a paths-only project must keep registering the entry's reference closure; watched: ${watched.join(", ")}`,
  );
}
