import assert from "node:assert/strict";

import * as legend from "../../../../packages/graph/src/viewer/legend";
import website from "../../../../website/src/components/graph/TtscWebsiteGraphViewerModel";
import { loadViewerReducers } from "../internal/viewerReducers";

/**
 * Verifies unknown relationship names stay literal in every reducer and fall
 * back to the declared colours in both palettes.
 *
 * Object prototype names such as **proto**, constructor and toString must stay
 * ordinary unknown data, neither corrupting the payload nor being found as
 * inherited palette entries and replacing a colour with a function.
 *
 * 1. Reduce edges of kinds calls, exports, new_relation, **proto**, constructor
 *    and toString through the package, website and fixture reducers.
 * 2. Require the kinds to come out as value-call, exports and the four unknown
 *    names unchanged, also after JSON serialization.
 * 3. For the package and website palettes, require the four unknown names to
 *    resolve to the fallback node and link colours and not to be palette keys,
 *    and require class and value-call to keep their known colours.
 *
 * @evidence contracts/testing.md#behavioral-verification Each of the three reducer copies must output the link kinds ["value-call", "exports", "new_relation", "__proto__", "constructor", "toString"] for the six input kinds, and the same after JSON round-trip; in the package and website palettes NODE_COLORS and LINK_COLORS lookups for the four unknown names must fall back to UNKNOWN_NODE_COLOR and UNKNOWN_LINK_COLOR and must not appear in Object.keys, while class and value-call keep their known colours.
 * @evidence contracts/testing.md#independent-expectations The expected link kind lists and the colour values are literals authored in the test. The colour literals duplicate the palette constants, so they pin the current palette values rather than derive them independently.
 * @evidence contracts/testing.md#distinguishing-cases calls and exports (known, folded or kept) contrast new_relation (ordinary unknown) and the three inherited Object property names, which a plain-object lookup would resolve to functions; known colours are checked beside the fallbacks. The fixture benchmark copy is not covered by the palette checks, and unknown kinds in the node kind of a reduced payload are not exercised.
 * @evidence contracts/testing.md#execution-ownership Imports and runs the three reducer sources, the bundled viewer legend module and the website viewer model in the test process; no browser, installed artifact, native producer or benchmark run is involved.
 */
export async function test_ttscgraph_viewer_unknown_kinds_keep_literal_strings_and_fallback_colors(): Promise<void> {
  const kinds = [
    "calls",
    "exports",
    "new_relation",
    "__proto__",
    "constructor",
    "toString",
  ];
  const expected = ["value-call", "exports", ...kinds.slice(2)];
  const failures: unknown[] = [];
  const check = (assertion: () => void): void => {
    try {
      assertion();
    } catch (error) {
      failures.push(error);
    }
  };
  for (const copy of await loadViewerReducers()) {
    try {
      const payload = copy.reduce({
        project: "fixture",
        nodes: [
          {
            id: "src/from.ts#f:function",
            name: "f",
            kind: "function",
            file: "src/from.ts",
          },
          {
            id: "src/to.ts#g:function",
            name: "g",
            kind: "function",
            file: "src/to.ts",
          },
        ],
        edges: kinds.map((kind) => ({
          from: "src/from.ts#f:function",
          to: "src/to.ts#g:function",
          kind,
        })),
      });
      check(() =>
        assert.deepEqual(
          payload.links?.map((link) => link.kind),
          expected,
          copy.name,
        ),
      );
      check(() =>
        assert.deepEqual(
          JSON.parse(JSON.stringify(payload)).links.map(
            (link: { kind: string }) => link.kind,
          ),
          expected,
          `${copy.name}: JSON`,
        ),
      );
    } catch (error) {
      failures.push(error);
    }
  }
  for (const [
    name,
    palette,
    nodeFallback,
    linkFallback,
    knownNode,
    knownLink,
  ] of [
    ["package", legend, "#565f6b", "#ffffff55", "#36e2ee", "#3fb950"],
    ["website", website, "#334155", "#94a3b8", "#3178c6", "#15803d"],
  ] as const) {
    for (const kind of kinds.slice(2)) {
      try {
        check(() =>
          assert.equal(
            palette.NODE_COLORS[kind] ?? palette.UNKNOWN_NODE_COLOR,
            nodeFallback,
            `${name}: node ${kind}`,
          ),
        );
        check(() =>
          assert.equal(
            palette.LINK_COLORS[kind] ?? palette.UNKNOWN_LINK_COLOR,
            linkFallback,
            `${name}: link ${kind}`,
          ),
        );
        check(() =>
          assert.equal(Object.keys(palette.NODE_COLORS).includes(kind), false),
        );
        check(() =>
          assert.equal(Object.keys(palette.LINK_COLORS).includes(kind), false),
        );
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      check(() =>
        assert.equal(palette.NODE_COLORS.class, knownNode, `${name}: class`),
      );
      check(() =>
        assert.equal(
          palette.LINK_COLORS["value-call"],
          knownLink,
          `${name}: calls`,
        ),
      );
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(failures, "unknown viewer kinds");
}
