import { TestValidator } from "@nestia/e2e";
import factory, {
  SyntaxKind,
  addSyntheticLeadingComment,
  addSyntheticTrailingComment,
} from "../../../../../packages/factory/src/index";

import { kw, param, print } from "../../internal/helpers";

const alias = () =>
  factory.createTypeAliasDeclaration(
    undefined,
    "ID",
    undefined,
    kw(SyntaxKind.StringKeyword),
  );

/** Shared fixture operations; the individual test exports own their assertions. */
export const inlineCommentFixture = { alias };
