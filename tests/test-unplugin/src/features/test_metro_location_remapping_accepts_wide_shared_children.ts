import assert from "node:assert/strict";
import path from "node:path";

import { remapAstLocations } from "../../../../packages/metro/src/core/remapAstLocations";

/**
 * Verifies location remapping traverses wide arrays of shared AST children once
 * without a variadic expansion.
 *
 * A node shared by many parents must be remapped exactly once, however many
 * references the array holds, and a node whose map names another source must stay
 * untouched.
 *
 * 1. Remap an AST whose body holds zero, one and 200000 references to one shared
 *    node and require the node to be shifted exactly once.
 * 2. Remap a node against a map for a different source and require its location
 *    unchanged.
 *
 * @evidence contracts/testing.md#behavioral-verification remapAstLocations rewrites the shared child's two source positions from generated line one to original line five in singleton and 200000-child AST populations; an empty population leaves the unattached child at line one.
 * @evidence contracts/testing.md#independent-expectations Source-map VLQ AAIA independently encodes source zero, original zero-based line four and column zero; Babel's one-based position must therefore become line five exactly once.
 * @evidence contracts/testing.md#distinguishing-cases Empty arrays leave the unattached node unchanged, singleton and wide aliased arrays remap once, and a map naming another source retains the original location.
 * @evidence contracts/testing.md#execution-ownership This exported source-unit entry directly invokes Metro's authored AST remapper on in-memory fixtures and native absolute path spellings; it starts no Metro process, compiler or installed consumer.
 */
export const test_metro_location_remapping_accepts_wide_shared_children = (): void => {
  const file = path.resolve("wide-location-fixture.ts");
  for (const size of [0, 1, 200_000]) {
    const node = { loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } } };
    const ast = { body: Array(size).fill(node) };
    remapAstLocations(ast, { mappings: "AAIA", sources: [file] }, file);
    assert.deepEqual(node.loc, {
      start: { line: size === 0 ? 1 : 5, column: 0 },
      end: { line: size === 0 ? 1 : 5, column: 0 },
    });
  }
  const unmatched = { loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } } };
  remapAstLocations(unmatched, { mappings: "AAIA", sources: [path.resolve("other-source.ts")] }, file);
  assert.equal(unmatched.loc.start.line, 1);
};
