package linthost

import (
  "path/filepath"
  "testing"

  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestKnownSymbolPropertyNameFindsIterationAndDisposalProtocolMembers is a
// shim-completeness probe for `Checker_getPropertyNameForKnownSymbolName`: it
// runs a real Checker over a ttsc-owned fixture and asserts the exposed op
// composes with `GetPropertyOfType` into a working well-known-symbol member
// lookup. It is the same traversal used by the `typescript/await-thenable`
// rule for `for await...of` (`Symbol.asyncIterator`), Promise aggregator
// (`Symbol.iterator`), and `await using` (`Symbol.asyncDispose`) arms.
//
// The closure auditor only proves the symbol is nameable; this probe proves
// the RESOLUTION completes: the returned name must be the late-bound name of
// the real global unique symbol (lib-provided for `iterator` and
// `asyncIterator`, `declare global`-augmented for `asyncDispose`). Any other
// string, including the checker's `\xFE@`-prefixed fallback, would silently
// match nothing. The lint rule would then report every `for await`, skip typed
// Promise aggregator inputs, or accept no `await using`, depending on the
// requested symbol.
//
//  1. Compile a fixture declaring `[Symbol.asyncIterator]`,
//     `[Symbol.iterator]`, and `[Symbol.asyncDispose]` members, with the
//     dispose symbols coming from a `declare global` augmentation.
//  2. Resolve all three protocol property names through the exposed shim op.
//  3. Assert each name finds the implementing interface's member and does
//     NOT find one on the sibling interface without that protocol.
func TestKnownSymbolPropertyNameFindsIterationAndDisposalProtocolMembers(t *testing.T) {
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

  probe := func(symbolName, implementing, withoutProtocol string) {
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
    withoutProtocolType := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, classSymbol(t, prog, withoutProtocol))
    if withoutProtocolType == nil {
      t.Fatalf("no declared type for %s", withoutProtocol)
    }
    if prog.checker.GetPropertyOfType(withoutProtocolType, name) != nil {
      t.Fatalf("GetPropertyOfType(%s, %q) over-matched a type without the [Symbol.%s] member", withoutProtocol, name, symbolName)
    }
  }
  // asyncIterator resolves through the ES2018+ lib's SymbolConstructor.
  probe("asyncIterator", "AsyncFeed", "SyncFeed")
  // iterator resolves independently from asyncIterator on the sync protocol.
  probe("iterator", "SyncFeed", "AsyncFeed")
  // asyncDispose resolves through the fixture's `declare global` augmentation.
  probe("asyncDispose", "AsyncResource", "SyncResource")
}
