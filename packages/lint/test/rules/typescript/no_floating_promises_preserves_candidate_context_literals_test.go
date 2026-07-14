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
// not every expression affected by contextual typing. Plain literals, wrapper
// expressions, annotated callback returns, and generic calls with contextual
// return inference must therefore remain uncertain in candidate proofs.
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
  source := `interface ArrayCandidate {
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
interface TemplateCandidate {
  then(value: __BACKTICK__item-${number}__BACKTICK__, onRejected: () => void): Promise<void>;
  then(value: string, onRejected: () => void): undefined;
}
interface GenericTemplateCandidate {
  then<T = undefined>(value: __BACKTICK__item-${number}__BACKTICK__, onRejected: () => T): Promise<void>;
  then<T = undefined>(value: string, onRejected: () => T): undefined;
}
interface ConstAssertionCandidate {
  then(value: { callback: (input: "narrow") => "narrow" }, onRejected: () => void): Promise<void>;
  then(value: { callback: (input: string) => string }, onRejected: () => void): undefined;
}
interface NakedGenericCallbackCandidate {
  catch<T>(onRejected: () => T): T;
}
declare const arrayCandidate: ArrayCandidate;
declare const genericArrayCandidate: GenericArrayCandidate;
declare const callbackCandidate: CallbackCandidate;
declare const genericCallbackCandidate: GenericCallbackCandidate;
declare const templateCandidate: TemplateCandidate;
declare const genericTemplateCandidate: GenericTemplateCandidate;
declare const constAssertionCandidate: ConstAssertionCandidate;
declare const nakedGenericCallbackCandidate: NakedGenericCallbackCandidate;
arrayCandidate.then([1, 2], () => undefined);
genericArrayCandidate.then([1, 2], () => undefined);
callbackCandidate.catch((reason: unknown): { kind: "narrow" } => ({ kind: "narrow" }));
genericCallbackCandidate.catch((reason: unknown): { kind: "narrow" } => ({ kind: "narrow" }));
templateCandidate.then(__BACKTICK__item-${1 as number}__BACKTICK__, () => undefined);
genericTemplateCandidate.then(__BACKTICK__item-${1 as number}__BACKTICK__, () => undefined);
constAssertionCandidate.then({ callback: input => input } as const, () => undefined);
nakedGenericCallbackCandidate.catch(() => [Promise.resolve()]);
declare function contextualArray(value: number[], onRejected: () => undefined): void;
declare function contextualCallback(onRejected: (reason: unknown) => { kind: string }): void;
declare function contextualString(value: string, onRejected: () => undefined): void;
declare function contextualConstAssertion(
  value: { callback: (input: string) => string },
  onRejected: () => undefined,
): void;
declare function contextualValue<T>(): T;
declare function contextualPromiseArray(onRejected: () => unknown[]): void;
contextualArray([1, 2], () => undefined);
contextualCallback((reason: unknown) => ({ kind: "narrow" }));
contextualConstAssertion({ callback: input => input } as const, () => undefined);
contextualConstAssertion(
  { callback: (input: string) => input } as { callback: (input: string) => string },
  () => undefined,
);
contextualPromiseArray(() => [Promise.resolve()]);
async function candidateContextWrappers(): Promise<void> {
  contextualArray(await [1, 2], () => undefined);
  contextualArray(([1, 2])!, () => undefined);
  contextualArray(contextualValue(), () => undefined);
  contextualString(__BACKTICK__item-${1 as number}__BACKTICK__, () => undefined);
}
`
  writeFile(t, filepath.Join(root, "main.ts"), strings.ReplaceAll(source, "__BACKTICK__", "`"))

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

  genericCall := callAt("contextualArray(contextualValue()")
  if genericCall.Arguments == nil || len(genericCall.Arguments.Nodes) != 2 {
    t.Fatal("contextual generic-call fixture does not have two arguments")
  }
  genericCallType := prog.checker.GetTypeAtLocation(genericCall.Arguments.Nodes[0])
  if genericCallType == nil || prog.checker.TypeToString(genericCallType) != "number[]" {
    t.Fatal("canonical generic call did not infer the broad contextual return")
  }

  contextualCallback := callAt("contextualCallback((reason: unknown)")
  if contextualCallback.Arguments == nil || len(contextualCallback.Arguments.Nodes) != 1 {
    t.Fatal("contextual callback fixture does not have one argument")
  }
  callbackArgument := contextualCallback.Arguments.Nodes[0]
  if prog.checker.IsContextSensitive(callbackArgument) {
    t.Fatal("annotated callback with a plain object return unexpectedly uses the narrow context-sensitive classification")
  }

  contextualConstAssertion := callAt("contextualConstAssertion({ callback")
  if contextualConstAssertion.Arguments == nil || len(contextualConstAssertion.Arguments.Nodes) != 2 {
    t.Fatal("contextual const-assertion fixture does not have two arguments")
  }
  constAssertionArgument := contextualConstAssertion.Arguments.Nodes[0]
  if !shimast.IsConstAssertion(constAssertionArgument) {
    t.Fatal("contextual const-assertion fixture is not an as-const assertion")
  }

  ordinaryAssertion := callAt("contextualConstAssertion(\n  { callback: (input: string)")
  if ordinaryAssertion.Arguments == nil || len(ordinaryAssertion.Arguments.Nodes) != 2 {
    t.Fatal("ordinary assertion fixture does not have two arguments")
  }
  ordinaryAssertionArgument := ordinaryAssertion.Arguments.Nodes[0]
  if shimast.IsConstAssertion(ordinaryAssertionArgument) {
    t.Fatal("ordinary type assertion was classified as a const assertion")
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
    {
      name:       "await wrapper",
      call:       callAt("contextualArray(await"),
      signatures: signaturesAt(callAt("arrayCandidate.then"), "then"),
    },
    {
      name:       "non-null wrapper",
      call:       callAt("contextualArray(([1, 2])!"),
      signatures: signaturesAt(callAt("genericArrayCandidate.then"), "then"),
    },
    {
      name:       "generic call return",
      call:       genericCall,
      signatures: signaturesAt(callAt("arrayCandidate.then"), "then"),
    },
    {
      name:       "template expression",
      call:       callAt("contextualString(`item-${1 as number}`"),
      signatures: signaturesAt(callAt("templateCandidate.then"), "then"),
    },
    {
      name:       "generic template expression",
      call:       callAt("contextualString(`item-${1 as number}`"),
      signatures: signaturesAt(callAt("genericTemplateCandidate.then"), "then"),
    },
    {
      name:       "const assertion",
      call:       contextualConstAssertion,
      signatures: signaturesAt(callAt("constAssertionCandidate.then"), "then"),
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

  ordinarySignatures := signaturesAt(callAt("constAssertionCandidate.then"), "then")
  if len(ordinarySignatures) != 2 {
    t.Fatalf("ordinary assertion signatures = %d, want two", len(ordinarySignatures))
  }
  if got := floatingPromiseSignatureApplicability(prog.checker, ordinaryAssertion, ordinarySignatures[0]);
    got != floatingPromiseCallIncompatible {
    t.Fatalf("ordinary narrow-candidate applicability = %d, want incompatible", got)
  }
  if got := floatingPromiseSignatureApplicability(prog.checker, ordinaryAssertion, ordinarySignatures[1]);
    got != floatingPromiseCallApplicable {
    t.Fatalf("ordinary broad-candidate applicability = %d, want applicable", got)
  }
  if got := floatingPromiseApplicableSignature(ctx, ordinaryAssertion, ordinarySignatures);
    got != ordinarySignatures[1] {
    t.Fatal("ordinary type assertion did not select its proven broad candidate")
  }

  contextualPromiseArray := callAt("contextualPromiseArray(()")
  if contextualPromiseArray.Arguments == nil || len(contextualPromiseArray.Arguments.Nodes) != 1 {
    t.Fatal("contextual Promise-array callback fixture does not have one argument")
  }
  promiseArrayCallback := contextualPromiseArray.Arguments.Nodes[0]
  promiseArrayCallbackType := prog.checker.GetTypeAtLocation(promiseArrayCallback)
  if promiseArrayCallbackType == nil {
    t.Fatal("contextual Promise-array callback has no type")
  }
  promiseArrayCallbackSignatures := prog.checker.GetSignaturesOfType(
    promiseArrayCallbackType,
    shimchecker.SignatureKindCall,
  )
  if len(promiseArrayCallbackSignatures) != 1 {
    t.Fatalf("contextual Promise-array callback signatures = %d, want one", len(promiseArrayCallbackSignatures))
  }
  cachedPromiseArrayReturn := prog.checker.GetReturnTypeOfSignature(promiseArrayCallbackSignatures[0])
  if cachedPromiseArrayReturn == nil || prog.checker.TypeToString(cachedPromiseArrayReturn) != "unknown[]" {
    t.Fatal("callback return was not widened by the canonical unknown-array context")
  }
  freshGenericCall := callAt("nakedGenericCallbackCandidate.catch")
  freshGenericReturn := prog.checker.GetTypeAtLocation(freshGenericCall.AsNode())
  if freshGenericReturn == nil || prog.checker.TypeToString(freshGenericReturn) != "Promise<void>[]" {
    t.Fatal("fresh generic callback call did not infer its Promise-array return")
  }
  nakedSignatures := signaturesAt(callAt("nakedGenericCallbackCandidate.catch"), "catch")
  if len(nakedSignatures) != 1 {
    t.Fatalf("naked generic callback signatures = %d, want one", len(nakedSignatures))
  }
  if got := floatingPromiseSignatureApplicability(prog.checker, contextualPromiseArray, nakedSignatures[0]);
    got != floatingPromiseCallApplicable {
    t.Fatalf("naked generic callback applicability = %d, want applicable", got)
  }
  if got := floatingPromiseApplicableSignature(ctx, contextualPromiseArray, nakedSignatures);
    got != nakedSignatures[0] {
    t.Fatal("naked generic callback candidate was not selected")
  }
  if !floatingPromiseSignatureReturnIsUnhandled(
    ctx,
    contextualPromiseArray.AsNode(),
    contextualPromiseArray,
    nakedSignatures[0],
    noFloatingPromisesOptions{},
  ) {
    t.Fatal("candidate-contextual Promise-array return was treated as safe")
  }
}
