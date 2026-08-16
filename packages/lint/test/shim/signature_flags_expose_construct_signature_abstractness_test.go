package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// Verifies SignatureFlags exposes construct-signature abstractness through the
// shim.
//
// Signature.Flags() was already reachable through the full Signature alias,
// but SignatureFlags itself was not nameable, so the returned value could not
// be tested against SignatureFlagsAbstract (#1203). The flag is also the only
// correct general answer: a class with no constructor and no base produces a
// default construct signature with no declaration at all, and a class
// inheriting its base's constructor clones the base signature, so
// Declaration() points at the OTHER class's constructor while the checker
// forces the bit to the derived class's abstractness — in both directions.
// Declaration-modifier reading returns nothing for the former and an answer
// that tracks the base class for the latter.
//
//  1. Build a program with abstract/concrete classes and constructor-type
//     aliases, covering the declared, default-signature, and inherited
//     shapes in both abstract polarities.
//  2. Obtain every construct signature only through the exported shim surface,
//     reading flags into a shimchecker.SignatureFlags-typed variable so the
//     alias itself is pinned, not just the member consts.
//  3. Assert the Abstract bit exactly where the source says abstract, the
//     Construct bit everywhere, the nil declaration on both default-signature
//     boundaries, and the declaring class's modifier on every class-declared
//     shape — diverging from the flag on both inherited ones.
func TestSignatureFlagsExposeConstructSignatureAbstractness(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export abstract class AbstractDeclared {
  constructor(value: string) { void value; }
}
export class ConcreteDeclared {
  constructor(value: string) { void value; }
}
export abstract class AbstractDefault {}
export class ConcreteDefault {}
export class ConcreteBase {
  constructor(value: number) { void value; }
}
export abstract class AbstractInheriting extends ConcreteBase {}
export class ConcreteInheriting extends AbstractDeclared {}
export type AbstractOpener = abstract new (value: string) => AbstractDeclared;
export type ConcreteOpener = new (value: string) => ConcreteDeclared;
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

  cases := []struct {
    name         string
    typeAlias    bool
    wantAbstract bool
    wantNilDecl  bool
    // checkDeclaringClass asserts the abstract modifier on the class that
    // lexically declares the signature's constructor. It agrees with the
    // flag on the declared shapes and diverges on both inherited shapes,
    // pinning that the flag, not the declaration, carries abstractness.
    checkDeclaringClass    bool
    declaringClassAbstract bool
  }{
    {name: "AbstractDeclared", wantAbstract: true, checkDeclaringClass: true, declaringClassAbstract: true},
    {name: "ConcreteDeclared", checkDeclaringClass: true},
    {name: "AbstractDefault", wantAbstract: true, wantNilDecl: true},
    {name: "ConcreteDefault", wantNilDecl: true},
    {name: "ConcreteBase", checkDeclaringClass: true},
    {name: "AbstractInheriting", wantAbstract: true, checkDeclaringClass: true},
    {name: "ConcreteInheriting", checkDeclaringClass: true, declaringClassAbstract: true},
    {name: "AbstractOpener", typeAlias: true, wantAbstract: true},
    {name: "ConcreteOpener", typeAlias: true},
  }
  for _, tc := range cases {
    symbol := classSymbol(t, prog, tc.name)
    var target *shimchecker.Type
    if tc.typeAlias {
      target = shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, symbol)
    } else {
      target = shimchecker.Checker_getTypeOfSymbol(prog.checker, symbol)
    }
    signatures := shimchecker.Checker_getSignaturesOfType(prog.checker, target, shimchecker.SignatureKindConstruct)
    if len(signatures) != 1 {
      t.Fatalf("%s construct signatures = %d, want 1", tc.name, len(signatures))
    }
    var flags shimchecker.SignatureFlags = signatures[0].Flags()
    if flags&shimchecker.SignatureFlagsConstruct == 0 {
      t.Fatalf("%s flags = %d: Construct bit missing on a construct signature", tc.name, flags)
    }
    if got := flags&shimchecker.SignatureFlagsAbstract != 0; got != tc.wantAbstract {
      t.Fatalf("%s abstract bit = %v, want %v (flags = %d)", tc.name, got, tc.wantAbstract, flags)
    }
    declaration := signatures[0].Declaration()
    if got := declaration == nil; got != tc.wantNilDecl {
      t.Fatalf("%s nil declaration = %v, want %v", tc.name, got, tc.wantNilDecl)
    }
    if tc.checkDeclaringClass {
      if declaration == nil {
        t.Fatalf("%s has no declaration to read a declaring class from", tc.name)
      }
      class := declaration.Parent
      if got := shimast.GetCombinedModifierFlags(class)&shimast.ModifierFlagsAbstract != 0; got != tc.declaringClassAbstract {
        t.Fatalf("%s declaring class abstract modifier = %v, want %v", tc.name, got, tc.declaringClassAbstract)
      }
    }
  }
}
