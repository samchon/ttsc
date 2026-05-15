import type { TtscLintRuleOptionsMap } from "./TtscLintRuleOptions";
import type { TtscLintSeverity } from "./TtscLintSeverity";

/**
 * One rule's configuration entry.
 *
 * Accepts either a bare severity literal or a `[severity, options]`
 * tuple. The options slot's type is *picked per rule name* via
 * `TtscLintRuleOptionsMap` — so a user typing
 * `["format/sort-imports", "error", { importOrder: [...] }]` gets exact
 * autocomplete and typo detection on the options object.
 *
 * Rules that do not appear in `TtscLintRuleOptionsMap` accept only the
 * severity literal (or the bare `[severity]` tuple): the conditional
 * arm collapses to `never`, removing the options-tuple branch from the
 * union for those rules. This keeps `no-var` and friends from silently
 * accepting unrecognized option blobs.
 */
export type TtscLintRuleEntry<R extends string = string> =
  | TtscLintSeverity
  | readonly [TtscLintSeverity]
  | (R extends keyof TtscLintRuleOptionsMap
      ? readonly [TtscLintSeverity, TtscLintRuleOptionsMap[R]]
      : never);
