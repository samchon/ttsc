package lint

import "testing"

func TestEqeqeq(t *testing.T) {
	const source = `
		const a = 1, b = 2;
		if (a == b) {}
		if (a != b) {}
		if (a === b) {}
	`
	assertFindings(t, eqeqeq{}, source, SeverityError, []string{
		"Expected '===' and instead saw '=='.",
		"Expected '!==' and instead saw '!='.",
	})
}

func TestUseIsNaN(t *testing.T) {
	const source = `
		const a = 1;
		if (a === NaN) {}
		if (NaN !== a) {}
		if (a === 0) {}
	`
	assertFindings(t, useIsnan{}, source, SeverityError, []string{
		"Use the isNaN function to compare with NaN.",
		"Use the isNaN function to compare with NaN.",
	})
}

func TestValidTypeof(t *testing.T) {
	const source = `
		const a: any = {};
		if (typeof a === "stirng") {}
		if (typeof a === "string") {}
		if (typeof a === "object") {}
		if ("nope" === typeof a) {}
	`
	assertFindings(t, validTypeof{}, source, SeverityError, []string{
		"Invalid typeof comparison value.",
		"Invalid typeof comparison value.",
	})
}

func TestNoCompareNegZero(t *testing.T) {
	const source = `
		const x = 0;
		if (x === -0) {}
		if (-0 < x) {}
		if (x === 0) {}
	`
	assertFindings(t, noCompareNegZero{}, source, SeverityError, []string{
		"Do not use the '-0' literal in comparisons.",
		"Do not use the '-0' literal in comparisons.",
	})
}

func TestNoUnsafeNegation(t *testing.T) {
	const source = `
		const x: any = {};
		if (!"k" in x) {}
		if (!"foo" instanceof Object) {}
		if (!(x.has)) {}
	`
	assertFindings(t, noUnsafeNegation{}, source, SeverityError, []string{
		"Unexpected negating the left operand of a relational operator.",
		"Unexpected negating the left operand of a relational operator.",
	})
}

func TestNoCondAssign(t *testing.T) {
	const source = `
		let a = 1, b = 2;
		if (a = b) {}
		if ((a = b)) {}
		while (a = b) {}
	`
	assertFindings(t, noCondAssign{}, source, SeverityError, []string{
		"Expected a conditional expression and instead saw an assignment.",
		"Expected a conditional expression and instead saw an assignment.",
	})
}

func TestNoConstantCondition(t *testing.T) {
	const source = `
		if (true) {}
		if (1) {}
		if (false) {}
		if (someFn()) {}
		while (true) {}
	`
	assertFindings(t, noConstantCondition{}, source, SeverityError, []string{
		"Unexpected constant condition.",
		"Unexpected constant condition.",
		"Unexpected constant condition.",
	})
}

func TestNoExtraBooleanCast(t *testing.T) {
	const source = `
		const a: any = 1;
		if (!!a) {}
		if (Boolean(a)) {}
		!!a;
		const b = !!a;
	`
	assertFindings(t, noExtraBooleanCast{}, source, SeverityError, []string{
		"Redundant double negation.",
		"Redundant Boolean call.",
	})
}
