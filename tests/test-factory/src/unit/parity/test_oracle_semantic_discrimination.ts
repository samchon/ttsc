import { TestValidator } from "@nestia/e2e";
import { structure } from "../../internal/oracle";

/**
 * Verifies differential oracle discrimination of semantic scalar fields.
 *
 * Child traversal alone omits operators, literal contents and declaration
 * modes. These independent source pairs must remain distinguishable even
 * though their child-kind trees can coincide.
 *
 * 1. Compare sources differing in one omitted scalar field.
 * 2. Require distinct signatures for every pair.
 * 3. Permit formatting parentheses while preserving optional-chain boundaries.
 *
 * @evidence contracts/testing.md#behavioral-verification structure must distinguish unary/postfix operators, literal values, heritage modes, import/export phases and tagged raw text; equal child kinds alone must not pass a wrong printer result.
 * @evidence contracts/testing.md#independent-expectations Each literal pair denotes different TypeScript syntax or tagged-template raw data; the expected inequality is independent of the factory printer, and formatting-only twins must compare equal.
 * @evidence contracts/testing.md#distinguishing-cases Scalar-only positive differences are paired with equivalent spacing/parentheses and untagged cooked-template controls and a chain-breaking parenthesis counterexample; this tests structural discrimination rather than evaluated equivalence.
 * @evidence contracts/testing.md#execution-ownership test_oracle_semantic_discrimination calls the maintained structure parser oracle in process; the Factory unit TestExecutor discovers this one export without a native host or installed consumer.
 */
export const test_oracle_semantic_discrimination = (): void => {
  const pairs: [string, string, string][] = [
    ["prefix", "!x;", "+x;"],
    ["postfix", "x++;", "x--;"],
    ["bigint", "1n;", "2n;"],
    ["template", "`a`;", "`b`;"],
    ["regexp", "/a/;", "/b/;"],
    ["declaration", "let x = 1;", "const x = 1;"],
    ["heritage", "class A extends B {}", "class A implements B {}"],
    ["type operator", "type T = keyof A;", "type T = readonly A;"],
    ["import phase", 'import {A} from "x";', 'import type {A} from "x";'],
    ["type-only import specifier", 'import {A} from "x";', 'import {type A} from "x";'],
    ["type-only export", 'export {A} from "x";', 'export type {A} from "x";'],
    ["type-only export specifier", 'export {A} from "x";', 'export {type A} from "x";'],
    ["export assignment", "export default A;", "export = A;"],
    ["typeof import", 'type T = import("x");', 'type T = typeof import("x");'],
    ["tagged raw", "tag`a`;", "tag`\\x61`;"],
    ["optional chain boundary", "a?.b();", "(a?.b)();"],
  ];
  for (const [title, a, b] of pairs)
    TestValidator.equals(title, structure(a) === structure(b), false);
  TestValidator.equals("formatting parentheses", structure("a + (b);"), structure("a+b;"));
  TestValidator.equals("untagged cooked template escapes", structure("`a`;"), structure("`\\x61`;"));
};
