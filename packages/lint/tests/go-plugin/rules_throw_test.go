package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoThrowLiteral(t *testing.T) {
	const source = `
		throw "literal";
		throw 42;
		throw true;
		throw null;
		throw undefined;
		throw new Error("ok");
		throw err;
	`
	findings := assertFindings(t, "no-throw-literal", source, lintpkg.SeverityError, []string{
		"Expected an error object to be thrown.",
		"Expected an error object to be thrown.",
		"Expected an error object to be thrown.",
		"Expected an error object to be thrown.",
		"Expected an error object to be thrown.",
	})
	if len(findings) != 5 {
		t.Fatalf("want 5 findings, got %d", len(findings))
	}
}
