import { TestValidator } from "@nestia/e2e";
import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
  getSyntheticLeadingComments,
  getSyntheticTrailingComments,
  setSyntheticLeadingComments,
  setSyntheticTrailingComments,
} from "../../../../../packages/factory/src/index";
import { print, ref } from "../../internal/helpers";
/**
 * Verifies nodes without synthesized comments print exactly as before (no regression).
 *
 * Comment support must leave a node with no attached comment unchanged.
 *
 * 1. TsPrinter.print emits the uncommented type reference X without comment delimiters or extra whitespace.
 * 2. The literal X is the TypeScript spelling of the supplied reference; it is not captured from the printer.
 *
 * @evidence contracts/testing.md#behavioral-verification TsPrinter.print emits the uncommented type reference X without comment delimiters or extra whitespace.
 * @evidence contracts/testing.md#independent-expectations The literal X is the TypeScript spelling of the supplied reference; it is not captured from the printer.
 * @evidence contracts/testing.md#distinguishing-cases This is the no-comment control for synthetic comment attachment; leading/trailing and clear transitions are covered by the adjacent comments cases.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_uncommented_node_unchanged. Calls createTypeReferenceNode through ref and TsPrinter.print in the source unit process.
 */
export const test_uncommented_node_unchanged = (): void => {
  TestValidator.equals("uncommented node", print(ref("X")), "X");
};
