package linthost

import "testing"

// TestNextjsNoSyncScriptsReportsPlainScriptWithoutAsync verifies blocking script tags are reported.
//
// Static JSX attributes are enough to cover the sync script branch without
// simulating browser loading behavior.
//
// 1. Parse a TSX page with an external script tag.
// 2. Omit both async and defer.
// 3. Assert `nextjs/no-sync-scripts` reports the script.
func TestNextjsNoSyncScriptsReportsPlainScriptWithoutAsync(t *testing.T) {
  assertRuleCorpusCaseTSX(t, "pages/index.tsx", `
export default function Page() {
  return (
    <>
      // expect: nextjs/no-sync-scripts error
      <script src="/legacy.js" />
    </>
  );
}
`)
}
