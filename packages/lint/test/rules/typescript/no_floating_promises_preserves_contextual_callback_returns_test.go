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
//  2. Compare it with generic and non-generic unsafe literal-return candidates.
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
interface GenericCandidate {
  catch<T>(onRejected: () => T): Promise<void>;
  catch<T>(onRejected: () => string): undefined;
}
interface ConstrainedCandidate {
  catch<T extends "narrow">(onRejected: () => T): Promise<void>;
  catch(onRejected: () => string): undefined;
}
declare const candidate: Candidate;
declare const genericCandidate: GenericCandidate;
declare const constrainedCandidate: ConstrainedCandidate;
declare function contextual(onRejected: () => string): void;
declare function genericContextual<T>(onRejected: () => string): void;
candidate.catch(() => "narrow");
genericCandidate.catch<"narrow">(() => "narrow");
constrainedCandidate.catch(() => "narrow");
contextual(() => "narrow");
genericContextual<"narrow">(() => "narrow");
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
  genericCandidateCall := callAt("genericCandidate.catch")
  constrainedCandidateCall := callAt("constrainedCandidate.catch")
  contextualCall := callAt("contextual(()")
  genericContextualCall := callAt("genericContextual<\"narrow\">")
  candidateExpression := candidateCall.AsCallExpression()
  genericCandidateExpression := genericCandidateCall.AsCallExpression()
  constrainedCandidateExpression := constrainedCandidateCall.AsCallExpression()
  contextualExpression := contextualCall.AsCallExpression()
  genericContextualExpression := genericContextualCall.AsCallExpression()
  if candidateExpression == nil || genericCandidateExpression == nil || constrainedCandidateExpression == nil ||
    contextualExpression == nil || genericContextualExpression == nil ||
    contextualExpression.Arguments == nil || len(contextualExpression.Arguments.Nodes) != 1 {
    t.Fatal("contextual callback fixture calls are malformed")
  }
  signaturesAt := func(expression *shimast.CallExpression) []*shimchecker.Signature {
    t.Helper()
    access := expression.Expression.AsPropertyAccessExpression()
    if access == nil {
      t.Fatal("candidate call is not a property access")
    }
    receiverType := prog.checker.GetTypeAtLocation(access.Expression)
    if receiverType == nil {
      t.Fatal("candidate receiver has no type")
    }
    property := prog.checker.GetPropertyOfType(receiverType, "catch")
    if property == nil {
      t.Fatal("candidate catch property not found")
    }
    propertyType := prog.checker.GetTypeOfSymbolAtLocation(property, expression.Expression)
    if propertyType == nil {
      t.Fatal("candidate catch property has no type")
    }
    return prog.checker.GetSignaturesOfType(propertyType, shimchecker.SignatureKindCall)
  }
  signatures := signaturesAt(candidateExpression)
  if len(signatures) != 2 {
    t.Fatalf("expected two candidate signatures, got %d", len(signatures))
  }
  callback := contextualExpression.Arguments.Nodes[0]
  if prog.checker.IsContextSensitive(callback) {
    t.Fatal("zero-parameter literal callback unexpectedly uses the Checker's narrow context-sensitive classification")
  }
  actualType := prog.checker.GetTypeAtLocation(callback)
  if actualType == nil {
    t.Fatal("original callback has no type")
  }
  actualSignatures := prog.checker.GetSignaturesOfType(actualType, shimchecker.SignatureKindCall)
  if len(actualSignatures) != 1 {
    t.Fatalf("original callback signatures = %d, want one", len(actualSignatures))
  }
  actualReturn := prog.checker.GetReturnTypeOfSignature(actualSignatures[0])
  if actualReturn == nil || prog.checker.TypeToString(actualReturn) != "string" {
    t.Fatal("original callback context did not widen the literal return to string")
  }

  if got := floatingPromiseSignatureApplicability(prog.checker, contextualExpression, signatures[0]);
    got != floatingPromiseCallUncertain {
    t.Fatalf("literal-return candidate applicability = %d, want uncertain", got)
  }
  if got := floatingPromiseSignatureApplicability(prog.checker, contextualExpression, signatures[1]);
    got != floatingPromiseCallApplicable {
    t.Fatalf("safe concrete candidate applicability = %d, want applicable", got)
  }
  ctx := &Context{File: file, Checker: prog.checker, CurrentDirectory: root}
  if got := floatingPromiseApplicableSignature(ctx, contextualExpression, signatures); got != nil {
    t.Fatal("safe overload selected after discarding a context-sensitive candidate")
  }

  genericSignatures := signaturesAt(genericCandidateExpression)
  if len(genericSignatures) != 2 || genericContextualExpression.Arguments == nil ||
    len(genericContextualExpression.Arguments.Nodes) != 1 {
    t.Fatalf("generic contextual fixture mismatch: signatures=%d", len(genericSignatures))
  }
  genericCallback := genericContextualExpression.Arguments.Nodes[0]
  if prog.checker.IsContextSensitive(genericCallback) {
    t.Fatal("generic literal callback unexpectedly uses the Checker's narrow context-sensitive classification")
  }
  if got := floatingPromiseSignatureApplicability(
    prog.checker,
    genericContextualExpression,
    genericSignatures[0],
  ); got != floatingPromiseCallUncertain {
    t.Fatalf("generic literal-return candidate applicability = %d, want uncertain", got)
  }
  if got := floatingPromiseSignatureApplicability(
    prog.checker,
    genericContextualExpression,
    genericSignatures[1],
  ); got != floatingPromiseCallApplicable {
    t.Fatalf("safe generic candidate applicability = %d, want applicable", got)
  }
  if got := floatingPromiseApplicableSignature(ctx, genericContextualExpression, genericSignatures); got != nil {
    t.Fatal("safe generic overload selected after discarding a context-sensitive candidate")
  }

  constrainedSignatures := signaturesAt(constrainedCandidateExpression)
  if len(constrainedSignatures) != 2 {
    t.Fatalf("expected two constrained candidate signatures, got %d", len(constrainedSignatures))
  }
  if got := floatingPromiseSignatureApplicability(
    prog.checker,
    contextualExpression,
    constrainedSignatures[0],
  ); got != floatingPromiseCallUncertain {
    t.Fatalf("constrained literal-return candidate applicability = %d, want uncertain", got)
  }
  if got := floatingPromiseSignatureApplicability(
    prog.checker,
    contextualExpression,
    constrainedSignatures[1],
  ); got != floatingPromiseCallApplicable {
    t.Fatalf("safe constrained twin applicability = %d, want applicable", got)
  }
  if got := floatingPromiseApplicableSignature(ctx, contextualExpression, constrainedSignatures); got != nil {
    t.Fatal("safe overload selected after discarding a constrained context-sensitive candidate")
  }
}
