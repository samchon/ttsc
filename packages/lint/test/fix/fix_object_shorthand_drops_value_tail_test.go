package main

import "testing"

// TestFixObjectShorthandDropsValueTail verifies the object-shorthand
// fixer collapses `{ x: x }` to `{ x }`.
//
// The rule only fires when the property's key identifier equals the
// initializer's identifier, so deleting the `: <initializer>` tail
// preserves runtime semantics. The fixer must leave surrounding
// properties and the brace pair alone.
//
// 1. Parse an object literal with `{ x: x }`.
// 2. Apply the finding through the disk-backed fixer.
// 3. Assert the redundant tail is gone.
func TestFixObjectShorthandDropsValueTail(t *testing.T) {
  assertFixSnapshot(
    t,
    "object-shorthand",
    "const x = 1;\nconst obj = { x: x };\nJSON.stringify(obj);\n",
    "const x = 1;\nconst obj = { x };\nJSON.stringify(obj);\n",
  )
}
