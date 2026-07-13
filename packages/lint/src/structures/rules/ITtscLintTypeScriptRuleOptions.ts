/**
 * Options shapes for the configurable rules in {@link ITtscLintTypeScriptRules}.
 *
 * @reference https://typescript-eslint.io/rules/
 */

/**
 * Policy for one `@ts-<directive>` comment kind in `typescript/ban-ts-comment`.
 *
 * - `true` — report every use of the directive.
 * - `false` — allow the directive unconditionally.
 * - `"allow-with-description"` — allow the directive when it is followed by a
 *   description of at least `minimumDescriptionLength` characters.
 * - `{ descriptionFormat }` — additionally require the description to match the
 *   given regular expression (evaluated with Go's RE2 `regexp` syntax, which
 *   covers the usual patterns such as `"^: TS\\d+ because .+$"`).
 */
export type TtscLintTypeScriptBanTsCommentDirectiveConfig =
  | boolean
  | "allow-with-description"
  | {
      /**
       * Regular expression the directive description must match. Matched
       * against the raw text following the directive, including its leading
       * whitespace, so anchored patterns usually start with `^: `.
       */
      descriptionFormat?: string;
    };

/**
 * `typescript/ban-ts-comment` rule options.
 *
 * Absent directive keys keep the upstream recommended defaults: `@ts-check` is
 * allowed, `@ts-expect-error` is allowed with a description, and `@ts-ignore` /
 * `@ts-nocheck` are reported.
 */
export interface ITtscLintTypeScriptBanTsCommentRuleOptions {
  /**
   * Minimum description length (counted in grapheme clusters, so one emoji is
   * one character) for directives configured as `"allow-with-description"` or
   * `{ descriptionFormat }`.
   *
   * @default 3
   */
  minimumDescriptionLength?: number;

  /**
   * Policy for `@ts-check` pragma comments.
   *
   * @default false
   */
  "ts-check"?: TtscLintTypeScriptBanTsCommentDirectiveConfig;

  /**
   * Policy for `@ts-expect-error` directive comments.
   *
   * @default "allow-with-description"
   */
  "ts-expect-error"?: TtscLintTypeScriptBanTsCommentDirectiveConfig;

  /**
   * Policy for `@ts-ignore` directive comments.
   *
   * @default true
   */
  "ts-ignore"?: TtscLintTypeScriptBanTsCommentDirectiveConfig;

  /**
   * Policy for `@ts-nocheck` pragma comments.
   *
   * @default true
   */
  "ts-nocheck"?: TtscLintTypeScriptBanTsCommentDirectiveConfig;
}

/**
 * `typescript/switch-exhaustiveness-check` rule options.
 *
 * The defaults require every enumerable union member to have an explicit
 * `case`, allow a redundant `default` on an already exhaustive switch, and do
 * not require a `default` for open types such as `string` or `number`.
 *
 * @reference https://typescript-eslint.io/rules/switch-exhaustiveness-check
 */
export interface ITtscLintTypeScriptSwitchExhaustivenessCheckRuleOptions {
  /**
   * Allow a `default` clause on a switch whose finite members are already
   * covered explicitly.
   *
   * @default true
   */
  allowDefaultCaseForExhaustiveSwitch?: boolean;

  /**
   * Treat a real `default` clause or matching trailing comment as coverage for
   * otherwise missing finite members.
   *
   * @default false
   */
  considerDefaultExhaustiveForUnions?: boolean;

  /**
   * Regular expression matched against the trimmed body of the last comment
   * after the final `case`. The default marker is `/^no default$/iu`.
   *
   * Custom patterns use Go's RE2 `regexp` syntax.
   */
  defaultCaseCommentPattern?: string;

  /**
   * Require a real `default` clause or matching trailing comment when the
   * discriminant contains an open, non-literal type.
   *
   * @default false
   */
  requireDefaultForNonUnion?: boolean;
}
