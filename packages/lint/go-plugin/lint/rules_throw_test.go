package lint

import "testing"

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
	findings := assertFindings(t, noThrowLiteral{}, source, SeverityError, []string{
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
