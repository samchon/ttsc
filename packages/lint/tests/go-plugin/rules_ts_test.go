package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoExplicitAny(t *testing.T) {
	const source = `
		function f(x: any): any { return x; }
		const a: number = 0;
		type Foo = any;
	`
	assertFindings(t, "no-explicit-any", source, lintpkg.SeverityError, []string{
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
	assertFindings(t, "no-non-null-assertion", source, lintpkg.SeverityError, []string{
		"Forbidden non-null assertion.",
	})
}

func TestNoEmptyInterface(t *testing.T) {
	assertFindings(t, "no-empty-interface", "interface A {}", lintpkg.SeverityError, []string{
		"An empty interface is equivalent to '{}'.",
	})
	assertFindings(t, "no-empty-interface", "interface A { x: number; }", lintpkg.SeverityError, nil)
}

func TestNoInferrableTypes(t *testing.T) {
	const source = `
		const a: number = 5;
		const b: string = "x";
		const c: boolean = true;
		const d: number = expensive();
		const e = 5;
	`
	findings := assertFindings(t, "no-inferrable-types", source, lintpkg.SeverityError, []string{
		"Type annotation here is unnecessary.",
		"Type annotation here is unnecessary.",
		"Type annotation here is unnecessary.",
	})
	if len(findings) != 3 {
		t.Fatalf("want 3, got %d", len(findings))
	}
}

func TestNoNamespace(t *testing.T) {
	assertFindings(t, "no-namespace", "namespace Foo { export const x = 1; }", lintpkg.SeverityError, []string{
		"ES2015 module syntax is preferred over namespaces.",
	})
	// Ambient module declarations stay allowed.
	assertFindings(t, "no-namespace", `declare module "fs" { }`, lintpkg.SeverityError, nil)
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
	assertFindings(t, "no-this-alias", source, lintpkg.SeverityError, []string{
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
	findings := assertFindings(t, "prefer-as-const", source, lintpkg.SeverityError, []string{
		want, want,
	})
	_ = findings
}

func TestNoRequireImports(t *testing.T) {
	const source = `
		const fs = require("fs");
		import path = require("path");
	`
	assertFindings(t, "no-require-imports", source, lintpkg.SeverityError, []string{
		"A `require()` style import is forbidden.",
		"An `import = require()` style import is forbidden.",
	})
}

func TestBanTsComment(t *testing.T) {
	const source = "// @ts-ignore\n" +
		"const a: number = \"oops\" as any;\n" +
		"// @ts-expect-error\n" +
		"const b: number = \"oops\" as any;\n"
	findings := assertFindings(t, "ban-ts-comment", source, lintpkg.SeverityError, []string{
		"Do not use `@ts-ignore` because it alters compilation errors.",
		"Do not use `@ts-expect-error` because it alters compilation errors.",
	})
	if len(findings) != 2 {
		t.Fatalf("want 2, got %d", len(findings))
	}
}
