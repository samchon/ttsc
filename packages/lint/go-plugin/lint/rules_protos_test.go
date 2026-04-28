package lint

import "testing"

func TestNoIterator(t *testing.T) {
	assertFindings(t, noIterator{}, "x.__iterator__;", SeverityError, []string{
		"Reserved name '__iterator__'.",
	})
	assertFindings(t, noIterator{}, "x.foo;", SeverityError, nil)
}

func TestNoProto(t *testing.T) {
	assertFindings(t, noProto{}, "x.__proto__;", SeverityError, []string{
		"The '__proto__' property is deprecated.",
	})
}
