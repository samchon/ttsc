import factory, { SyntaxKind } from "../../../../packages/factory/src/index";

import { kw } from "./helpers";

/** A type alias `type ID = string;` for the synthetic comment tests to annotate. */
export const alias = () =>
  factory.createTypeAliasDeclaration(
    undefined,
    "ID",
    undefined,
    kw(SyntaxKind.StringKeyword),
  );

/** The exact JSDoc body shape produced by codegen callers (`@nestia/migrate`). */
export const jsdoc = (description: string): string =>
  ["*", ` * ${description}`, ""].join("\n");
