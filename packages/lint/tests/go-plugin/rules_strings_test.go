package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoTemplateCurlyInString(t *testing.T) {
	assertFindings(t, "no-template-curly-in-string", `const a = "hello ${name}";`, lintpkg.SeverityError, []string{
		"Unexpected template string expression in regular string.",
	})
	assertFindings(t, "no-template-curly-in-string", "const b = `hello ${name}`;", lintpkg.SeverityError, nil)
	assertFindings(t, "no-template-curly-in-string", `const c = "no placeholder";`, lintpkg.SeverityError, nil)
}

func TestNoMultiStr(t *testing.T) {
	assertFindings(t, "no-multi-str", "const a: string = \"line1 \\\nline2\";", lintpkg.SeverityError, []string{
		"Multiline support is limited to comments.",
	})
	assertFindings(t, "no-multi-str", `const a: string = "line1 line2";`, lintpkg.SeverityError, nil)
}

func TestNoUselessConcat(t *testing.T) {
	const source = `
		const a = "foo" + "bar";
		const b = "x" + y;
		const c = "x" + "y" + "z";
	`
	// `c` is parsed as `("x" + "y") + "z"` so two left-children fire.
	findings := assertFindings(t, "no-useless-concat", source, lintpkg.SeverityError, []string{
		"Unexpected string concatenation of literals.",
		"Unexpected string concatenation of literals.",
	})
	if len(findings) != 2 {
		t.Fatalf("want 2, got %d", len(findings))
	}
}

func TestNoOctal(t *testing.T) {
	const source = `
		const a = 010;
		const b = 0o10;
		const c = 10;
	`
	assertFindings(t, "no-octal", source, lintpkg.SeverityError, []string{
		"Octal literals should not be used.",
	})
}
