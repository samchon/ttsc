package lint_test

import (
	"testing"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestNoIterator(t *testing.T) {
	assertFindings(t, "no-iterator", "x.__iterator__;", lintpkg.SeverityError, []string{
		"Reserved name '__iterator__'.",
	})
	assertFindings(t, "no-iterator", "x.foo;", lintpkg.SeverityError, nil)
}

func TestNoProto(t *testing.T) {
	assertFindings(t, "no-proto", "x.__proto__;", lintpkg.SeverityError, []string{
		"The '__proto__' property is deprecated.",
	})
}
