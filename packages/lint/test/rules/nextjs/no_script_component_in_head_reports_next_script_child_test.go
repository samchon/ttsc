package linthost

import "testing"

// TestNextjsNoScriptComponentInHeadReportsNextScriptChild verifies next/script is not nested in next/head.
//
// This covers both default import maps and descendant scanning inside a Head
// JSX element.
//
// 1. Import Head and Script from their Next.js modules.
// 2. Render Script inside Head.
// 3. Assert the Script child is reported.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies next/script nested inside next/head is reported for nextjs/no-script-component-in-head; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations Script outside Head has the supported independent loader ownership. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoScriptComponentInHeadReportsNextScriptChild is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoScriptComponentInHeadReportsNextScriptChild(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
import Head from "next/head";
import Script from "next/script";

export default function Page() {
  return (
    <Head>
      // expect: nextjs/no-script-component-in-head error
      <Script src="/head.js" />
    </Head>
  );
}
`)
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-script-component-in-head", "pages/index.tsx", "import Head from \"next/head\"; import Script from \"next/script\"; export default function Page() { return <><Head /><Script src=\"/head.js\" /></>; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
