import assert from "node:assert/strict";

import * as legend from "../../../../packages/graph/src/viewer/legend";
import website from "../../../../website/src/components/graph/TtscWebsiteGraphViewerModel";
import { loadViewerReducers } from "../internal/viewerReducers";

/**
 * Verifies unknown relationship names and both viewers' palette fallbacks.
 *
 * Object prototype names must remain unknown data rather than inherited map
 * values that corrupt the payload or replace a color with a function.
 *
 * 1. Reduce known and unknown kinds through all three authored copies.
 * 2. Preserve the literal unknown names through JSON serialization.
 * 3. Check both palettes' fallback and known colors independently.
 *
 * @evidence contracts/testing.md#behavioral-verification All three authored reducers preserve unknown literal kinds through JSON serialization; both authored viewer palettes yield their explicit fallback colors for unknown node and link kinds.
 * @evidence contracts/testing.md#independent-expectations Literal expected folded and unknown names plus separately stated fallback colors determine results without reading the display mapping implementation.
 * @evidence contracts/testing.md#distinguishing-cases Known calls and exports contrast an ordinary unknown name and all three inherited Object names; both palettes retain known colors and enumerate only declared entries.
 * @evidence contracts/testing.md#execution-ownership This named source unit imports real pure reducer and palette sources without a browser, installed artifact, native producer or benchmark campaign.
 */
export async function test_ttscgraph_viewer_unknown_kinds_keep_literal_strings_and_fallback_colors(): Promise<void> {
  const kinds = ["calls", "exports", "new_relation", "__proto__", "constructor", "toString"];
  const expected = ["value-call", "exports", ...kinds.slice(2)];
  const failures: unknown[] = [];
  const check = (assertion: () => void): void => { try { assertion(); } catch (error) { failures.push(error); } };
  for (const copy of await loadViewerReducers()) {
    try {
      const payload = copy.reduce({
        project: "fixture",
        nodes: [{ id: "src/from.ts#f:function", name: "f", kind: "function", file: "src/from.ts" }, { id: "src/to.ts#g:function", name: "g", kind: "function", file: "src/to.ts" }],
        edges: kinds.map((kind) => ({ from: "src/from.ts#f:function", to: "src/to.ts#g:function", kind })),
      });
      check(() => assert.deepEqual(payload.links?.map((link) => link.kind), expected, copy.name));
      check(() => assert.deepEqual(JSON.parse(JSON.stringify(payload)).links.map((link: { kind: string }) => link.kind), expected, `${copy.name}: JSON`));
    } catch (error) { failures.push(error); }
  }
  for (const [name, palette, nodeFallback, linkFallback, knownNode, knownLink] of [
    ["package", legend, "#565f6b", "#ffffff55", "#36e2ee", "#3fb950"],
    ["website", website, "#334155", "#94a3b8", "#3178c6", "#15803d"],
  ] as const) {
    for (const kind of kinds.slice(2)) {
      try {
        check(() => assert.equal(palette.NODE_COLORS[kind] ?? palette.UNKNOWN_NODE_COLOR, nodeFallback, `${name}: node ${kind}`));
        check(() => assert.equal(palette.LINK_COLORS[kind] ?? palette.UNKNOWN_LINK_COLOR, linkFallback, `${name}: link ${kind}`));
        check(() => assert.equal(Object.keys(palette.NODE_COLORS).includes(kind), false));
        check(() => assert.equal(Object.keys(palette.LINK_COLORS).includes(kind), false));
      } catch (error) { failures.push(error); }
    }
    try {
      check(() => assert.equal(palette.NODE_COLORS.class, knownNode, `${name}: class`));
      check(() => assert.equal(palette.LINK_COLORS["value-call"], knownLink, `${name}: calls`));
    } catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, "unknown viewer kinds");
}
