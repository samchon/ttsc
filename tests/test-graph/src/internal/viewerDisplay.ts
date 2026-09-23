import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./viewerReducers";

export { repositoryRoot } from "./viewerReducers";

/** Reads one repository file as UTF-8 text. */
const read = (root: string, file: string): string =>
  fs.readFileSync(path.join(root, file), "utf8");

/**
 * A `export type NAME = | "a" | "b"` union, read from source.
 *
 * `TtscGraphDumpEdgeKind` is the authoritative list of edges a native dump can
 * carry, so a case that feeds every edge kind through the viewer reads the list
 * from there rather than keeping a hand-maintained copy.
 */
export const dumpVocabulary = (
  root: string,
  file: string,
  name: string,
): string[] => {
  const source = read(root, file);
  const start = source.indexOf(`export type ${name}`);
  assert.notEqual(start, -1, `${file} no longer declares ${name}`);
  const kinds = [...source.slice(start).matchAll(/\|\s*"([a-z_]+)"/g)].map(
    (match) => match[1]!,
  );
  assert.ok(kinds.length > 0, `${name} parsed as an empty union`);
  return kinds;
};

/**
 * The slice of the DOM the bundled viewer's legend renders through.
 *
 * Declared here rather than imported from
 * `packages/graph/src/viewer/legend.ts`, because this package's `rootDir` is
 * its own `src`. The stub is not checked against the production type, and does
 * not need to be: a stub that stopped matching would make `getElementById` miss
 * and the render produce nothing, which the case asserts against.
 */
export interface LegendElement {
  className: string;
  style: { background: string };
  append(...nodes: unknown[]): void;
  prepend(...nodes: unknown[]): void;
}

/** The slice of `document` the legend needs. */
export interface LegendDocument {
  getElementById(id: string): LegendElement | null;
  createElement(tag: string): LegendElement;
}

/** The bundled viewer's display module, loaded the way the reducers are. */
export const loadLegendModule = async (): Promise<{
  LINK_COLORS: Record<string, string>;
  NODE_COLORS: Record<string, string>;
  UNKNOWN_LINK_COLOR: string;
  UNKNOWN_NODE_COLOR: string;
  renderLegend: (host: LegendDocument) => void;
}> => {
  const url = pathToFileURL(
    path.join(repositoryRoot(), "packages/graph/src/viewer/legend.ts"),
  ).href;
  const module = (await import(url)) as {
    LINK_COLORS?: Record<string, string>;
    renderLegend?: (host: LegendDocument) => void;
  };
  if (module.LINK_COLORS === undefined || module.renderLegend === undefined)
    assert.fail(
      "packages/graph/src/viewer/legend.ts exports the display module",
    );
  return module as never;
};
