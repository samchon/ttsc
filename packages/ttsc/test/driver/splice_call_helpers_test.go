package driver_test

import (
	"testing"
	_ "unsafe"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

//go:linkname spliceCall github.com/samchon/ttsc/packages/ttsc/driver.spliceCall
func spliceCall(text string, rewrite driver.Rewrite, searchFrom int) (string, int, bool, error)

//go:linkname insertSentinel github.com/samchon/ttsc/packages/ttsc/driver.insertSentinel
func insertSentinel(text string) string

//go:linkname joinRootAndNamespaces github.com/samchon/ttsc/packages/ttsc/driver.joinRootAndNamespaces
func joinRootAndNamespaces(rewrite driver.Rewrite) string

//go:linkname matchParen github.com/samchon/ttsc/packages/ttsc/driver.matchParen
func matchParen(text string, pos int) (int, bool)

//go:linkname skipQuoted github.com/samchon/ttsc/packages/ttsc/driver.skipQuoted
func skipQuoted(text string, pos int, quote byte) (int, bool)

//go:linkname skipTemplate github.com/samchon/ttsc/packages/ttsc/driver.skipTemplate
func skipTemplate(text string, pos int) (int, bool)

//go:linkname skipLineComment github.com/samchon/ttsc/packages/ttsc/driver.skipLineComment
func skipLineComment(text string, pos int) int

//go:linkname skipBlockComment github.com/samchon/ttsc/packages/ttsc/driver.skipBlockComment
func skipBlockComment(text string, pos int) (int, bool)

//go:linkname skipRegexLiteral github.com/samchon/ttsc/packages/ttsc/driver.skipRegexLiteral
func skipRegexLiteral(text string, pos int) (int, bool)

func spliceForTest(t *testing.T, text string) string {
	t.Helper()
	got, _, ok, err := spliceCall(text, driver.Rewrite{
		RootName:      "plugin",
		Method:        "make",
		Replacement:   "replacement",
		ConsumeParens: true,
	}, 0)
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("rewrite did not match")
	}
	return got
}
