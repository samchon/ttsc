import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  type TypeNode,
} from "../../../../../packages/factory/src/index";
import { kw, print, ref } from "../../internal/helpers";
import { parseClean, shapeOf } from "../../internal/oracle";

/**
 * Verifies the postfix and operator type contexts leave an operand bare when
 * its binding is already tighter, so the parentheses of the sibling
 * `test_contextual_type_parentheses` are not added to everything.
 *
 * Array, indexed access, optional and rest tuple elements, `keyof` and
 * `readonly` print a type reference, a keyword, an array or a generic reference
 * as written. Wrapping those would still parse but would change the text the
 * caller asked for and hide a parenthesizer that wraps unconditionally.
 *
 * 1. Print each consumer around a bare type reference or keyword.
 * 2. Print nested postfix and operator forms that need no group: an array of an
 *    array, an array of a generic reference and `keyof` over an array.
 * 3. Compare the text with an authored literal and the legacy parse of
 *    `type T = <text>;` with an authored kind outline that holds no
 *    parenthesized type.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints each consumer around a bare operand and requires the exact text, so a parenthesizer that wrapped every operand fails each row.
 * @evidence contracts/testing.md#independent-expectations The literals follow the TypeScript type grammar (postfix `[]` and `[K]` bind tighter than `keyof` and `readonly`); each is parsed by the pinned legacy parser and its tree compared with an authored kind outline that contains no ParenthesizedType, so the oracle is the grammar and not the printer's output.
 * @evidence contracts/testing.md#distinguishing-cases Ten rows each pair a consumer with an operand that needs no group; the required-group counterparts (union, type query, function, nested operator) are owned by test_contextual_type_parentheses, so the two tests together separate wrapping from not wrapping.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry that builds nodes with the factories and prints them in process; the legacy parser is only the grammar reference and no compiler or process runs.
 */
export const test_contextual_type_operands_stay_bare_when_no_wrapping_is_needed =
  (): void => {
    const f = factory;
    const rows: { name: string; type: () => TypeNode; text: string; shape: string }[] = [
      {
        name: "array of a reference",
        type: () => f.createArrayTypeNode(ref("A")),
        text: "A[]",
        shape: "ArrayType(TypeReference(Identifier))",
      },
      {
        name: "array of a keyword",
        type: () => f.createArrayTypeNode(kw(SyntaxKind.StringKeyword)),
        text: "string[]",
        shape: "ArrayType(StringKeyword)",
      },
      {
        name: "indexed access on a reference",
        type: () => f.createIndexedAccessTypeNode(ref("A"), ref("K")),
        text: "A[K]",
        shape:
          "IndexedAccessType(TypeReference(Identifier),TypeReference(Identifier))",
      },
      {
        name: "optional tuple element",
        type: () => f.createTupleTypeNode([f.createOptionalTypeNode(ref("A"))]),
        text: "[A?]",
        shape: "TupleType(OptionalType(TypeReference(Identifier)))",
      },
      {
        name: "rest tuple element",
        type: () => f.createTupleTypeNode([f.createRestTypeNode(ref("A"))]),
        text: "[...A]",
        shape: "TupleType(RestType(TypeReference(Identifier)))",
      },
      {
        name: "keyof a reference",
        type: () => f.createTypeOperatorNode(SyntaxKind.KeyOfKeyword, ref("A")),
        text: "keyof A",
        shape: "TypeOperator(TypeReference(Identifier))",
      },
      {
        name: "readonly array",
        type: () =>
          f.createTypeOperatorNode(
            SyntaxKind.ReadonlyKeyword,
            f.createArrayTypeNode(ref("A")),
          ),
        text: "readonly A[]",
        shape: "TypeOperator(ArrayType(TypeReference(Identifier)))",
      },
      {
        name: "array of an array",
        type: () => f.createArrayTypeNode(f.createArrayTypeNode(ref("A"))),
        text: "A[][]",
        shape: "ArrayType(ArrayType(TypeReference(Identifier)))",
      },
      {
        name: "array of a generic reference",
        type: () =>
          f.createArrayTypeNode(f.createTypeReferenceNode("Array", [ref("A")])),
        text: "Array<A>[]",
        shape:
          "ArrayType(TypeReference(Identifier,TypeReference(Identifier)))",
      },
      {
        name: "keyof over an array",
        type: () =>
          f.createTypeOperatorNode(
            SyntaxKind.KeyOfKeyword,
            f.createArrayTypeNode(ref("A")),
          ),
        text: "keyof A[]",
        shape: "TypeOperator(ArrayType(TypeReference(Identifier)))",
      },
    ];
    for (const row of rows) {
      TestValidator.equals(row.name, print(row.type()), row.text);
      const alias = parseClean(`type T = ${row.text};`).statements[0] as unknown as {
        type: Parameters<typeof shapeOf>[0];
      };
      TestValidator.equals(
        `${row.name}: the literal parses to the intended tree`,
        shapeOf(alias.type),
        row.shape,
      );
    }
  };
