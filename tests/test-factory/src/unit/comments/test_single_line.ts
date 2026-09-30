import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, addSyntheticLeadingComment } from "../../../../../packages/factory/src/index";

import { kw, print } from "../../internal/helpers";

const alias = () =>
  factory.createTypeAliasDeclaration(
    undefined,
    "ID",
    undefined,
    kw(SyntaxKind.StringKeyword),
  );

/** Shared fixture operations; the individual test exports own their assertions. */
export const singleLineFixture = { alias };
