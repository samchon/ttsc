package linthost

import "testing"

// TestNoUnsafeOptionalChainingPreservesContiguousChain verifies parentheses end
// an optional chain while contiguous links do not.
//
// Short-circuiting extends through ordinary property, element and call links
// until a parenthesis closes the chain.
//
//  1. Run the rule over contiguous chains of property, element and call links,
//     including non-null assertions.
//  2. Run the rule over the same chains wrapped in parentheses.
//  3. Assert the first source is clean and the parenthesized chains report the exact
//     outer accesses.
//
// @evidence contracts/testing.md#behavioral-verification The enabled rule accepts contiguous access/call links and reports exact outer accesses on parenthesized chains.
// @evidence contracts/testing.md#independent-expectations ECMAScript optional-chain short circuit extends through ordinary links until parentheses end the chain.
// @evidence contracts/testing.md#distinguishing-cases Property, element and call receivers, multi-link chains and erased non-null/as/type/satisfies assertions distinguish parser propagation from individual question-dot tokens; a new optional link after an assertion remains safe.
// @evidence contracts/testing.md#execution-ownership Parser and rule Engine run directly in the Go unit process; no consumer installation or native host is involved.
func TestNoUnsafeOptionalChainingPreservesContiguousChain(t *testing.T) {
  assertRuleSkipsSource(t, "no-unsafe-optional-chaining", `obj?.foo.bar; obj?.[0][1]; obj?.foo(); obj?.foo().bar; obj?.foo!.bar;`)
  assertRuleFindingRanges(t, "no-unsafe-optional-chaining", `(obj?.foo).bar; (obj?.foo.bar)[0]; (obj?.foo())(); (obj?.foo)!.bar;`,
    "(obj?.foo).bar", "(obj?.foo.bar)[0]", "(obj?.foo())()", "(obj?.foo)!.bar")
  assertRuleFindingRanges(t, "no-unsafe-optional-chaining", `(obj?.foo as any).bar; (<any>obj?.foo).bar; (obj?.foo satisfies any).bar; (obj?.foo as any)!.bar; ((obj?.foo) as any)();`,
    "(obj?.foo as any).bar", "(<any>obj?.foo).bar", "(obj?.foo satisfies any).bar", "(obj?.foo as any)!.bar", "((obj?.foo) as any)()")
  assertRuleSkipsSource(t, "no-unsafe-optional-chaining", `(obj?.foo as any)?.bar; (<any>obj?.foo)?.bar; (obj?.foo satisfies any)?.bar;`)
}
