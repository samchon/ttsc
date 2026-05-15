package main

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContribAdapterToInternalTextEditsReturnsNilForEmptyInput pins the
// deliberate `nil` return at contrib_adapter.go::toInternalTextEdits's
// empty-input branch.
//
// `selectTextEdits` treats nil and zero-length slices identically, but
// the adapter's return type is intentionally nil so downstream code that
// inspects `finding.Fix == nil` to skip the fix path keeps working. A
// regression that returned a non-nil empty slice would silently flip the
// nil-check semantics everywhere downstream.
//
// 1. Call `toInternalTextEdits(nil)`.
// 2. Call `toInternalTextEdits([]rule.TextEdit{})`.
// 3. Assert both return nil (not a non-nil empty slice).
func TestContribAdapterToInternalTextEditsReturnsNilForEmptyInput(t *testing.T) {
  if got := toInternalTextEdits(nil); got != nil {
    t.Fatalf("nil input should return nil, got %+v", got)
  }
  if got := toInternalTextEdits([]rule.TextEdit{}); got != nil {
    t.Fatalf("empty input should return nil, got %+v", got)
  }
}
