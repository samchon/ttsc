package linthost

import "testing"

// TestNextjsNextScriptForGAReportsInlineAnalytics verifies static inline analytics.js payloads are reported.
//
// Inline detection reads only the final statically known
// `dangerouslySetInnerHTML.__html` value. Positive and negative twins cover
// the last-write behavior of spreads, computed keys, and duplicate keys.
//
//  1. Render native scripts with literal and dynamic object writes.
//  2. Put a known static `__html` both before and after unknown writes.
//  3. Assert only payloads whose final value is statically known report.
func TestNextjsNextScriptForGAReportsInlineAnalytics(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
const analytics = "https://www.google-analytics.com/analytics.js";
const overrides = { __html: analytics };
const htmlKey = "__html";

export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ __html: "https://www.google-analytics.com/analytics.js" }} />
      <script dangerouslySetInnerHTML={{ __html: analytics }} />

      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ ...overrides, __html: "https://www.google-analytics.com/analytics.js" }} />
      <script dangerouslySetInnerHTML={{ __html: "https://www.google-analytics.com/analytics.js", ...overrides }} />

      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ [htmlKey]: analytics, __html: "https://www.google-analytics.com/analytics.js" }} />
      <script dangerouslySetInnerHTML={{ __html: "https://www.google-analytics.com/analytics.js", [htmlKey]: analytics }} />

      // expect: nextjs/next-script-for-ga error
      <script dangerouslySetInnerHTML={{ __html: analytics, __html: "https://www.google-analytics.com/analytics.js" }} />
      <script dangerouslySetInnerHTML={{ __html: "https://www.google-analytics.com/analytics.js", __html: analytics }} />
    </>
  );
}
`)
}
