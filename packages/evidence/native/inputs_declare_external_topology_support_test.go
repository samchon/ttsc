package evidence

import (
  "encoding/json"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

// The host discovers this contract by type assertion and skips a rule that
// fails it (`linthost/project_inputs.go:97-100`), with no warning of any kind.
// A drifted signature would therefore not break a build — it would silently
// stop every watcher this plugin declares, and a rule that watches nothing
// looks exactly like a rule whose sources never changed.
var _ rule.ProjectInputRule = graphRule{}

// declaredInputs runs the published contract the way the host does.
func declaredInputs(t *testing.T, options string) []rule.ProjectInput {
  t.Helper()
  return graphRule{}.ProjectInputs(rule.NewProjectInputContext(
    rule.ProjectIdentity{PhysicalProjectRoot: t.TempDir()},
    rule.SeverityError,
    json.RawMessage(options),
  ))
}

// declaredPatterns lists the declared patterns of one kind, so a case asserts
// the population rather than the order the claims happened to be written in.
func declaredPatterns(
  inputs []rule.ProjectInput,
  kind rule.ProjectInputKind,
) map[string]bool {
  patterns := map[string]bool{}
  for _, input := range inputs {
    if input.Kind == kind {
      patterns[input.Pattern] = true
    }
  }
  return patterns
}

func assertDeclares(
  t *testing.T,
  inputs []rule.ProjectInput,
  kind rule.ProjectInputKind,
  expected []string,
) {
  t.Helper()
  declared := declaredPatterns(inputs, kind)
  if len(declared) != len(expected) {
    t.Fatalf("expected %d %s input(s) %v, got %v", len(expected), kind, expected, declared)
  }
  for _, pattern := range expected {
    if !declared[pattern] {
      t.Fatalf("expected %s input '%s', got %v", kind, pattern, declared)
    }
  }
}
