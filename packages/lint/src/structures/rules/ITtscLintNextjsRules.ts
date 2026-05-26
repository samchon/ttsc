import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Next.js framework rules from `@next/eslint-plugin-next`, applied to
 * TypeScript and TSX sources inside Next.js apps.
 *
 * Checks Next.js-specific conventions — pages/app routing, `<Head>`
 * placement, font and script loading, image and link components —
 * that the framework's runtime treats as load-bearing.
 *
 * @reference https://nextjs.org/docs/app/api-reference/config/eslint
 */
export interface ITtscLintNextjsRules {
  /**
   * Require a non-blocking `display=` value on Google Fonts
   * stylesheet links; reject `auto`, `block`, and `fallback`, which
   * keep text invisible while the font loads and hurt LCP. Prefer
   * `optional` or `swap`.
   *
   * @reference https://nextjs.org/docs/messages/google-font-display
   */
  "nextjs/google-font-display"?: TtscLintRuleSetting;

  /**
   * Require `rel="preconnect"` for `fonts.gstatic.com` links to
   * shave latency off Google Font fetches.
   *
   * @reference https://nextjs.org/docs/messages/google-font-preconnect
   */
  "nextjs/google-font-preconnect"?: TtscLintRuleSetting;

  /**
   * Require an `id` attribute on inline `<Script>` components from
   * `next/script`.
   *
   * Next.js uses the id to track the script across client
   * navigations and to satisfy its loading-strategy budget; an
   * inline script without one is silently dropped on subsequent
   * renders.
   *
   * @reference https://nextjs.org/docs/messages/inline-script-id
   */
  "nextjs/inline-script-id"?: TtscLintRuleSetting;

  /**
   * Prefer the Next.js Google Analytics integration over
   * hand-written `gtag` script tags.
   *
   * @reference https://nextjs.org/docs/messages/next-script-for-ga
   */
  "nextjs/next-script-for-ga"?: TtscLintRuleSetting;

  /**
   * Reject local declarations named `module`, which shadow the
   * CommonJS `module` binding Next.js relies on.
   *
   * @reference https://nextjs.org/docs/messages/no-assign-module-variable
   */
  "nextjs/no-assign-module-variable"?: TtscLintRuleSetting;

  /**
   * Reject `async` function bodies on React Client Components.
   *
   * The client-side React runtime can't await a component's render,
   * so an `async` `"use client"` component returns a pending promise
   * that crashes hydration; do data fetching in a Server Component
   * or in `useEffect` instead.
   *
   * @reference https://nextjs.org/docs/messages/no-async-client-component
   */
  "nextjs/no-async-client-component"?: TtscLintRuleSetting;

  /**
   * Restrict the `next/script` `strategy="beforeInteractive"` option
   * to `pages/_document.tsx` — anywhere else, the strategy is
   * downgraded silently.
   *
   * @reference https://nextjs.org/docs/messages/no-before-interactive-script-outside-document
   */
  "nextjs/no-before-interactive-script-outside-document"?: TtscLintRuleSetting;

  /**
   * Reject raw `<link rel="stylesheet">` tags.
   *
   * Next.js handles CSS through its bundler — imported stylesheets,
   * CSS Modules, or `next/font` — and manual stylesheet links skip
   * the runtime's critical-CSS extraction and render-blocking
   * heuristics.
   *
   * @reference https://nextjs.org/docs/messages/no-css-tags
   */
  "nextjs/no-css-tags"?: TtscLintRuleSetting;

  /**
   * Restrict `next/document` imports to `pages/_document.tsx` —
   * `Document` cannot be used in a regular page.
   *
   * @reference https://nextjs.org/docs/messages/no-document-import-in-page
   */
  "nextjs/no-document-import-in-page"?: TtscLintRuleSetting;

  /**
   * Reject more than one `<Head>` element from `next/document` in
   * `pages/_document.tsx`.
   *
   * Next.js merges metadata into the single `<Head>` it renders into
   * the HTML shell; additional instances are dropped silently and
   * any tags inside them never reach the page.
   *
   * @reference https://nextjs.org/docs/messages/no-duplicate-head
   */
  "nextjs/no-duplicate-head"?: TtscLintRuleSetting;

  /**
   * Reject raw `<head>` elements outside the `app/` directory —
   * use `next/head` or the metadata exports.
   *
   * @reference https://nextjs.org/docs/messages/no-head-element
   */
  "nextjs/no-head-element"?: TtscLintRuleSetting;

  /**
   * Reject `next/head` imports inside `pages/_document.tsx` — use
   * `next/document`'s `Head` there.
   *
   * @reference https://nextjs.org/docs/messages/no-head-import-in-document
   */
  "nextjs/no-head-import-in-document"?: TtscLintRuleSetting;

  /**
   * Prefer `next/link` for internal anchors with a static `href`,
   * since `Link` performs client-side routing.
   *
   * @reference https://nextjs.org/docs/messages/no-html-link-for-pages
   */
  "nextjs/no-html-link-for-pages"?: TtscLintRuleSetting;

  /**
   * Prefer `next/image` over raw `<img>` elements so the framework
   * can optimize the asset.
   *
   * @reference https://nextjs.org/docs/messages/no-img-element
   */
  "nextjs/no-img-element"?: TtscLintRuleSetting;

  /**
   * Reject Google font `<link>` tags inside regular pages files —
   * load fonts in `_document.tsx` (pages router) or via
   * `next/font` (app router).
   *
   * @reference https://nextjs.org/docs/messages/no-page-custom-font
   */
  "nextjs/no-page-custom-font"?: TtscLintRuleSetting;

  /**
   * Reject `next/script` inside `next/head` — `<Script>` must
   * appear in the JSX tree, not in `<Head>`.
   *
   * @reference https://nextjs.org/docs/messages/no-script-component-in-head
   */
  "nextjs/no-script-component-in-head"?: TtscLintRuleSetting;

  /**
   * Reject styled-jsx tags inside `pages/_document.tsx`, which the
   * server renders incorrectly.
   *
   * @reference https://nextjs.org/docs/messages/no-styled-jsx-in-document
   */
  "nextjs/no-styled-jsx-in-document"?: TtscLintRuleSetting;

  /**
   * Require `async` or `defer` on external raw `<script>` tags so
   * loading does not block render.
   *
   * @reference https://nextjs.org/docs/messages/no-sync-scripts
   */
  "nextjs/no-sync-scripts"?: TtscLintRuleSetting;

  /**
   * Reject `<title>` inside `Head` from `next/document`. Set the
   * title from the metadata exports instead.
   *
   * @reference https://nextjs.org/docs/messages/no-title-in-document-head
   */
  "nextjs/no-title-in-document-head"?: TtscLintRuleSetting;

  /**
   * Catch near-miss typos in Next.js data-fetching export names
   * (`getStaticProps`, `getStaticPaths`, `getServerSideProps`).
   *
   * A misspelled export is treated as ordinary module state, so the
   * page silently falls back to client-side rendering with no
   * build-time warning.
   *
   * @reference https://nextjs.org/docs/messages/no-typos
   */
  "nextjs/no-typos"?: TtscLintRuleSetting;

  /**
   * Reject Polyfill.io script URLs — Next.js already polyfills
   * modern browsers, and Polyfill.io has a checkered history.
   *
   * @reference https://nextjs.org/docs/messages/no-unwanted-polyfillio
   */
  "nextjs/no-unwanted-polyfillio"?: TtscLintRuleSetting;
}
