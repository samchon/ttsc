package linthost

import "testing"

// TestNextjsNoTyposReportsMisspelledDataExport verifies near-miss data export names are reported.
//
// The rule targets TypeScript source exports in pages files and does not need
// JSX parsing or filesystem route discovery.
//
// 1. Parse a pages TypeScript file.
// 2. Export `getStaticProp`, one edit away from `getStaticProps`.
// 3. Assert `nextjs/no-typos` reports the export name.
//
// @evidence contracts/testing.md#behavioral-verification The corpus helper exercises the actual lint engine and verifies getStaticProp export is reported for nextjs/no-typos; complete rule/severity/source-line expectations reject extra or missing diagnostics.
// @evidence contracts/testing.md#independent-expectations The supported data export is getStaticProps, not the singular near miss. Literal source annotations and accepted inputs express the supported Next rule contract independently of the implementation's result.
// @evidence contracts/testing.md#distinguishing-cases The original annotated violation remains unchanged and an adjacent accepted source is checked with filename pages/index.ts. This is static source/filename behavior, not a browser rendering assertion.
// @evidence contracts/testing.md#execution-ownership TestNextjsNoTyposReportsMisspelledDataExport is a discoverable Go unit entry; TypeScript/TSX parsing and the owning engine execute in one shared process without installing Next, route discovery or a product child host.
func TestNextjsNoTyposReportsMisspelledDataExport(t *testing.T) {
  assertRuleCorpusCaseWithKind(t, "pages/index.ts", `
// expect: nextjs/no-typos error
export function getStaticProp() {
  return { props: {} };
}
`, behavioralWitnessFilename)
  _, _, acceptedFindings := runRuleFindingsSnapshotFile(t, "nextjs/no-typos", "pages/index.ts", "export function getStaticProps() { return { props: {} }; }\n", nil)
  if len(acceptedFindings) != 0 {
    t.Fatalf("accepted Next source unexpectedly reports: %+v", acceptedFindings)
  }
}
