package linthost

import (
  "path/filepath"
  "testing"

  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestTypeMapperParallelSubstitutionAvoidsCapture verifies type mappers substitute generic arguments in parallel without capture.
//
// Combining independent simple mappers composes their substitutions. When a
// reference permutes declaration parameters, composition can remap an argument
// that was already substituted, so plugins need the upstream parallel mapper.
//
//  1. Compile a generic class whose member references the class as `Pair<B, A>`.
//  2. Build a mapper from both declaration parameters to both reference arguments.
//  3. Assert `[A, B]` becomes `[B, A]` without either target being remapped.
//
// @evidence contracts/testing.md#behavioral-verification A real generic Pair<A,B> reference Pair<B,A> preserves parameter identities, produces an array mapper, and instantiates its constructor tuple as literal [B,A] without capturing a previously substituted argument; malformed mapper inputs return nil.
// @evidence contracts/testing.md#independent-expectations The authored swapped reference demands parallel A->B and B->A substitution, so the literal tuple [B, A] distinguishes both capture and no substitution. Parameter identity and mapper-kind expectations follow the declared shape rather than the returned instantiated type.
// @evidence contracts/testing.md#distinguishing-cases A two-parameter swap contrasts with empty, unequal-length, nil-source and nil-target inputs. Acquiring the actual reference arguments and constructor parameter ensures the final result exercises the real producer-to-instantiation chain.
// @evidence contracts/testing.md#execution-ownership The temporary Program/checker and exported mapper/instantiation shim operations run in-process with source-authored generic parameters. Existing helper extraction of declaration parameters supplies inputs; no committed API presence, native build, installation or subprocess substitutes for runtime behavior.
func TestTypeMapperParallelSubstitutionAvoidsCapture(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export class Pair<A, B> {
  constructor(value: [A, B]) { void value; }
  swapped!: Pair<B, A>;
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

  pairSymbol := classSymbol(t, prog, "Pair")
  pairParams := declaredClassTypeParameters(t, prog.checker, pairSymbol)
  if len(pairParams) != 2 {
    t.Fatalf("Pair type parameters = %d, want 2", len(pairParams))
  }

  pairType := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, pairSymbol)
  swappedRef := shimchecker.Checker_getTypeOfPropertyOfType(prog.checker, pairType, "swapped")
  swappedArgs := shimchecker.Checker_getTypeArguments(prog.checker, swappedRef)
  if len(swappedArgs) != 2 {
    t.Fatalf("Pair<B, A> type arguments = %d, want 2", len(swappedArgs))
  }
  if swappedArgs[0] != pairParams[1] || swappedArgs[1] != pairParams[0] {
    t.Fatal("Pair<B, A> did not retain the declaration parameter identities")
  }

  mapper := shimchecker.Checker_newTypeMapper(pairParams, swappedArgs)
  if mapper == nil {
    t.Fatal("Checker_newTypeMapper returned nil for corresponding type slices")
  }
  if mapper.Kind() != shimchecker.TypeMapperKindArray {
    t.Fatalf("parallel mapper kind = %v, want TypeMapperKindArray", mapper.Kind())
  }

  staticType := shimchecker.Checker_getTypeOfSymbol(prog.checker, pairSymbol)
  constructors := shimchecker.Checker_getSignaturesOfType(prog.checker, staticType, shimchecker.SignatureKindConstruct)
  if len(constructors) != 1 {
    t.Fatalf("Pair construct signatures = %d, want 1", len(constructors))
  }
  parameters := shimchecker.Signature_parameters(constructors[0])
  if len(parameters) != 1 {
    t.Fatalf("Pair constructor parameters = %d, want 1", len(parameters))
  }

  declared := shimchecker.Checker_getTypeOfSymbol(prog.checker, parameters[0])
  instantiated := shimchecker.Checker_instantiateType(prog.checker, declared, mapper)
  if got := prog.checker.TypeToString(instantiated); got != "[B, A]" {
    t.Fatalf("instantiated [A, B] = %q, want %q", got, "[B, A]")
  }

  if got := shimchecker.Checker_newTypeMapper(nil, nil); got != nil {
    t.Fatal("Checker_newTypeMapper accepted empty type slices")
  }
  if got := shimchecker.Checker_newTypeMapper(pairParams, swappedArgs[:1]); got != nil {
    t.Fatal("Checker_newTypeMapper accepted slices with different lengths")
  }
  if got := shimchecker.Checker_newTypeMapper([]*shimchecker.Type{nil}, swappedArgs[:1]); got != nil {
    t.Fatal("Checker_newTypeMapper accepted a nil source")
  }
  if got := shimchecker.Checker_newTypeMapper(pairParams[:1], []*shimchecker.Type{nil}); got != nil {
    t.Fatal("Checker_newTypeMapper accepted a nil target")
  }
}
