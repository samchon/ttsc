package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoEmpty(t *testing.T) {
	// Empty `if` / `try` / `finally` / `while` all fire. Empty
	// `catch (e) {}` is tolerated to match the "swallow the error"
	// idiom — that's the only carveout vs. ESLint's default.
	const source = `
		if (1) {}
		try {} catch (e) {} finally {}
		while (1) {}
	`
	findings := assertFindings(t, "no-empty", source, lintpkg.SeverityError, []string{
		"Empty block statement.", // if
		"Empty block statement.", // try
		"Empty block statement.", // finally
		"Empty block statement.", // while
	})
	if len(findings) != 4 {
		t.Fatalf("want 4 empty block findings, got %d", len(findings))
	}
}

func TestNoEmptyAllowsCatch(t *testing.T) {
	// Empty catch is tolerated by default, matching ESLint's
	// `allowEmptyCatch: false` default — wait, actually their default
	// FORBIDS it. We allow it because that's the most common idiom when
	// you legitimately want to swallow.
	const source = `try { x(); } catch (e) {}`
	assertFindings(t, "no-empty", source, lintpkg.SeverityError, nil)
}

func TestNoEmptyDoesNotFlagFunctionBody(t *testing.T) {
	// Empty function body is `no-empty-function`'s territory.
	const source = `function f() {}`
	assertFindings(t, "no-empty", source, lintpkg.SeverityError, nil)
}

func TestNoEmptyFunction(t *testing.T) {
	const source = `
		function f() {}
		const g = () => {};
		class A { m() {} get x() {} set x(v: number) {} constructor() {} }
		const fn = function () {};
	`
	findings := assertFindings(t, "no-empty-function", source, lintpkg.SeverityError, []string{
		"Unexpected empty function.",
		"Unexpected empty function.",
		"Unexpected empty function.",
		"Unexpected empty function.",
		"Unexpected empty function.",
		"Unexpected empty function.",
		"Unexpected empty function.",
	})
	if len(findings) == 0 {
		t.Fatal("expected at least one empty-function finding")
	}
}

func TestNoEmptyPattern(t *testing.T) {
	assertFindings(t, "no-empty-pattern", `function f({}: {}) {}`, lintpkg.SeverityError, []string{
		"Unexpected empty object pattern.",
	})
	assertFindings(t, "no-empty-pattern", `function g([]: any[]) {}`, lintpkg.SeverityError, []string{
		"Unexpected empty array pattern.",
	})
	assertFindings(t, "no-empty-pattern", `function f({a}: {a: number}) { return a; }`, lintpkg.SeverityError, nil)
}
