import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./viewerReducers";

export { repositoryRoot } from "./viewerReducers";

/**
 * Source readers for the viewer's display vocabularies.
 *
 * The maps and lists these read are production constants in modules a test
 * cannot import: the website's live in React components, and the benchmark's
 * copy sits inside a namespace. Reading them from source is also what makes a
 * claim about the _declaration_ testable — an entry whose fold is an identity,
 * or a list whose order is the only thing it carries, changes no behavior when
 * it is deleted.
 */
const read = (root: string, file: string): string =>
  fs.readFileSync(path.join(root, file), "utf8");

/** A `const NAME: Record<string, string> = { ... }` literal, read from source. */
export const readStringMap = (
  root: string,
  file: string,
  name: string,
): Record<string, string> => {
  const source = read(root, file);
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
  return Object.fromEntries(entries.map((match) => [match[1]!, match[2]!]));
};

/** A `const NAME: readonly string[] = [ ... ]` literal, read from source. */
export const readStringList = (
  root: string,
  file: string,
  name: string,
): string[] => {
  const source = read(root, file);
  const head = `const ${name}: readonly string[] = [`;
  const start = source.indexOf(head);
  assert.notEqual(start, -1, `${file} no longer declares ${name}`);
  const tail = source.slice(start + head.length);
  const close = tail.indexOf("];");
  assert.notEqual(close, -1, `${name} in ${file} is not a flat array literal`);
  const entries = [...tail.slice(0, close).matchAll(/"([\w-]+)"/g)].map(
    (match) => match[1]!,
  );
  assert.ok(entries.length > 0, `${name} in ${file} parsed as empty`);
  return entries;
};

/** An exported `const NAME = "value"` declaration, read from source. */
export const readStringConstant = (
  root: string,
  file: string,
  name: string,
): string => {
  const source = read(root, file);
  const match = new RegExp(`const ${name} = "([^"]+)"`).exec(source);
  assert.notEqual(match, null, `${file} no longer declares ${name}`);
  return match![1]!;
};

/**
 * A `export type NAME = | "a" | "b"` union, read from source.
 *
 * `TtscGraphDumpEdgeKind` and `TtscGraphDumpNodeKind` are the authoritative
 * lists of what a native dump can carry, and
 * `packages/ttsc/internal/graph/graph_kind_contracts_match_their_producers_test.go`
 * already holds each of them against the Go producer. Deriving either set any
 * other way would add a hand-maintained copy of a machine-checked fact.
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
  append(...nodes: (LegendElement | string)[]): void;
  prepend(...nodes: (LegendElement | string)[]): void;
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
