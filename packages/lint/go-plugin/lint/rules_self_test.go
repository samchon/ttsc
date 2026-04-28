package lint

import "testing"

func TestNoSelfAssign(t *testing.T) {
	const source = `
		let x = 1;
		x = x;
		const o = { a: 1 };
		o.a = o.a;
		x = 2;
	`
	assertFindings(t, noSelfAssign{}, source, SeverityError, []string{
		"Self-assignment of a variable.",
		"Self-assignment of a variable.",
	})
}

func TestNoSelfCompare(t *testing.T) {
	const source = `
		const a = 1, b = 2;
		if (a === a) {}
		if (b !== b) {}
		if (a < a) {}
		if (a === b) {}
	`
	assertFindings(t, noSelfCompare{}, source, SeverityError, []string{
		"Comparing to itself is potentially pointless.",
		"Comparing to itself is potentially pointless.",
		"Comparing to itself is potentially pointless.",
	})
}
