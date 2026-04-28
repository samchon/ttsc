package lint

import "testing"

func TestNoExplicitAny(t *testing.T) {
	const source = `
		function f(x: any): any { return x; }
		const a: number = 0;
		type Foo = any;
	`
	assertFindings(t, noExplicitAny{}, source, SeverityError, []string{
		"Unexpected any. Specify a different type.",
		"Unexpected any. Specify a different type.",
		"Unexpected any. Specify a different type.",
	})
}

func TestNoNonNullAssertion(t *testing.T) {
	const source = `
		function f(x: number | null) {
			return x!;
		}
	`
	assertFindings(t, noNonNullAssertion{}, source, SeverityError, []string{
		"Forbidden non-null assertion.",
	})
}

func TestNoEmptyInterface(t *testing.T) {
	assertFindings(t, noEmptyInterface{}, "interface A {}", SeverityError, []string{
		"An empty interface is equivalent to '{}'.",
	})
	assertFindings(t, noEmptyInterface{}, "interface A { x: number; }", SeverityError, nil)
}

func TestNoInferrableTypes(t *testing.T) {
	const source = `
		const a: number = 5;
		const b: string = "x";
		const c: boolean = true;
		const d: number = expensive();
		const e = 5;
	`
	findings := assertFindings(t, noInferrableTypes{}, source, SeverityError, []string{
		"Type annotation here is unnecessary.",
		"Type annotation here is unnecessary.",
		"Type annotation here is unnecessary.",
	})
	if len(findings) != 3 {
		t.Fatalf("want 3, got %d", len(findings))
	}
}

func TestNoNamespace(t *testing.T) {
	assertFindings(t, noNamespace{}, "namespace Foo { export const x = 1; }", SeverityError, []string{
		"ES2015 module syntax is preferred over namespaces.",
	})
	// Ambient module declarations stay allowed.
	assertFindings(t, noNamespace{}, `declare module "fs" { }`, SeverityError, nil)
}

func TestNoThisAlias(t *testing.T) {
	const source = `
		class Foo {
			method() {
				const self = this;
				return self;
			}
		}
	`
	assertFindings(t, noThisAlias{}, source, SeverityError, []string{
		"Unexpected aliasing of 'this' to local variable.",
	})
}

func TestPreferAsConst(t *testing.T) {
	const source = `
		const a = "foo" as "foo";
		const b = 1 as 1;
		const c = "x" as const;
	`
	want := "Expected `as const` instead of `as` literal type."
	findings := assertFindings(t, preferAsConst{}, source, SeverityError, []string{
		want, want,
	})
	_ = findings
}

func TestNoRequireImports(t *testing.T) {
	const source = `
		const fs = require("fs");
		import path = require("path");
	`
	assertFindings(t, noRequireImports{}, source, SeverityError, []string{
		"A `require()` style import is forbidden.",
		"An `import = require()` style import is forbidden.",
	})
}

func TestBanTsComment(t *testing.T) {
	const source = "// @ts-ignore\n" +
		"const a: number = \"oops\" as any;\n" +
		"// @ts-expect-error\n" +
		"const b: number = \"oops\" as any;\n"
	findings := assertFindings(t, banTsComment{}, source, SeverityError, []string{
		"Do not use `@ts-ignore` because it alters compilation errors.",
		"Do not use `@ts-expect-error` because it alters compilation errors.",
	})
	if len(findings) != 2 {
		t.Fatalf("want 2, got %d", len(findings))
	}
}
