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
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies native external script without async/defer is reported for nextjs/no-sync-scripts; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations async prevents synchronous parser blocking. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.tsx. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoSyncScriptsReportsPlainScriptWithoutAsync is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoSyncScriptsReportsPlainScriptWithoutAsync(t *testing.T) {
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-sync-scripts", "pages/index.tsx", "export default function Page() { return <script async src=\"/legacy.js\" />; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
