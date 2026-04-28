package lint

import "testing"

func TestRadix(t *testing.T) {
	assertFindings(t, radix{}, `parseInt("42");`, SeverityError, []string{
		"Missing radix parameter.",
	})
	assertFindings(t, radix{}, `parseInt("42", 10);`, SeverityError, nil)
	assertFindings(t, radix{}, `parseInt("ff", 16);`, SeverityError, nil)
	assertFindings(t, radix{}, `parseInt("42", 7);`, SeverityError, []string{
		"Invalid radix parameter.",
	})
	assertFindings(t, radix{}, `Number.parseInt("42");`, SeverityError, []string{
		"Missing radix parameter.",
	})
}

func TestNoNewWrappers(t *testing.T) {
	assertFindings(t, noNewWrappers{}, `new String("a");`, SeverityError, []string{
		"Do not use String as a constructor.",
	})
	assertFindings(t, noNewWrappers{}, `new Number(1);`, SeverityError, []string{
		"Do not use Number as a constructor.",
	})
	assertFindings(t, noNewWrappers{}, `new Boolean(true);`, SeverityError, []string{
		"Do not use Boolean as a constructor.",
	})
	assertFindings(t, noNewWrappers{}, `String("a");`, SeverityError, nil)
}
