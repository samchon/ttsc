import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { ViewerRawDump } from "../internal/viewerReducers";
import { loadViewerReducers, repositoryRoot } from "../internal/viewerReducers";

/**
 * The wire kinds that cannot reach a `ttscgraph dump`, and why. A kind absent
 * from both this table and the display map is a kind the viewer draws without
 * naming, so silence is not available here.
 */
const NOT_IN_A_DUMP: Record<string, string> = {
  contains:
    "synthesized by the TypeScript memory layer, never by the native dump",
  dispatches: "trace-only; the native dump never emits it",
};

/** The wire vocabulary, read from the type that declares it. */
const wireKinds = (root: string): string[] => {
  const source = fs.readFileSync(
    path.join(root, "packages/graph/src/structures/TtscGraphEdgeKind.ts"),
    "utf8",
  );
  const start = source.indexOf("export type TtscGraphEdgeKind");
  assert.notEqual(start, -1, "TtscGraphEdgeKind no longer declares a union");
  const kinds = [...source.slice(start).matchAll(/\|\s*"([a-z_]+)"/g)].map(
    (m) => m[1]!,
  );
  assert.ok(kinds.length > 0, "TtscGraphEdgeKind union parsed as empty");
  for (const excluded of Object.keys(NOT_IN_A_DUMP))
    assert.ok(
      kinds.includes(excluded),
      `${excluded} is excluded from the dump vocabulary but is no longer a wire kind`,
    );
  return kinds;
};

/**
 * A `const NAME: Record<string, string> = { ... }` literal, read from source.
 *
 * Read rather than imported because two of the four declarations live in
 * modules a test cannot load: the bundled viewer's entry runs `main()` against
 * a DOM on import, and the benchmark copy sits inside a namespace.
 */
const readStringMap = (
  root: string,
  file: string,
  name: string,
): Record<string, string> => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const head = `const ${name}: Record<string, string> = {`;
  const start = source.indexOf(head);
  assert.notEqual(start, -1, `${file} no longer declares ${name}`);
  const tail = source.slice(start + head.length);
  const close = tail.search(/\n[ \t]*\};/);
  assert.notEqual(close, -1, `${name} in ${file} is not a flat object literal`);
  const entries = [
    ...tail.slice(0, close).matchAll(/^\s*"?([\w-]+)"?:\s*"([^"]+)",/gm),
  ];
  assert.ok(entries.length > 0, `${name} in ${file} parsed as empty`);
  return Object.fromEntries(entries.map((m) => [m[1]!, m[2]!]));
};

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

/**
 * Verifies graph viewer: one definition of the edge families.
 *
 * The edge-family vocabulary lived in five unenforced places — a display map
 * copied into three reducers, a colour map in each viewer, and a legend written
 * out by hand in `packages/graph/src/viewer/index.html`. `doc_ref` shipped with
 * no legend entry, and `exports` was drawn in the fallback colour under no
 * legend entry and no filter row at all. This case is what makes the next
 * family impossible to half-add.
 *
 * 1. Read the wire vocabulary from `TtscGraphEdgeKind` and reduce a dump carrying
 *    one edge of every kind a dump can hold.
 * 2. Assert the three reducer copies fold every kind onto the same family, and
 *    that a kind is either folded or declared unreachable with a reason.
 * 3. Assert every family has a colour in both viewers and a label on the website,
 *    and that an unknown kind still passes through unfolded.
 * 4. Assert the bundled viewer's markup names no family and no family colour.
 */
export const test_ttscgraph_viewer_edge_families_have_one_definition =
  async (): Promise<void> => {
    const root = repositoryRoot();
    const copies = await loadViewerReducers();

    const dumpKinds = wireKinds(root).filter(
      (kind) => NOT_IN_A_DUMP[kind] === undefined,
    );
    assert.ok(
      dumpKinds.length >= 9,
      `only ${dumpKinds.length} wire kinds can reach a dump; the exclusion table is over-broad`,
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
    for (const copy of copies) {
      const map = readStringMap(root, copy.file, "DISPLAY_KIND");
      assert.deepEqual(
        Object.keys(map).sort(),
        [...dumpKinds].sort(),
        `${copy.file}: DISPLAY_KIND must name every wire kind a dump can carry`,
      );
    }

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

    const bundled = readStringMap(
      root,
      "packages/graph/src/viewer/main.ts",
      "LINK_COLORS",
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

    const displayed = [...new Set(reference.values())].sort();
    for (const [surface, map] of [
      ["packages/graph/src/viewer/main.ts LINK_COLORS", bundled],
      ["TtscWebsiteGraphViewerModel LINK_COLORS", website],
      ["TtscWebsiteGraphViewerModel LINK_KIND_LABEL", labels],
    ] as const) {
      assert.deepEqual(
        Object.keys(map).sort(),
        displayed,
        `${surface} does not carry exactly the families the reducers produce`,
      );
    }

    // The negative twin: an unknown kind is still passed through and is still
    // not a family, so the fallback colour keeps meaning "unknown".
    for (const copy of copies) {
      const payload = copy.reduce(dumpOf(["not_a_real_kind"]));
      assert.equal(
        payload.links?.[0]?.kind,
        "not_a_real_kind",
        `${copy.name}: an unknown kind must pass through unfolded`,
      );
    }
    assert.equal(
      bundled["not_a_real_kind"],
      undefined,
      "an unknown kind must not have a family colour",
    );

    // The legend is rendered from the colour map, so the markup carries no
    // family name and no family colour. Both used to be written out by hand.
    const markup = fs.readFileSync(
      path.join(root, "packages/graph/src/viewer/index.html"),
      "utf8",
    );
    const rendered = markup.slice(markup.indexOf("<body"));
    for (const family of displayed)
      assert.equal(
        rendered.includes(family),
        false,
        `index.html names the ${family} family; the legend must come from LINK_COLORS`,
      );
    for (const color of Object.values(bundled))
      assert.equal(
        rendered.includes(color),
        false,
        `index.html hardcodes the ${color} swatch; the legend must come from LINK_COLORS`,
      );
  };
