import assert from "node:assert/strict";

import type { LegendDocument, LegendElement } from "../internal/viewerDisplay";
import {
  dumpVocabulary,
  loadLegendModule,
  repositoryRoot,
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
 * The vocabulary lived in several unenforced places — a display map copied into
 * three reducers, a colour map in the bundled viewer, and a legend written out
 * by hand. `doc_ref` shipped with no legend entry, and `exports` was drawn in
 * the fallback colour under no legend entry at all. This case makes the next
 * family impossible to half-add.
 *
 * 1. Reduce a dump carrying one edge of every kind a dump can hold, through all
 *    three reducer copies, and require them to fold it identically.
 * 2. Require every family the reducers produce to have a colour in the bundled
 *    viewer, and an unknown kind to still pass through with none.
 * 3. Render the legend and require one entry per family, in order, with the right
 *    swatch.
 */
export const test_ttscgraph_viewer_edge_families_have_one_definition =
  async (): Promise<void> => {
    const root = repositoryRoot();
    const copies = await loadViewerReducers();
    const legend = await loadLegendModule();
    const LINK_COLORS = legend.LINK_COLORS;

    // The authoritative list of what a native dump can carry, read rather than
    // derived again from the general union and a hand-written exclusion.
    const dumpKinds = dumpVocabulary(
      root,
      "packages/graph/src/structures/TtscGraphDumpEdgeKind.ts",
      "TtscGraphDumpEdgeKind",
    );

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
    for (const [index, copy] of copies.entries())
      assert.deepEqual(
        [...families[index]!].sort(),
        [...reference].sort(),
        `${copy.file} folds the wire kinds differently from ${copies[0]!.file}`,
      );

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
  };
