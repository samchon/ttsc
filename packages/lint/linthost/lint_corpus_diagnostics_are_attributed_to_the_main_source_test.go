package linthost

import (
  "reflect"
  "testing"
)

// TestLintCorpusDiagnosticsAreAttributedToTheMainSource verifies that rendered
// diagnostics are reduced to a portable file, rule, severity and line identity.
//
// Rule, severity and line alone would let a companion diagnostic impersonate the
// expected main-source failure. File spelling must tolerate separators, `./`
// prefixes, ANSI styling and case without ever accepting a different file.
//
//  1. Render banners for the main file in POSIX, `./`, Windows-separator and
//     upper-case spellings, a companion, and non-banner noise.
//  2. Parse them and compare with the expected diagnostics of an entry.
//  3. Assert every main spelling matches and the companion differs.
//
// @evidence contracts/testing.md#behavioral-verification parseCorpusDiagnostics is run on authored renderer output including ANSI escapes and warning/error categories, and its result is compared with expectedCorpusDiagnostics for an entry.
// @evidence contracts/testing.md#independent-expectations The authored banners follow the `file:line:col - category TSnnnn: [rule] message` shape; expectedCorpusDiagnostics applied to the literal entry is first checked against the independently authored complete record (src/main.ts, fixture/rule, error, line 2), so shared path normalization cannot make both sides silently agree on a wrong identity, and the warning banner is checked against the literal severity "warn".
// @evidence contracts/testing.md#distinguishing-cases The four main-file spellings are positives; a companion diagnostic with the same rule, severity and line must not equal the main-source expectation; a line that is not a banner is ignored.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusDiagnosticsAreAttributedToTheMainSource is a discoverable Go unit entry calling two pure functions on in-memory strings; the renderer itself is exercised by TestLintFixtureCorpus.
func TestLintCorpusDiagnosticsAreAttributedToTheMainSource(t *testing.T) {
  entry := corpusEntry{SourcePath: "src/Main.ts", Expected: []corpusExpectation{{Rule: "fixture/rule", Severity: "error", Line: 2}}}
  want := expectedCorpusDiagnostics(entry)
  literal := []corpusDiagnostic{{File: "src/main.ts", Rule: "fixture/rule", Severity: "error", Line: 2}}
  if !reflect.DeepEqual(want, literal) {
    t.Fatalf("entry expectation changed authored identity: got %+v, want %+v", want, literal)
  }
  banner := func(file, category string) string {
    return file + ":2:1 - " + category + " TS9001: [fixture/rule] fixture diagnostic\n"
  }
  for _, file := range []string{"src/Main.ts", "./src/Main.ts", `src\Main.ts`, `SRC\MAIN.TS`} {
    got, err := parseCorpusDiagnostics("\x1b[96m" + banner(file, "error") + "\x1b[0m   2 const x;\n\n")
    if err != nil || !reflect.DeepEqual(got, want) {
      t.Fatalf("%s: got %+v %v, want %+v", file, got, err, want)
    }
  }
  companion, err := parseCorpusDiagnostics(banner("src/helper.ts", "error"))
  if err != nil || reflect.DeepEqual(companion, want) {
    t.Fatalf("a companion diagnostic must not satisfy the main-source expectation: %+v %v", companion, err)
  }
  warning, err := parseCorpusDiagnostics(banner("src/Main.ts", "warning"))
  if err != nil || len(warning) != 1 || warning[0].Severity != "warn" {
    t.Fatalf("a warning banner must map to severity warn: %+v %v", warning, err)
  }
  if none, err := parseCorpusDiagnostics("Found 1 error.\n"); err != nil || len(none) != 0 {
    t.Fatalf("non-banner text must be ignored: %+v %v", none, err)
  }
}
