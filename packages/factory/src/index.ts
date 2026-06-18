/**
 * Hand-written, dependency-free re-implementation of the legacy TypeScript AST
 * factory (`ts.factory`) and printer (`ts.Printer`).
 *
 * ```typescript
 * import factory, { SyntaxKind, TsPrinter } from "@ttsc/factory";
 * ```
 *
 * - `factory` — the node factory namespace (also the default export).
 * - {@link TsPrinter} — renders factory nodes to TypeScript source text.
 * - {@link SyntaxKind} / {@link NodeFlags} — token & flag enums.
 * - Outline AST types (`Expression`, `Statement`, `TypeNode`, ...).
 *
 * No `typescript` module is imported anywhere; the logic is implemented
 * directly, so this keeps working in the TypeScript-Go (tsgo) era.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export * as factory from "./factory/index";
export { SyntaxKind, NodeFlags, tokenToString } from "./syntax";
export { TsPrinter } from "./TsPrinter";
export type { TsPrinterOptions } from "./TsPrinter";
export type * from "./ast";

import * as factory from "./factory/index";

/** Outline of the legacy `ts.NodeFactory`. */
export type NodeFactory = typeof factory;

export default factory;
