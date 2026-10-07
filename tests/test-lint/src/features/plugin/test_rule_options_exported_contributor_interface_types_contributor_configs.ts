import type { ITtscLintConfig } from "@ttsc/lint";

import type { IDemoLintRules } from "../../../../../packages/lint/test/lint-contributor-demo/src/index";

/**
 * Verifies a config typed with a contributor's exported rule interface tightens
 * only the rules that interface registers, and an untyped config keeps the open
 * fallback.
 *
 * The public contributor index intentionally accepts an unknown options slot
 * for packages whose typings are absent. Passing the demo contributor's
 * exported `IDemoLintRules` as the config's type argument must tighten
 * `demo/no-marker-comment` to its `markers` option and make
 * `demo/capitalize-exports` severity-only, while the same rule written against
 * the bare `ITtscLintConfig` stays open.
 *
 * 1. Type-check the registered rule with its valid `markers` option.
 * 2. Pin option-name and option-value failures with `@ts-expect-error`.
 * 3. Accept severity-only forms and reject a payload for the optionless rule.
 * 4. Confirm an unregistered contributor namespace keeps unknown options, and that
 *    the untyped config accepts the demo rule with arbitrary options.
 *
 * @evidence contracts/testing.md#behavioral-verification The test-lint tsc run checks satisfies ITtscLintConfig<IDemoLintRules> assignments and requires each @ts-expect-error rejection to exist; the exported function is a compile-time fixture, not a runtime assertion.
 * @evidence contracts/testing.md#independent-expectations The declared markers string-array option and severity-only rule in the exported interface independently define the accepted assignments; misspelled keys, scalar markers and optionless payloads must be rejected, and the untyped config must accept the same rule with arbitrary options.
 * @evidence contracts/testing.md#distinguishing-cases Accepted: a valid markers array, an empty markers array, an omitted optional markers property, severity-only demo/capitalize-exports, an unregistered unregistered/opaque-options rule with arbitrary options, and the demo rule with arbitrary options under the untyped config. Rejected under the typed config: the option key typo marker, the scalar markers: "TODO", and an options payload on the severity-only rule.
 * @evidence contracts/testing.md#execution-ownership The suite start command type-checks before the unit runner transpiles and calls this function, whose body asserts nothing at runtime. `tsc --noEmit -p tsconfig.json` enforces the compile-time assertions in the same unit lane; the file compiles against the exported IDemoLintRules interface, not an ambient module augmentation, and unused @ts-expect-error directives are compiler errors.
 */
export function test_rule_options_exported_contributor_interface_types_contributor_configs(): void {
  const valid = {
    rules: {
      "demo/no-marker-comment": ["error", { markers: ["TODO", "FIXME"] }],
    },
  } satisfies ITtscLintConfig<IDemoLintRules>;

  const emptyMarkers = {
    rules: { "demo/no-marker-comment": ["error", { markers: [] }] },
  } satisfies ITtscLintConfig<IDemoLintRules>;
  const omittedMarkers = {
    rules: { "demo/no-marker-comment": ["error", {}] },
  } satisfies ITtscLintConfig<IDemoLintRules>;

  const typo = {
    rules: {
      "demo/no-marker-comment": [
        "error",
        {
          // @ts-expect-error — the declared option is `markers`, not `marker`.
          marker: ["TODO"],
        },
      ],
    },
  } satisfies ITtscLintConfig<IDemoLintRules>;

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
  } satisfies ITtscLintConfig<IDemoLintRules>;

  const validOptionless = {
    rules: {
      "demo/capitalize-exports": ["warning"],
    },
  } satisfies ITtscLintConfig<IDemoLintRules>;

  const invalidOptionless = {
    rules: {
      // @ts-expect-error — the exported interface makes this rule severity-only.
      "demo/capitalize-exports": ["error", { typo: true }],
    },
  } satisfies ITtscLintConfig<IDemoLintRules>;

  const unknownContributor = {
    rules: {
      "unregistered/opaque-options": [
        "warning",
        { markers: "opaque", extra: 1 },
      ],
    },
  } satisfies ITtscLintConfig<IDemoLintRules>;

  const openFallback = {
    rules: {
      "demo/no-marker-comment": ["error", { marker: ["x"], anything: 1 }],
    },
  } satisfies ITtscLintConfig;

  void [
    valid,
    emptyMarkers,
    omittedMarkers,
    typo,
    invalidValue,
    validOptionless,
    invalidOptionless,
    unknownContributor,
    openFallback,
  ];
}
