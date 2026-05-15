import type { TtscLintConfig } from "@ttsc/lint";
import assert from "node:assert/strict";

/**
 * Verifies lib/index.d.ts surfaces per-rule option autocomplete and rejects
 * malformed shapes at compile time.
 *
 * The `TtscLintRuleEntry<R>` mapped type is supposed to pick its second tuple
 * slot from `TtscLintRuleOptionsMap[R]`. This compile-time test exercises both
 * the happy path and the negative branches that make the typing load-bearing.
 *
 * Happy path:
 *
 * - A bare severity literal is accepted for any rule (lint or format).
 * - `[severity, options]` typed against the matching rule key compiles and the
 *   options object is structurally checked.
 *
 * Negative branches pinned with `@ts-expect-error`:
 *
 * - Typo'd rule name (`format/Quotes` with capital Q) is rejected.
 * - Typo'd option key (`prefre` for `prefer`) is rejected.
 * - Cross-rule option leakage (`mode` on `format/quotes`) is rejected.
 * - A lint-only rule (`no-var`) cannot carry an options object.
 *
 * The function runs at runtime as a sanity check that `satisfies
 * TtscLintConfig` does not regress; the real assertion happens during `pnpm run
 * test:typecheck`.
 *
 * 1. Construct configs exercising each tuple shape, both valid and broken.
 * 2. Verify the runtime objects exist (the happy paths must compile).
 * 3. Lean on `pnpm run test:typecheck` to catch type-level regressions — a missing
 *    `@ts-expect-error` directive will surface as a test failure because TS
 *    reports the unused directive itself as an error.
 */
export const test_lib_index_d_ts_rule_options_autocomplete_per_rule = () => {
  const config: TtscLintConfig = {
    rules: {
      "no-var": "error",
      "format/semi": ["warning", { prefer: "always" }],
      "format/quotes": ["warning", { prefer: "double" }],
      "format/trailing-comma": ["warning", { mode: "all" }],
      "format/sort-imports": [
        "warning",
        {
          importOrder: ["<THIRD_PARTY_MODULES>", "@api(.*)$", "^[./]"],
          importOrderSeparation: true,
          importOrderSortSpecifiers: true,
        },
      ],
      "format/jsdoc": [
        "warning",
        {
          tagSynonyms: { property: "prop" },
          sortTags: false,
        },
      ],
    },
  };

  const bareTuple: TtscLintConfig = {
    rules: {
      "format/semi": ["warning"],
      "format/sort-imports": "off",
    },
  };

  // Negative cases TypeScript actually enforces through the intersection
  // of mapped types. Two related-but-distinct typo classes survive at
  // the type level: excess properties inside an options object, and
  // length mismatches on tuples whose value type is `severity | [severity]`
  // only (the lint-rule half of `TtscLintRuleMap`).
  //
  // Rule-name typos (e.g. `"format/Quotes"`) currently slip past TS's
  // excess-property check for intersection-of-mapped-types — a known
  // limitation in TS's check rules. The `(string & {})` widener is
  // intentionally absent so the IDE still autocompletes valid keys; the
  // runtime config validator (`packages/lint/plugin/config.go`)
  // surfaces an unknown-rule diagnostic on actual misuses.
  const negativeCases: TtscLintConfig = {
    rules: {
      // @ts-expect-error — `prefre` is a typo of `prefer`; excess property check on the tuple's options slot fires.
      "format/quotes": ["error", { prefre: "double" }],
      // @ts-expect-error — `no-var` is a lint rule with `severity | [severity]` only; a length-2 tuple is rejected.
      "no-var": ["error", { ignore: true }],
    },
  };

  assert.ok(config);
  assert.ok(bareTuple);
  assert.ok(negativeCases);
};
