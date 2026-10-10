package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestTypeInstantiationMappersReachRuntimeEndpoints verifies type-instantiation mappers reach real checker endpoints at runtime.
//
// This direct endpoint test uses a real Checker on authored generic classes.
// Simple and composed mapper operations must substitute constructor array and
// tuple parameter types, rather than merely being callable. The literal type
// strings below distinguish correct substitution from no-op or partial work;
// this test does not certify an auditor or a plugin's reflection output.
//
//  1. Load a fixture with a generic class `Box<T>` and a reference
//     `Box<string>`.
//  2. Obtain the declaration's type parameters and the reference's concrete
//     arguments through the exposed shim surface.
//  3. Build a simple mapper and assert `T[]` becomes `string[]`.
//  4. Compose two mappers and assert `[A, B]` becomes `[number, boolean]`.
//  5. Assert the wrappers' explicit nil-input return and identity contracts.
//
// @evidence contracts/testing.md#behavioral-verification Real generic constructor types instantiate T[] as string[] with a simple mapper and [A,B] as [number,boolean] with composed mappers. Nil mapper preserves the original type; nil source, target, checker/type and unsupported mapper composition boundaries retain their explicit return contracts.
// @evidence contracts/testing.md#independent-expectations Source-authored Holder references Box<string> and Pair<number,boolean> define the two literal expected type strings. Identity expectations for nil mapper and a missing first mapper are separate wrapper contracts, not a second instantiation used as an oracle.
// @evidence contracts/testing.md#distinguishing-cases Nested array and tuple substitution distinguish no-op or partial mappers; the simple mapper's kind and composed observable result exercise different producer routes. All original nil-input boundaries remain, including the asymmetry between missing first and second mappers.
// @evidence contracts/testing.md#execution-ownership A single real fixture Program/checker composes exported type-argument, mapper and instantiation endpoints in the shared Go process. Runtime results are compared with literal expectations without checking committed exports, invoking native plugin hosts or installing consumers.
func TestTypeInstantiationMappersReachRuntimeEndpoints(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Box<T> {
  constructor(value: T[]) { void value; }
}
export class Pair<A, B> {
  constructor(value: [A, B]) { void value; }
}
export class Holder {
  box!: Box<string>;
  pair!: Pair<number, boolean>;
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

  if prog.checker == nil {
    t.Fatal("loadProgram did not acquire a checker")
  }

  // --- Single-pair mapper: Box<T> instantiated with string ---
  // Construct signatures live on the static (constructor) side of the class
  // symbol, so obtain them through getTypeOfSymbol, matching the existing
  // signature-introspection probe.
  boxSymbol := classSymbol(t, prog, "Box")
  boxType := shimchecker.Checker_getTypeOfSymbol(prog.checker, boxSymbol)
  if boxType == nil {
    t.Fatal("Checker_getTypeOfSymbol returned nil for the Box class symbol")
  }
  boxCtor := shimchecker.Checker_getSignaturesOfType(prog.checker, boxType, shimchecker.SignatureKindConstruct)
  if len(boxCtor) != 1 {
    t.Fatalf("Box construct signatures = %d, want 1", len(boxCtor))
  }
  boxParams := declaredClassTypeParameters(t, prog.checker, boxSymbol)
  if len(boxParams) != 1 {
    t.Fatalf("Box type parameters = %d, want 1", len(boxParams))
  }

  // The reference Box<string> carries the concrete type argument. Obtain it
  // through the Holder.box property type (an instance member, so use the
  // declared instance type of Holder).
  holderType := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, classSymbol(t, prog, "Holder"))
  boxRef := shimchecker.Checker_getTypeOfPropertyOfType(prog.checker, holderType, "box")
  boxArgs := shimchecker.Checker_getTypeArguments(prog.checker, boxRef)
  if len(boxArgs) != 1 {
    t.Fatalf("Box<string> type arguments = %d, want 1", len(boxArgs))
  }

  mapper := shimchecker.Checker_newSimpleTypeMapper(boxParams[0], boxArgs[0])
  if mapper == nil {
    t.Fatal("Checker_newSimpleTypeMapper returned nil for a valid pair")
  }
  if mapper.Kind() != shimchecker.TypeMapperKindSimple {
    t.Fatalf("simple mapper kind = %v, want TypeMapperKindSimple", mapper.Kind())
  }

  boxCtorParams := shimchecker.Signature_parameters(boxCtor[0])
  if len(boxCtorParams) != 1 {
    t.Fatalf("Box constructor parameters = %d, want 1", len(boxCtorParams))
  }
  boxCtorParamType := shimchecker.Checker_getTypeOfSymbol(prog.checker, boxCtorParams[0])
  instantiated := shimchecker.Checker_instantiateType(prog.checker, boxCtorParamType, mapper)
  if instantiated == nil {
    t.Fatal("Checker_instantiateType returned nil for a valid mapper")
  }
  if got := prog.checker.TypeToString(instantiated); got != "string[]" {
    t.Fatalf("instantiated T[] = %q, want %q", got, "string[]")
  }

  // --- Combined mapper: Pair<A, B> instantiated with number and boolean ---
  pairSymbol := classSymbol(t, prog, "Pair")
  pairType := shimchecker.Checker_getTypeOfSymbol(prog.checker, pairSymbol)
  pairCtor := shimchecker.Checker_getSignaturesOfType(prog.checker, pairType, shimchecker.SignatureKindConstruct)
  if len(pairCtor) != 1 {
    t.Fatalf("Pair construct signatures = %d, want 1", len(pairCtor))
  }
  pairParams := declaredClassTypeParameters(t, prog.checker, pairSymbol)
  if len(pairParams) != 2 {
    t.Fatalf("Pair type parameters = %d, want 2", len(pairParams))
  }
  pairRef := shimchecker.Checker_getTypeOfPropertyOfType(prog.checker, holderType, "pair")
  pairArgs := shimchecker.Checker_getTypeArguments(prog.checker, pairRef)
  if len(pairArgs) != 2 {
    t.Fatalf("Pair<number, boolean> type arguments = %d, want 2", len(pairArgs))
  }

  m1 := shimchecker.Checker_newSimpleTypeMapper(pairParams[0], pairArgs[0])
  m2 := shimchecker.Checker_newSimpleTypeMapper(pairParams[1], pairArgs[1])
  composed := shimchecker.Checker_combineTypeMappers(prog.checker, m1, m2)
  if composed == nil {
    t.Fatal("Checker_combineTypeMappers returned nil for two valid mappers")
  }
  // combineTypeMappers builds a CompositeTypeMapper, whose Kind() reports
  // TypeMapperKindUnknown; the observable contract is that it substitutes both
  // pairs, which the instantiation below asserts.

  pairCtorParams := shimchecker.Signature_parameters(pairCtor[0])
  if len(pairCtorParams) != 1 {
    t.Fatalf("Pair constructor parameters = %d, want 1", len(pairCtorParams))
  }
  pairCtorParamType := shimchecker.Checker_getTypeOfSymbol(prog.checker, pairCtorParams[0])
  instantiatedPair := shimchecker.Checker_instantiateType(prog.checker, pairCtorParamType, composed)
  if instantiatedPair == nil {
    t.Fatal("Checker_instantiateType returned nil for the composed mapper")
  }
  if got := prog.checker.TypeToString(instantiatedPair); got != "[number, boolean]" {
    t.Fatalf("instantiated [A, B] = %q, want %q", got, "[number, boolean]")
  }

  if got := shimchecker.Checker_instantiateType(prog.checker, boxCtorParamType, nil); got != boxCtorParamType {
    t.Fatal("Checker_instantiateType with a nil mapper did not preserve the original type")
  }
  if got := shimchecker.Checker_combineTypeMappers(nil, nil, mapper); got != mapper {
    t.Fatal("Checker_combineTypeMappers with a nil first mapper did not return the second mapper")
  }
  if got := shimchecker.Checker_combineTypeMappers(nil, mapper, m2); got != nil {
    t.Fatal("Checker_combineTypeMappers composed two mappers without a checker")
  }
  if got := shimchecker.Checker_combineTypeMappers(prog.checker, mapper, nil); got != nil {
    t.Fatal("Checker_combineTypeMappers accepted a nil second mapper")
  }
  if got := shimchecker.Checker_newSimpleTypeMapper(nil, boxArgs[0]); got != nil {
    t.Fatal("Checker_newSimpleTypeMapper accepted a nil source")
  }
  if got := shimchecker.Checker_newSimpleTypeMapper(boxParams[0], nil); got != nil {
    t.Fatal("Checker_newSimpleTypeMapper accepted a nil target")
  }
  if got := shimchecker.Checker_instantiateType(nil, boxCtorParamType, mapper); got != nil {
    t.Fatal("Checker_instantiateType accepted a nil checker")
  }
  if got := shimchecker.Checker_instantiateType(prog.checker, nil, mapper); got != nil {
    t.Fatal("Checker_instantiateType accepted a nil type")
  }
}

func declaredClassTypeParameters(
  t *testing.T,
  checker *shimchecker.Checker,
  symbol *shimast.Symbol,
) []*shimchecker.Type {
  t.Helper()
  for _, declaration := range symbol.Declarations() {
    if declaration == nil ||
      (declaration.Kind != shimast.KindClassDeclaration && declaration.Kind != shimast.KindClassExpression) {
      continue
    }
    nodes := declaration.TypeParameters()
    result := make([]*shimchecker.Type, 0, len(nodes))
    for _, node := range nodes {
      if node == nil {
        continue
      }
      typ := checker.GetTypeAtLocation(node)
      if typ == nil {
        t.Fatalf("GetTypeAtLocation returned nil for a type parameter of %s", symbol.Name())
      }
      result = append(result, typ)
    }
    return result
  }
  t.Fatalf("class declaration for %q not found", symbol.Name())
  return nil
}
