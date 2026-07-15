import type { ITtscLintConfig } from "@ttsc/lint";

import "./index";

/**
 * Verifies importing a contributor's module augmentation tightens only the rule
 * it registers.
 *
 * The public contributor index intentionally accepts an unknown options slot
 * for packages whose typings are absent. The options map must tighten
 * `demo/no-marker-comment`, while direct contributor-interface augmentation
 * must make `demo/capitalize-exports` severity-only.
 *
 * 1. Type-check the registered rule with its valid `markers` option.
 * 2. Pin option-name and option-value failures with `@ts-expect-error`.
 * 3. Accept severity-only forms and reject a payload for the optionless rule.
 * 4. Confirm an unregistered contributor namespace keeps unknown options.
 */
export const test_rule_options_module_augmentation_types_contributor_configs =
  (): void => {
    const valid = {
      rules: {
        "demo/no-marker-comment": ["error", { markers: ["TODO", "FIXME"] }],
      },
    } satisfies ITtscLintConfig;

    const typo = {
      rules: {
        "demo/no-marker-comment": [
          "error",
          {
            // @ts-expect-error — the augmented option is `markers`, not `marker`.
            marker: ["TODO"],
          },
        ],
      },
    } satisfies ITtscLintConfig;

    const invalidValue = {
      rules: {
        "demo/no-marker-comment": [
          "warning",
          {
            // @ts-expect-error — `markers` is a readonly string array.
            markers: "TODO",
          },
        ],
      },
    } satisfies ITtscLintConfig;

    const validOptionless = {
      rules: {
        "demo/capitalize-exports": ["warning"],
      },
    } satisfies ITtscLintConfig;

    const invalidOptionless = {
      rules: {
        // @ts-expect-error — direct augmentation makes this rule severity-only.
        "demo/capitalize-exports": ["error", { typo: true }],
      },
    } satisfies ITtscLintConfig;

    const unknownContributor = {
      rules: {
        "unregistered/opaque-options": [
          "warning",
          { markers: "opaque", extra: 1 },
        ],
      },
    } satisfies ITtscLintConfig;

    void [
      valid,
      typo,
      invalidValue,
      validOptionless,
      invalidOptionless,
      unknownContributor,
    ];
  };
