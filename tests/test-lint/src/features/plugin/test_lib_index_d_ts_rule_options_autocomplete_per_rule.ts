import type { ITtscLintConfig } from "@ttsc/lint";
import assert from "node:assert/strict";

/**
 * Verifies lib/index.d.ts surfaces per-rule option autocomplete and rejects
 * malformed shapes at compile time.
 *
 * `ITtscLintRules` exposes each built-in rule as a concrete camelCase
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
 * - Cross-rule option leakage (`mode` on `formatQuotes`) is rejected.
 * - A lint-only rule (`noVar`) cannot carry an options object.
 * - A legacy slash format rule name (`format/semi`) is rejected by the type
 *   surface even though runtime config loading still accepts it as a migration
 *   alias.
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
      noVar: "error",
      formatSemi: ["warning", { prefer: "always" }],
      formatQuotes: ["warning", { prefer: "double" }],
      formatTrailingComma: ["warning", { mode: "all" }],
      formatSortImports: [
        "warning",
        {
          importOrder: ["<THIRD_PARTY_MODULES>", "@api(.*)$", "^[./]"],
          importOrderSeparation: true,
          importOrderSortSpecifiers: true,
        },
      ],
      formatJsdoc: [
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
      formatSemi: ["warning"],
      formatSortImports: "off",
    },
  };

  // Negative cases TypeScript enforces through the intersection-of-
  // mapped-types pattern. Each lives in its own const so TS evaluates
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
  // - Cross-rule option leakage (`mode` on `formatSortImports`) — the
  //   options slot is keyed per rule; sort-imports's option shape has
  //   no `mode` field.
  // - Lint-only rule with options (`noVar: ["error", {...}]`) — the
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
      formatQuotes: ["error", { prefre: "double" }],
    },
  };
  const crossRuleShape: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `mode` belongs to formatTrailingComma; formatSortImports's option shape rejects it.
      formatSortImports: ["error", { mode: "all" }],
    },
  };
  const lintRuleWithOptions: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `noVar` is a lint rule with `severity | [severity]` only; a length-2 tuple is rejected.
      noVar: ["error", { ignore: true }],
    },
  };
  const legacyFormatRuleName: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — built-in format rules use camelCase names such as `formatSemi`.
      "format/semi": "error",
    },
  };

  assert.ok(config);
  assert.ok(bareTuple);
  assert.ok(ruleNameTypo);
  assert.ok(optionKeyTypo);
  assert.ok(crossRuleShape);
  assert.ok(lintRuleWithOptions);
  assert.ok(legacyFormatRuleName);
};
