import { TestValidator } from "@nestia/e2e";
import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
  addSyntheticTrailingComment,
} from "../../../../../packages/factory/src/index";
import { kw, param, print } from "../../internal/helpers";
import { alias } from "../../internal/commentFixtures";

/**
 * Verifies leading and trailing comments coexist on one node.
 *
 * The two attachment slots must coexist without one overwriting or relocating the other.
 *
 * 1. The ID alias retains distinct before and after comments on their respective sides.
 * 2. The literal slash-star before star-slash type ID = string; slash-star after star-slash specifies ordering independently of comment accessors.
 *
 * @evidence contracts/testing.md#behavioral-verification The ID alias retains distinct before and after comments on their respective sides.
 * @evidence contracts/testing.md#independent-expectations The literal slash-star before star-slash type ID = string; slash-star after star-slash specifies ordering independently of comment accessors.
 * @evidence contracts/testing.md#distinguishing-cases Both attachment slots are populated together, detecting overwrite or shared-slot errors absent from the single-side twins.
 * @evidence contracts/testing.md#execution-ownership Factory unit TestExecutor discovers test_leading_and_trailing_comment. Calls alias, both synthetic comment adders and TsPrinter.print in one source unit case.
 */
export const test_leading_and_trailing_comment = (): void => {
  const node = alias();
  addSyntheticLeadingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    " before ",
    false,
  );
  addSyntheticTrailingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    " after ",
  );
  TestValidator.equals(
    "leading and trailing comment",
    print(node),
    "/* before */ type ID = string; /* after */",
  );
};
