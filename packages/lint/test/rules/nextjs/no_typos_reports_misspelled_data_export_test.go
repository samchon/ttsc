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
func TestNextjsNoTyposReportsMisspelledDataExport(t *testing.T) {
  assertRuleCorpusCase(t, "pages/index.ts", `
// expect: nextjs/no-typos error
export function getStaticProp() {
  return { props: {} };
}
`)
}
