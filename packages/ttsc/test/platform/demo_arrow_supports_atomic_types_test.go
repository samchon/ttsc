package main

import "testing"

// TestDemoArrowSupportsAtomicTypes verifies every demo predicate branch.
//
// demoArrow is the helper behind the command's synthetic JavaScript output. It
// owns the supported atomic type table, including the empty string fallback used
// when a caller leaves --type at its default path.
//
// This scenario covers each successful switch branch without involving flag
// parsing. Keeping the helper check direct makes failures point to the predicate
// map rather than the command wrapper.
//
// 1. Ask demoArrow for every supported atomic type and the empty fallback.
// 2. Compare each returned JavaScript predicate exactly.
// 3. Assert that none of the supported branches returns an error.
func TestDemoArrowSupportsAtomicTypes(t *testing.T) {
	cases := map[string]string{
		"any":     "(input) => true",
		"boolean": `(input) => "boolean" === typeof input`,
		"number":  `(input) => "number" === typeof input`,
		"bigint":  `(input) => "bigint" === typeof input`,
		"string":  `(input) => "string" === typeof input`,
		"":        `(input) => "string" === typeof input`,
	}
	for input, expected := range cases {
		actual, err := demoArrow(input)
		if err != nil {
			t.Fatalf("demoArrow(%q) returned error: %v", input, err)
		}
		if actual != expected {
			t.Fatalf("demoArrow(%q) = %q, want %q", input, actual, expected)
		}
	}
}
