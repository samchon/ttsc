import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { LegendDocument, LegendElement } from "../internal/viewerDisplay";
import {
  dumpVocabulary,
  loadLegendModule,
  readStringMap,
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
 * The vocabulary lived in five unenforced places — a display map copied into
 * three reducers, a colour map in each viewer, and a legend written out by hand
 * in `packages/graph/src/viewer/index.html`. `doc_ref` shipped with no legend
 * entry, and `exports` was drawn in the fallback colour under no legend entry
 * and no filter row at all. This case makes the next family impossible to
 * half-add.
 *
 * 1. Reduce a dump carrying one edge of every kind a dump can hold, through all
 *    three reducer copies, and require them to fold it identically.
 * 2. Require each copy's display map to name every one of those kinds, because a
 *    fold onto a family of the same name changes nothing when deleted.
 * 3. Require every family to have a colour in both viewers and a label on the
 *    website, and an unknown kind to still pass through with none.
 * 4. Render the legend and require one entry per family, in order, with the right
 *    swatch — and require the markup to build no entry of its own.
 */
export const test_ttscgraph_viewer_edge_families_have_one_definition =
  async (): Promise<void> => {
    const root = repositoryRoot();
    const copies = await loadViewerReducers();
    const legend = await loadLegendModule();
    const LINK_COLORS = legend.LINK_COLORS;

    // The authoritative list of what a native dump can carry.
    // `packages/ttsc/internal/graph/graph_kind_contracts_match_their_producers_test.go`
    // already holds it against the Go producer, so this reads it rather than
    // deriving it again from the general union and a hand-written exclusion.
    const dumpKinds = dumpVocabulary(
      root,
      "packages/graph/src/structures/TtscGraphDumpEdgeKind.ts",
      "TtscGraphDumpEdgeKind",
    );
    assert.ok(
      dumpKinds.includes("exports"),
      "the dump vocabulary lost `exports`, the family this case was written for",
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

    // The display map itself must be total over the dump vocabulary, not merely
    // agree by accident. `exports` folds onto a family of the same name, so
    // deleting its entry changes no behavior at all — the identity fallback
    // covers it — and only the source-level claim can catch that.
    for (const copy of copies)
      assert.deepEqual(
        Object.keys(readStringMap(root, copy.file, "DISPLAY_KIND")).sort(),
        [...dumpKinds].sort(),
        `${copy.file}: DISPLAY_KIND must name every wire kind a dump can carry`,
      );

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

    const website = readStringMap(
      root,
      "website/src/components/graph/TtscWebsiteGraphViewerModel.ts",
      "LINK_COLORS",
    );
    const labels = readStringMap(
      root,
      "website/src/components/graph/TtscWebsiteGraphViewerModel.ts",
      "LINK_KIND_LABEL",
    );
    const surfaces = [
      ["packages/graph/src/viewer/legend.ts LINK_COLORS", LINK_COLORS],
      ["TtscWebsiteGraphViewerModel LINK_COLORS", website],
      ["TtscWebsiteGraphViewerModel LINK_KIND_LABEL", labels],
    ] as const;

    const displayed = [...new Set(reference.values())].sort();
    for (const [surface, map] of surfaces)
      assert.deepEqual(
        Object.keys(map).sort(),
        displayed,
        `${surface} does not carry exactly the families the reducers produce`,
      );

    // The negative twin: an unknown kind is still passed through and is still
    // not a family on any surface, so the fallback keeps meaning "unknown".
    for (const copy of copies)
      assert.equal(
        copy.reduce(dumpOf(["not_a_real_kind"])).links?.[0]?.kind,
        "not_a_real_kind",
        `${copy.name}: an unknown kind must pass through unfolded`,
      );
    for (const [surface, map] of surfaces)
      assert.equal(
        map["not_a_real_kind"],
        undefined,
        `${surface} gave an unknown kind an entry`,
      );

    // The legend is built from the colour map. Asserting only that the markup
    // names nothing is not enough: deleting the render call satisfies that and
    // ships the viewer with no legend at all, which is the regression this case
    // exists to stop.
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

    // A working legend the viewer never calls ships the same page as no legend
    // at all, and no assertion about the function can see that. The entry's own
    // source is what says the call happens, and that it happens before the
    // fetch — the reason a graph that fails to load still shows the legend.
    const entry = fs.readFileSync(
      path.join(root, "packages/graph/src/viewer/main.ts"),
      "utf8",
    );
    // Anchored to the start of a statement, so a commented-out call does not
    // satisfy it — that is exactly how the call would disappear.
    const called = /^[ \t]*renderLegend\(document\);/m.exec(entry);
    assert.notEqual(
      called,
      null,
      "packages/graph/src/viewer/main.ts never renders the legend",
    );
    const call = called!.index;
    const fetched = entry.indexOf("await fetch(");
    assert.notEqual(
      fetched,
      -1,
      "the viewer entry no longer fetches the graph",
    );
    assert.ok(
      call < fetched,
      "the legend is rendered after the fetch, so a failed load shows no legend",
    );

    // And the markup builds no entry of its own. Structural rather than
    // literal: a hand-written swatch spelled `#3FB950` or `rgb(63,185,80)`
    // evades a substring match on the colour values.
    const markup = fs.readFileSync(
      path.join(root, "packages/graph/src/viewer/index.html"),
      "utf8",
    );
    const footer = markup.slice(
      markup.indexOf("<footer"),
      markup.indexOf("</footer>"),
    );
    assert.notEqual(footer, "", "index.html no longer has the legend footer");
    for (const marker of ["swatch", "dot", "background:"])
      assert.equal(
        footer.includes(marker),
        false,
        `index.html builds a legend entry by hand (${marker}); it has to come from LINK_COLORS`,
      );
  };
