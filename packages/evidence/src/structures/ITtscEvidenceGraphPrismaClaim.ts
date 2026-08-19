import type { TtscEvidenceGraphPrismaSymbol } from "../typings/TtscEvidenceGraphPrismaSymbol";
import type { ITtscEvidenceGraphClaimBase } from "./ITtscEvidenceGraphClaimBase";

/**
 * A Prisma schema claiming its referenced evidence.
 *
 * A schema is authored, not generated, so it can carry its own citations. This
 * is what turns "this table exists" into "this table exists because of that
 * requirement", and it is the direction a data model most needs: a column
 * nobody asked for is invisible until someone reads the whole schema against
 * the whole specification.
 *
 * Ownership declarations live in `///` documentation comments immediately above
 * their model or field. Both `@evidence <target> <reason>` and
 * `@evidenceExclude <target> <reason>` require a target and a non-empty
 * explanation.
 *
 * A triple-slash comment and a block comment both host a citation, because
 * Prisma documents a declaration with either and both reach the generated
 * client types. A double-slash line comment is discarded by Prisma itself and
 * hosts nothing — a citation written in one is reported rather than ignored,
 * because a tag that silently does nothing is the exact failure this rule
 * exists to remove.
 *
 * A comment documents the declaration that immediately follows it, which is
 * Prisma's own rule. A blank line before a top-level block detaches the comment
 * entirely, and a comment above a block attribute or a closing brace documents
 * nothing; a citation in any of those positions is reported.
 *
 * A matching claim file has one exclusion-only exception: an unattached
 * top-level `/// @evidenceExclude` run is a file-level carrier. This supports a
 * lint-only `.schema` ledger outside Prisma generation. `@evidence` in the same
 * position remains invalid.
 *
 * ```prisma
 * /// @evidence docs/requirements.md#pricing Sale price derives from this section.
 * model Sale {
 *   /// @evidence docs/requirements.md#coupons The stacking limit is stored here.
 *   coupon_limit Int
 * }
 * ```
 */
export interface ITtscEvidenceGraphPrismaClaim extends ITtscEvidenceGraphClaimBase<"prisma"> {
  /**
   * Glob patterns for the Prisma schema files that must cite the referenced
   * evidence. Every matching regular file is parsed as part of one schema
   * regardless of extension, which is what lets a lint-only `.schema` ledger
   * join the population Prisma generation never reads.
   *
   * That schema is composed of files rather than of paths. One file reached by
   * two populations, as a package installed under `node_modules` and rooted
   * again at its workspace source is, joins it once and is answered for by
   * both.
   */
  files: string[];

  /**
   * Prisma node kind or kinds eligible to host this claim's ownership evidence.
   *
   * Omit this property to select models, columns, and relations. A single value
   * selects one kind; a non-empty array selects the union of its kinds.
   *
   * The default is the widest one, because on the claiming side a selector
   * narrows where ownership evidence may sit rather than what must be covered.
   * Narrow it to `"model"` when only tables owe an answer and a column-level
   * citation should be reported as out of scope. A file-level exclusion carrier
   * is eligible independently of this selector.
   *
   * @default ["model", "column", "relation"]
   */
  symbol?: TtscEvidenceGraphPrismaSymbol | TtscEvidenceGraphPrismaSymbol[];
}
