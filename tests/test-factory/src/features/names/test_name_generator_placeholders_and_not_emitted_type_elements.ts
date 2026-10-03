import { TestValidator } from "@nestia/e2e";
import ts from "ts-legacy";

import factory, {
  SyntaxKind,
  type TypeElement,
  TsPrinter,
} from "../../../../../packages/factory/src/index";
import { print } from "../../internal/helpers";
import { parseClean } from "../../internal/oracle";

const f = factory;
const member = (name: string, kind: SyntaxKind) =>
  f.createPropertySignature(undefined, name, undefined, f.createKeywordTypeNode(kind));
const alias = (...members: TypeElement[]) =>
  f.createTypeAliasDeclaration(undefined, "A", undefined, f.createTypeLiteralNode(members));

/**
 * Verifies the three stateless name generators print exactly their documented
 * placeholder names and a not-emitted type element occupies a member slot
 * without printing anything.
 *
 * `createTempVariable`, `createUniqueName` and `createUniquePrivateName` do not
 * track scopes, so equal arguments give equal names and the optional affixes
 * wrap a fixed or caller base; the private form strips one leading `#` and falls
 * back to `_unique`. A not-emitted element contributes no syntax, so no `;`
 * remains where it sits and the neighbors still parse as members.
 *
 * 1. Print each generator with no arguments, with affixes and, for the private
 *    form, with a leading `#`, an empty base and a plain base.
 * 2. Print type literals and interfaces with the placeholder in the middle, at
 *    either end, doubled and alone, including a width-driven broken literal.
 * 3. Parse each printed alias or interface with the legacy parser and read back
 *    its member names.
 *
 * @evidence contracts/testing.md#behavioral-verification Prints each generator result and each placeholder-bearing declaration and requires the exact text; the declaration texts are also parsed by the legacy parser and their member names compared, so a stray separator that would not parse fails.
 * @evidence contracts/testing.md#independent-expectations The generator literals are the documented placeholder contract (`_temp`, caller text with affixes, `#_unique`), which no legacy name generator reproduces by design; authored expected member-name arrays are compared with the independent legacy parse of the printed text.
 * @evidence contracts/testing.md#distinguishing-cases No affix against both affixes, a leading `#` against none, an empty private base against a plain one, and a placeholder in the middle against first, last, doubled and alone distinguish the assembly and the empty-slot cases.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry that calls the builders and TsPrinter in process; the legacy parser is only the grammar reference. Uniqueness is documented as not guaranteed and is therefore asserted as equal names for equal arguments.
 */
export const test_name_generator_placeholders_and_not_emitted_type_elements =
  (): void => {
    TestValidator.equals("temp variable", print(f.createTempVariable()), "_temp");
    TestValidator.equals(
      "temp variable with affixes",
      print(f.createTempVariable(undefined, false, "a", "z")),
      "a_tempz",
    );
    TestValidator.equals(
      "equal arguments give equal temp names",
      print(f.createTempVariable()) === print(f.createTempVariable()),
      true,
    );
    TestValidator.equals("unique name", print(f.createUniqueName("base")), "base");
    TestValidator.equals(
      "unique name with affixes",
      print(f.createUniqueName("base", 0, "p_", "_s")),
      "p_base_s",
    );
    TestValidator.equals(
      "private fallback",
      print(f.createUniquePrivateName()),
      "#_unique",
    );
    TestValidator.equals(
      "private base with a leading hash",
      print(f.createUniquePrivateName("#x")),
      "#x",
    );
    TestValidator.equals(
      "private empty base with affixes",
      print(f.createUniquePrivateName("", "a", "b")),
      "#a_uniqueb",
    );
    TestValidator.equals(
      "private base with affixes",
      print(f.createUniquePrivateName("x", "a", "b")),
      "#axb",
    );

    const a = member("a", SyntaxKind.StringKeyword);
    const b = member("b", SyntaxKind.NumberKeyword);
    const slot = () => f.createNotEmittedTypeElement();
    const memberNames = (text: string): string[] => {
      const declaration = parseClean(text).statements[0]!;
      const members: readonly ts.TypeElement[] = ts.isTypeAliasDeclaration(declaration)
        ? (declaration.type as ts.TypeLiteralNode).members
        : (declaration as ts.InterfaceDeclaration).members;
      return members.map((element) => (element.name as ts.Identifier).text);
    };
    const cases: { name: string; text: string; expected: string; names: string[] }[] = [
      {
        name: "placeholder between members",
        text: print(alias(a, slot(), b)),
        expected: "type A = { a: string; b: number };",
        names: ["a", "b"],
      },
      {
        name: "placeholder alone",
        text: print(alias(slot())),
        expected: "type A = {};",
        names: [],
      },
      {
        name: "placeholder first",
        text: print(alias(slot(), a)),
        expected: "type A = { a: string };",
        names: ["a"],
      },
      {
        name: "placeholder last",
        text: print(alias(a, slot())),
        expected: "type A = { a: string };",
        names: ["a"],
      },
      {
        name: "two placeholders in a row",
        text: print(alias(a, slot(), slot(), b)),
        expected: "type A = { a: string; b: number };",
        names: ["a", "b"],
      },
      {
        name: "interface holding only the placeholder",
        text: print(
          f.createInterfaceDeclaration(undefined, "I", undefined, undefined, [slot()]),
        ),
        expected: "interface I {}",
        names: [],
      },
      {
        name: "interface with the placeholder between members",
        text: print(
          f.createInterfaceDeclaration(undefined, "I", undefined, undefined, [a, slot(), b]),
        ),
        expected: "interface I {\n  a: string;\n  b: number;\n}",
        names: ["a", "b"],
      },
    ];
    for (const c of cases) {
      TestValidator.equals(c.name, c.text, c.expected);
      TestValidator.equals(`${c.name}: legacy members`, memberNames(c.text), c.names);
    }

    const long = (length: number, kind: SyntaxKind) =>
      member("a".repeat(length), kind);
    TestValidator.equals(
      "a long literal breaks without leaving a blank line",
      new TsPrinter().print(
        alias(long(31, SyntaxKind.StringKeyword), slot(), member("b".repeat(45), SyntaxKind.NumberKeyword)),
      ),
      `type A = {\n  ${"a".repeat(31)}: string;\n  ${"b".repeat(45)}: number;\n};`,
    );
  };
