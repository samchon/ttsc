package linthost

import "testing"

// TestFormatQuotePropsUnquotesInterfaceMember verifies interface members use
// the as-needed quote policy.
//
// Interface members are not object-literal properties, so the former visited
// set left their redundant quoted names untouched despite Prettier rewriting
// them.
//
// 1. Parse an interface with a quoted property name.
// 2. Apply format/quote-props with mode `as-needed`.
// 3. Assert the member name becomes an identifier.
//
// @evidence contracts/testing.md#behavioral-verification format/quote-props as-needed mode must unquote the interface width member while preserving its number type and interface declaration.
// @evidence contracts/testing.md#independent-expectations The complete literal output spells the same width property name as an IdentifierName and retains its number annotation; the supported quoteProps surface includes interface members.
// @evidence contracts/testing.md#distinguishing-cases This interface-member positive distinguishes a non-object member holder from ordinary object keys; type-literal and class-method positives separately cover their distinct holders, while preserve mode owns abstention.
// @evidence contracts/testing.md#execution-ownership TestFormatQuotePropsUnquotesInterfaceMember is a public Go unit selected by the lint semantic-unit Evidence claim. The shared syntax-only harness invokes the owning rule and applies edits in process for this host's literal inputs and complete output comparisons. No consumer install, native product build or product host is started.
func TestFormatQuotePropsUnquotesInterfaceMember(t *testing.T) {
  assertFixSnapshotWithOptions(
    t,
    "format/quote-props",
    "interface Shape { \"width\": number }\n",
    `{"mode":"as-needed"}`,
    "interface Shape { width: number }\n",
  )
}
