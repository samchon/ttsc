package lint

import "testing"

func TestNoSparseArrays(t *testing.T) {
	assertFindings(t, noSparseArrays{}, "const a = [1, , 3];", SeverityError, []string{
		"Unexpected comma in middle of array.",
	})
	assertFindings(t, noSparseArrays{}, "const b = [1, 2, 3];", SeverityError, nil)
	// Trailing commas don't introduce omitted slots.
	assertFindings(t, noSparseArrays{}, "const c = [1, 2,];", SeverityError, nil)
}

func TestNoArrayConstructor(t *testing.T) {
	assertFindings(t, noArrayConstructor{}, "const a = new Array();", SeverityError, []string{
		"The array literal notation [] is preferable.",
	})
	assertFindings(t, noArrayConstructor{}, "const b = new Array(1, 2, 3);", SeverityError, []string{
		"The array literal notation [] is preferable.",
	})
	// Single-arg numeric form is allowed (could be preallocate).
	assertFindings(t, noArrayConstructor{}, "const c = new Array(10);", SeverityError, nil)
	// Typed empty array tolerated.
	assertFindings(t, noArrayConstructor{}, "const d = new Array<string>();", SeverityError, nil)
	// Plain literal is fine.
	assertFindings(t, noArrayConstructor{}, "const e = [];", SeverityError, nil)
}
