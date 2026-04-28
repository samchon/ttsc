package lint

import "testing"

func TestNoDuplicateCase(t *testing.T) {
	const source = `
		switch (x) {
			case 1: break;
			case 2: break;
			case 1: break;
			case "a": break;
			case "a": break;
			default: break;
		}
	`
	assertFindings(t, noDuplicateCase{}, source, SeverityError, []string{
		"Duplicate case label.",
		"Duplicate case label.",
	})
}

func TestNoDupeKeys(t *testing.T) {
	const source = `
		const o = {
			a: 1,
			b: 2,
			a: 3,
			"c": 4,
			"c": 5,
		};
	`
	assertFindings(t, noDupeKeys{}, source, SeverityError, []string{
		"Duplicate key 'a'.",
		"Duplicate key 'c'.",
	})
}

func TestNoDupeKeysAccessorPair(t *testing.T) {
	// Getter + setter sharing a name is allowed.
	const source = `
		const o = {
			get foo() { return 1; },
			set foo(v: number) { },
		};
	`
	assertFindings(t, noDupeKeys{}, source, SeverityError, nil)
}

func TestNoDupeArgs(t *testing.T) {
	const source = `
		function f(a: number, b: number, a: number) {}
		const g = function(a: number, a: number) {};
		const h = (a: number, b: number) => {};
	`
	assertFindings(t, noDupeArgs{}, source, SeverityError, []string{
		"Duplicate parameter name 'a'.",
		"Duplicate parameter name 'a'.",
	})
}
