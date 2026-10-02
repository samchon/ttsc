package linthost

import (
  "regexp"
  "testing"
)

// TestLintCorpusSkipsNameOneRuleAndOneHarness verifies that an audited skip is
// honored only when it names its rule and the Go harness that proves it.
//
// A skipped fixture is excluded from the flat corpus run, so the skip is the
// only record that its rule is covered elsewhere. It must carry a known
// constraint, a reason pointing at exactly one positive Go harness under
// packages/lint/linthost that exists, and exactly one rule, and no rule may hold two skips.
//
// 1. Load valid skipped fixtures and require them to leave the entry list.
// 2. Write skips with an unknown constraint, no harness, two harnesses, a
//    harness outside packages/lint/linthost, a harness file that does not exist,
//    a harness in a subdirectory, a "not yet implemented" reason, no rule and two
//    skips for one rule.
// 3. Assert each fails with its own error.
//
// @evidence contracts/testing.md#behavioral-verification loadLintCorpus is run on real trees: a skip with a constraint, one harness path and one rule is excluded from the entries, while each malformed skip fails loading with the error of the rule it breaks.
// @evidence contracts/testing.md#independent-expectations The skip contract (constraint in options|filename|project|checker|platform, one existing packages/lint/linthost/*_test.go harness, one rule, one skip per rule) is the specification; expected messages are literals written from it.
// @evidence contracts/testing.md#distinguishing-cases One valid skip (its rule named only through @ttsc-corpus-rule) is the control; unknown constraint, missing or doubled harness, an escaping harness path, a harness file that does not exist, a harness in a subdirectory, a placeholder reason, a missing rule and a duplicate rule each isolate one violation.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusSkipsNameOneRuleAndOneHarness is a discoverable Go unit entry; each scenario is a named subtest over its own t.TempDir tree and calls only the loader.
func TestLintCorpusSkipsNameOneRuleAndOneHarness(t *testing.T) {
  harness := "positive coverage lives at packages/lint/linthost/lint_fixture_corpus_test.go."
  skip := func(constraint, reason string) string {
    return "// @ttsc-corpus-skip(" + constraint + "): " + reason + "\n// @ttsc-corpus-rule: fixture/rule\nexport {};\n"
  }
  entries, err := loadLintCorpus(writeCorpusTree(t, map[string]string{
    "skipped.ts": skip("project", harness),
    "entry.ts":   "// expect: fixture/other error\nexport {};\n",
  }))
  if err != nil || len(entries) != 1 || entries[0].RelativeFile != "entry.ts" {
    t.Fatalf("a valid skip must leave only the positive entry: %v %+v", err, entries)
  }
  for _, scenario := range []struct {
    name  string
    files map[string]string
    want  string
  }{
    {"unknown-constraint", map[string]string{"a.ts": skip("bogus", harness)}, `unknown corpus constraint "bogus"`},
    {"no-harness", map[string]string{"a.ts": skip("project", "covered elsewhere")}, `exactly one positive Go harness`},
    {"two-harnesses", map[string]string{"a.ts": skip("project", harness+" Also packages/lint/linthost/lint_corpus_loader_helpers_test.go.")}, `exactly one positive Go harness`},
    {"escaping-harness", map[string]string{"a.ts": skip("project", "see packages/lint/linthost/../escape_test.go.")}, `harness escapes packages/lint/linthost/`},
    {"missing-harness", map[string]string{"a.ts": skip("project", "positive coverage lives at packages/lint/linthost/no_such_harness_test.go.")}, `referenced harness does not exist`},
    {"nested-harness", map[string]string{"a.ts": skip("project", "positive coverage lives at packages/lint/linthost/sub/dir_test.go.")}, `must be a file directly under packages/lint/linthost/`},
    {"not-yet-implemented", map[string]string{"a.ts": skip("project", harness+" Not yet implemented.")}, `cannot skip the corpus as "not yet implemented"`},
    {"no-rule", map[string]string{"a.ts": "// @ttsc-corpus-skip(project): " + harness + "\nexport {};\n"}, `must identify exactly one rule`},
    {"duplicate-rule", map[string]string{"a.ts": skip("project", harness), "b.ts": skip("platform", harness)}, `fixture/rule already has another corpus-skip fixture`},
  } {
    t.Run(scenario.name, func(t *testing.T) {
      _, err := loadLintCorpus(writeCorpusTree(t, scenario.files))
      if err == nil || !regexp.MustCompile(scenario.want).MatchString(err.Error()) {
        t.Fatalf("want error matching %q, got %v", scenario.want, err)
      }
    })
  }
}
