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
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies only the final statically known analytics __html payloads are reported for nextjs/next-script-for-ga; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations JavaScript object spread and repeated/computed property ordering determine the final known write. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original fixture already carries its reported construct and the clean counterpart described above; exact finding enumeration keeps the counterpart from being over-reported. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNextScriptForGAReportsInlineAnalytics is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
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
