import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, {
  SyntaxKind,
  type TypeNode,
} from "../../../../../packages/factory/src/index";
import { print } from "../../internal/helpers";
import { assertOracle, parseClean, printLegacy } from "../../internal/oracle";

const f = factory;
const l = ts.factory;

/** One operand type, built once for each printer. */
interface Operand {
  name: string;
  ttsc: () => TypeNode;
  legacy: () => ts.TypeNode;
}
/** One position that consumes an operand, built once for each printer. */
interface Consumer {
  name: string;
  ttsc: (operand: TypeNode) => TypeNode;
  legacy: (operand: ts.TypeNode) => ts.TypeNode;
}

/**
 * The pairs where this printer deliberately differs from the legacy printer's
 * text, with the text it must print. Same-kind nesting is flattened here and
 * left grouped there, and the operand of a rest element is grouped here and
 * left bare there; both parse to the same program, and the printer's choice is
 * pinned by authored literals instead of by the legacy text.
 */
const FLATTENED: Record<string, string> = {
  "union as union member": "type T = A | B | B;",
  "union as second union member": "type T = B | A | B;",
  "intersection as intersection member": "type T = A & B & B;",
};

/** Whether a consumer is the rest element, whose operand needs no group. */
const isRestElement = (title: string): boolean =>
  title.endsWith(" as rest tuple element");

/**
 * Parsed syntax of a text with every type parenthesis removed, identifiers
 * kept.
 */
const withoutTypeParentheses = (text: string): string => {
  const outline = (node: ts.Node): string => {
    if (ts.isParenthesizedTypeNode(node)) return outline(node.type);
    const children: string[] = [];
    node.forEachChild((child) => void children.push(outline(child)));
    const name: string = ts.isIdentifier(node)
      ? `Identifier(${node.text})`
      : ts.SyntaxKind[node.kind]!;
    return children.length === 0 ? name : `${name}[${children.join(",")}]`;
  };
  return outline(parseClean(text));
};

const ref = (name: string) => f.createTypeReferenceNode(name);
const lref = (name: string) => l.createTypeReferenceNode(name, undefined);

const operands: Operand[] = [
  { name: "reference", ttsc: () => ref("A"), legacy: () => lref("A") },
  {
    name: "keyword",
    ttsc: () => f.createKeywordTypeNode(SyntaxKind.StringKeyword),
    legacy: () => l.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
  },
  {
    name: "union",
    ttsc: () => f.createUnionTypeNode([ref("A"), ref("B")]),
    legacy: () => l.createUnionTypeNode([lref("A"), lref("B")]),
  },
  {
    name: "intersection",
    ttsc: () => f.createIntersectionTypeNode([ref("A"), ref("B")]),
    legacy: () => l.createIntersectionTypeNode([lref("A"), lref("B")]),
  },
  {
    name: "function type",
    ttsc: () => f.createFunctionTypeNode(undefined, [], ref("R")),
    legacy: () => l.createFunctionTypeNode(undefined, [], lref("R")),
  },
  {
    name: "constructor type",
    ttsc: () => f.createConstructorTypeNode(undefined, undefined, [], ref("R")),
    legacy: () =>
      l.createConstructorTypeNode(undefined, undefined, [], lref("R")),
  },
  {
    name: "conditional type",
    ttsc: () =>
      f.createConditionalTypeNode(ref("A"), ref("B"), ref("C"), ref("D")),
    legacy: () =>
      l.createConditionalTypeNode(lref("A"), lref("B"), lref("C"), lref("D")),
  },
  {
    name: "type query",
    ttsc: () => f.createTypeQueryNode(f.createIdentifier("v")),
    legacy: () => l.createTypeQueryNode(l.createIdentifier("v")),
  },
  {
    name: "keyof operator",
    ttsc: () => f.createTypeOperatorNode(SyntaxKind.KeyOfKeyword, ref("A")),
    legacy: () =>
      l.createTypeOperatorNode(ts.SyntaxKind.KeyOfKeyword, lref("A")),
  },
  {
    name: "array type",
    ttsc: () => f.createArrayTypeNode(ref("A")),
    legacy: () => l.createArrayTypeNode(lref("A")),
  },
];

const consumers: Consumer[] = [
  {
    name: "array element",
    ttsc: (operand) => f.createArrayTypeNode(operand),
    legacy: (operand) => l.createArrayTypeNode(operand),
  },
  {
    name: "indexed access object",
    ttsc: (operand) => f.createIndexedAccessTypeNode(operand, ref("K")),
    legacy: (operand) => l.createIndexedAccessTypeNode(operand, lref("K")),
  },
  {
    name: "optional tuple element",
    ttsc: (operand) =>
      f.createTupleTypeNode([f.createOptionalTypeNode(operand)]),
    legacy: (operand) =>
      l.createTupleTypeNode([l.createOptionalTypeNode(operand)]),
  },
  {
    name: "rest tuple element",
    ttsc: (operand) => f.createTupleTypeNode([f.createRestTypeNode(operand)]),
    legacy: (operand) => l.createTupleTypeNode([l.createRestTypeNode(operand)]),
  },
  {
    name: "keyof operand",
    ttsc: (operand) =>
      f.createTypeOperatorNode(SyntaxKind.KeyOfKeyword, operand),
    legacy: (operand) =>
      l.createTypeOperatorNode(ts.SyntaxKind.KeyOfKeyword, operand),
  },
  {
    name: "union member",
    ttsc: (operand) => f.createUnionTypeNode([operand, ref("B")]),
    legacy: (operand) => l.createUnionTypeNode([operand, lref("B")]),
  },
  {
    name: "second union member",
    ttsc: (operand) => f.createUnionTypeNode([ref("B"), operand]),
    legacy: (operand) => l.createUnionTypeNode([lref("B"), operand]),
  },
  {
    name: "intersection member",
    ttsc: (operand) => f.createIntersectionTypeNode([operand, ref("B")]),
    legacy: (operand) => l.createIntersectionTypeNode([operand, lref("B")]),
  },
  {
    name: "conditional check type",
    ttsc: (operand) =>
      f.createConditionalTypeNode(operand, ref("B"), ref("C"), ref("D")),
    legacy: (operand) =>
      l.createConditionalTypeNode(operand, lref("B"), lref("C"), lref("D")),
  },
  {
    name: "conditional extends type",
    ttsc: (operand) =>
      f.createConditionalTypeNode(ref("A"), operand, ref("C"), ref("D")),
    legacy: (operand) =>
      l.createConditionalTypeNode(lref("A"), operand, lref("C"), lref("D")),
  },
];

/**
 * Verifies the type printer's parenthesization means what the pinned legacy
 * printer's means for every operand shape in every consumer position.
 *
 * Each of ten operand types (a reference, a keyword, a union, an intersection,
 * a function type, a constructor type, a conditional type, a type query, a
 * `keyof` operator and an array) is placed in each of ten positions (an array
 * element, an indexed-access object, optional and rest tuple elements, a
 * `keyof` operand, a first and second union member, an intersection member, and
 * a conditional's check and extends types). The text this printer prints and
 * the text the legacy printer prints for the same tree must parse to the same
 * syntax, so a missing group that changes the tree and an extra group that does
 * not are both visible.
 *
 * 1. Build every operand for both printers and wrap it in each consumer.
 * 2. Print the pair under a type alias, one with TsPrinter and one with the legacy
 *    printer.
 * 3. Require the printed text to parse cleanly and to match the legacy syntax,
 *    except for the three same-kind nestings that this printer flattens, which
 *    are pinned by authored text, and the rest-element operands, which this
 *    printer groups and the legacy printer leaves bare, compared with type
 *    parentheses removed.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints the full 100-pair operand-by-consumer matrix with TsPrinter and compares each parse with the legacy printer's, so a dropped group that rebinds the type or a differing wrap fails with the pair named.
 * @evidence contracts/testing.md#independent-expectations The expected text of every pair is the pinned legacy factory's own printer output for an independently constructed legacy tree, never this printer's output; the comparison reduces both to parsed syntax with parentheses of expressions elided and type parentheses kept. The exceptions are stated: three flattened same-kind nestings are authored literals (`A | B | B`, `B | A | B`, `A & B & B`) and the rest-element operands that this printer groups (`[...(A | B)]`, valid either way under the grammar) are compared with type parentheses removed.
 * @evidence contracts/testing.md#distinguishing-cases Operands that bind tighter than a consumer (references, keywords) are contrasted with ones that bind looser (union, intersection, function, constructor, conditional, type query, `keyof`), across ten consumers that group differently (postfix, tuple, operator, union, intersection, conditional).
 * @evidence contracts/testing.md#execution-ownership Factory unit entry that prints 100 trees in process and calls the legacy printer only as the differential reference; the expression matrix is owned by test_parenthesizer_oracle_differential and no compiler or process runs.
 */
export const test_type_parenthesizer_oracle_differential = (): void => {
  const failures: Error[] = [];
  for (const consumer of consumers)
    for (const operand of operands) {
      const title = `${operand.name} as ${consumer.name}`;
      try {
        const printed: string = print(
          f.createTypeAliasDeclaration(
            undefined,
            "T",
            undefined,
            consumer.ttsc(operand.ttsc()),
          ),
        );
        const oracle: ts.Node = l.createTypeAliasDeclaration(
          undefined,
          "T",
          undefined,
          consumer.legacy(operand.legacy()),
        );
        if (title in FLATTENED) {
          TestValidator.equals(title, printed, FLATTENED[title]!);
          parseClean(FLATTENED[title]!);
        } else if (isRestElement(title)) {
          // Grouped here, bare there: the same tree once the parentheses go.
          TestValidator.equals(
            title,
            withoutTypeParentheses(printed),
            withoutTypeParentheses(printLegacy(oracle)),
          );
        } else assertOracle(title, printed, oracle);
      } catch (error) {
        failures.push(error as Error);
      }
    }
  if (failures.length !== 0)
    throw new AggregateError(
      failures,
      `type parenthesizer differs from the legacy oracle in ${failures.length} of ${consumers.length * operands.length} pairs: ${failures.map((error) => error.message.split("\n")[0]).join("; ")}`,
    );
};
