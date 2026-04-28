package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoVar(t *testing.T) {
	const source = `
		var a = 1;
		let b = 2;
		const c = 3;
		var d = 4, e = 5;
	`
	assertFindings(t, "no-var", source, lintpkg.SeverityError, []string{
		"Unexpected var, use let or const instead.",
		"Unexpected var, use let or const instead.",
	})
}

func TestNoVarOff(t *testing.T) {
	assertFindings(t, "no-var", "var a = 1;", lintpkg.SeverityOff, nil)
}

func TestNoUndefInit(t *testing.T) {
	const source = `
		let a = undefined;
		var b = undefined;
		const c = 0;
		let d;
		let e = null;
	`
	assertFindings(t, "no-undef-init", source, lintpkg.SeverityError, []string{
		"It's not necessary to initialize \"undefined\".",
		"It's not necessary to initialize \"undefined\".",
	})
}
