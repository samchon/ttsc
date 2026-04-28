package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoConsole(t *testing.T) {
	const source = `
		console.log("hi");
		console.warn("oops");
		console.error("boom");
		myConsole.log("ok");
	`
	assertFindings(t, "no-console", source, lintpkg.SeverityError, []string{
		"Unexpected console statement.",
		"Unexpected console statement.",
		"Unexpected console statement.",
	})
}
