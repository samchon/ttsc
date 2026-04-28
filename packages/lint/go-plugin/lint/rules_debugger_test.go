package lint

import "testing"

func TestNoDebugger(t *testing.T) {
	assertFindings(t, noDebugger{}, "function f() { debugger; }", SeverityError, []string{
		"Unexpected `debugger` statement.",
	})
}

func TestNoDebuggerClean(t *testing.T) {
	assertFindings(t, noDebugger{}, "function f() { return 1; }", SeverityError, nil)
}

func TestNoWith(t *testing.T) {
	assertFindings(t, noWith{}, "function f(o: any) { with (o) { x; } }", SeverityError, []string{
		"Unexpected `with` statement.",
	})
}
