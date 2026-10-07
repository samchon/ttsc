package linthost

import "testing"

// TestBoundariesEntryPointRejectsNonEntryImport verifies boundaries/entry-point
// requires imports into a configured element to land on that element's public
// entry file.
//
// Entry-point enforcement is deliberately path based: it can run during the
// normal lint pass without a TypeScript checker, and it catches deep relative
// imports before they become stable project API.
//
// 1. Materialize a domain element with index.ts and internal.ts files.
// 2. Configure index.ts as the domain entry point.
// 3. Assert the app file's deep import reports while the index import passes.
//
// @evidence contracts/testing.md#behavioral-verification Entry-point policy rejects domain/internal but permits the directory index entry and names index.ts as the legal entry.
// @evidence contracts/testing.md#independent-expectations The authored entry index.ts option independently marks the permitted import target; exact message fragments and one finding establish that distinction.
// @evidence contracts/testing.md#distinguishing-cases Internal-file and root-directory imports contrast bypassed entry and legal entry resolution.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule calls NewEngineWithResolver.Run on the authored internal and directory-entry imports. The entry owns both assertSingleBoundaryFinding message checks and exact one-report cardinality.
func TestBoundariesEntryPointRejectsNonEntryImport(t *testing.T) {
  const ruleName = "boundaries/entry-point"
  source := `
    import "../domain/internal";
    import "../domain";
  `
  findings := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{
    "elements": [
      { "type": "app", "pattern": "src/app/**" },
      { "type": "domain", "pattern": "src/domain/**", "entry": "index.ts" }
    ]
  }`, map[string]string{
    "src/domain/index.ts":    "export {};",
    "src/domain/internal.ts": "export {};",
  })
  assertSingleBoundaryFinding(t, ruleName, findings, `entry point`)
  // The element's entry patterns are what a legal import must go through, and
  // the rule holds them when it reports, so the message names them.
  assertSingleBoundaryFinding(t, ruleName, findings, `Allowed here: index.ts.`)
  if got := source[findings[0].Pos:findings[0].End]; got != `"../domain/internal"` {
    t.Fatalf("finding range text = %q, want %s", got, `"../domain/internal"`)
  }
}
