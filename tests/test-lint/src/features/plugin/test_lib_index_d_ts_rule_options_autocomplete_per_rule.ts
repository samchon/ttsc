import type { ITtscLintConfig } from "@ttsc/lint";
import assert from "node:assert/strict";

/**
 * Verifies lib/index.d.ts surfaces per-rule option autocomplete and rejects
 * malformed shapes at compile time.
 *
 * `ITtscLintRules` exposes each built-in rule as a concrete kebab/slash
 * property and picks each known format rule's second tuple slot from
 * `ITtscLintRuleOptionsMap`. This compile-time test exercises both the happy
 * path and the negative branches that make the typing load-bearing.
 *
 * Happy path:
 *
 * - A bare severity literal is accepted for any rule (lint or format).
 * - `[severity, options]` typed against the matching rule key compiles and the
 *   options object is structurally checked.
 *
 * Negative branches pinned with `@ts-expect-error`:
 *
 * - Typo'd built-in rule name (`noVra`) is rejected.
 * - Typo'd option key (`prefre` for `prefer`) is rejected.
 * - Cross-rule option leakage (`mode` on `format/quotes`) is rejected.
 * - A lint-only rule (`no-var`) cannot carry an options object.
 * - A camelCase format rule name (`formatSemi`) is rejected by the type
 *   surface.
 *
 * The function runs at runtime as a sanity check that `satisfies
 * ITtscLintConfig` does not regress; the real assertion happens during `pnpm
 * run test:typecheck`.
 *
 * 1. Construct configs exercising each tuple shape, both valid and broken.
 * 2. Verify the runtime objects exist (the happy paths must compile).
 * 3. Lean on `pnpm run test:typecheck` to catch type-level regressions — a missing
 *    `@ts-expect-error` directive will surface as a test failure because TS
 *    reports the unused directive itself as an error.
 */
export const test_lib_index_d_ts_rule_options_autocomplete_per_rule = () => {
  const config: ITtscLintConfig = {
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

  const bareTuple: ITtscLintConfig = {
    rules: {
      "format/semi": ["warning"],
      "format/sort-imports": "off",
    },
  };

  // Negative cases TypeScript enforces through the family-interface
  // intersection pattern. Each lives in its own const so TS evaluates
  // them independently — bundling four broken cases into one object
  // literal makes TS skip the first excess-property error once other
  // assignment errors fire on later entries, masking the rule-name
  // typo branch and leaving its `@ts-expect-error` directive unused.
  // Splitting the cases keeps each branch load-bearing.
  //
  // - Built-in rule-name typo (`noVra`) — excess property on the
  //   rules-object.
  // - Option-key typo (`prefre` for `prefer`) — excess property on the
  //   tuple's options slot.
  // - Cross-rule option leakage (`mode` on `format/sort-imports`) — the
  //   options slot is keyed per rule; sort-imports's option shape has
  //   no `mode` field.
  // - Lint-only rule with options (`no-var: ["error", {...}]`) — the
  //   lint rule properties are typed as
  //   `severity | [severity]`, so a length-2 tuple has no matching
  //   union branch.
  const ruleNameTypo: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `noVra` is not a known built-in rule and not a namespaced contributor rule.
      noVra: "error",
    },
  };
  const optionKeyTypo: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `prefre` is a typo of `prefer`; excess property check on the tuple's options slot fires.
      "format/quotes": ["error", { prefre: "double" }],
    },
  };
  const crossRuleShape: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `mode` belongs to format/trailing-comma; format/sort-imports's option shape rejects it.
      "format/sort-imports": ["error", { mode: "all" }],
    },
  };
  const lintRuleWithOptions: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `no-var` is a lint rule with `severity | [severity]` only; a length-2 tuple is rejected.
      "no-var": ["error", { ignore: true }],
    },
  };
  const camelFormatRuleName: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — built-in format rules use slash names such as `format/semi`.
      formatSemi: "error",
    },
  };

  assert.ok(config);
  assert.ok(bareTuple);
  assert.ok(ruleNameTypo);
  assert.ok(optionKeyTypo);
  assert.ok(crossRuleShape);
  assert.ok(lintRuleWithOptions);
  assert.ok(camelFormatRuleName);
};
