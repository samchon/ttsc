import type { ITtscLintConfig } from "@ttsc/lint";
import assert from "node:assert/strict";

/**
 * Verifies lib/index.d.ts surfaces per-rule option autocomplete and rejects
 * malformed shapes at compile time.
 *
 * `ITtscLintRules` exposes each built-in rule as a concrete kebab/slash
 * property and picks each options-bearing rule's second tuple slot from
 * `ITtscLintRuleOptionsMap`. This compile-time test exercises both the happy
 * path and the negative branches that make the typing load-bearing.
 *
 * Happy path:
 *
 * - A bare severity literal is accepted for any rule.
 * - `[severity, options]` typed against the matching rule key compiles and the
 *   options object is structurally checked.
 *
 * Negative branches pinned with `@ts-expect-error`:
 *
 * - Typo'd built-in rule name (`noVra`) is rejected.
 * - Typo'd option key (`metohds` for `methods` on
 *   `cypress/unsafe-to-chain-command`) is rejected.
 * - Typo'd option key on a bare-name core rule (`allowSeparateTypeImport` for
 *   `allowSeparateTypeImports` on `no-duplicate-imports`) is rejected.
 * - A non-boolean value for a boolean core-rule option (`includeExports: "yes"`
 *   on `no-duplicate-imports`) is rejected.
 * - Typo'd option key on another options-bearing core rule (`allowTernery` for
 *   `allowTernary` on `no-unused-expressions`) is rejected.
 * - An unsupported `prefer-const` destructuring policy is rejected.
 * - Cross-rule option leakage (`testIdPattern` on
 *   `cypress/unsafe-to-chain-command`) is rejected.
 * - A lint-only rule (`no-var`) cannot carry an options object.
 * - An identifier-form built-in name without the canonical slash (`reactJsxKey`)
 *   is rejected.
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
      "no-duplicate-imports": [
        "error",
        { allowSeparateTypeImports: true, includeExports: true },
      ],
      "no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTaggedTemplates: true },
      ],
      "prefer-const": [
        "error",
        { destructuring: "all", ignoreReadBeforeAssign: true },
      ],
      "cypress/unsafe-to-chain-command": [
        "warning",
        { methods: ["customClick"] },
      ],
      "testing-library/consistent-data-testid": [
        "warning",
        { testIdPattern: "^TestId(__\\w+)*$" },
      ],
      "react/only-export-components": [
        "warning",
        { allowExportNames: ["loader", "action"] },
      ],
      "boundaries/element-types": [
        "warning",
        {
          default: "disallow",
          rules: [{ from: "ui", allow: "domain" }],
        },
      ],
    },
  };

  const bareTuple: ITtscLintConfig = {
    rules: {
      "cypress/unsafe-to-chain-command": ["warning"],
      "react/only-export-components": "off",
    },
  };

  // Negative cases TypeScript enforces through the family-interface
  // intersection pattern. Each lives in its own const so TS evaluates
  // them independently. Bundling several broken cases into one object
  // literal makes TS skip the first excess-property error once other
  // assignment errors fire on later entries, masking the rule-name
  // typo branch and leaving its `@ts-expect-error` directive unused.
  // Splitting the cases keeps each branch load-bearing.
  const ruleNameTypo: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `noVra` is not a known built-in rule and not a namespaced contributor rule.
      noVra: "error",
    },
  };
  const optionKeyTypo: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `metohds` is a typo of `methods`; excess property check on the tuple's options slot fires.
      "cypress/unsafe-to-chain-command": ["error", { metohds: ["click"] }],
    },
  };
  const noDuplicateImportsOptionKeyTypo: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `allowSeparateTypeImport` is a typo of `allowSeparateTypeImports`; excess property check on the tuple's options slot fires.
      "no-duplicate-imports": ["error", { allowSeparateTypeImport: true }],
    },
  };
  const noDuplicateImportsOptionValueShape: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `includeExports` is a boolean option; a string value is rejected.
      "no-duplicate-imports": ["error", { includeExports: "yes" }],
    },
  };
  const noUnusedExpressionsOptionKeyTypo: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `allowTernery` is a typo of `allowTernary`; excess property check on the tuple's options slot fires.
      "no-unused-expressions": ["error", { allowTernery: true }],
    },
  };
  const preferConstOptionValue: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — prefer-const accepts only the official `any` and `all` destructuring policies.
      "prefer-const": ["error", { destructuring: "some" }],
    },
  };
  const crossRuleShape: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `testIdPattern` belongs to testing-library/consistent-data-testid; cypress/unsafe-to-chain-command's option shape rejects it.
      "cypress/unsafe-to-chain-command": ["error", { testIdPattern: "^T" }],
    },
  };
  const lintRuleWithOptions: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — `no-var` is a lint rule with `severity | [severity]` only; a length-2 tuple is rejected.
      "no-var": ["error", { ignore: true }],
    },
  };
  const camelBuiltinName: ITtscLintConfig = {
    rules: {
      // @ts-expect-error — built-in rules use kebab/slash names such as `react/jsx-key`; camelCase identifiers are not in the typed surface.
      reactJsxKey: "error",
    },
  };

  assert.ok(config);
  assert.ok(bareTuple);
  assert.ok(ruleNameTypo);
  assert.ok(optionKeyTypo);
  assert.ok(noDuplicateImportsOptionKeyTypo);
  assert.ok(noDuplicateImportsOptionValueShape);
  assert.ok(noUnusedExpressionsOptionKeyTypo);
  assert.ok(preferConstOptionValue);
  assert.ok(crossRuleShape);
  assert.ok(lintRuleWithOptions);
  assert.ok(camelBuiltinName);
};
