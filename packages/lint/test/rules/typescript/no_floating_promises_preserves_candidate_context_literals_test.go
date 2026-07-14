package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestNoFloatingPromisesPreservesCandidateContextLiterals verifies a type
// cached under the canonical call cannot exclude an overload that would
// contextually type the same literal differently.
//
// Checker.IsContextSensitive intentionally tracks nested untyped functions,
// not every expression affected by contextual typing. Plain arrays, objects,
// and annotated callbacks returning them must therefore remain uncertain in
// both concrete and generic candidate proofs.
func TestNoFloatingPromisesPreservesCandidateContextLiterals(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "main.ts"), `interface ArrayCandidate {
  then(value: [1, 2], onRejected: () => void): Promise<void>;
  then(value: number[], onRejected: () => void): undefined;
}
interface GenericArrayCandidate {
  then<T = undefined>(value: [1, 2], onRejected: () => T): Promise<void>;
  then<T = undefined>(value: number[], onRejected: () => T): undefined;
}
interface CallbackCandidate {
  catch(onRejected: (reason: unknown) => { kind: "narrow" }): Promise<void>;
  catch(onRejected: (reason: unknown) => { kind: string }): undefined;
}
interface GenericCallbackCandidate {
  catch<T = undefined>(onRejected: (reason: unknown) => { kind: "narrow" }): Promise<void>;
  catch<T = undefined>(onRejected: (reason: unknown) => { kind: string }): undefined;
}
declare const arrayCandidate: ArrayCandidate;
declare const genericArrayCandidate: GenericArrayCandidate;
declare const callbackCandidate: CallbackCandidate;
declare const genericCallbackCandidate: GenericCallbackCandidate;
arrayCandidate.then([1, 2], () => undefined);
genericArrayCandidate.then([1, 2], () => undefined);
callbackCandidate.catch((reason: unknown): { kind: "narrow" } => ({ kind: "narrow" }));
genericCallbackCandidate.catch((reason: unknown): { kind: "narrow" } => ({ kind: "narrow" }));
declare function contextualArray(value: number[], onRejected: () => undefined): void;
declare function contextualCallback(onRejected: (reason: unknown) => { kind: string }): void;
contextualArray([1, 2], () => undefined);
contextualCallback((reason: unknown) => ({ kind: "narrow" }));
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
  callAt := func(marker string) *shimast.CallExpression {
    t.Helper()
    offset := strings.Index(file.Text(), marker)
    if offset < 0 {
      t.Fatalf("source marker %q not found", marker)
    }
    node := shimast.GetNodeAtPosition(file, offset, false)
    for node != nil && node.Kind != shimast.KindCallExpression {
      node = node.Parent
    }
    if node == nil || node.AsCallExpression() == nil {
      t.Fatalf("no call expression at %q", marker)
    }
    return node.AsCallExpression()
  }
  signaturesAt := func(call *shimast.CallExpression, propertyName string) []*shimchecker.Signature {
    t.Helper()
    access := call.Expression.AsPropertyAccessExpression()
    if access == nil {
      t.Fatal("candidate call is not a property access")
    }
    receiverType := prog.checker.GetTypeAtLocation(access.Expression)
    if receiverType == nil {
      t.Fatal("candidate receiver has no type")
    }
    property := prog.checker.GetPropertyOfType(receiverType, propertyName)
    if property == nil {
      t.Fatalf("candidate %s property not found", propertyName)
    }
    propertyType := prog.checker.GetTypeOfSymbolAtLocation(property, call.Expression)
    if propertyType == nil {
      t.Fatalf("candidate %s property has no type", propertyName)
    }
    return prog.checker.GetSignaturesOfType(propertyType, shimchecker.SignatureKindCall)
  }

  contextualArray := callAt("contextualArray([1, 2]")
  if contextualArray.Arguments == nil || len(contextualArray.Arguments.Nodes) != 2 {
    t.Fatal("contextual array fixture does not have two arguments")
  }
  arrayArgument := contextualArray.Arguments.Nodes[0]
  if prog.checker.IsContextSensitive(arrayArgument) {
    t.Fatal("plain array literal unexpectedly uses the Checker's narrow context-sensitive classification")
  }
  arrayType := prog.checker.GetTypeAtLocation(arrayArgument)
  if arrayType == nil {
    t.Fatal("canonical array has no type")
  }
  if got := prog.checker.TypeToString(arrayType); got != "number[]" {
    t.Fatalf("canonical array type = %q, want number[]", got)
  }

  contextualCallback := callAt("contextualCallback((reason: unknown)")
  if contextualCallback.Arguments == nil || len(contextualCallback.Arguments.Nodes) != 1 {
    t.Fatal("contextual callback fixture does not have one argument")
  }
  callbackArgument := contextualCallback.Arguments.Nodes[0]
  if prog.checker.IsContextSensitive(callbackArgument) {
    t.Fatal("annotated callback with a plain object return unexpectedly uses the narrow context-sensitive classification")
  }

  cases := []struct {
    name       string
    call       *shimast.CallExpression
    signatures []*shimchecker.Signature
  }{
    {
      name:       "array",
      call:       contextualArray,
      signatures: signaturesAt(callAt("arrayCandidate.then"), "then"),
    },
    {
      name:       "generic array",
      call:       contextualArray,
      signatures: signaturesAt(callAt("genericArrayCandidate.then"), "then"),
    },
    {
      name:       "callback return",
      call:       contextualCallback,
      signatures: signaturesAt(callAt("callbackCandidate.catch"), "catch"),
    },
    {
      name:       "generic callback return",
      call:       contextualCallback,
      signatures: signaturesAt(callAt("genericCallbackCandidate.catch"), "catch"),
    },
  }
  ctx := &Context{File: file, Checker: prog.checker, CurrentDirectory: root}
  for _, test := range cases {
    if len(test.signatures) != 2 {
      t.Fatalf("%s signatures = %d, want two", test.name, len(test.signatures))
    }
    for index, signature := range test.signatures {
      if got := floatingPromiseSignatureApplicability(prog.checker, test.call, signature);
        got != floatingPromiseCallUncertain {
        t.Fatalf("%s candidate %d applicability = %d, want uncertain", test.name, index, got)
      }
    }
    if got := floatingPromiseApplicableSignature(ctx, test.call, test.signatures); got != nil {
      t.Fatalf("%s selected a signature from candidate-contextual cached evidence", test.name)
    }
  }
}
