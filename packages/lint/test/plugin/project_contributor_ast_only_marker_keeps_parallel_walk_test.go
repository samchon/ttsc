package linthost

import (
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProjectContributorAstOnlyMarkerKeepsParallelWalk verifies a project
// contributor can decline the standalone checker.
//
// The checker decision is engine-wide, not per-rule: one declared project rule
// previously set needsTypeChecker unconditionally, which forced the serial walk
// on every file rule in the run even when the project rule never read
// Context.Checker. A project rule that reads only its own sources or the
// filesystem paid the whole cost, and a file rule's own
// `NeedsTypeChecker() bool { return false }` bought nothing while a project
// contributor was installed.
//
//  1. Install a project contributor whose marker returns false.
//  2. Configure it globally at error severity.
//  3. Assert the engine still skips the standalone checker.
func TestProjectContributorAstOnlyMarkerKeepsParallelWalk(t *testing.T) {
  adapter, err := inspectProjectContributor(astOnlyProjectContributor{})
  if err != nil {
    t.Fatal(err)
  }
  previous, existed := registeredProjectRules[adapter.name]
  registeredProjectRules[adapter.name] = adapter
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[adapter.name] = previous
    } else {
      delete(registeredProjectRules, adapter.name)
    }
  })

  engine := NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{adapter.name: SeverityError},
  })
  if engine.NeedsTypeChecker() {
    t.Fatal("an AST-only project contributor forced the standalone checker")
  }
}

type astOnlyProjectContributor struct{}

func (astOnlyProjectContributor) Name() string                     { return "project-test/ast-only" }
func (astOnlyProjectContributor) Check(*publicrule.ProjectContext) {}
func (astOnlyProjectContributor) NeedsTypeChecker() bool           { return false }
