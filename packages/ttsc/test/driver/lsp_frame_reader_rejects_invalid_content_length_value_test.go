package driver_test

import (
  "bytes"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderRejectsInvalidContentLengthValue Verifies that FrameReader rejects non-integer and negative lengths with an error mentioning Content-Length.
//
// Two malformed rows are checked; the assertion does not require a particular missing-header error identity.
//
// 1. Read a frame with a non-numeric Content-Length.
// 2. Read a frame with a negative Content-Length.
// 3. Assert both fail with errors mentioning Content-Length.
//
// @evidence contracts/testing.md#behavioral-verification FrameReader rejects non-integer and negative lengths with an error mentioning Content-Length.
// @evidence contracts/testing.md#independent-expectations Neither nope nor -3 is a nonnegative LSP body byte count.
// @evidence contracts/testing.md#distinguishing-cases Two malformed rows are checked; the assertion does not require a particular missing-header error identity.
// @evidence contracts/testing.md#execution-ownership Each table row owns its bytes.Reader and calls the public Go frame parser. Go discovers TestLSPFrameReaderRejectsInvalidContentLengthValue under ./test/driver.
func TestLSPFrameReaderRejectsInvalidContentLengthValue(t *testing.T) {
  cases := []struct {
    name  string
    input string
  }{
    {name: "non-integer", input: "Content-Length: nope\r\n\r\n"},
    {name: "negative", input: "Content-Length: -3\r\n\r\n"},
  }
  for _, tc := range cases {
    t.Run(tc.name, func(t *testing.T) {
      fr := driver.NewFrameReader(bytes.NewReader([]byte(tc.input)))
      _, _, err := fr.Read()
      if err == nil {
        t.Fatalf("expected error for %q", tc.input)
      }
      if !strings.Contains(err.Error(), "Content-Length") {
        t.Fatalf("error should mention Content-Length: %v", err)
      }
    })
  }
}
