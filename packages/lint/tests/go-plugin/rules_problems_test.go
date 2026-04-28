package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoDupeElseIf(t *testing.T) {
	const source = `
		if (a) {
			x();
		} else if (b) {
			x();
		} else if (a) {
			x();
		}
	`
	assertFindings(t, "no-dupe-else-if", source, lintpkg.SeverityError, []string{
		"This branch can never execute. Its condition is a duplicate of an earlier branch.",
	})
}

func TestNoDupeElseIfClean(t *testing.T) {
	assertFindings(t, "no-dupe-else-if", `
		if (a) {} else if (b) {} else if (c) {}
	`, lintpkg.SeverityError, nil)
}

func TestNoExAssign(t *testing.T) {
	const source = `
		try {
			risky();
		} catch (e) {
			e = "boom";
			console.log(e);
		}
	`
	assertFindings(t, "no-ex-assign", source, lintpkg.SeverityError, []string{
		"Do not assign to the exception parameter.",
	})
}

func TestNoEmptyCharacterClass(t *testing.T) {
	assertFindings(t, "no-empty-character-class", `const r = /[]/;`, lintpkg.SeverityError, []string{
		"Empty class.",
	})
	assertFindings(t, "no-empty-character-class", `const r = /[^]/;`, lintpkg.SeverityError, []string{
		"Empty class.",
	})
	assertFindings(t, "no-empty-character-class", `const r = /[a]/;`, lintpkg.SeverityError, nil)
	assertFindings(t, "no-empty-character-class", `const r = /\[\]/;`, lintpkg.SeverityError, nil)
}

func TestNoMisleadingCharacterClass(t *testing.T) {
	assertFindings(t, "no-misleading-character-class", "const r = /[\xf0\x9f\x91\x8d]/;", lintpkg.SeverityError, []string{
		"Unexpected surrogate pair in character class. Use the 'u' flag.",
	})
	// `u` flag suppresses the rule.
	assertFindings(t, "no-misleading-character-class", "const r = /[\xf0\x9f\x91\x8d]/u;", lintpkg.SeverityError, nil)
}

func TestNoLossOfPrecision(t *testing.T) {
	assertFindings(t, "no-loss-of-precision", "const a = 9007199254740993;", lintpkg.SeverityError, []string{
		"This number literal will lose precision at runtime.",
	})
	assertFindings(t, "no-loss-of-precision", "const a = 12345;", lintpkg.SeverityError, nil)
	// Hex/oct/binary forms are skipped (precision is exact in those bases).
	assertFindings(t, "no-loss-of-precision", "const a = 0xFFFFFFFFFFFFFFFF;", lintpkg.SeverityError, nil)
}

func TestNoClassAssign(t *testing.T) {
	const source = `
		class A {}
		A = function () {};
	`
	assertFindings(t, "no-class-assign", source, lintpkg.SeverityError, []string{
		"'A' is a class.",
	})
}

func TestNoFuncAssign(t *testing.T) {
	const source = `
		function f() {}
		f = function () {};
	`
	assertFindings(t, "no-func-assign", source, lintpkg.SeverityError, []string{
		"'f' is a function.",
	})
}

func TestNoPrototypeBuiltins(t *testing.T) {
	const source = `
		const o: any = {};
		o.hasOwnProperty("x");
		o.isPrototypeOf({});
		o.propertyIsEnumerable("y");
		o.foo();
	`
	assertFindings(t, "no-prototype-builtins", source, lintpkg.SeverityError, []string{
		"Do not access Object.prototype method 'hasOwnProperty' from target object.",
		"Do not access Object.prototype method 'isPrototypeOf' from target object.",
		"Do not access Object.prototype method 'propertyIsEnumerable' from target object.",
	})
}

func TestNoAsyncPromiseExecutor(t *testing.T) {
	assertFindings(t, "no-async-promise-executor", "new Promise(async (resolve) => { resolve(1); });", lintpkg.SeverityError, []string{
		"Promise executor functions should not be async.",
	})
	assertFindings(t, "no-async-promise-executor", "new Promise((resolve) => { resolve(1); });", lintpkg.SeverityError, nil)
}

func TestNoPromiseExecutorReturn(t *testing.T) {
	assertFindings(t, "no-promise-executor-return", "new Promise((resolve) => 1);", lintpkg.SeverityError, []string{
		"Return values from promise executor functions cannot be read.",
	})
	assertFindings(t, "no-promise-executor-return", "new Promise((resolve) => { resolve(1); });", lintpkg.SeverityError, nil)
}

func TestNoControlRegex(t *testing.T) {
	assertFindings(t, "no-control-regex", `const r = /\x1f/;`, lintpkg.SeverityError, []string{
		"Unexpected control character(s) in regular expression.",
	})
	assertFindings(t, "no-control-regex", `const r = //;`, lintpkg.SeverityError, []string{
		"Unexpected control character(s) in regular expression.",
	})
	assertFindings(t, "no-control-regex", `const r = /abc/;`, lintpkg.SeverityError, nil)
}

func TestNoIrregularWhitespace(t *testing.T) {
	const source = "const a = 1;\xc2\xa0const b = 2;\n" // NBSP between statements
	findings := assertFindings(t, "no-irregular-whitespace", source, lintpkg.SeverityError, []string{
		"Irregular whitespace not allowed.",
	})
	if len(findings) != 1 {
		t.Fatalf("want 1 finding, got %d", len(findings))
	}
}

func TestNoFallthrough(t *testing.T) {
	const source = `
		switch (1 as number) {
			case 1:
				doSomething();
			case 2:
				doMore();
				break;
			case 3:
				return;
			case 4:
				someOther();
				return;
			case 5:
				doStuff();
		}
	`
	findings := assertFindings(t, "no-fallthrough", source, lintpkg.SeverityError, []string{
		"Expected a 'break' statement before this case.",
	})
	if len(findings) != 1 {
		t.Fatalf("want 1 fallthrough finding, got %d", len(findings))
	}
}

func TestNoInnerDeclarations(t *testing.T) {
	const source = `
		function outer() {
			if (1) {
				function inner() {}
				var x = 1;
			}
		}
	`
	findings := assertFindings(t, "no-inner-declarations", source, lintpkg.SeverityError, []string{
		"Move function declaration to the function scope.",
		"Move variable declaration to the function scope.",
	})
	if len(findings) != 2 {
		t.Fatalf("want 2 findings, got %d", len(findings))
	}
}

func TestNoObjCalls(t *testing.T) {
	assertFindings(t, "no-obj-calls", "Math();", lintpkg.SeverityError, []string{
		"'Math' is not a function.",
	})
	assertFindings(t, "no-obj-calls", "JSON();", lintpkg.SeverityError, []string{
		"'JSON' is not a function.",
	})
	assertFindings(t, "no-obj-calls", "Reflect();", lintpkg.SeverityError, []string{
		"'Reflect' is not a function.",
	})
	assertFindings(t, "no-obj-calls", "Math.floor(1);", lintpkg.SeverityError, nil)
}
