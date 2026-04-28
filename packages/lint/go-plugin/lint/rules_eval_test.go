package lint

import "testing"

func TestNoEval(t *testing.T) {
	assertFindings(t, noEval{}, `eval("x");`, SeverityError, []string{
		"eval can be harmful.",
	})
}

func TestNoEvalNotFlagged(t *testing.T) {
	// Indirect eval is `no-implied-eval`'s job; we don't ship that rule.
	assertFindings(t, noEval{}, `globalThis.eval("x");`, SeverityError, nil)
	assertFindings(t, noEval{}, `myEval("x");`, SeverityError, nil)
}

func TestNoScriptURL(t *testing.T) {
	assertFindings(t, noScriptURL{}, `const a: string = "javascript:alert(1)";`, SeverityError, []string{
		"Script URL is a form of eval.",
	})
	assertFindings(t, noScriptURL{}, `const a: string = "JavaScript:alert(1)";`, SeverityError, []string{
		"Script URL is a form of eval.",
	})
}

func TestNoScriptURLClean(t *testing.T) {
	assertFindings(t, noScriptURL{}, `const a: string = "https://example.com";`, SeverityError, nil)
}
