package rule_test

import (
  "encoding/json"
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestNewProjectInputContextPreservesOwnedOptions verifies dependency contexts
// preserve the supplied identity while isolating their option byte storage.
//
// The constructor receives an already resolved snapshot. It must not mint a
// lifecycle or canonicalize native strings, and each publisher owns its copy
// of mutable option bytes rather than the host's original payload.
//
//  1. Construct two contexts with every identity channel and literal options.
//  2. Mutate input and first-context data, checking the other context is intact.
//  3. Construct nil/empty-option contexts and require the supplied zero identity.
//
// @evidence contracts/testing.md#behavioral-verification NewProjectInputContext preserves all eight identity fields and supplied severity, copies option bytes for each output, and accepts nil or empty payloads without inventing identity or options.
// @evidence contracts/testing.md#independent-expectations An authored eight-field identity and literal JSON payload specify preservation independently of producer normalizers. Mutations in input and one result distinguish owned byte slices and copied identity records from aliases by observing the untouched sibling and original storage.
// @evidence contracts/testing.md#distinguishing-cases Populated identity includes logical/physical differences and optional origins; two independently constructed contexts receive different severity. Nil/empty payload plus zero identity is an adjacent absence control; no decoder or filesystem normalization is claimed.
// @evidence contracts/testing.md#execution-ownership The direct external-package unit calls the constructor with string channels and JSON bytes. It needs no registry, Program, real native filesystem, producer build or consumer installation.
func TestNewProjectInputContextPreservesOwnedOptions(t *testing.T) {
  identity := rule.ProjectIdentity{
    LifecycleID:         "host-cycle",
    InvocationCwd:       "/caller/invocation",
    LogicalConfigPath:   "/logical/tsconfig.json",
    LogicalProjectRoot:  "/logical",
    PhysicalConfigPath:  "/physical/tsconfig.json",
    PhysicalProjectRoot: "/physical",
    ExplicitProjectRoot: "/explicit",
    PluginConfigOrigin:  "/plugin-origin",
  }
  expectedIdentity := identity
  options := json.RawMessage(`{"file":"docs/first.md"}`)
  first := rule.NewProjectInputContext(identity, rule.SeverityWarn, options)
  second := rule.NewProjectInputContext(identity, rule.SeverityError, options)
  identity.LogicalConfigPath = "/mutated/input"
  options[0] = 'X'
  if first == nil || second == nil || first == second || first.Identity != expectedIdentity || second.Identity != expectedIdentity || first.Severity != rule.SeverityWarn || second.Severity != rule.SeverityError {
    t.Fatalf("constructor changed supplied snapshot values: first=%#v second=%#v", first, second)
  }
  if string(first.Options) != `{"file":"docs/first.md"}` || string(second.Options) != `{"file":"docs/first.md"}` {
    t.Fatalf("input mutation changed owned option copies: first=%q second=%q", first.Options, second.Options)
  }
  first.Identity.PhysicalProjectRoot = "/mutated/first"
  first.Options[0] = 'Y'
  if second.Identity != expectedIdentity || string(second.Options) != `{"file":"docs/first.md"}` || options[0] != 'X' {
    t.Fatalf("context storage aliases sibling or input: second=%#v input=%q", second, options)
  }
  for _, absent := range []json.RawMessage{nil, {}} {
    context := rule.NewProjectInputContext(rule.ProjectIdentity{}, rule.SeverityOff, absent)
    if context == nil || context.Identity != (rule.ProjectIdentity{}) || context.Severity != rule.SeverityOff || len(context.Options) != 0 {
      t.Fatalf("empty context fabricated identity or options: %#v", context)
    }
  }
}
