import { TestValidator } from "@nestia/e2e";
import factory, { SyntaxKind, addSyntheticLeadingComment } from "../../../../../packages/factory/src/index";

import { kw, print } from "../../internal/helpers";

/** The exact JSDoc body shape produced by codegen callers (`@nestia/migrate`). */
const jsdoc = (description: string): string =>
  ["*", ` * ${description}`, ""].join("\n");

/** Shared fixture operations; the individual test exports own their assertions. */
export const jsdocFixture = { jsdoc };
