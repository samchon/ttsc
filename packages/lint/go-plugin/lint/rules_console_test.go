package lint

import "testing"

func TestNoConsole(t *testing.T) {
	const source = `
		console.log("hi");
		console.warn("oops");
		console.error("boom");
		myConsole.log("ok");
	`
	assertFindings(t, noConsole{}, source, SeverityError, []string{
		"Unexpected console statement.",
		"Unexpected console statement.",
		"Unexpected console statement.",
	})
}
