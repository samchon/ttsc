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
// lookup. It is the known-symbol lookup prefix used by `typescript/await-thenable`
// rule for `for await...of` (`Symbol.asyncIterator`), Promise aggregator
// (`Symbol.iterator`), and `await using` (`Symbol.asyncDispose`) arms.
//
// The returned name must resolve the authored unique-symbol member
// (lib-provided for `iterator` and `asyncIterator`, globally augmented for
// `asyncDispose`) while rejecting its protocol-free sibling. The test does
// not require a particular internal spelling or execute the rule's later
// call-signature checks and diagnostics.
//
//  1. Load a checker fixture declaring `[Symbol.asyncIterator]`,
//     `[Symbol.iterator]`, and `[Symbol.asyncDispose]` members, with the
//     dispose symbols coming from a `declare global` augmentation.
//  2. Resolve all three protocol property names through the exposed shim op.
//  3. Assert each name finds the implementing interface's member and does
//     NOT find one on the sibling interface without that protocol.
//
// @evidence contracts/testing.md#behavioral-verification The real checker resolves known asyncIterator, iterator and asyncDispose names into properties of their implementing interfaces, while the opposite sync/async sibling lacks each requested protocol member.
// @evidence contracts/testing.md#independent-expectations Literal computed members in AsyncFeed, SyncFeed, AsyncResource and SyncResource define protocol presence and absence. Expected member lookup is independent of returned late-bound name spelling, allowing that internal spelling to change while rejecting a name that resolves nowhere or overmatches.
// @evidence contracts/testing.md#distinguishing-cases Built-in lib iteration symbols contrast with the fixture's global disposal augmentation; each positive implementing interface has a negative sibling, and a returned name that is empty or equal to the raw symbol name fails the test before any property lookup.
// @evidence contracts/testing.md#execution-ownership One real loadProgram/checker resolves authored TypeScript declarations through exposed shim endpoints and GetPropertyOfType in the shared Go process. The unit tests runtime composition without native builds, consumer installs or committed source/export existence checks.
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
