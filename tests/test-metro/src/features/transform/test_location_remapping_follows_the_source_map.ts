import assert from "node:assert/strict";
import path from "node:path";

import { remapAstLocations } from "../../../../../packages/metro/src/core/remapAstLocations";

/**
 * Verifies Metro's AST location remapper moves each Babel position back to the
 * authored text the source map names, and withdraws a position it cannot place.
 *
 * Metro derives the module's source map from the AST's `loc` values, so a
 * position left pointing into the ttsc-printed text puts breakpoints and stack
 * traces on the wrong line, and a position invented for generated code points
 * at text the author never wrote. Babel lines are one-based and map lines are
 * zero-based, which is why a hand-encoded map is used here.
 *
 * 1. Remap nodes whose endpoints fall on the first, between and after the two
 *    segments of one generated line, and on a later generated line.
 * 2. Remap nodes starting on an unmapped segment, a segment of another source
 *    and a line the map does not have.
 * 3. Remap a node whose mapped end precedes its start and a cyclic AST.
 *
 * @evidence contracts/testing.md#behavioral-verification remapAstLocations is called on in-memory ASTs against the map "AAAA,KAAK;AAEL;A;ACAA" (generated line 1: columns 0 and 5 to authored line 1 columns 0 and 5; line 2 to authored line 3; line 3 an unmapped segment; line 4 a segment of a second source) and the resulting loc of each node is compared with a literal.
 * @evidence contracts/testing.md#independent-expectations The map is encoded by hand from the Source Map v3 base64 VLQ rules (A=0, K=+5, E=+2, L=-5, C=+1) and the expected lines and columns are the authored positions those numbers denote plus one for Babel's one-based lines; nothing is computed by the remapper under test.
 * @evidence contracts/testing.md#distinguishing-cases Positive: columns 2 and 7 select the earlier and the later segment by greatest lower bound, a later generated line maps to its own authored line and extra loc fields survive. Negative: an unmapped segment, a segment of another source and a line past the map set loc to null, and a map naming a different file leaves the AST untouched. Boundary: a mapped end before its start clamps to the start, and a self-referencing node terminates.
 * @evidence contracts/testing.md#execution-ownership Unit layer: calls the authored remapAstLocations from source on in-memory objects and a real absolute path identity; no Metro process, compiler or installed consumer starts.
 */
export const test_location_remapping_follows_the_source_map = (): void => {
  const file = path.resolve("remap-fixture.ts");
  const other = path.resolve("remap-other.ts");
  const map = { mappings: "AAAA,KAAK;AAEL;A;ACAA", sources: [file, other] };
  const at = (line: number, column: number) => ({ line, column });
  const node = (
    start: { line: number; column: number },
    end: { line: number; column: number },
    extra: object = {},
  ): { loc: unknown; self?: unknown } => ({ loc: { start, end, ...extra } });

  const betweenSegments = node(at(1, 2), at(1, 7), { filename: "kept.ts" });
  const laterLine = node(at(2, 4), at(2, 9));
  const unmapped = node(at(3, 1), at(3, 2));
  const foreignSegment = node(at(4, 0), at(4, 1));
  const pastTheMap = node(at(9, 0), at(9, 1));
  const reversedEnd = node(at(1, 5), at(1, 0));
  const withoutLoc: { value: number } = { value: 1 };
  const cyclic = node(at(1, 0), at(1, 5));
  cyclic.self = cyclic;
  const ast = {
    body: [
      betweenSegments,
      laterLine,
      unmapped,
      foreignSegment,
      pastTheMap,
      reversedEnd,
      withoutLoc,
      cyclic,
    ],
  };

  remapAstLocations(ast, map, file);

  assert.deepEqual(betweenSegments.loc, {
    start: at(1, 0),
    end: at(1, 5),
    filename: "kept.ts",
  });
  assert.deepEqual(laterLine.loc, { start: at(3, 0), end: at(3, 0) });
  assert.equal(unmapped.loc, null, "an unmapped segment has no authored text");
  assert.equal(foreignSegment.loc, null, "another source is not the file");
  assert.equal(pastTheMap.loc, null, "a line past the map is unplaced");
  assert.deepEqual(
    reversedEnd.loc,
    { start: at(1, 5), end: at(1, 5) },
    "a mapped end before the start clamps to the start",
  );
  assert.deepEqual(withoutLoc, { value: 1 });
  assert.deepEqual(cyclic.loc, { start: at(1, 0), end: at(1, 5) });

  const untouched = node(at(1, 2), at(1, 7));
  remapAstLocations(
    { body: [untouched] },
    { mappings: map.mappings, sources: [other] },
    file,
  );
  assert.deepEqual(untouched.loc, { start: at(1, 2), end: at(1, 7) });
};
