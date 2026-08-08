import type { TtscEvidenceGraphTypeScriptSymbol } from "../typings/TtscEvidenceGraphTypeScriptSymbol";
import type { ITtscEvidenceGraphClaimBase } from "./ITtscEvidenceGraphClaimBase";

/**
 * A population of TypeScript declarations claiming its referenced evidence.
 *
 * JSDoc puts an evidence edge on the public declaration making the claim,
 * rather than on the file around it. Supported hosts are exported interfaces,
 * type aliases, classes, namespaces, functions, data variables, type
 * properties, and the public class member forms documented by
 * {@link TtscEvidenceGraphTypeScriptSymbol}.
 *
 * Both `@evidence <target> <reason>` and `@evidenceExclude <target> <reason>`
 * require a target and a non-empty explanation. Ownership evidence must sit on
 * a host selected by {@link symbol}. An exclusion may instead sit on any
 * supported public export in the matching {@link files}, without changing the
 * target scope this claim excludes.
 */
export interface ITtscEvidenceGraphTypeScriptClaim extends ITtscEvidenceGraphClaimBase<"typescript"> {
  /**
   * Directory whose TypeScript population {@link files} select.
   *
   * A relative root resolves from the active `ttsc` project root, so a monorepo
   * package can select an explicitly included sibling with `../api`.
   *
   * This property does not add files to the TypeScript Program and never scans
   * the directory. Only source files already supplied by `ttsc` can match, so
   * the owning `tsconfig` must include the rooted population explicitly.
   */
  root?: string;

  /**
   * Root-relative glob patterns for TypeScript files in the active `ttsc`
   * Program that must cite the referenced evidence. A matching file outside the
   * Program is not available to the rule and does not count as a match.
   *
   * For example, `src/**` selects the complete source subtree, while
   * `scripts/check-?.ts` selects `check-a.ts` but not `check-ab.ts`.
   */
  files: string[];

  /**
   * TypeScript symbol kind or kinds eligible to host this claim's ownership
   * evidence.
   *
   * Omit this property to select exported type, function, and property symbols.
   * A single value selects one kind; a non-empty array selects the union of its
   * kinds. A mixed variable statement containing callable and data declarations
   * can host both function and property claims. `@evidenceExclude` may use any
   * supported public export in a matching file as a central carrier regardless
   * of this selector. A JSDoc block on an unsupported or unexported declaration
   * does not satisfy either form.
   *
   * @default ["type", "function", "property"]
   */
  symbol?:
    | TtscEvidenceGraphTypeScriptSymbol
    | TtscEvidenceGraphTypeScriptSymbol[];
}
