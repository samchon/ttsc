import assert from "node:assert/strict";

import type { LegendDocument, LegendElement } from "../internal/viewerDisplay";
import {
  loadLegendModule,
} from "../internal/viewerDisplay";
import type { ViewerRawDump } from "../internal/viewerReducers";
import { loadViewerReducers } from "../internal/viewerReducers";

/** One dump carrying exactly one edge of each requested kind. */
const dumpOf = (kinds: readonly string[]): ViewerRawDump => {
  const nodes = kinds.flatMap((kind, index) =>
    ["from", "to"].map((end) => ({
      id: `src/${kind}_${end}.ts#s${index}${end}:function`,
      name: `s${index}${end}`,
      kind: "function",
      file: `src/${kind}_${end}.ts`,
    })),
  );
  return {
    project: "fixture",
    nodes,
    edges: kinds.map((kind, index) => ({
      from: nodes[index * 2]!.id,
      to: nodes[index * 2 + 1]!.id,
      kind,
    })),
  };
};

type StubElement = LegendElement & { children: (LegendElement | string)[] };

/** A footer element and the `document` slice the legend renders through. */
const legendHost = (): { footer: StubElement; document: LegendDocument } => {
  const element = (): StubElement => {
    const node: StubElement = {
      className: "",
      style: { background: "" },
      children: [],
      append: (...nodes: (LegendElement | string)[]): void => {
        node.children.push(...nodes);
      },
      prepend: (...nodes: (LegendElement | string)[]): void => {
        node.children.unshift(...nodes);
      },
    };
    return node;
  };
  const footer = element();
  footer.children.push("node size = connection count");
  return {
    footer,
    document: {
      getElementById: (id: string) => (id === "legend" ? footer : null),
      createElement: () => element(),
    },
  };
};

/**
 * Verifies graph viewer: one definition of the edge families.
 *
 * The vocabulary lived in five unenforced places - a display map copied into
 * three reducers, a colour map in each viewer, and a legend written out by hand
 * in the bundled viewer markup. `doc_ref` shipped with no legend entry, and
 * `exports` was drawn in the fallback colour under no legend entry. This case
 * holds the three reducers and the bundled viewer's legend to one definition, so
 * a new family cannot be half-added across them.
 *
 * 1. Reduce a dump carrying one edge of each of ten wire kinds through all three
 *    reducer copies, and require them to fold it identically.
 * 2. Require every family the reducers produce to have a colour in the bundled
 *    viewer's LINK_COLORS, and an unknown kind to pass through with none.
 * 3. Render the legend into a stub footer and require one entry per family, in
 *    order, with its swatch colour and classes, ahead of the static note, and not
 *    duplicated by a second render.
 *
 * @evidence contracts/testing.md#behavioral-verification The package, website and fixture reducer copies must each keep all ten seeded wire relationships as links and fold them to the same kind per edge; the set of folded kinds must equal the keys of the viewer's LINK_COLORS; an unknown kind must pass through unfolded and have no colour; and renderLegend must prepend one dot per LINK_COLORS entry, in order, with its colour, the classes dot and swatch, the static note kept after them, and a second render adding nothing.
 * @evidence contracts/testing.md#independent-expectations The ten wire kinds, the unknown kind and the display family of every wire kind (value-call, type-ref, doc-ref, heritage, exports) are literals written in the test from the viewer vocabulary, so a fold that is wrong in all three copies is caught. The set of families is also compared with the keys of LINK_COLORS, which detects a missing legend family but not a poor palette choice; the colours themselves are owned by the unknown-kinds test.
 * @evidence contracts/testing.md#distinguishing-cases Ten supported kinds contrast an unknown kind that must stay unfolded and uncoloured; swatch class, order, note placement and repeated rendering are asserted separately. The website and benchmark legend implementations are not rendered, only the bundled viewer's.
 * @evidence contracts/testing.md#execution-ownership Imports and runs the three reducer source files and the bundled legend module in the test process, rendering into a hand-written stub of the DOM footer; no browser, installed artifact, native build or product host is involved.
 */
export async function test_ttscgraph_viewer_edge_families_have_one_definition(): Promise<void> {
    const copies = await loadViewerReducers();
    const legend = await loadLegendModule();
    const LINK_COLORS = legend.LINK_COLORS;

    // Literal wire-contract inputs preserve every supported relationship case.
    const dumpKinds = ["exports", "calls", "accesses", "instantiates", "type_ref", "doc_ref", "extends", "implements", "overrides", "renders"];

    // Each copy folds the same dump, so the comparison is behavioral rather
    // than a text diff of three object literals.
    const families = copies.map((copy) => {
      const payload = copy.reduce(dumpOf(dumpKinds));
      assert.equal(
        payload.links?.length,
        dumpKinds.length,
        `${copy.name}: every seeded edge must survive the reduction`,
      );
      // Keyed by the edge's own endpoint rather than by position, so a copy
      // that reorders links cannot silently pass this comparison.
      return new Map(
        payload.links!.map((link) => [
          link.source.slice(4, link.source.indexOf("_from.ts")),
          link.kind,
        ]),
      );
    });

    const reference = families[0]!;
    assert.deepEqual(
      [...reference.keys()].sort(),
      [...dumpKinds].sort(),
      "the reduction did not return one link per seeded wire kind",
    );
    // The display family of each wire kind, written out from the viewer's
    // vocabulary (value calls, type references, document references, heritage
    // and exports) so a fold that is wrong in every copy is still caught.
    const expectedFamilies: [string, string][] = [
      ["accesses", "value-call"],
      ["calls", "value-call"],
      ["doc_ref", "doc-ref"],
      ["exports", "exports"],
      ["extends", "heritage"],
      ["implements", "heritage"],
      ["instantiates", "value-call"],
      ["overrides", "heritage"],
      ["renders", "value-call"],
      ["type_ref", "type-ref"],
    ];
    for (const [index, copy] of copies.entries()) {
      assert.deepEqual(
        [...families[index]!].sort(),
        expectedFamilies,
        `${copy.file} does not fold the wire kinds into the documented families`,
      );
      assert.deepEqual(
        [...families[index]!].sort(),
        [...reference].sort(),
        `${copy.file} folds the wire kinds differently from ${copies[0]!.file}`,
      );
    }

    const displayed = [...new Set(reference.values())].sort();
    assert.deepEqual(
      Object.keys(LINK_COLORS).sort(),
      displayed,
      "packages/graph/src/viewer/legend.ts LINK_COLORS does not carry exactly the families the reducers produce",
    );

    // The negative twin: an unknown kind is still passed through and is still
    // not a family, so the fallback keeps meaning "unknown".
    for (const copy of copies)
      assert.equal(
        copy.reduce(dumpOf(["not_a_real_kind"])).links?.[0]?.kind,
        "not_a_real_kind",
        `${copy.name}: an unknown kind must pass through unfolded`,
      );
    assert.equal(
      LINK_COLORS["not_a_real_kind"],
      undefined,
      "packages/graph/src/viewer/legend.ts LINK_COLORS gave an unknown kind an entry",
    );

    // The legend is built from the colour map, one entry per family.
    const host = legendHost();
    legend.renderLegend(host.document);
    const swatches = host.footer.children.filter(
      (child): child is StubElement => typeof child !== "string",
    );
    assert.deepEqual(
      swatches.map((dot) => [
        dot.children[1],
        (dot.children[0] as StubElement).style.background,
      ]),
      Object.entries(LINK_COLORS),
      "the rendered legend is not one entry per family, in order, with its colour",
    );
    // The classes are what make the entry visible: the viewer styles
    // `footer .dot` and `footer .swatch`, so a legend rendered without them is
    // in the DOM as zero-size inline spans and ships the same page as no legend.
    for (const dot of swatches) {
      assert.equal(dot.className, "dot", "a legend entry lost its class");
      assert.equal(
        (dot.children[0] as StubElement).className,
        "swatch",
        "a legend swatch lost its class, so it renders at zero size",
      );
    }

    assert.equal(
      host.footer.children[swatches.length],
      "node size = connection count",
      "the swatches must be prepended, ahead of the static note",
    );

    legend.renderLegend(host.document);
    assert.equal(
      host.footer.children.length,
      swatches.length + 1,
      "a second render duplicated the legend",
    );
  }
