package linthost

import (
  "encoding/json"
  "testing"
)

// TestNoRestrictedSyntaxChecksStructuredOptionUniquenessByFields verifies
// duplicate detection compares structured options field by field.
//
// Two options differing only where a delimiter-looking substring falls must stay
// distinct, while an identical selector and message pair is a duplicate.
//
//  1. Decode two option sets whose selector and message contain NUL and
//     delimiter-like text.
//  2. Decode a set repeating one identical structured record.
//  3. Assert the distinct records are accepted and the repeated record is rejected.
//
// @evidence contracts/testing.md#behavioral-verification The actual option decoder preserves both distinct NUL-containing field records and rejects a repeated identical structured record.
// @evidence contracts/testing.md#independent-expectations Independently authored selector/message tuples stay distinct despite delimiter-looking substrings; exact tuple equality, not serialized concatenation, defines a duplicate.
// @evidence contracts/testing.md#distinguishing-cases Different field boundaries sharing a misleading delimiter layout remain accepted; an identical structured option pair rejects.
// @evidence contracts/testing.md#execution-ownership TestNoRestrictedSyntaxChecksStructuredOptionUniquenessByFields is selected in the shared Go unit population. It calls decodeNoRestrictedSyntaxOptions directly with the authored structured JSON inputs. No installed consumer, native artifact build or real product host runs.
func TestNoRestrictedSyntaxChecksStructuredOptionUniquenessByFields(t *testing.T) {
  options, err := decodeNoRestrictedSyntaxOptions(json.RawMessage(`[
    {"selector":"A","message":"B\u0000true\u0000C"},
    {"selector":"A\u0000true\u0000B","message":"C"}
  ]`))
  if err != nil || len(options) != 2 {
    t.Fatalf("distinct structured options collided: options=%+v err=%v", options, err)
  }

  if options[0].selector != "A" || options[0].message != "B\x00true\x00C" || !options[0].messageSet ||
    options[1].selector != "A\x00true\x00B" || options[1].message != "C" || !options[1].messageSet {
    t.Fatalf("decoded structured fields changed: %+v", options)
  }
  _, duplicateErr := decodeNoRestrictedSyntaxOptions(json.RawMessage(`[{"selector":"A","message":"B\u0000true\u0000C"},{"selector":"A","message":"B\u0000true\u0000C"}]`))
  if duplicateErr == nil { t.Fatal("identical structured options must reject") }
}
