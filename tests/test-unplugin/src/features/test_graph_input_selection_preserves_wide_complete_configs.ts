import assert from "node:assert/strict";

import { selectGraphInputs } from "../../../../packages/unplugin/src/core/transform/envelope/selectGraphInputs";

/**
 * Verifies a complete plugin input declaration contributes its full config chain
 * without a variadic expansion.
 *
 * Graph input selection must return every universal config of a complete
 * declaration regardless of width, and nothing when the compilation raised an
 * exception.
 *
 * 1. Declare zero, one and 200000 universal configs for a complete plugin
 *    declaration.
 * 2. Select graph inputs for a successful result and require exactly the declared
 *    configs.
 * 3. Select for an exception result and require no inputs.
 *
 * @evidence contracts/testing.md#behavioral-verification selectGraphInputs returns every config in original order for the complete branch and returns no inputs for an exception, including a 200000-entry config chain.
 * @evidence contracts/testing.md#independent-expectations Independently authored config paths are the complete branch's only universal graph inputs; exact length, endpoints and deep equality detect truncation, reordering or omission.
 * @evidence contracts/testing.md#distinguishing-cases Empty, singleton and wide config populations preserve their exact contents; an exception with the same graph is the negative branch. Reachability and globals belong to ordinary incomplete-input units.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry calls the authored selector with a branch-specific in-memory graph fixture; completeness excludes traversal, so it needs no identity context, compiler, install or native host.
 */
export const test_graph_input_selection_preserves_wide_complete_configs = (): void => {
  for (const size of [0, 1, 200_000]) {
    const configs = Array.from({ length: size }, (_, index) => `/project/config-${index}.json`);
    const graph = { configs } as Parameters<typeof selectGraphInputs>[0];
    const state = {} as Parameters<typeof selectGraphInputs>[1];
    const props = {
      complete: true,
      file: "/project/main.ts",
      projectRoot: "/project",
      result: { type: "success" as const, typescript: {}, graph: { edges: {}, globals: [], configs: [] } },
    };
    assert.deepEqual(selectGraphInputs(graph, state, props), configs);
    assert.deepEqual(selectGraphInputs(graph, state, {
      ...props,
      result: { type: "exception", error: new Error("authored exception control") },
    }), []);
  }
};
