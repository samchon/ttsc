package linthost

import (
  "path/filepath"
  "testing"

  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestKnownSymbolPropertyNameFindsAsyncProtocolMembers is a shim-completeness
// probe for `Checker_getPropertyNameForKnownSymbolName`: it runs a real
// Checker over a ttsc-owned fixture and asserts the exposed op composes with
// `GetPropertyOfType` into a working well-known-symbol member lookup — the
// exact traversal `typescript/await-thenable` performs for its
// `for await...of` (`Symbol.asyncIterator`) and `await using`
// (`Symbol.asyncDispose`) arms.
//
// The closure auditor only proves the symbol is nameable; this probe proves
// the RESOLUTION completes: the returned name must be the late-bound name of
// the real global unique symbol (lib-provided for `asyncIterator`,
// `declare global`-augmented for `asyncDispose`), because any other string —
// including the checker's `\xFE@`-prefixed fallback — would silently match
// nothing and the lint rule would report every `for await` / accept no
// `await using`.
//
//  1. Compile a fixture declaring `[Symbol.asyncIterator]`,
//     `[Symbol.iterator]`, and `[Symbol.asyncDispose]` members, with the
//     dispose symbols coming from a `declare global` augmentation.
//  2. Resolve both protocol property names through the exposed shim op.
//  3. Assert each name finds the implementing interface's member and does
//     NOT find one on the sibling interface that only implements the sync
//     protocol.
func TestKnownSymbolPropertyNameFindsAsyncProtocolMembers(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export {};
declare global {
  interface SymbolConstructor {
    readonly dispose: unique symbol;
    readonly asyncDispose: unique symbol;
  }
}
interface AsyncFeed {
  [Symbol.asyncIterator](): AsyncIterator<number>;
}
interface SyncFeed {
  [Symbol.iterator](): Iterator<number>;
}
interface AsyncResource {
  [Symbol.asyncDispose](): Promise<void>;
}
interface SyncResource {
  [Symbol.dispose](): void;
}
declare const inventory: [AsyncFeed, SyncFeed, AsyncResource, SyncResource];
JSON.stringify(inventory);
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

  probe := func(symbolName, implementing, syncOnly string) {
    t.Helper()
    name := shimchecker.Checker_getPropertyNameForKnownSymbolName(prog.checker, symbolName)
    if name == "" || name == symbolName {
      t.Fatalf("Checker_getPropertyNameForKnownSymbolName(%q) returned %q; expected a late-bound property name", symbolName, name)
    }
    implementingType := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, classSymbol(t, prog, implementing))
    if implementingType == nil {
      t.Fatalf("no declared type for %s", implementing)
    }
    if prog.checker.GetPropertyOfType(implementingType, name) == nil {
      t.Fatalf("GetPropertyOfType(%s, %q) did not find the [Symbol.%s] member; the known-symbol name resolution dead-ends", implementing, name, symbolName)
    }
    syncOnlyType := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, classSymbol(t, prog, syncOnly))
    if syncOnlyType == nil {
      t.Fatalf("no declared type for %s", syncOnly)
    }
    if prog.checker.GetPropertyOfType(syncOnlyType, name) != nil {
      t.Fatalf("GetPropertyOfType(%s, %q) over-matched a type without the [Symbol.%s] member", syncOnly, name, symbolName)
    }
  }
  // asyncIterator resolves through the ES2018+ lib's SymbolConstructor.
  probe("asyncIterator", "AsyncFeed", "SyncFeed")
  // asyncDispose resolves through the fixture's `declare global` augmentation.
  probe("asyncDispose", "AsyncResource", "SyncResource")
}
