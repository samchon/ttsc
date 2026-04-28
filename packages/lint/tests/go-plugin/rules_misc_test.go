package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestRadix(t *testing.T) {
	assertFindings(t, "radix", `parseInt("42");`, lintpkg.SeverityError, []string{
		"Missing radix parameter.",
	})
	assertFindings(t, "radix", `parseInt("42", 10);`, lintpkg.SeverityError, nil)
	assertFindings(t, "radix", `parseInt("ff", 16);`, lintpkg.SeverityError, nil)
	assertFindings(t, "radix", `parseInt("42", 7);`, lintpkg.SeverityError, []string{
		"Invalid radix parameter.",
	})
	assertFindings(t, "radix", `Number.parseInt("42");`, lintpkg.SeverityError, []string{
		"Missing radix parameter.",
	})
}

func TestNoNewWrappers(t *testing.T) {
	assertFindings(t, "no-new-wrappers", `new String("a");`, lintpkg.SeverityError, []string{
		"Do not use String as a constructor.",
	})
	assertFindings(t, "no-new-wrappers", `new Number(1);`, lintpkg.SeverityError, []string{
		"Do not use Number as a constructor.",
	})
	assertFindings(t, "no-new-wrappers", `new Boolean(true);`, lintpkg.SeverityError, []string{
		"Do not use Boolean as a constructor.",
	})
	assertFindings(t, "no-new-wrappers", `String("a");`, lintpkg.SeverityError, nil)
}
