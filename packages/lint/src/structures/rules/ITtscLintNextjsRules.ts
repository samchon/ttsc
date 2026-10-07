import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Next.js framework rules from `@next/eslint-plugin-next`, applied to
 * TypeScript and TSX sources inside Next.js apps.
 *
 * Configures static Next.js conventions for pages/app paths, `<Head>`
 * placement, and font, script, image and link syntax. These checks do not run
 * the framework or predict rendering and hydration outcomes.
 *
 * @reference https://nextjs.org/docs/app/api-reference/config/eslint
 *
 * @evidence contracts/common.md#principled-implementation Optional nextjs keys pair each framework policy with the severity-only setting union; unspecified keys do not impose an application policy.
 * @evidence contracts/common.md#clear-and-simple-design One map owns Next.js rule enablement, leaving framework detection and diagnostics to native implementations instead of embedding them in configuration types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Framework rule names are contract-defined keys, not consumer-specific cases, and the interface introduces no untyped options bypass.
 * @evidence contracts/common.md#meaningful-documentation Native family and member comments explain routing, component and asset-loading concerns with examples of affected syntax; paragraph and member separation follow documentation guidance.
 */
export interface ITtscLintNextjsRules {
  /**
   * Reject missing, `auto`, `block`, and `fallback` display query values on
   * static https://fonts.googleapis.com/css links. Prefer `optional` or
   * `swap`.
   *
   * @reference https://nextjs.org/docs/messages/google-font-display
   */
  "nextjs/google-font-display"?: TtscLintRuleSetting;

  /**
   * Require `rel="preconnect"` for `fonts.gstatic.com` links to shave latency
   * off Google Font fetches.
   *
   * @reference https://nextjs.org/docs/messages/google-font-preconnect
   */
  "nextjs/google-font-preconnect"?: TtscLintRuleSetting;

  /**
   * Require an `id` attribute on inline `<Script>` components from
   * `next/script`.
   *
   * The native check recognizes default imports from `next/script` and reports
   * JSX elements containing inline content or dangerouslySetInnerHTML when the
   * `id` attribute is absent.
   *
   * @reference https://nextjs.org/docs/messages/inline-script-id
   */
  "nextjs/inline-script-id"?: TtscLintRuleSetting;

  /**
   * Prefer the Next.js Google Analytics integration over hand-written `gtag`
   * script tags.
   *
   * @reference https://nextjs.org/docs/messages/next-script-for-ga
   */
  "nextjs/next-script-for-ga"?: TtscLintRuleSetting;

  /**
   * Reject variable declarations whose identifier is `module`.
   *
   * @reference https://nextjs.org/docs/messages/no-assign-module-variable
   */
  "nextjs/no-assign-module-variable"?: TtscLintRuleSetting;

  /**
   * Reject recognized async default component exports in files with a leading
   * `"use client"` directive. The native check follows top-level async bindings
   * and direct default-export expressions; it does not execute React.
   *
   * @reference https://nextjs.org/docs/messages/no-async-client-component
   */
  "nextjs/no-async-client-component"?: TtscLintRuleSetting;

  /**
   * Restrict recognized `next/script` uses with a static
   * `strategy="beforeInteractive"` value to pages/_document paths.
   *
   * @reference https://nextjs.org/docs/messages/no-before-interactive-script-outside-document
   */
  "nextjs/no-before-interactive-script-outside-document"?: TtscLintRuleSetting;

  /**
   * Reject raw `<link rel="stylesheet">` tags.
   *
   * The native check reports static nonempty href values on links whose rel
   * value is `stylesheet`; it does not inspect a bundler's CSS output.
   *
   * @reference https://nextjs.org/docs/messages/no-css-tags
   */
  "nextjs/no-css-tags"?: TtscLintRuleSetting;

  /**
   * Reject `next/document` imports in recognized pages paths other than
   * pages/_document.
   *
   * @reference https://nextjs.org/docs/messages/no-document-import-in-page
   */
  "nextjs/no-document-import-in-page"?: TtscLintRuleSetting;

  /**
   * Reject more than one `<Head>` element from `next/document` in
   * `pages/_document.tsx`.
   *
   * The native check counts JSX uses of the imported next/document Head name in
   * recognized document paths; it does not inspect generated HTML.
   *
   * @reference https://nextjs.org/docs/messages/no-duplicate-head
   */
  "nextjs/no-duplicate-head"?: TtscLintRuleSetting;

  /**
   * Reject raw `<head>` elements outside the `app/` directory; use `next/head`
   * or the metadata exports.
   *
   * @reference https://nextjs.org/docs/messages/no-head-element
   */
  "nextjs/no-head-element"?: TtscLintRuleSetting;

  /**
   * Reject `next/head` imports inside pages/_document paths; use
   * `next/document`'s `Head` there.
   *
   * @reference https://nextjs.org/docs/messages/no-head-import-in-document
   */
  "nextjs/no-head-import-in-document"?: TtscLintRuleSetting;

  /**
   * Prefer `next/link` for anchors whose static href starts with a single `/`
   * and contains no dot. This native path heuristic does not resolve routes.
   *
   * @reference https://nextjs.org/docs/messages/no-html-link-for-pages
   */
  "nextjs/no-html-link-for-pages"?: TtscLintRuleSetting;

  /**
   * Prefer `next/image` over raw `<img>` elements outside a `<picture>`
   * ancestor.
   *
   * @reference https://nextjs.org/docs/messages/no-img-element
   */
  "nextjs/no-img-element"?: TtscLintRuleSetting;

  /**
   * Reject Google font `<link>` tags inside regular pages files — load fonts in
   * `_document.tsx` (pages router) or via `next/font` (app router).
   *
   * @reference https://nextjs.org/docs/messages/no-page-custom-font
   */
  "nextjs/no-page-custom-font"?: TtscLintRuleSetting;

  /**
   * Reject `next/script` inside `next/head` — `<Script>` must appear in the JSX
   * tree, not in `<Head>`.
   *
   * @reference https://nextjs.org/docs/messages/no-script-component-in-head
   */
  "nextjs/no-script-component-in-head"?: TtscLintRuleSetting;

  /**
   * Reject style tags carrying a jsx attribute in recognized pages/_document
   * paths.
   *
   * @reference https://nextjs.org/docs/messages/no-styled-jsx-in-document
   */
  "nextjs/no-styled-jsx-in-document"?: TtscLintRuleSetting;

  /**
   * Require `async` or `defer` on external raw `<script>` tags so loading does
   * not block render.
   *
   * @reference https://nextjs.org/docs/messages/no-sync-scripts
   */
  "nextjs/no-sync-scripts"?: TtscLintRuleSetting;

  /**
   * Reject `<title>` inside an imported next/document Head in recognized
   * pages/_document paths.
   *
   * @reference https://nextjs.org/docs/messages/no-title-in-document-head
   */
  "nextjs/no-title-in-document-head"?: TtscLintRuleSetting;

  /**
   * Catch near-miss typos in Next.js data-fetching export names
   * (`getStaticProps`, `getStaticPaths`, `getServerSideProps`).
   *
   * The native check reports names one edit away from these spellings in
   * recognized non-API pages paths. It does not determine rendering mode.
   *
   * @reference https://nextjs.org/docs/messages/no-typos
   */
  "nextjs/no-typos"?: TtscLintRuleSetting;

  /**
   * Reject static script src values containing `polyfill.io` or
   * `polyfill-fastly.io`, including recognized next/script imports.
   *
   * @reference https://nextjs.org/docs/messages/no-unwanted-polyfillio
   */
  "nextjs/no-unwanted-polyfillio"?: TtscLintRuleSetting;
}
