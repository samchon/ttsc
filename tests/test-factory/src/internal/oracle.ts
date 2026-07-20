import type { Node } from "@ttsc/factory";
import { TsPrinter } from "@ttsc/factory";
import ts from "ts-legacy";

/**
 * Differential oracle against the pinned legacy compiler (`ts-legacy`).
 *
 * `@ttsc/factory`'s printer re-implements the legacy printer's parenthesizer
 * and list rules, so the authority for what a tree must print as is the legacy
 * printer's own output for the same tree — never this printer's current output.
 * An expectation copied from the code under test cannot fail when that code is
 * wrong; it only records what the code did the day the test was written.
 *
 * Comparing the two texts byte for byte would compare formatting, not meaning
 * (the legacy printer writes `class A extends B {\n}` and a space before a
 * template tag). {@link structure} therefore reduces printed text to what the
 * program *means*: the parsed node-kind tree, with parentheses removed and
 * optional-chain membership recorded, so `a?.b()` and `(a?.b)()` — the same
 * characters modulo one pair of parentheses, but different programs — do not
 * compare equal.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */

/** Print a legacy (`ts-legacy`) node with the legacy printer: the oracle text. */
export const printLegacy = (node: ts.Node): string =>
  legacyPrinter.printNode(
    ts.EmitHint.Unspecified,
    node,
    ts.createSourceFile("oracle.ts", "", ts.ScriptTarget.Latest),
  );

/** Parse `text`, throwing when it does not parse cleanly. */
export const parseClean = (
  text: string,
  scriptKind: ts.ScriptKind = ts.ScriptKind.TS,
): ts.SourceFile => {
  const file: ts.SourceFile = parse(text, scriptKind);
  const diagnostics: readonly string[] = parseDiagnostics(file);
  if (diagnostics.length !== 0)
    throw new Error(
      `printed source does not parse: ${JSON.stringify(text)} :: ${diagnostics.join(" | ")}`,
    );
  return file;
};

/** Diagnostic messages the parser produced for a parsed file. */
export const parseDiagnostics = (file: ts.SourceFile): string[] =>
  (
    (file as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics ?? []
  ).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "));

/**
 * Structural signature of printed source: the node-kind tree with
 * `ParenthesizedExpression` elided and optional-chain membership marked.
 *
 * Eliding parentheses is what makes the comparison a *meaning* comparison
 * rather than a formatting one; marking chain membership is what keeps it from
 * being blind to the difference the parentheses make, since `(a?.b)()` parses
 * to a call that is not part of the chain and `a?.b()` to one that is.
 */
export const structure = (
  text: string,
  scriptKind: ts.ScriptKind = ts.ScriptKind.TS,
): string => signature(parseClean(text, scriptKind));

/** {@link structure}'s reduction, over an already-parsed node. */
export const signature = (node: ts.Node): string => {
  if (ts.isParenthesizedExpression(node)) return signature(node.expression);
  const parts: string[] = [];
  node.forEachChild((child) => void parts.push(signature(child)));
  let name: string = ts.SyntaxKind[node.kind]!;
  if (isOptionalChain(node)) name += "?";
  if (
    ts.isIdentifier(node) ||
    ts.isNumericLiteral(node) ||
    ts.isStringLiteral(node) ||
    ts.isJsxText(node)
  )
    name += `(${JSON.stringify(node.text)})`;
  return parts.length === 0 ? name : `${name}[${parts.join(",")}]`;
};

/**
 * Assert that `printed` means what the legacy printer's own output for
 * `oracle` means.
 */
export const assertOracle = (
  title: string,
  printed: string,
  oracle: ts.Node,
  scriptKind: ts.ScriptKind = ts.ScriptKind.TS,
): void => {
  const expected: string = structure(printLegacy(oracle), scriptKind);
  const actual: string = structure(printed, scriptKind);
  if (actual !== expected)
    throw new Error(
      `${title}: printed source does not mean what the oracle prints\n  printed: ${JSON.stringify(printed)}\n  oracle:  ${JSON.stringify(printLegacy(oracle))}\n  actual:   ${actual}\n  expected: ${expected}`,
    );
};

/**
 * The `children` argument the JSX runtime receives for the first element in
 * `text`, which is what a reader of the rendered page actually sees.
 *
 * JSX whitespace is not layout: a whitespace-only child containing a newline is
 * deleted and every text child is trimmed at an edge that carries a newline, so
 * this is the observable that a width-driven line break must not change.
 */
export const jsxChildren = (text: string): string => {
  const emitted: string = ts.transpileModule(text, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ESNext,
    },
    reportDiagnostics: true,
  }).outputText;
  const file: ts.SourceFile = parseClean(emitted, ts.ScriptKind.JS);
  let children: string | undefined;
  const visit = (node: ts.Node): void => {
    if (
      children === undefined &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(file) === "children"
    )
      // the signature keeps every string literal's exact text while ignoring
      // how the emitter laid the call out
      children = signature(node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return children ?? "<no children>";
};

/**
 * The V8 `SyntaxError` message for `source`, or `undefined` when it compiles.
 *
 * The TypeScript parser accepts a trailing comma after a destructuring
 * assignment's rest element and only rejects it later, so the engine — which is
 * what actually runs generated code — is the authority for that row.
 */
export const syntaxErrorOf = (source: string): string | undefined => {
  try {
    new Function(source);
    return undefined;
  } catch (error) {
    return (error as Error).message;
  }
};

/** Collect every `kind` appearing in a `@ttsc/factory` tree. */
export const kindsOf = (node: Node): Set<string> => {
  const kinds = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (typeof record.kind === "string") kinds.add(record.kind);
    for (const item of Object.values(record)) visit(item);
  };
  visit(node);
  return kinds;
};

/** Printer wide enough that no group breaks: layout is out of the way. */
export const wide = new TsPrinter({ printWidth: 200 });

const legacyPrinter: ts.Printer = ts.createPrinter({
  newLine: ts.NewLineKind.LineFeed,
});

const parse = (text: string, scriptKind: ts.ScriptKind): ts.SourceFile =>
  ts.createSourceFile(
    scriptKind === ts.ScriptKind.TSX
      ? "case.tsx"
      : scriptKind === ts.ScriptKind.JS
        ? "case.js"
        : "case.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

/**
 * Whether a parsed node is part of an optional chain, mirroring the
 * `NodeFlags.OptionalChain` the compiler sets: a `?.` link, or an access, call
 * or non-null assertion continuing one. A parenthesized head ends the chain,
 * which is exactly the distinction under test.
 */
const isOptionalChain = (node: ts.Node): boolean => {
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node) ||
    ts.isCallExpression(node)
  )
    return node.questionDotToken !== undefined || isOptionalChain(node.expression);
  if (ts.isNonNullExpression(node)) return isOptionalChain(node.expression);
  return false;
};
