package rule_test

import (
  "encoding/json"
  "errors"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestContextDecodeOptionsPreservesDefaultsAndDecoderErrors verifies all five
// public context helpers preserve absence and standard JSON decoding semantics.
//
// Present options update a caller-owned destination rather than constructing a
// cached replacement. Invalid input returns the standard decoder's error; JSON
// type errors do not promise transactional rollback of all destination fields.
//
//  1. Exercise nil receivers and absent payloads without changing defaults.
//  2. Decode a partial object into distinct defaults, preserving omitted fields.
//  3. Check syntax, type and invalid-destination errors plus JSON null behavior.
//
// @evidence contracts/testing.md#behavioral-verification The actual Context, ProjectContext, ProjectInputContext, HintContext and GraphContext DecodeOptions methods preserve caller defaults for absent input, decode present fields without replacing omitted defaults, and return standard JSON errors rather than swallowing them.
// @evidence contracts/testing.md#independent-expectations Authored default values and literal JSON specify destination updates independently of the helpers. Standard encoding/json documents SyntaxError, UnmarshalTypeError, InvalidUnmarshalError and null-to-scalar behavior; assertions use those public error types without reproducing decoder logic or assuming rollback after a type error.
// @evidence contracts/testing.md#distinguishing-cases Each named context runs nil receiver, nil and empty options, populated partial object with an unknown member, distinct destination defaults, malformed syntax, wrong field type, nil destination and JSON null cases. Custom unmarshaler effects and filesystem path interpretation are not claimed by these ordinary destination cases.
// @evidence contracts/testing.md#execution-ownership One direct external-package unit registers five separately named context subcases and calls the public option-decoding operations with raw JSON. It needs no Program, registry, filesystem fixture, native artifact or installed consumer.
func TestContextDecodeOptionsPreservesDefaultsAndDecoderErrors(t *testing.T) {
  contexts := []struct {
    name string
    decode func(json.RawMessage) func(interface{}) error
    absent func(interface{}) error
  }{
    {"file", func(raw json.RawMessage) func(interface{}) error { return (&rule.Context{Options: raw}).DecodeOptions }, (*rule.Context)(nil).DecodeOptions},
    {"project", func(raw json.RawMessage) func(interface{}) error { return (&rule.ProjectContext{Options: raw}).DecodeOptions }, (*rule.ProjectContext)(nil).DecodeOptions},
    {"input", func(raw json.RawMessage) func(interface{}) error { return (&rule.ProjectInputContext{Options: raw}).DecodeOptions }, (*rule.ProjectInputContext)(nil).DecodeOptions},
    {"hint", func(raw json.RawMessage) func(interface{}) error { return (&rule.HintContext{Options: raw}).DecodeOptions }, (*rule.HintContext)(nil).DecodeOptions},
    {"graph", func(raw json.RawMessage) func(interface{}) error { return (&rule.GraphContext{Options: raw}).DecodeOptions }, (*rule.GraphContext)(nil).DecodeOptions},
  }
  for _, context := range contexts {
    t.Run(context.name, func(t *testing.T) {
      type options struct {
        Mode string `json:"mode"`
        Count int `json:"count"`
      }
      for _, decode := range []func(interface{}) error{context.absent, context.decode(nil), context.decode(json.RawMessage{})} {
        out := options{Mode: "default", Count: 7}
        if err := decode(&out); err != nil || out != (options{Mode: "default", Count: 7}) {
          t.Fatalf("absence changed defaults: out=%#v error=%v", out, err)
        }
        if err := decode(nil); err != nil {
          t.Fatalf("absence decoded an invalid destination: %v", err)
        }
      }
      decode := context.decode(json.RawMessage(`{"mode":"loud","unknown":true}`))
      for _, count := range []int{7, 11} {
        out := options{Mode: "default", Count: count}
        if err := decode(&out); err != nil || out != (options{Mode: "loud", Count: count}) {
          t.Fatalf("partial decode lost destination defaults: out=%#v error=%v", out, err)
        }
      }
      out := options{Mode: "default", Count: 7}
      var syntaxError *json.SyntaxError
      if err := context.decode(json.RawMessage(`{"mode":`))(&out); !errors.As(err, &syntaxError) || out != (options{Mode: "default", Count: 7}) {
        t.Fatalf("syntax error was swallowed or changed destination: out=%#v error=%v", out, err)
      }
      var typeError *json.UnmarshalTypeError
      if err := context.decode(json.RawMessage(`{"count":"wrong"}`))(&out); !errors.As(err, &typeError) {
        t.Fatalf("field type error was not returned: %v", err)
      }
      var destinationError *json.InvalidUnmarshalError
      if err := decode(nil); !errors.As(err, &destinationError) {
        t.Fatalf("present options accepted nil destination: %v", err)
      }
      scalar := 23
      if err := context.decode(json.RawMessage(`null`))(&scalar); err != nil || scalar != 23 {
        t.Fatalf("JSON null changed scalar default: value=%d error=%v", scalar, err)
      }
    })
  }
}
