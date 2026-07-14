package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestNoFloatingPromisesPreservesContextualCallbackReturns verifies a callback
// type cached for the original call cannot exclude another overload candidate.
//
// A contextually typed literal return can widen under the original signature
// while remaining narrow under a candidate-specific signature. Reusing the
// widened return as intrinsic evidence would discard a possible unsafe overload.
//
//  1. Contextually widen a callback's literal return to string.
//  2. Compare it with an unsafe candidate that supplies a literal return context.
//  3. Assert the mismatch remains uncertain and prevents selecting the safe twin.
func TestNoFloatingPromisesPreservesContextualCallbackReturns(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "main.ts"), `interface Candidate {
  catch(onRejected: () => "narrow"): Promise<void>;
  catch(onRejected: () => string): undefined;
}
declare const candidate: Candidate;
declare function contextual(onRejected: () => string): void;
candidate.catch(() => "narrow");
contextual(() => "narrow");
`)

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    needsRuleChecker: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected configuration diagnostics: %#v", diags)
  }
  defer prog.close()
  files := prog.userSourceFiles()
  if len(files) != 1 || prog.checker == nil {
    t.Fatalf("program setup mismatch: files=%d checker=%v", len(files), prog.checker != nil)
  }
  file := files[0]
  callAt := func(marker string) *shimast.Node {
    t.Helper()
    offset := strings.Index(file.Text(), marker)
    if offset < 0 {
      t.Fatalf("source marker %q not found", marker)
    }
    node := shimast.GetNodeAtPosition(file, offset, false)
    for node != nil && node.Kind != shimast.KindCallExpression {
      node = node.Parent
    }
    if node == nil {
      t.Fatalf("no call expression at %q", marker)
    }
    return node
  }

  candidateCall := callAt("candidate.catch")
  contextualCall := callAt("contextual(()")
  candidateExpression := candidateCall.AsCallExpression()
  contextualExpression := contextualCall.AsCallExpression()
  if candidateExpression == nil || contextualExpression == nil ||
    contextualExpression.Arguments == nil || len(contextualExpression.Arguments.Nodes) != 1 {
    t.Fatal("contextual callback fixture calls are malformed")
  }
  receiver := candidateExpression.Expression.AsPropertyAccessExpression().Expression
  receiverType := prog.checker.GetTypeAtLocation(receiver)
  property := prog.checker.GetPropertyOfType(receiverType, "catch")
  if property == nil {
    t.Fatal("candidate catch property not found")
  }
  propertyType := prog.checker.GetTypeOfSymbolAtLocation(property, candidateExpression.Expression)
  signatures := prog.checker.GetSignaturesOfType(propertyType, shimchecker.SignatureKindCall)
  if len(signatures) != 2 {
    t.Fatalf("expected two candidate signatures, got %d", len(signatures))
  }
  callback := contextualExpression.Arguments.Nodes[0]
  if !prog.checker.IsContextSensitive(callback) {
    t.Fatal("callback fixture is not context sensitive")
  }
  actualType := prog.checker.GetTypeAtLocation(callback)
  actualSignatures := prog.checker.GetSignaturesOfType(actualType, shimchecker.SignatureKindCall)
  if len(actualSignatures) != 1 ||
    prog.checker.TypeToString(prog.checker.GetReturnTypeOfSignature(actualSignatures[0])) != "string" {
    t.Fatal("original callback context did not widen the literal return to string")
  }

  if got := floatingPromiseSignatureApplicability(prog.checker, contextualExpression, signatures[0]);
    got != floatingPromiseCallUncertain {
    t.Fatalf("literal-return candidate applicability = %d, want uncertain", got)
  }
  ctx := &Context{File: file, Checker: prog.checker, CurrentDirectory: root}
  if got := floatingPromiseApplicableSignature(ctx, contextualExpression, signatures); got != nil {
    t.Fatal("safe overload selected after discarding a context-sensitive candidate")
  }
}
