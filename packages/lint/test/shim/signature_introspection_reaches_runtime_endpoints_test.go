package linthost

import (
  "path/filepath"
  "testing"

  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type signatureObservation struct {
  minimum    int
  parameters int
  rest       bool
  firstType  string
  restType   string
  returnType string
}

// Verifies signature introspection reaches real checker endpoints at runtime.
//
// A compile-only composition cannot prove that the public producer yields
// usable signatures or that the arity, parameter, rest, and return wrappers
// preserve their semantics.
//
//  1. Build a real program with five constructor shapes and one static call.
//  2. Obtain every signature only through the exported shim producer.
//  3. Assert required/declared arity, parameter/rest types, and return types.
func TestSignatureIntrospectionReachesRuntimeEndpoints(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Zero {
  constructor() {}
}
export class Optional {
  constructor(value?: number) { void value; }
}
export class Required {
  constructor(value: string) { void value; }
}
export class RestOnly {
  constructor(...values: boolean[]) { void values; }
}
export class LeadingRest {
  constructor(value: bigint, ...rest: number[]) { void value; void rest; }
}
export class Factory {
  private constructor() {}
  static create(seed: symbol): Factory { void seed; return new Factory(); }
}
`)

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    needsRuleChecker: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.close()

  expected := map[string]signatureObservation{
    "Zero":        {minimum: 0, parameters: 0, returnType: "Zero"},
    "Optional":    {minimum: 0, parameters: 1, firstType: "number | undefined", returnType: "Optional"},
    "Required":    {minimum: 1, parameters: 1, firstType: "string", returnType: "Required"},
    "RestOnly":    {minimum: 0, parameters: 1, rest: true, firstType: "boolean[]", restType: "boolean", returnType: "RestOnly"},
    "LeadingRest": {minimum: 1, parameters: 2, rest: true, firstType: "bigint", restType: "number", returnType: "LeadingRest"},
  }
  for name, want := range expected {
    staticType := shimchecker.Checker_getTypeOfSymbol(prog.checker, classSymbol(t, prog, name))
    signatures := shimchecker.Checker_getSignaturesOfType(prog.checker, staticType, shimchecker.SignatureKindConstruct)
    if len(signatures) != 1 {
      t.Fatalf("%s construct signatures = %d, want 1", name, len(signatures))
    }
    if got := observeSignature(prog.checker, signatures[0]); got != want {
      t.Fatalf("%s observation = %+v, want %+v", name, got, want)
    }
  }

  factoryType := shimchecker.Checker_getTypeOfSymbol(prog.checker, classSymbol(t, prog, "Factory"))
  createType := shimchecker.Checker_getTypeOfPropertyOfType(prog.checker, factoryType, "create")
  calls := shimchecker.Checker_getSignaturesOfType(prog.checker, createType, shimchecker.SignatureKindCall)
  if len(calls) != 1 {
    t.Fatalf("Factory.create call signatures = %d, want 1", len(calls))
  }
  wantCall := signatureObservation{minimum: 1, parameters: 1, firstType: "symbol", returnType: "Factory"}
  if got := observeSignature(prog.checker, calls[0]); got != wantCall {
    t.Fatalf("Factory.create observation = %+v, want %+v", got, wantCall)
  }
}

func observeSignature(checker *shimchecker.Checker, signature *shimchecker.Signature) signatureObservation {
  parameters := shimchecker.Signature_parameters(signature)
  observation := signatureObservation{
    minimum:    shimchecker.Checker_getMinArgumentCount(checker, signature),
    parameters: shimchecker.Signature_parameterCount(signature),
    rest:       shimchecker.Signature_hasRestParameter(signature),
    returnType: checker.TypeToString(shimchecker.Checker_getReturnTypeOfSignature(checker, signature)),
  }
  if len(parameters) > 0 {
    observation.firstType = checker.TypeToString(shimchecker.Checker_getTypeOfSymbol(checker, parameters[0]))
  }
  if observation.rest {
    observation.restType = checker.TypeToString(shimchecker.Checker_getRestTypeOfSignature(checker, signature))
  }
  return observation
}
