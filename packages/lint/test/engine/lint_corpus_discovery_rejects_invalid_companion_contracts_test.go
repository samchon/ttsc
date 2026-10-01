package linthost

import (
  "regexp"
  "testing"
)

// TestLintCorpusDiscoveryRejectsInvalidCompanionContracts verifies that a
// companion exclusion is honored only when it is exact, exclusive and owned.
//
// A companion is safe to leave out of the entry list only when its directive is
// well formed, it plays no other role and exactly one positive entry's case
// directory consumes it. Otherwise the marker would recreate the silent-drop
// path under a different name.
//
// 1. Write malformed, duplicate, conflicting, orphan and ambiguous companion
//    layouts, each to its own corpus root.
// 2. Load each root.
// 3. Assert every layout fails for its own structural reason.
//
// @evidence contracts/testing.md#behavioral-verification loadLintCorpus is run on eight real layouts and each must fail with the message of the contract it breaks; a companion owned by one entry is the control that loads in the neighboring nested-owner case.
// @evidence contracts/testing.md#independent-expectations The companion contract (exact marker, no expectations, skip, clean or entry directives, exactly one owning positive entry under its src/) is the specification; every expected message is a literal written from it.
// @evidence contracts/testing.md#distinguishing-cases Malformed and duplicate markers, expectation, skip, entry-directive and clean conflicts, a root-level orphan, a missing owner and two candidate owners each isolate one violated rule.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusDiscoveryRejectsInvalidCompanionContracts is a discoverable Go unit entry; each scenario is a named subtest over its own t.TempDir tree with no compiler or host.
func TestLintCorpusDiscoveryRejectsInvalidCompanionContracts(t *testing.T) {
  entry := "// expect: fixture/rule error\nexport const violation = true;\n"
  ownerless := `helper\.ts: a corpus companion must belong to exactly one positive entry whose case directory contains it under src/`
  for _, scenario := range []struct {
    name  string
    files map[string]string
    want  string
  }{
    {"malformed", map[string]string{"case/violation.ts": entry, "case/src/helper.ts": "// @ttsc-corpus-companion: helper\nexport {};\n"}, "helper\\.ts: malformed `// @ttsc-corpus-companion` directive"},
    {"duplicate", map[string]string{"case/violation.ts": entry, "case/src/helper.ts": "// @ttsc-corpus-companion\n// @ttsc-corpus-companion\nexport {};\n"}, `helper\.ts: a corpus source may declare at most one companion directive`},
    {"expectation-conflict", map[string]string{"case/violation.ts": entry, "case/src/helper.ts": "// @ttsc-corpus-companion\n// expect: fixture/rule error\nexport {};\n"}, `helper\.ts: a corpus companion cannot declare expectations`},
    {"skip-conflict", map[string]string{"case/violation.ts": entry, "case/src/helper.ts": "// @ttsc-corpus-companion\n// @ttsc-corpus-skip(project): packages/lint/test/fixture_test.go\nexport {};\n"}, `helper\.ts: a corpus companion cannot also be an audited skip`},
    {"clean-conflict", map[string]string{"case/violation.ts": entry, "case/src/helper.ts": "// @ttsc-corpus-companion\n// @ttsc-corpus-clean: fixture/rule\nexport {};\n"}, `helper\.ts: a corpus companion cannot also be a clean entry`},
    {"entry-directive-conflict", map[string]string{"case/violation.ts": entry, "case/src/helper.ts": "// @ttsc-corpus-companion\n// @ttsc-corpus-filename: src/helper.ts\nexport {};\n"}, `helper\.ts: a corpus companion cannot declare entry directives`},
    {"root-orphan", map[string]string{"entry.ts": entry, "src/helper.ts": "// @ttsc-corpus-companion\nexport {};\n"}, ownerless},
    {"missing-owner", map[string]string{"entry.ts": entry, "case/src/helper.ts": "// @ttsc-corpus-companion\nexport {};\n"}, ownerless},
    {"ambiguous-owner", map[string]string{"case/one.ts": entry, "case/two.ts": entry, "case/src/helper.ts": "// @ttsc-corpus-companion\nexport {};\n"}, ownerless},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      _, err := loadLintCorpus(writeCorpusTree(t, scenario.files))
      if err == nil || !regexp.MustCompile(scenario.want).MatchString(err.Error()) {
        t.Fatalf("want error matching %q, got %v", scenario.want, err)
      }
    })
  }
}
