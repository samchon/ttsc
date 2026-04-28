package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoAlert(t *testing.T) {
	assertFindings(t, "no-alert", `alert("hi");`, lintpkg.SeverityError, []string{"Unexpected alert."})
	assertFindings(t, "no-alert", `confirm("ok?");`, lintpkg.SeverityError, []string{"Unexpected confirm."})
	assertFindings(t, "no-alert", `prompt("name?");`, lintpkg.SeverityError, []string{"Unexpected prompt."})
	assertFindings(t, "no-alert", `myAlert();`, lintpkg.SeverityError, nil)
}

func TestNoBitwise(t *testing.T) {
	const src = `
		const a: any = 0;
		const b: any = 0;
		const c1 = a & b;
		const c2 = a | b;
		const c3 = a ^ b;
		const c4 = a << 1;
		const c5 = a >> 1;
		const c6 = a >>> 1;
		const c7 = ~a;
		const c8 = a && b;
	`
	findings := assertFindings(t, "no-bitwise", src, lintpkg.SeverityError, []string{
		"Unexpected use of bitwise operator.",
		"Unexpected use of bitwise operator.",
		"Unexpected use of bitwise operator.",
		"Unexpected use of bitwise operator.",
		"Unexpected use of bitwise operator.",
		"Unexpected use of bitwise operator.",
		"Unexpected use of bitwise operator.",
	})
	if len(findings) != 7 {
		t.Fatalf("want 7, got %d", len(findings))
	}
}

func TestNoCaller(t *testing.T) {
	assertFindings(t, "no-caller", `function f() { return arguments.callee; }`, lintpkg.SeverityError, []string{"Avoid arguments.callee."})
	assertFindings(t, "no-caller", `function f() { return arguments.caller; }`, lintpkg.SeverityError, []string{"Avoid arguments.caller."})
}

func TestNoCaseDeclarations(t *testing.T) {
	const src = `
		switch (1 as number) {
			case 1: {
				let a = 1;
				break;
			}
			case 2:
				let b = 2;
				break;
			case 3:
				const c = 3;
				break;
			case 4:
				var d = 4;
				break;
		}
	`
	findings := assertFindings(t, "no-case-declarations", src, lintpkg.SeverityError, []string{
		"Unexpected lexical declaration in case block.",
		"Unexpected lexical declaration in case block.",
	})
	if len(findings) != 2 {
		t.Fatalf("want 2, got %d", len(findings))
	}
}

func TestNoContinue(t *testing.T) {
	assertFindings(t, "no-continue", `for (let i = 0; i < 3; i++) { if (i === 1) continue; }`, lintpkg.SeverityError, []string{
		"Unexpected use of continue statement.",
	})
}

func TestNoDeleteVar(t *testing.T) {
	assertFindings(t, "no-delete-var", `let a = 1; delete a;`, lintpkg.SeverityError, []string{
		"Variables should not be deleted.",
	})
	assertFindings(t, "no-delete-var", `const o: any = {}; delete o.x;`, lintpkg.SeverityError, nil)
}

func TestNoEqNull(t *testing.T) {
	assertFindings(t, "no-eq-null", `const x: any = 1; if (x == null) {}`, lintpkg.SeverityError, []string{
		"Use '===' to compare with null.",
	})
	assertFindings(t, "no-eq-null", `const x: any = 1; if (x === null) {}`, lintpkg.SeverityError, nil)
}

func TestNoExtraBind(t *testing.T) {
	assertFindings(t, "no-extra-bind", `const f = (() => 1).bind({});`, lintpkg.SeverityError, []string{
		"The function binding is unnecessary.",
	})
	assertFindings(t, "no-extra-bind", `const f = (function () { return 1; }).bind({});`, lintpkg.SeverityError, []string{
		"The function binding is unnecessary.",
	})
	assertFindings(t, "no-extra-bind", `const f = (function () { return this; }).bind({});`, lintpkg.SeverityError, nil)
}

func TestNoLabels(t *testing.T) {
	assertFindings(t, "no-labels", `outer: for (let i = 0; i < 3; i++) { break outer; }`, lintpkg.SeverityError, []string{
		"Unexpected labeled statement.",
	})
}

func TestNoLoneBlocks(t *testing.T) {
	const src = `
		{
			doSomething();
		}
		{
			const a = 1;
			void a;
		}
	`
	findings := assertFindings(t, "no-lone-blocks", src, lintpkg.SeverityError, []string{
		"Block is redundant.",
	})
	if len(findings) != 1 {
		t.Fatalf("want 1, got %d", len(findings))
	}
}

func TestNoLonelyIf(t *testing.T) {
	const src = `
		if (a) {
			x();
		} else {
			if (b) {
				y();
			}
		}
	`
	assertFindings(t, "no-lonely-if", src, lintpkg.SeverityError, []string{
		"Unexpected if as the only statement in an else block.",
	})
}

func TestNoMultiAssign(t *testing.T) {
	assertFindings(t, "no-multi-assign", `let a, b; a = b = 1;`, lintpkg.SeverityError, []string{
		"Unexpected chained assignment.",
	})
}

func TestNoNegatedCondition(t *testing.T) {
	assertFindings(t, "no-negated-condition", `if (!a) { x(); } else { y(); }`, lintpkg.SeverityError, []string{
		"Unexpected negated condition.",
	})
	assertFindings(t, "no-negated-condition", `const r = !a ? 1 : 2;`, lintpkg.SeverityError, []string{
		"Unexpected negated condition.",
	})
	assertFindings(t, "no-negated-condition", `if (!a) { x(); }`, lintpkg.SeverityError, nil)
}

func TestNoNestedTernary(t *testing.T) {
	assertFindings(t, "no-nested-ternary", `const r = a ? b : c ? d : e;`, lintpkg.SeverityError, []string{
		"Do not nest ternary expressions.",
	})
	assertFindings(t, "no-nested-ternary", `const r = a ? b : c;`, lintpkg.SeverityError, nil)
}

func TestNoNew(t *testing.T) {
	assertFindings(t, "no-new", `new Thing();`, lintpkg.SeverityError, []string{
		"Do not use 'new' for side effects.",
	})
	assertFindings(t, "no-new", `const t = new Thing();`, lintpkg.SeverityError, nil)
}

func TestNoNewFunc(t *testing.T) {
	assertFindings(t, "no-new-func", `const f = new Function("a", "return a");`, lintpkg.SeverityError, []string{
		"The Function constructor is eval.",
	})
	assertFindings(t, "no-new-func", `const f = Function("a", "return a");`, lintpkg.SeverityError, []string{
		"The Function constructor is eval.",
	})
}

func TestNoObjectConstructor(t *testing.T) {
	assertFindings(t, "no-object-constructor", `const o = new Object();`, lintpkg.SeverityError, []string{
		"The object literal notation {} is preferable.",
	})
	assertFindings(t, "no-object-constructor", `const o = Object();`, lintpkg.SeverityError, []string{
		"The object literal notation {} is preferable.",
	})
	assertFindings(t, "no-object-constructor", `const o = Object(null);`, lintpkg.SeverityError, nil)
}

func TestNoOctalEscape(t *testing.T) {
	assertFindings(t, "no-octal-escape", "const a: string = \"\\251\";", lintpkg.SeverityError, []string{
		"Don't use octal escape sequences.",
	})
	assertFindings(t, "no-octal-escape", "const a: string = \"\\xfb\";", lintpkg.SeverityError, nil)
}

func TestNoPlusPlus(t *testing.T) {
	assertFindings(t, "no-plusplus", `let i = 0; i++;`, lintpkg.SeverityError, []string{
		"Unary operator '++'/'--' used.",
	})
	assertFindings(t, "no-plusplus", `let i = 0; --i;`, lintpkg.SeverityError, []string{
		"Unary operator '++'/'--' used.",
	})
}

func TestNoRegexSpaces(t *testing.T) {
	assertFindings(t, "no-regex-spaces", `const r = /a  b/;`, lintpkg.SeverityError, []string{
		"Spaces are hard to count. Use {N}.",
	})
	assertFindings(t, "no-regex-spaces", `const r = /a b/;`, lintpkg.SeverityError, nil)
}

func TestNoReturnAssign(t *testing.T) {
	assertFindings(t, "no-return-assign", `function f(a: any) { return a = 1; }`, lintpkg.SeverityError, []string{
		"Return statement should not contain assignment.",
	})
	assertFindings(t, "no-return-assign", `const f = (a: any) => a = 1;`, lintpkg.SeverityError, []string{
		"Arrow function should not return an assignment.",
	})
}

func TestNoSequences(t *testing.T) {
	// Wrapped in parens: ESLint's "I really mean it" form stays silent.
	assertFindings(t, "no-sequences", `const x: any = (a(), b());`, lintpkg.SeverityError, nil)
	// Bare comma operator inside `return`: fires.
	assertFindings(t, "no-sequences", `function f(a: any, b: any) { return a, b; }`, lintpkg.SeverityError, []string{
		"Unexpected use of comma operator.",
	})
}

func TestNoShadowRestrictedNames(t *testing.T) {
	assertFindings(t, "no-shadow-restricted-names", `function f(undefined: number) { return undefined; }`, lintpkg.SeverityError, []string{
		"Shadowing of global property 'undefined'.",
	})
	assertFindings(t, "no-shadow-restricted-names", `let NaN: number = 1; void NaN;`, lintpkg.SeverityError, []string{
		"Shadowing of global property 'NaN'.",
	})
}

func TestNoUndefined(t *testing.T) {
	assertFindings(t, "no-undefined", `const x = undefined;`, lintpkg.SeverityError, []string{
		"Unexpected use of undefined.",
	})
	assertFindings(t, "no-undefined", `const o: any = {}; o.undefined;`, lintpkg.SeverityError, nil)
}

func TestNoUnneededTernary(t *testing.T) {
	assertFindings(t, "no-unneeded-ternary", `const a = x ? true : false;`, lintpkg.SeverityError, []string{
		"Unnecessary use of conditional expression for boolean.",
	})
	assertFindings(t, "no-unneeded-ternary", `const a = x ? 1 : 2;`, lintpkg.SeverityError, nil)
}

func TestNoUnusedExpressions(t *testing.T) {
	assertFindings(t, "no-unused-expressions", `(1, 2);`, lintpkg.SeverityError, []string{
		"Expected an assignment or function call and instead saw an expression.",
	})
	assertFindings(t, "no-unused-expressions", `"use strict";`, lintpkg.SeverityError, nil)
	assertFindings(t, "no-unused-expressions", `f();`, lintpkg.SeverityError, nil)
}

func TestNoUselessCall(t *testing.T) {
	assertFindings(t, "no-useless-call", `f.call(undefined, 1);`, lintpkg.SeverityError, []string{
		"Unnecessary call().",
	})
	assertFindings(t, "no-useless-call", `f.apply(null, [1]);`, lintpkg.SeverityError, []string{
		"Unnecessary apply().",
	})
	assertFindings(t, "no-useless-call", `f.call(target, 1);`, lintpkg.SeverityError, nil)
}

func TestNoUselessComputedKey(t *testing.T) {
	assertFindings(t, "no-useless-computed-key", `const o = { ["foo"]: 1 };`, lintpkg.SeverityError, []string{
		"Unnecessarily computed property key.",
	})
	assertFindings(t, "no-useless-computed-key", `const o = { [bar]: 1 };`, lintpkg.SeverityError, nil)
}

func TestNoUselessRename(t *testing.T) {
	const src = `
		import { foo as foo } from "x";
		export { bar as bar };
		const { baz: baz } = obj;
	`
	findings := assertFindings(t, "no-useless-rename", src, lintpkg.SeverityError, []string{
		"Import { x as x } is redundant.",
		"Export { x as x } is redundant.",
		"Destructuring rename to the same name is redundant.",
	})
	if len(findings) != 3 {
		t.Fatalf("want 3, got %d", len(findings))
	}
}

func TestObjectShorthand(t *testing.T) {
	assertFindings(t, "object-shorthand", `const x = 1; const o = { x: x };`, lintpkg.SeverityError, []string{
		"Expected property shorthand.",
	})
	assertFindings(t, "object-shorthand", `const x = 1; const o = { x };`, lintpkg.SeverityError, nil)
}

func TestOperatorAssignment(t *testing.T) {
	assertFindings(t, "operator-assignment", `let x = 1; x = x + 1;`, lintpkg.SeverityError, []string{
		"Assignment can be replaced with compound operator.",
	})
	assertFindings(t, "operator-assignment", `let x = 1; x += 1;`, lintpkg.SeverityError, nil)
}

func TestPreferExponentiationOperator(t *testing.T) {
	assertFindings(t, "prefer-exponentiation-operator", `const a = Math.pow(2, 3);`, lintpkg.SeverityError, []string{
		"Use the '**' operator instead of 'Math.pow'.",
	})
	assertFindings(t, "prefer-exponentiation-operator", `const a = 2 ** 3;`, lintpkg.SeverityError, nil)
}

func TestPreferSpread(t *testing.T) {
	assertFindings(t, "prefer-spread", `f.apply(null, args);`, lintpkg.SeverityError, []string{
		"Use the spread operator instead of '.apply()'.",
	})
	assertFindings(t, "prefer-spread", `f.apply(target, args);`, lintpkg.SeverityError, nil)
}

func TestPreferTemplate(t *testing.T) {
	assertFindings(t, "prefer-template", `const x = "hi " + name + "!";`, lintpkg.SeverityError, []string{
		"Unexpected string concatenation.",
	})
	assertFindings(t, "prefer-template", "const x = `hi ${name}!`;", lintpkg.SeverityError, nil)
	assertFindings(t, "prefer-template", `const x = "a" + "b";`, lintpkg.SeverityError, nil) // no non-literal
}

func TestRequireYield(t *testing.T) {
	assertFindings(t, "require-yield", `function* gen() { return 1; }`, lintpkg.SeverityError, []string{
		"This generator function does not have 'yield'.",
	})
	assertFindings(t, "require-yield", `function* gen() { yield 1; }`, lintpkg.SeverityError, nil)
}

func TestVarsOnTop(t *testing.T) {
	const src = `
		function f() {
			doStuff();
			var a = 1;
			void a;
		}
	`
	assertFindings(t, "vars-on-top", src, lintpkg.SeverityError, []string{
		"All 'var' declarations must be at the top of the function scope.",
	})
}

func TestYoda(t *testing.T) {
	assertFindings(t, "yoda", `if (1 === x) {}`, lintpkg.SeverityError, []string{
		"Expected literal to be on the right side of comparison.",
	})
	assertFindings(t, "yoda", `if (x === 1) {}`, lintpkg.SeverityError, nil)
}
