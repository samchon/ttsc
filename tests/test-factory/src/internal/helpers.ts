import factory, { SyntaxKind, TsPrinter } from "@ttsc/factory";
import type {
  Expression,
  Node,
  ParameterDeclaration,
  TypeNode,
} from "@ttsc/factory";
import ts from "ts-legacy";

/** Shared default printer (80 columns, two-space indent). */
export const printer = new TsPrinter();

/** Print a node with the shared default printer. */
export const print = (node: Node): string => printer.print(node);

/** Parse printed expression source back and return its runtime value. */
export const cook = (source: string): string =>
  new Function(`return (${source});`)() as string;

/**
 * Parse printed expression source back with the legacy compiler and return the
 * top-level expression, throwing when the source does not parse cleanly as a
 * single expression statement. Round-trip oracle for parenthesizer tests: the
 * returned node's kind proves how the printed text re-binds.
 */
export const reparse = (source: string): ts.Expression => {
  const file: ts.SourceFile = ts.createSourceFile(
    "reparse.ts",
    `${source};`,
    ts.ScriptTarget.Latest,
  );
  const diagnostics: readonly ts.Diagnostic[] =
    (file as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics ?? [];
  if (diagnostics.length !== 0)
    throw new Error(
      `reparse: printed source does not parse: ${JSON.stringify(source)}`,
    );
  const statement: ts.Statement | undefined = file.statements[0];
  if (
    file.statements.length !== 1 ||
    statement === undefined ||
    !ts.isExpressionStatement(statement)
  )
    throw new Error(
      `reparse: printed source is not a single expression statement: ${JSON.stringify(source)}`,
    );
  return statement.expression;
};

/** Shorthand for {@link factory.createIdentifier}. */
export const id = (text: string) => factory.createIdentifier(text);

/** Shorthand for {@link factory.createNumericLiteral}. */
export const num = (value: string) => factory.createNumericLiteral(value);

/** Shorthand for {@link factory.createStringLiteral}. */
export const str = (value: string) => factory.createStringLiteral(value);

/** Shorthand for {@link factory.createKeywordTypeNode}. */
export const kw = (kind: SyntaxKind) => factory.createKeywordTypeNode(kind);

/** Shorthand for {@link factory.createTypeReferenceNode}. */
export const ref = (name: string) => factory.createTypeReferenceNode(name);

/** Shorthand for {@link factory.createModifier}. */
export const mod = (kind: SyntaxKind) => factory.createModifier(kind);

/** A simple `name: type` parameter declaration. */
export const param = (name: string, type: TypeNode): ParameterDeclaration =>
  factory.createParameterDeclaration(
    undefined,
    undefined,
    name,
    undefined,
    type,
    undefined,
  );

/** Wrap statements (or any nodes) as the body of an arrow for layout tests. */
export const arrowBody = (body: Expression): Node =>
  factory.createArrowFunction(
    undefined,
    undefined,
    [],
    undefined,
    undefined,
    body,
  );
