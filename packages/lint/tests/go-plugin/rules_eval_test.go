package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoEval(t *testing.T) {
	assertFindings(t, "no-eval", `eval("x");`, lintpkg.SeverityError, []string{
		"eval can be harmful.",
	})
}

func TestNoEvalNotFlagged(t *testing.T) {
	// Indirect eval is `no-implied-eval`'s job; we don't ship that rule.
	assertFindings(t, "no-eval", `globalThis.eval("x");`, lintpkg.SeverityError, nil)
	assertFindings(t, "no-eval", `myEval("x");`, lintpkg.SeverityError, nil)
}

func TestNoScriptURL(t *testing.T) {
	assertFindings(t, "no-script-url", `const a: string = "javascript:alert(1)";`, lintpkg.SeverityError, []string{
		"Script URL is a form of eval.",
	})
	assertFindings(t, "no-script-url", `const a: string = "JavaScript:alert(1)";`, lintpkg.SeverityError, []string{
		"Script URL is a form of eval.",
	})
}

func TestNoScriptURLClean(t *testing.T) {
	assertFindings(t, "no-script-url", `const a: string = "https://example.com";`, lintpkg.SeverityError, nil)
}
