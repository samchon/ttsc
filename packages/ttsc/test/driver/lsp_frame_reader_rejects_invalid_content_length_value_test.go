package driver_test

import (
  "bytes"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLSPFrameReaderRejectsInvalidContentLengthValue pins the strict
// parsing of the Content-Length value. Non-integer and negative values
// must look the same to Read — both invalidate the only header that
// declares a body length, so Read surfaces the same missing-header error.
//
// 1. Send a frame with a non-numeric Content-Length value.
// 2. Send a frame with a negative Content-Length value.
// 3. Assert both produce the missing-Content-Length error.
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
