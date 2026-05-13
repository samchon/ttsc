package driver_test

import (
  "testing"
  _ "unsafe"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

//go:linkname spliceCall github.com/samchon/ttsc/packages/ttsc/driver.spliceCall
func spliceCall(text string, rewrite driver.Rewrite, searchFrom int) (string, int, bool, error)

func spliceForTest(t *testing.T, text string) string {
  t.Helper()
  got, _, ok, err := spliceCall(text, driver.Rewrite{
    RootName:      "plugin",
    Method:        "make",
    Replacement:   "replacement",
    ConsumeParens: true,
  }, 0)
  if err != nil {
    t.Fatal(err)
  }
  if !ok {
    t.Fatal("rewrite did not match")
  }
  return got
}
