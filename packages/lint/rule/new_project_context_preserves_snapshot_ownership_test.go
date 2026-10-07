package rule_test

import (
  "encoding/json"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// TestNewProjectContextPreservesSnapshotOwnership verifies check contexts copy
// source-slice and option storage while preserving supplied shared references.
//
// Source entries and the checker are opaque host-owned objects, not deep copies.
// Mutating slice slots must not change host or another contributor's inputs.
// Reporter capabilities and actual Program population have separate host units.
//
//  1. Construct two contexts from literal identity, sources, checker and options.
//  2. Mutate input and one result, observing the untouched sibling and original.
//  3. Construct nil and empty snapshots without fabricating sources or checker.
//
// @evidence contracts/testing.md#behavioral-verification NewProjectContext preserves identity, severity and the exact checker/source object references while independently owning source-slice and option-byte backing storage. Input and result mutation cannot overwrite a sibling snapshot.
// @evidence contracts/testing.md#independent-expectations Authored identity fields, source/checker pointer tokens, literal JSON and severities define the snapshot. Pointer equality tests intentional shared object identity; independent slice-slot and byte mutations distinguish storage aliases without using producer normalization or reading AST internals.
// @evidence contracts/testing.md#distinguishing-cases Two populated contexts have different severity and shared opaque source/checker references; input and first-result mutations isolate host, result and sibling storage. Nil and empty collections with zero identity and nil checker/reporter distinguish absence. State-publication/reporting capabilities and real source selection are covered by host cycle units, not claimed here.
// @evidence contracts/testing.md#execution-ownership The external-package direct unit calls only NewProjectContext with opaque source/checker allocations and JSON bytes. It does not invoke compiler internals, load a Program, register a rule, install an artifact or start a host process.
func TestNewProjectContextPreservesSnapshotOwnership(t *testing.T) {
  identity := rule.ProjectIdentity{LifecycleID: "host-cycle", InvocationCwd: "/invocation", LogicalProjectRoot: "/logical", PhysicalProjectRoot: "/physical"}
  sourceA := new(shimast.SourceFile)
  sourceB := new(shimast.SourceFile)
  checker := new(shimchecker.Checker)
  sources := []*shimast.SourceFile{sourceA, sourceB}
  options := json.RawMessage(`{"mode":"strict"}`)
  first := rule.NewProjectContext(identity, sources, checker, rule.SeverityWarn, options, nil)
  second := rule.NewProjectContext(identity, sources, checker, rule.SeverityError, options, nil)
  sources[0] = nil
  options[0] = 'X'
  if first == nil || second == nil || first == second || first.Identity != identity || second.Identity != identity || first.Checker != checker || second.Checker != checker || first.Severity != rule.SeverityWarn || second.Severity != rule.SeverityError {
    t.Fatalf("constructor changed snapshot values: first=%#v second=%#v", first, second)
  }
  for _, context := range []*rule.ProjectContext{first, second} {
    if len(context.Sources) != 2 || context.Sources[0] != sourceA || context.Sources[1] != sourceB || string(context.Options) != `{"mode":"strict"}` {
      t.Fatalf("input mutation changed snapshot: %#v", context)
    }
  }
  first.Sources[1] = nil
  first.Options[0] = 'Y'
  first.Identity.PhysicalProjectRoot = "/mutated"
  if len(second.Sources) != 2 || second.Sources[0] != sourceA || second.Sources[1] != sourceB || second.Identity != identity || string(second.Options) != `{"mode":"strict"}` || sources[0] != nil || sources[1] != sourceB || options[0] != 'X' {
    t.Fatalf("result storage aliases sibling or input: second=%#v sources=%v options=%q", second, sources, options)
  }
  for _, empty := range []struct {
    sources []*shimast.SourceFile
    options json.RawMessage
  }{{nil, nil}, {[]*shimast.SourceFile{}, json.RawMessage{}}} {
    context := rule.NewProjectContext(rule.ProjectIdentity{}, empty.sources, nil, rule.SeverityOff, empty.options, nil)
    if context == nil || context.Identity != (rule.ProjectIdentity{}) || context.Checker != nil || context.Severity != rule.SeverityOff || len(context.Sources) != 0 || len(context.Options) != 0 {
      t.Fatalf("empty context manufactured inputs: %#v", context)
    }
  }
}
