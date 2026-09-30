package evidence

import (
  "encoding/json"
  "strings"
  "testing"
)

/**
 * Verifies each policy option rejects every non-boolean runtime shape.
 *
 * TypeScript catches most malformed literals, but JavaScript and unchecked generated config reach the native decoder directly. A JSON null is especially dangerous, because Go's decoder otherwise turns it into `false` — which looks exactly like an option nobody wrote.
 *
 *  1. Supply numbers, strings, arrays, objects, and nulls for each option.
 *  2. Decode each through a disabled claim as well as an enabled one.
 *  3. Assert the option-name boolean diagnostic fragment appears for every rejection.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual decodeGraphConfig and decoded native model are evaluated; this case asserts each of four policy flags rejects number, zero, string, array, object and null on both enabled and disabled claims.
 *
 * @evidence contracts/testing.md#independent-expectations The four published policy flags are booleans, so number/zero/string/array/object/null must be refused on enabled and disabled claims. The test requires the literal property-name boolean fragment; it does not independently assert the complete claims[0].reference prefix.
 *
 * @evidence contracts/testing.md#distinguishing-cases Each of four policy flags rejects number, zero, string, array, object and null on both enabled and disabled claims.
 *
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticReferencePolicyRejectsMalformedRuntimeShapes is the selectable unit entry in tests/test-evidence/go/unit, compiled into the shared native Go package by the repository overlay. It invokes decodeGraphConfig and its decoder/assertion helpers in process; its JSON artifact/package names are input strings and trigger no installation, artifact loader, native plugin build, or child process. Its local table variants remain owned by this entry.
 */
func TestEvidenceSemanticReferencePolicyRejectsMalformedRuntimeShapes(t *testing.T) {
  invalid := []struct {
    name  string
    value string
  }{
    {name: "number", value: "1"},
    {name: "zero", value: "0"},
    {name: "string", value: `"true"`},
    {name: "array", value: `[]`},
    {name: "object", value: `{}`},
    {name: "null", value: `null`},
  }
  for _, property := range []string{
    "noEvidenceExclude",
    "uniqueEvidence",
    "singleEvidencePerSymbol",
    "checklist",
  } {
    for _, test := range invalid {
      t.Run(test.name+" "+property, func(t *testing.T) {
        for _, disabled := range []string{"false", "true"} {
          _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{
            "type":"typescript",
            "disabled":` + disabled + `,
            "files":["src/**"],
            "reference":{
              "type":"markdown",
              "files":["docs/**"],
              "` + property + `":` + test.value + `
            }
          }]}`))
          expected := property + ": expected a boolean"
          if !strings.Contains(strings.Join(problems, "\n"), expected) {
            t.Fatalf("disabled=%s did not reject %s at %q: %v", disabled, test.name, expected, problems)
          }
        }
      })
    }
  }
}
