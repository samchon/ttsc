import assert from "node:assert/strict";
import path from "node:path";

import { GRAPH } from "../../internal/transform-complete/GRAPH";
import { createWatchInputUnitFixture } from "../../internal/transform-complete/createWatchInputUnitFixture";

/**
 * Verifies a file declared complete is watched only through its reported inputs
 * and the universal config chain.
 *
 * A completeness declaration transfers ownership of the file's dependency set
 * to the plugin. The graph's reachability closure from that file and its
 * global-scope files both drop, while an input the plugin reported but the
 * graph never named still registers.
 *
 * 1. Supply a literal envelope with two reported dependencies, one absent from the graph, a graph,
 *    and a completeness declaration for `src/main.ts`.
 * 2. Collect its watch inputs.
 * 3. Assert they are exactly the two reported dependencies and the universal
 *    inputs, then consume the same envelope for an unmarked sibling and assert
 *    its graph reach, global and config inputs remain.
 *
 * @evidence contracts/testing.md#behavioral-verification
 *   The real notifyWatchInputs consumes one envelope first for complete src/main.ts and then for unmarked src/other.ts. Main registers exactly its two reported dependencies plus universal inputs; other retains its own graph edge, ambient global and universal/config inputs. Keeping unread main reach, dropping the unlisted dependency or applying main's completeness to its sibling fails.
 * @evidence contracts/testing.md#independent-expectations
 *   Independent lists enumerate main's two declared paths and other's literal src/other-type.d.ts graph edge and src/ambient.d.ts global, each with the fixture's universal/config inputs. Main's unread transitive paths and ambient global are absent only from main's list. selectWatchInputs does not compute either oracle.
 * @evidence contracts/testing.md#distinguishing-cases
 *   The same envelope contrasts complete main with an unmarked sibling; an off-graph declared dependency registers only for main while graph reach and globals remain for other. The empty-dependencies and volatile variants are the sibling tests test_transformttsc_keeps_only_universal_inputs_for_a_complete_file_without_dependencies and test_transformttsc_ignores_completeness_for_a_volatile_file.
 * @evidence contracts/testing.md#execution-ownership
 *   This source unit passes the same authored success envelope to the real notifyWatchInputs twice through the fixture's addWatchFile hook over a real temporary project. These calls own per-file watch selection, not SDK envelope acquisition, generation lifetime or a native invocation count; no compiler, plugin binary or installed host runs.
 */
export function test_transformttsc_narrows_watch_inputs_for_a_file_declared_complete(): void {
  const fixture = createWatchInputUnitFixture();
  const result: Parameters<typeof fixture.collect>[0] = {
    type: "success",
    typescript: {
      "src/main.ts": "export const value = 1;",
      "src/other.ts": "export const other = 1;",
    },
    graph: GRAPH,
    dependenciesComplete: ["src/main.ts"],
    dependencies: { "src/main.ts": ["src/consulted.d.ts", "src/only-declared.d.ts"] },
    hostInputs: ["package.json", "plugin.cjs", "tsconfig.json"],
    pluginSources: { [path.join(fixture.root, "plugin-source")]: "unit-input-state" },
  };

  assert.deepEqual(
    fixture.collect(result),
    [
      path.join(fixture.root, "src/consulted.d.ts"),
      path.join(fixture.root, "src/only-declared.d.ts"),
      ...fixture.universal,
    ].sort(),
  );
  assert.deepEqual(
    fixture.collect(result, path.join(fixture.root, "src/other.ts")),
    [
      path.join(fixture.root, "src/other-type.d.ts"),
      path.join(fixture.root, "src/ambient.d.ts"),
      ...fixture.universal,
    ].sort(),
    "main's completeness does not narrow the unmarked sibling",
  );
}
