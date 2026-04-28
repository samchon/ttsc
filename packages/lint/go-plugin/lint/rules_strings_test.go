package lint

import "testing"

func TestNoTemplateCurlyInString(t *testing.T) {
	assertFindings(t, noTemplateCurlyInString{}, `const a = "hello ${name}";`, SeverityError, []string{
		"Unexpected template string expression in regular string.",
	})
	assertFindings(t, noTemplateCurlyInString{}, "const b = `hello ${name}`;", SeverityError, nil)
	assertFindings(t, noTemplateCurlyInString{}, `const c = "no placeholder";`, SeverityError, nil)
}

func TestNoMultiStr(t *testing.T) {
	assertFindings(t, noMultiStr{}, "const a: string = \"line1 \\\nline2\";", SeverityError, []string{
		"Multiline support is limited to comments.",
	})
	assertFindings(t, noMultiStr{}, `const a: string = "line1 line2";`, SeverityError, nil)
}

func TestNoUselessConcat(t *testing.T) {
	const source = `
		const a = "foo" + "bar";
		const b = "x" + y;
		const c = "x" + "y" + "z";
	`
	// `c` is parsed as `("x" + "y") + "z"` so two left-children fire.
	findings := assertFindings(t, noUselessConcat{}, source, SeverityError, []string{
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
	assertFindings(t, noOctal{}, source, SeverityError, []string{
		"Octal literals should not be used.",
	})
}
