package linthost

import (
  "path/filepath"
  "testing"

  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// Verifies SignatureFlags exposes construct-signature abstractness through the
// shim.
//
// Signature.Flags() was already reachable through the full Signature alias,
// but SignatureFlags itself was not nameable, so the returned value could not
// be tested against SignatureFlagsAbstract (#1203). The flag is also the only
// correct general answer: an abstract class without a constructor produces a
// default construct signature with no declaration at all, and an abstract
// class inheriting a concrete base clones the base's signature, so
// Declaration() points at a NON-abstract constructor while the checker forces
// the Abstract bit on. Declaration-modifier reading returns nothing for the
// former and the wrong answer for the latter.
//
//  1. Build a program with abstract/concrete classes and constructor-type
//     aliases, including the no-constructor and inherited-constructor shapes.
//  2. Obtain every construct signature only through the exported shim surface.
//  3. Assert the Abstract bit exactly where the source says abstract, the
//     Construct bit on every construct signature, and the nil declaration on
//     the default-signature boundary.
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
export class ConcreteBase {
  constructor(value: number) { void value; }
}
export abstract class AbstractInheriting extends ConcreteBase {}
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
  }{
    {name: "AbstractDeclared", wantAbstract: true},
    {name: "ConcreteDeclared"},
    {name: "AbstractDefault", wantAbstract: true, wantNilDecl: true},
    {name: "ConcreteBase"},
    {name: "AbstractInheriting", wantAbstract: true},
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
    flags := signatures[0].Flags()
    if flags&shimchecker.SignatureFlagsConstruct == 0 {
      t.Fatalf("%s flags = %d: Construct bit missing on a construct signature", tc.name, flags)
    }
    if got := flags&shimchecker.SignatureFlagsAbstract != 0; got != tc.wantAbstract {
      t.Fatalf("%s abstract bit = %v, want %v (flags = %d)", tc.name, got, tc.wantAbstract, flags)
    }
    if got := signatures[0].Declaration() == nil; got != tc.wantNilDecl {
      t.Fatalf("%s nil declaration = %v, want %v", tc.name, got, tc.wantNilDecl)
    }
  }
}
