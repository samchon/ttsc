package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestBoundariesDependenciesValidatesCompleteOptionShape verifies malformed
// policy configuration fails before rule dispatch.
//
// Silent decoding was the stub's production behavior. This matrix pins the
// object boundary, known keys, element descriptors, policy effects, selector
// fields, dependency kinds, and boolean gates while retaining legacy strings.
//
// 1. Validate representative malformed options at every nesting level.
// 2. Validate one legacy and one direction-aware object-selector configuration.
// 3. Assert each invalid payload names its actionable contract failure.
func TestBoundariesDependenciesValidatesCompleteOptionShape(t *testing.T) {
  rule := LookupRule("boundaries/dependencies")
  validator, ok := rule.(ruleOptionsValidator)
  if !ok {
    t.Fatal("boundaries/dependencies must validate options")
  }
  invalid := []struct {
    options string
    want    string
  }{
    {`[]`, `options must be an object`},
    {`{"unexpected":true}`, `unknown option "unexpected"`},
    {`{"default":"deny"}`, `must be "allow" or "disallow"`},
    {`{"policies":[],"rules":[]}`, `cannot be combined`},
    {`{"elements":[{"type":"app"}]}`, `requires non-empty "type" and "pattern"`},
    {`{"elements":[{"type":"app","pattern":"src/**","entry":1}]}`, `entry must be a string or array of strings`},
    {`{"policies":{}}`, `policies must be an array`},
    {`{"rules":{}}`, `rules must be an array`},
    {`{"rules":[{"from":"app"}]}`, `rules[0] requires at least one of "allow" or "disallow"`},
    {`{"policies":[{"from":"app"}]}`, `requires at least one of "allow" or "disallow"`},
    {`{"policies":[{"disallow":{"unexpected":true}}]}`, `unknown option "unexpected"`},
    {`{"policies":[{"disallow":{"dependency":{"kind":"runtime"}}}]}`, `unsupported value "runtime"`},
    {`{"policies":[{"importKind":"runtime","disallow":"app"}]}`, `importKind must be "value", "type", or "typeof"`},
    {`{"checkAllOrigins":"yes"}`, `checkAllOrigins must be a boolean`},
  }
  for _, test := range invalid {
    err := validator.ValidateOptions(json.RawMessage(test.options))
    if err == nil || !strings.Contains(err.Error(), test.want) {
      t.Fatalf("ValidateOptions(%s) = %v, want error containing %q", test.options, err, test.want)
    }
  }

  valid := []string{
    `{"elements":[{"type":"app","pattern":"src/app/**"}],"rules":[{"from":"app","allow":"app"}]}`,
    `{"elements":[{"type":"app","pattern":"src/app/**"}],"default":"allow","checkAllOrigins":true,"checkUnknownLocals":true,"checkInternals":true,"policies":[{"from":{"type":"app","entry":false},"dependency":{"kind":"type"},"disallow":{"to":{"origin":"external","source":"pkg"}},"message":"blocked"}]}`,
  }
  for _, options := range valid {
    if err := validator.ValidateOptions(json.RawMessage(options)); err != nil {
      t.Fatalf("ValidateOptions(%s) = %v", options, err)
    }
  }
}
