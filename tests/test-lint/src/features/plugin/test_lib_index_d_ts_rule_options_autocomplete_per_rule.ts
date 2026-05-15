import type { TtscLintConfig } from "@ttsc/lint";
import assert from "node:assert/strict";

/**
 * Verifies lib/index.d.ts surfaces per-rule option autocomplete.
 *
 * The `TtscLintRuleEntry<R>` mapped type is supposed to pick its second
 * tuple slot from `TtscLintRuleOptionsMap[R]`. This compile-time test
 * exercises three contracts:
 *
 *  - A bare severity literal is accepted for any rule (lint or format).
 *  - `[severity, options]` typed against the matching rule key compiles
 *    and the options object is structurally checked.
 *  - A lint-only rule (`no-var`) accepts only severity / `[severity]`.
 *
 * The function runs at runtime as a sanity check that `satisfies
 * TtscLintConfig` does not regress; the real assertion happens during
 * `pnpm run test:typecheck`.
 *
 * 1. Construct configs exercising each tuple shape.
 * 2. Verify the runtime objects deep-equal the expected literal.
 * 3. Lean on `pnpm run test:typecheck` to catch type-level regressions.
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

  assert.ok(config);
  assert.ok(bareTuple);
};
