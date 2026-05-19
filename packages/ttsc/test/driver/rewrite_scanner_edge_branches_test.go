package driver_test

import (
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
)

/**
 * Verifies rewrite scanner edge branches reject malformed JavaScript safely.
 *
 * The output rewriter scans printed JavaScript without a second parser. These
 * direct scanner checks pin the defensive branches that keep malformed strings,
 * comments, templates, regex literals, and namespace joins from being treated
 * as valid plugin calls.
 *
 * 1. Exercise the unexported scanner helpers through linknames.
 * 2. Feed malformed literals and edge-position inputs.
 * 3. Assert each helper returns the safe fallback instead of panicking.
 */
func TestDriverRewriteScannerEdgeBranches(t *testing.T) {
	if got := joinRootAndNamespaces(driver.Rewrite{RootName: "plugin"}); got != "plugin" {
		t.Fatalf("root-only join mismatch: %q", got)
	}
	if _, ok := matchParen("not-a-call", 0); ok {
		t.Fatal("matchParen accepted a non-paren start")
	}
	if _, ok := matchParen(`("unterminated)`, 0); ok {
		t.Fatal("matchParen accepted an unterminated string literal")
	}
	if _, ok := matchParen("(`unterminated)", 0); ok {
		t.Fatal("matchParen accepted an unterminated template literal")
	}
	if _, ok := matchParen("(/* unterminated", 0); ok {
		t.Fatal("matchParen accepted an unterminated block comment")
	}
	if _, ok := matchParen("(/unterminated", 0); ok {
		t.Fatal("matchParen accepted an unterminated regex literal")
	}
	if _, ok := matchParen("(abc", 0); ok {
		t.Fatal("matchParen accepted an unterminated paren list")
	}
	if got := insertSentinel("console.log(1);\n"); got != driver.RewriteSentinel+"\nconsole.log(1);\n" {
		t.Fatalf("plain sentinel insertion mismatch: %q", got)
	}
	if _, ok := skipQuoted("\"escaped\\\"", 0, '"'); ok {
		t.Fatal("skipQuoted accepted an escaped unterminated quote")
	}
	if _, ok := skipQuoted("\"line\nbreak\"", 0, '"'); ok {
		t.Fatal("skipQuoted accepted a multiline quoted literal")
	}
	if _, ok := skipTemplate("`escaped\\`", 0); ok {
		t.Fatal("skipTemplate accepted an escaped unterminated template")
	}
	if got := skipLineComment("comment", 0); got != len("comment")-1 {
		t.Fatalf("line comment EOF fallback mismatch: %d", got)
	}
	if _, ok := skipBlockComment("never closes", 0); ok {
		t.Fatal("skipBlockComment accepted an unterminated comment")
	}
	if _, ok := skipRegexLiteral(`/[a\/`, 0); ok {
		t.Fatal("skipRegexLiteral accepted an unterminated character class")
	}
	if end, ok := skipRegexLiteral(`/[a/]/gim`, 0); !ok || end != len(`/[a/]/gim`)-1 {
		t.Fatalf("skipRegexLiteral did not consume class and flags: end=%d ok=%v", end, ok)
	}
	if _, ok := skipRegexLiteral("/line\nbreak/", 0); ok {
		t.Fatal("skipRegexLiteral accepted a multiline regex literal")
	}
	if _, _, ok, err := spliceCall("plugin.make(", driver.Rewrite{
		RootName: "plugin",
		Method:   "make",
	}, 0); ok || err == nil {
		t.Fatalf("spliceCall accepted unbalanced parens: ok=%v err=%v", ok, err)
	}
}
