package transformer

import (
  "strings"
  "testing"
)

// TestTransformGoUpper verifies the uppercase fixture operation.
//
// The reusable Go transformer fixture rewrites the synthetic goUpper call
// before TypeScript output is consumed by higher-level feature tests. This
// baseline keeps the primary operation observable at the package boundary.
//
// 1. Transform a source file containing one goUpper call.
// 2. Apply the explicit go-uppercase plugin operation.
// 3. Assert the emitted code contains the uppercased string literal.
//
// @evidence contracts/testing.md#behavioral-verification Transform applies the explicit uppercase operation to the authored goUpper input and emits the complete CommonJS binding and console call.
// @evidence contracts/testing.md#independent-expectations A literal complete emitted module fixes the export, transformed value and console call independently of Transform.
// @evidence contracts/testing.md#distinguishing-cases The lower-case input and uppercase literal distinguish an unchanged source or omitted operation; full output also rejects dropped exports or a dropped console-call statement. The generated code is not executed here.
// @evidence contracts/testing.md#execution-ownership This case calls the reusable fixture Transform directly in the existing Go unit process; it does not build or execute the native sidecar.
func TestTransformGoUpper(t *testing.T) {
  result, err := Transform(`export const message: string = goUpper("hello"); console.log(message);`, []Plugin{
    {Operation: "go-uppercase"},
  })
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(result.Code, `"HELLO"`) {
    t.Fatalf("expected transformed literal, got:\n%s", result.Code)
  }

  want := "\"use strict\";\nObject.defineProperty(exports, \"__esModule\", { value: true });\nexports.message = void 0;\nconst message = \"HELLO\";\nexports.message = message;\nconsole.log(message);\n"
  if result.Code != want { t.Fatalf("complete uppercase output = %q, want %q", result.Code, want) }
}
