package linthost

import "testing"

// TestRuleCorpusUnicornPreferAt verifies unicorn/prefer-at reports negative
// indexing only when the indexed and `.length` receivers are equivalent.
//
// Replacing `items[limits.length - 1]` with `items.at(-1)` changes behavior.
// This matrix therefore locks identifier, property, element, private-field,
// wrapper, optional-chain, and repeated-call boundaries through the public
// diagnostic surface instead of testing the comparator in isolation.
//
// 1. Exercise equivalent receivers through runtime-neutral TypeScript wrappers.
// 2. Exercise adjacent mismatches and effectful repeated calls without expects.
// 3. Assert findings occur only on semantics-preserving `.at(-N)` candidates.
func TestRuleCorpusUnicornPreferAt(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/prefer-at.ts", `const xs = [1, 2, 3];
// expect: unicorn/prefer-at error
const last = xs[xs.length - 1];

const limits = [0, 1];
const mismatchedIdentifier = xs[limits.length - 1];

// expect: unicorn/prefer-at error
const lastCharacter = "abc"["abc".length - 1];
const mismatchedString = "abc"["ab".length - 1];

// expect: unicorn/prefer-at error
const parenthesized = ((xs))[((xs)).length - 2];
// expect: unicorn/prefer-at error
const asserted = (xs as readonly number[])[(xs satisfies readonly number[]).length - 1];
// expect: unicorn/prefer-at error
const nonNull = xs![(<readonly number[]>xs!).length - 1];

declare const holder: {
  items: number[];
  limits: number[];
};
// expect: unicorn/prefer-at error
const propertyReceiver = holder.items[holder.items.length - 1];
// expect: unicorn/prefer-at error
const staticElementReceiver = holder["items"][holder.items.length - 1];
const mismatchedProperty = holder.items[holder.limits.length - 1];

declare const matrix: number[][];
declare const index: number;
// expect: unicorn/prefer-at error
const elementReceiver = matrix[index][matrix[index].length - 1];
// expect: unicorn/prefer-at error
const equivalentStaticKey = matrix[0][matrix["0"].length - 1];
const mismatchedElement = matrix[0][matrix[1].length - 1];

declare function make(): number[];
const repeatedCall = make()[make().length - 1];

declare const parent: { children: number[] };
// expect: unicorn/prefer-at error
const optionalMatch = parent?.children[parent?.children.length - 1];
const optionalMismatch = parent?.children[parent.children.length - 1];

class Holder {
  #items = [1, 2, 3];
  #limits = [0, 1];

  last(): number {
    // expect: unicorn/prefer-at error
    return this.#items[this.#items.length - 1];
  }

  mismatched(): number {
    return this.#items[this.#limits.length - 1];
  }
}
`)
}
