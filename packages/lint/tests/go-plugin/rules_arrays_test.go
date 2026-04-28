package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoSparseArrays(t *testing.T) {
	assertFindings(t, "no-sparse-arrays", "const a = [1, , 3];", lintpkg.SeverityError, []string{
		"Unexpected comma in middle of array.",
	})
	assertFindings(t, "no-sparse-arrays", "const b = [1, 2, 3];", lintpkg.SeverityError, nil)
	// Trailing commas don't introduce omitted slots.
	assertFindings(t, "no-sparse-arrays", "const c = [1, 2,];", lintpkg.SeverityError, nil)
}

func TestNoArrayConstructor(t *testing.T) {
	assertFindings(t, "no-array-constructor", "const a = new Array();", lintpkg.SeverityError, []string{
		"The array literal notation [] is preferable.",
	})
	assertFindings(t, "no-array-constructor", "const b = new Array(1, 2, 3);", lintpkg.SeverityError, []string{
		"The array literal notation [] is preferable.",
	})
	// Single-arg numeric form is allowed (could be preallocate).
	assertFindings(t, "no-array-constructor", "const c = new Array(10);", lintpkg.SeverityError, nil)
	// Typed empty array tolerated.
	assertFindings(t, "no-array-constructor", "const d = new Array<string>();", lintpkg.SeverityError, nil)
	// Plain literal is fine.
	assertFindings(t, "no-array-constructor", "const e = [];", lintpkg.SeverityError, nil)
}
