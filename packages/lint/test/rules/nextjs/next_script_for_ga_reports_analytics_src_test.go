package linthost

import "testing"

// TestNextjsNextScriptForGAReportsAnalyticsSrc verifies static analytics.js sources are reported.
//
// Google Analytics' legacy loader is a separate static URL branch from the
// Google Tag Manager gtag loader. An unrelated native script is the negative
// twin so substring matching cannot classify every external script as GA.
//
//  1. Render native scripts for analytics.js and an unrelated dependency.
//  2. Enable `nextjs/next-script-for-ga` through the corpus helper.
//  3. Assert only the analytics.js opening reports.
func TestNextjsNextScriptForGAReportsAnalyticsSrc(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/next-script-for-ga error
      <script src="https://www.google-analytics.com/analytics.js" />
      <script src="https://cdn.example.com/application.js" />
    </>
  );
}
`)
}
