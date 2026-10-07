package linthost

import "testing"

// TestNoUnnecessaryTypeArgumentsPreservesHeritageDefaults verifies type-only
// and runtime heritage retain checker-based generic-default diagnostics.
//
// Qualified names in interface extends and class implements name type
// declarations, while class extends resolves a runtime expression. The compiler
// owns their AST representation; the assertion concerns their generic defaults.
//
// 1. Define an interface and a base class with a string generic default.
// 2. Use explicit string and number arguments in every heritage position.
// 3. Assert only the three string-default repetitions report, at exact lines.
//
// @evidence contracts/testing.md#behavioral-verification The in-process check command reports exactly the three explicit string arguments repeating a declared default and leaves the three explicit number arguments clean.
// @evidence contracts/testing.md#independent-expectations Authored generic declarations independently set the default to string; literal expected lines identify the interface, implements and runtime extends diagnostics without deriving expectations from AST representation.
// @evidence contracts/testing.md#distinguishing-cases Qualified interface extends and class implements contrast with class extends; each positive string argument has an adjacent non-default number argument that must not report.
// @evidence contracts/testing.md#execution-ownership The Go unit loads a real Program and Checker through the in-process check command using shared temporary-project helpers, without installing a consumer, building a native artifact or spawning a host.
func TestNoUnnecessaryTypeArgumentsPreservesHeritageDefaults(t *testing.T) {
  root := seedLintProject(t, `declare namespace NS { interface Contract<T = string> {} class Base<T = string> {} }
interface RepeatedInterface extends NS.Contract<string> {}
class RepeatedImplementation implements NS.Contract<string> {}
class RepeatedBase extends NS.Base<string> {}
interface DistinctInterface extends NS.Contract<number> {}
class DistinctImplementation implements NS.Contract<number> {}
class DistinctBase extends NS.Base<number> {}
`)
  const rule = "typescript/no-unnecessary-type-arguments"
  seedLintRules(t, root, map[string]string{rule: "error"})
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{"check", "--cwd", root, "--plugins-json", lintManifest(t)})
  })
  if code != 2 || stdout != "" {
    t.Fatalf("heritage diagnostics: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  assertTypedRuleRenderedErrors(t, rule, stderr, 2, 3, 4)
}
