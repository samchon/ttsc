package linthost

import "testing"

// TestFormatQuotePropsKeepsProtoKeyQuoted verifies quoteProps:"as-needed"
// never unquotes a "__proto__" key. A bare `__proto__:` in an object literal
// is the spec-special prototype setter (sets [[Prototype]]), whereas the
// quoted `"__proto__"` key is an ordinary own data property, so unquoting
// would silently change runtime semantics. Prettier keeps it quoted too.
//
//  1. Parse `{ "__proto__": 1, "foo": 2 }` with mode:"as-needed".
//  2. Apply format/quote-props.
//  3. Assert only `"foo"` is unquoted; `"__proto__"` stays quoted.
func TestFormatQuotePropsKeepsProtoKeyQuoted(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "const a = { \"__proto__\": 1, \"foo\": 2 };\n",
    `{"mode":"as-needed"}`,
    "const a = { \"__proto__\": 1, foo: 2 };\n",
  )
}
