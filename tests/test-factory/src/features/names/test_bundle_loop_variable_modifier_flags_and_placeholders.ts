import { TestValidator } from "@nestia/e2e";

import factory, {
  SyntaxKind,
  TsPrinter,
} from "../../../../../packages/factory/src/index";
import { id, print } from "../../internal/helpers";

/**
 * Verifies bundle printing, the fixed loop variable, string literals copied
 * from names, JSX name nodes, empty placeholders and modifier-flag expansion.
 *
 * Each builder has a documented, observable result: a bundle prints its source
 * files in order separated by a blank line, the loop variable is always `_i`, a
 * copied string literal is double quoted, JSX name nodes print with their colon
 * and spread braces, placeholder nodes print nothing, and a modifier mask
 * expands to keyword tokens in a fixed order or to nothing for zero.
 *
 * 1. Print a two-file bundle and the loop variable.
 * 2. Copy an identifier into a string literal and print the JSX name nodes.
 * 3. Print the placeholder node and expand three modifier masks.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createBundle, createLoopVariable, createStringLiteralFromNode, createJsxNamespacedName, createJsxSpreadAttribute, createNotEmittedStatement and createModifiersFromModifierFlags, comparing printed text or printed modifier tokens.
 * @evidence contracts/testing.md#independent-expectations Expected texts follow each builder's documentation (blank line between files, `_i`, quoted copy, `a:b`, `{...props}`, empty output); the mask 32|4096 is the legacy Export|Const value and expands to export then const.
 * @evidence contracts/testing.md#distinguishing-cases A single and a combined mask, a zero mask, a bundle of two files, a name copied from an identifier, and empty versus non-empty printed output contrast.
 * @evidence contracts/testing.md#execution-ownership Factory unit entry calling the builders and TsPrinter in process.
 */
export const test_bundle_loop_variable_modifier_flags_and_placeholders =
  (): void => {
    const file = (name: string) =>
      factory.createSourceFile([factory.createExpressionStatement(id(name))]);
    TestValidator.equals(
      "bundle",
      new TsPrinter().print(factory.createBundle([file("a"), file("b")])),
      "a;\n\nb;\n",
    );
    TestValidator.equals(
      "loop variable",
      print(factory.createLoopVariable()),
      "_i",
    );
    TestValidator.equals(
      "string literal from an identifier",
      print(factory.createStringLiteralFromNode(id("abc"))),
      '"abc"',
    );
    TestValidator.equals(
      "jsx namespaced name",
      print(factory.createJsxNamespacedName(id("a"), id("b"))),
      "a:b",
    );
    TestValidator.equals(
      "jsx spread attribute",
      print(factory.createJsxSpreadAttribute(id("props"))),
      "{...props}",
    );
    TestValidator.equals(
      "not emitted statement",
      print(factory.createNotEmittedStatement(id("x"))),
      "",
    );
    TestValidator.equals(
      "export and const mask",
      factory.createModifiersFromModifierFlags(32 | 4096)?.map((m) => print(m)),
      ["export", "const"],
    );
    TestValidator.equals(
      "single mask",
      factory.createModifiersFromModifierFlags(256)?.map((m) => print(m)),
      ["static"],
    );
    TestValidator.equals(
      "zero mask",
      factory.createModifiersFromModifierFlags(0),
      undefined,
    );
  };
