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
}
