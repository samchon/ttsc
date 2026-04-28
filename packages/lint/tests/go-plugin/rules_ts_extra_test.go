package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoConfusingNonNullAssertion(t *testing.T) {
	assertFindings(t, "no-confusing-non-null-assertion", `function f(x: number | null, y: number) { return x! == y; }`, lintpkg.SeverityError, []string{
		"Confusing combination of non-null assertion and equality.",
	})
	assertFindings(t, "no-confusing-non-null-assertion", `function f(x: number | null) { return x ?? 0; }`, lintpkg.SeverityError, nil)
}

func TestNoDuplicateEnumValues(t *testing.T) {
	const src = `
		enum E {
			A = 1,
			B = 2,
			C = 1,
			D = "x",
			E = "x",
		}
	`
	findings := assertFindings(t, "no-duplicate-enum-values", src, lintpkg.SeverityError, []string{
		"Duplicate enum member value.",
		"Duplicate enum member value.",
	})
	if len(findings) != 2 {
		t.Fatalf("want 2, got %d", len(findings))
	}
}

func TestNoExtraNonNullAssertion(t *testing.T) {
	assertFindings(t, "no-extra-non-null-assertion", `function f(x: number | null) { return x!!; }`, lintpkg.SeverityError, []string{
		"Forbidden extra non-null assertion.",
	})
	assertFindings(t, "no-extra-non-null-assertion", `function f(x: number | null) { return x!; }`, lintpkg.SeverityError, nil)
}

func TestNoNonNullAssertedOptionalChain(t *testing.T) {
	const src = `
		const o: { a?: { b: number } } = {} as any;
		const x = o?.a!;
	`
	assertFindings(t, "no-non-null-asserted-optional-chain", src, lintpkg.SeverityError, []string{
		"Optional chain expressions can return undefined; non-null assertion bypasses that check.",
	})
}

func TestNoMisusedNew(t *testing.T) {
	assertFindings(t, "no-misused-new", `interface I { constructor(): void; }`, lintpkg.SeverityError, []string{
		"Interfaces cannot have constructors. Use a class instead.",
	})
	assertFindings(t, "no-misused-new", `interface I { foo(): void; }`, lintpkg.SeverityError, nil)
}

func TestPreferEnumInitializers(t *testing.T) {
	const src = `
		enum E {
			A,
			B = 2,
			C,
		}
	`
	findings := assertFindings(t, "prefer-enum-initializers", src, lintpkg.SeverityError, []string{
		"Enum member should have an explicit initializer.",
		"Enum member should have an explicit initializer.",
	})
	if len(findings) != 2 {
		t.Fatalf("want 2, got %d", len(findings))
	}
}

func TestPreferForOf(t *testing.T) {
	const src = `
		const arr: number[] = [1, 2, 3];
		for (let i = 0; i < arr.length; i++) {
			console.log(arr[i]);
		}
	`
	assertFindings(t, "prefer-for-of", src, lintpkg.SeverityError, []string{
		"Prefer a 'for-of' loop instead of a 'for' loop with this simple iteration.",
	})
}

func TestPreferForOfClean(t *testing.T) {
	assertFindings(t, "prefer-for-of", `for (let i = 0; i < 10; i++) {}`, lintpkg.SeverityError, nil)
	assertFindings(t, "prefer-for-of", `const arr: number[] = []; for (const x of arr) { console.log(x); }`, lintpkg.SeverityError, nil)
}

func TestPreferFunctionType(t *testing.T) {
	assertFindings(t, "prefer-function-type", `interface F { (x: number): string; }`, lintpkg.SeverityError, []string{
		"Interface only has a call signature; use 'type' alias and function type instead.",
	})
	assertFindings(t, "prefer-function-type", `interface F { (x: number): string; foo(): void; }`, lintpkg.SeverityError, nil)
}

func TestPreferNamespaceKeyword(t *testing.T) {
	assertFindings(t, "prefer-namespace-keyword", `module Foo { export const x = 1; }`, lintpkg.SeverityError, []string{
		"Use 'namespace' instead of 'module' to declare custom TypeScript modules.",
	})
	assertFindings(t, "prefer-namespace-keyword", `namespace Foo { export const x = 1; }`, lintpkg.SeverityError, nil)
	// Ambient module declarations are allowed.
	assertFindings(t, "prefer-namespace-keyword", `declare module "fs" {}`, lintpkg.SeverityError, nil)
}

func TestNoArrayDelete(t *testing.T) {
	assertFindings(t, "no-array-delete", `const arr: number[] = []; delete arr[0];`, lintpkg.SeverityError, []string{
		"Using delete with an array expression is unsafe.",
	})
	assertFindings(t, "no-array-delete", `const o: any = {}; delete o.x;`, lintpkg.SeverityError, nil)
}

func TestNoEmptyObjectType(t *testing.T) {
	assertFindings(t, "no-empty-object-type", `type T = {};`, lintpkg.SeverityError, []string{
		"The `{}` type is generally not what's intended; consider `Record<string, unknown>` or `unknown`.",
	})
	assertFindings(t, "no-empty-object-type", `type T = { x: number };`, lintpkg.SeverityError, nil)
}

func TestArrayType(t *testing.T) {
	assertFindings(t, "array-type", `const a: Array<string> = [];`, lintpkg.SeverityError, []string{
		"Use 'T[]' instead of 'Array<T>'.",
	})
	assertFindings(t, "array-type", `const a: ReadonlyArray<string> = [];`, lintpkg.SeverityError, []string{
		"Use 'readonly T[]' instead of 'ReadonlyArray<T>'.",
	})
	assertFindings(t, "array-type", `const a: string[] = [];`, lintpkg.SeverityError, nil)
}

func TestConsistentIndexedObjectStyle(t *testing.T) {
	assertFindings(t, "consistent-indexed-object-style", `type T = { [key: string]: number };`, lintpkg.SeverityError, []string{
		"An index signature is preferred to be a Record type.",
	})
	assertFindings(t, "consistent-indexed-object-style", `type T = { x: number };`, lintpkg.SeverityError, nil)
}

func TestBanTslintComment(t *testing.T) {
	const src = `// tslint:disable
const x = 1;
`
	assertFindings(t, "ban-tslint-comment", src, lintpkg.SeverityError, []string{
		"tslint comment detected.",
	})
	assertFindings(t, "ban-tslint-comment", "// some other comment\nconst x = 1;\n", lintpkg.SeverityError, nil)
}

func TestAdjacentOverloadSignatures(t *testing.T) {
	const src = `
		interface I {
			foo(): void;
			bar(): void;
			foo(x: number): void;
		}
	`
	assertFindings(t, "adjacent-overload-signatures", src, lintpkg.SeverityError, []string{
		"All foo signatures should be adjacent.",
	})
}

func TestConsistentTypeImports(t *testing.T) {
	const src = `
		import { Foo } from "./types";
		type X = Foo;
	`
	assertFindings(t, "consistent-type-imports", src, lintpkg.SeverityError, []string{
		"All imports in the declaration are only used as types. Use `import type`.",
	})
}

func TestConsistentTypeImportsClean(t *testing.T) {
	const src = `
		import { Foo } from "./types";
		const x: Foo = new Foo();
	`
	assertFindings(t, "consistent-type-imports", src, lintpkg.SeverityError, nil)
}

func TestTripleSlashReference(t *testing.T) {
	const src = `/// <reference path="./other.ts" />
const x = 1;
`
	findings := assertFindings(t, "triple-slash-reference", src, lintpkg.SeverityError, []string{
		"Do not use triple slash references for ./other.ts.",
	})
	if len(findings) != 1 {
		t.Fatalf("want 1, got %d", len(findings))
	}
}
