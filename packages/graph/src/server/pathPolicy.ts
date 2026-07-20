import { ITtscGraphNode } from "../structures/ITtscGraphNode";

/** True for dependency declarations outside the authored project graph. */
export function isExternalNode(node: ITtscGraphNode): boolean {
  return (
    node.external ||
    node.file.startsWith("bundled://") ||
    /(^|\/)node_modules\//.test(node.file)
  );
}

/**
 * True for a `.d.ts` declaration file. Every declaration such a file holds is
 * ambient by construction, so none of them carries a body the graph can walk
 * into, whether or not the `declare` keyword is written out.
 */
export function isDeclarationFile(file: string): boolean {
  return /\.d\.[cm]?ts$/.test(file);
}

/** True for tests, examples, fixtures, generated output, and build artifacts. */
export function isSupportPath(file: string): boolean {
  return (
    file === "" ||
    file.startsWith("bundled://") ||
    /(^|\/)node_modules\//.test(file) ||
    /(^|\/)(test|tests|__tests__|spec|sample|samples|fixture|fixtures|__fixtures__|example|examples)\//.test(
      file,
    ) ||
    /\.(test|spec)\.[cm]?tsx?$/.test(file) ||
    /(^|\/)typings\.[cm]?ts$/.test(file) ||
    isDeclarationFile(file) ||
    /(^|\/)(dist|build|coverage|generated|__generated__)\//.test(file)
  );
}

/** True for source files whose declarations are tests or test helpers. */
export function isTestPath(file: string): boolean {
  return (
    /(^|\/)(test|tests|__tests__|spec)\//.test(file) ||
    /\.(test|spec)\.[cm]?tsx?$/.test(file)
  );
}

/** True when exported symbols are unlikely to be authored public API. */
export function isPublicApiNoisePath(file: string): boolean {
  return (
    isSupportPath(file) ||
    /(^|\/|\.)typings\.[cm]?ts$/.test(file) ||
    /(^|\/)internal\//.test(file)
  );
}
