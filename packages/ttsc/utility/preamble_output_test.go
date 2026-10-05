package utility

import (
  "encoding/base64"
  "encoding/json"
  "strings"
  "testing"
)

// TestPreambleOutputGeneratedCoordinates checks the actual final-writer map
// operations with independently encoded generated/original coordinate literals.
// It executes no compiler Program, Node, host process or custom transport.
//
// @evidence contracts/testing.md#behavioral-verification Actual insertion/flat-map/inline-map operations relocate generated coordinates while retaining original mappings and sourcesContent.
// @evidence contracts/testing.md#independent-expectations Expected VLQ rows, BOM/hashbang insertion lines, CRLF/Unicode widths and authored source text are independent literals.
// @evidence contracts/testing.md#distinguishing-cases Zero movement, whole-line versus partial-line insertion, inline versus external JSON, unmapped lines and malformed metadata distinguish incorrect offset, source rewriting and silent failure.
// @evidence contracts/testing.md#execution-ownership This utility-package Go unit calls private operations directly with strings and JSON/base64 in its test process; actual native artifact delivery and Runtime stack application remain separate owners.
func TestPreambleOutputGeneratedCoordinates(t *testing.T) {
  const original = `{"version":3,"file":"entry.cjs","sources":["entry.cts"],"sourcesContent":["throw '<&>';"],"names":[],"mappings":"AAAA;CAAC"}`
  for _, row := range []struct {
    name string
    insertion preambleInsertion
    mappings string
  }{
    {"unchanged", preambleInsertion{}, "AAAA;CAAC"},
    {"seven lines", preambleInsertion{lines: 7}, ";;;;;;;AAAA;CAAC"},
    {"same line", preambleInsertion{column: 2}, "EAAA;CAAC"},
    {"partial last line", preambleInsertion{lines: 2, column: 2}, ";;EAAA;CAAC"},
    {"after hashbang", preambleInsertion{line: 1, lines: 2, column: 2}, "AAAA;;;GAAC"},
  } {
    t.Run(row.name, func(t *testing.T) {
      output, err := shiftPreambleMap(original, row.insertion)
      if err != nil { t.Fatal(err) }
      var mapValue struct { Mappings string; SourcesContent []string }
      if err := json.Unmarshal([]byte(output), &mapValue); err != nil { t.Fatal(err) }
      if mapValue.Mappings != row.mappings || len(mapValue.SourcesContent) != 1 || mapValue.SourcesContent[0] != "throw '<&>';" {
        t.Fatalf("map mismatch: %s", output)
      }
    })
  }
  for _, row := range []struct { source, prefix string; expected preambleInsertion }{
    {"body", "a\r\nb\u2028😀", preambleInsertion{lines: 2, column: 2}},
    {"\ufeffbody", "// banner\n", preambleInsertion{lines: 1}},
    {"\ufeff#!/bin/node\nbody", "// banner\n", preambleInsertion{line: 1, lines: 1}},
  } {
    if actual := preambleInsertionFor(row.source, row.prefix); actual != row.expected { t.Fatalf("insertion=%#v expected=%#v", actual, row.expected) }
  }
  inline := "body\n" + preambleInlineMarker + base64.StdEncoding.EncodeToString([]byte(original)) + "\r\n"
  output, err := shiftPreambleInlineMap(inline, preambleInsertion{lines: 7})
  if err != nil { t.Fatal(err) }
  payload := strings.TrimSuffix(strings.Split(output, preambleInlineMarker)[1], "\r\n")
  decoded, err := base64.StdEncoding.DecodeString(payload)
  if err != nil { t.Fatal(err) }
  if !strings.Contains(string(decoded), `"mappings":";;;;;;;AAAA;CAAC"`) || !strings.HasPrefix(output, "body\n") { t.Fatalf("inline mismatch: %q", output) }
  for _, malformed := range []string{`{`, `{"version":2,"mappings":"AAAA"}`, `{"version":3,"mappings":0}`} {
    if _, err := shiftPreambleMap(malformed, preambleInsertion{lines: 1}); err == nil { t.Fatalf("malformed map admitted: %q", malformed) }
  }
  if _, err := shiftPreambleInlineMap("body\n" + preambleInlineMarker + "!", preambleInsertion{lines: 1}); err == nil { t.Fatal("malformed inline map admitted") }
  if output, err := shiftPreambleInlineMap("body\n", preambleInsertion{lines: 7}); err != nil || output != "body\n" { t.Fatalf("map-free body changed: %q %v", output, err) }
  if _, err := shiftPreambleColumn("g", 1); err == nil { t.Fatal("unterminated generated column admitted") }
  if _, err := shiftPreambleColumn("B", 1); err == nil { t.Fatal("negative generated column admitted") }
}
