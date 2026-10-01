package linthost

import (
  "reflect"
  "regexp"
  "strconv"
  "testing"
)

// assertBindingDiagnosticSites compares independently authored identifier
// locations rather than accepting the same number of findings on wrong bindings.
func assertBindingDiagnosticSites(t *testing.T, stderr string, expected [][2]int) {
  t.Helper()
  rendered := ansiControlSequencePattern.ReplaceAllString(stderr, "")
  pattern := regexp.MustCompile(`(?m)main\.ts:(\d+):(\d+)\s+-\s+error\s+TS\d+:\s*\[prefer-const\]`)
  actual := [][2]int{}
  for _, match := range pattern.FindAllStringSubmatch(rendered, -1) {
    line, err := strconv.Atoi(match[1])
    if err != nil {
      t.Fatal(err)
    }
    column, err := strconv.Atoi(match[2])
    if err != nil {
      t.Fatal(err)
    }
    actual = append(actual, [2]int{line, column})
  }
  if !reflect.DeepEqual(actual, expected) {
    t.Fatalf("prefer-const binding sites: want=%v got=%v\nstderr=%s", expected, actual, stderr)
  }
}
