package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoDebugger(t *testing.T) {
	assertFindings(t, "no-debugger", "function f() { debugger; }", lintpkg.SeverityError, []string{
		"Unexpected `debugger` statement.",
	})
}

func TestNoDebuggerClean(t *testing.T) {
	assertFindings(t, "no-debugger", "function f() { return 1; }", lintpkg.SeverityError, nil)
}

func TestNoWith(t *testing.T) {
	assertFindings(t, "no-with", "function f(o: any) { with (o) { x; } }", lintpkg.SeverityError, []string{
		"Unexpected `with` statement.",
	})
}
