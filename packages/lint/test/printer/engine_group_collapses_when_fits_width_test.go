package main

import "testing"

// TestEngineGroupCollapsesWhenFitsWidth verifies a Group whose flat
// projection fits the remaining columns renders Lines as single spaces
// and Softlines as nothing.
//
// This is the fit branch of the fit-or-break decision. If it
// regressed, every "short call expression" would needlessly break
// across lines, producing diffs that look like a runaway formatter.
// The fixture sets a wide budget so the flat layout clearly wins.
//
//  1. Build a group with two Text fragments separated by Line.
//  2. Print under printWidth=80.
//  3. Assert the result is `foo bar` on a single line.
func TestEngineGroupCollapsesWhenFitsWidth(t *testing.T) {
  doc := Group(Text("foo"), Line(), Text("bar"))
  got := Print(doc, DefaultPrintOptions())
  if got != "foo bar" {
    t.Fatalf("flat group mismatch: %q", got)
  }
}
