package linthost

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
//
// @evidence contracts/testing.md#behavioral-verification Actual adapter conversion returns nil for both nil and nonnil zero-length public edit slices, retaining diagnostic-only nil-fix semantics.
// @evidence contracts/testing.md#independent-expectations Literal nil identity is the independently required empty conversion representation; length-zero alone would permit the incompatible nonnil result.
// @evidence contracts/testing.md#distinguishing-cases Nil input and separately allocated empty input exercise both representations; the sibling three-edit conversion unit supplies a nonempty positive control.
// @evidence contracts/testing.md#execution-ownership The owning conversion function executes directly in one Go process without contributor registration, native linkage, installation or source-interface checks.
func TestContribAdapterToInternalTextEditsReturnsNilForEmptyInput(t *testing.T) {
  if got := toInternalTextEdits(nil); got != nil {
    t.Fatalf("nil input should return nil, got %+v", got)
  }
  if got := toInternalTextEdits([]rule.TextEdit{}); got != nil {
    t.Fatalf("empty input should return nil, got %+v", got)
  }
}
