package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestNoFloatingPromisesPreservesCanonicalCallResolution verifies mixed-
// receiver analysis never replaces the Checker's canonical signature with a
// branch-only overload result.
//
// The fixture covers valid and failed overload resolution, uncached and
// already-cached query order, and nested contextual generic calls. Pointer
// identity is intentional: an equivalent-looking replacement still proves a
// speculative query escaped into the shared Checker cache.
//
//  1. Cache canonical signatures before analysis for valid, invalid, and nested calls.
//  2. Analyze equivalent uncached and cached calls in opposite orders.
//  3. Assert every cached signature and return type remains the exact same object.
func TestNoFloatingPromisesPreservesCanonicalCallResolution(t *testing.T) {
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
  writeFile(t, filepath.Join(root, "src", "main.ts"), `interface SafeCatch {
  catch(onRejected: (reason: unknown) => void): undefined;
}
interface UnsafeCatch {
  catch(onRejected: (reason: unknown) => void): Promise<void>;
}
interface IncompatibleCatch {
  catch(value: number): Promise<void>;
}
declare const cachedSafe: Promise<void> | SafeCatch;
declare const uncachedSafe: Promise<void> | SafeCatch;
declare const cachedUnsafe: Promise<void> | UnsafeCatch;
declare const uncachedUnsafe: Promise<void> | UnsafeCatch;
declare const cachedFailed: Promise<void> | IncompatibleCatch;
declare const uncachedFailed: Promise<void> | IncompatibleCatch;
cachedSafe.catch(() => undefined);
uncachedSafe.catch(() => undefined);
cachedUnsafe.catch(() => undefined);
uncachedUnsafe.catch(() => undefined);
cachedFailed.catch(() => undefined);
uncachedFailed.catch(() => undefined);
declare function contextual<T>(factory: () => T): T;
declare const nestedCached: Promise<void> | SafeCatch;
declare const nestedUncached: Promise<void> | SafeCatch;
contextual(() => nestedCached.catch(() => undefined));
contextual(() => nestedUncached.catch(() => undefined));
declare const nestedFunctionCached: Promise<void> | SafeCatch;
declare const nestedFunctionUncached: Promise<void> | SafeCatch;
contextual(function () { return nestedFunctionCached.catch(() => undefined); });
contextual(function () { return nestedFunctionUncached.catch(() => undefined); });
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
  if prog.checker == nil {
    t.Fatal("loadProgram did not acquire a checker")
  }
  files := prog.userSourceFiles()
  if len(files) != 1 {
    t.Fatalf("expected one source file, got %d", len(files))
  }
  file := files[0]
  callAt := func(marker string) *shimast.Node {
    t.Helper()
    offset := strings.Index(file.Text(), marker)
    if offset < 0 {
      t.Fatalf("source marker %q not found", marker)
    }
    node := shimast.GetNodeAtPosition(file, offset, false)
    for node != nil && node.Kind != shimast.KindCallExpression {
      node = node.Parent
    }
    if node == nil {
      t.Fatalf("no call expression at %q", marker)
    }
    return node
  }

  cachedSafe := callAt("cachedSafe.catch")
  uncachedSafe := callAt("uncachedSafe.catch")
  cachedUnsafe := callAt("cachedUnsafe.catch")
  uncachedUnsafe := callAt("uncachedUnsafe.catch")
  cachedFailed := callAt("cachedFailed.catch")
  uncachedFailed := callAt("uncachedFailed.catch")
  nestedCached := callAt("nestedCached.catch")
  nestedUncached := callAt("nestedUncached.catch")
  contextualCached := callAt("contextual(() => nestedCached")
  contextualUncached := callAt("contextual(() => nestedUncached")
  nestedFunctionCached := callAt("nestedFunctionCached.catch")
  nestedFunctionUncached := callAt("nestedFunctionUncached.catch")
  contextualFunctionCached := callAt("contextual(function () { return nestedFunctionCached")
  contextualFunctionUncached := callAt("contextual(function () { return nestedFunctionUncached")

  type canonical struct {
    signature  *shimchecker.Signature
    returnType *shimchecker.Type
  }
  remember := func(node *shimast.Node) canonical {
    t.Helper()
    signature := prog.checker.GetResolvedSignature(node)
    if signature == nil {
      t.Fatalf("canonical signature is nil at %q", shimast.NodeText(node))
    }
    returnType := prog.checker.GetReturnTypeOfSignature(signature)
    if returnType == nil {
      t.Fatalf("canonical return type is nil at %q", shimast.NodeText(node))
    }
    return canonical{
      signature:  signature,
      returnType: returnType,
    }
  }
  assertCanonical := func(node *shimast.Node, want canonical) {
    t.Helper()
    signature := prog.checker.GetResolvedSignature(node)
    if signature != want.signature {
      t.Fatalf("canonical signature changed at %q", shimast.NodeText(node))
    }
    if got := prog.checker.GetReturnTypeOfSignature(signature); got != want.returnType {
      t.Fatalf("canonical return type changed at %q", shimast.NodeText(node))
    }
  }
  assertSameCanonicalShape := func(label string, got canonical, want canonical) {
    t.Helper()
    if got.returnType != want.returnType ||
      got.signature.Declaration() != want.signature.Declaration() ||
      got.signature.Target() != want.signature.Target() ||
      got.signature.Flags() != want.signature.Flags() {
      t.Fatalf("%s resolved to a branch-only signature instead of the canonical twin", label)
    }
  }

  cachedSafeCanonical := remember(cachedSafe)
  cachedUnsafeCanonical := remember(cachedUnsafe)
  cachedFailedCanonical := remember(cachedFailed)
  nestedCachedCanonical := remember(nestedCached)
  contextualCachedCanonical := remember(contextualCached)
  nestedFunctionCachedCanonical := remember(nestedFunctionCached)
  contextualFunctionCachedCanonical := remember(contextualFunctionCached)
  contextualCachedCall := contextualCached.AsCallExpression()
  contextualUncachedCall := contextualUncached.AsCallExpression()
  if contextualCachedCall == nil || contextualCachedCall.Arguments == nil || len(contextualCachedCall.Arguments.Nodes) != 1 ||
    contextualUncachedCall == nil || contextualUncachedCall.Arguments == nil || len(contextualUncachedCall.Arguments.Nodes) != 1 {
    t.Fatal("contextual fixture calls do not each have one arrow argument")
  }
  contextualCachedArrow := contextualCachedCall.Arguments.Nodes[0]
  contextualUncachedArrow := contextualUncachedCall.Arguments.Nodes[0]
  contextualCachedArrowType := prog.checker.GetTypeAtLocation(contextualCachedArrow)
  if contextualCachedArrowType == nil {
    t.Fatal("cached contextual arrow has no type")
  }
  contextualFunctionCachedCall := contextualFunctionCached.AsCallExpression()
  contextualFunctionUncachedCall := contextualFunctionUncached.AsCallExpression()
  if contextualFunctionCachedCall == nil || contextualFunctionCachedCall.Arguments == nil ||
    len(contextualFunctionCachedCall.Arguments.Nodes) != 1 ||
    contextualFunctionUncachedCall == nil || contextualFunctionUncachedCall.Arguments == nil ||
    len(contextualFunctionUncachedCall.Arguments.Nodes) != 1 {
    t.Fatal("contextual function fixture calls do not each have one function argument")
  }
  contextualFunctionCachedArgument := contextualFunctionCachedCall.Arguments.Nodes[0]
  contextualFunctionUncachedArgument := contextualFunctionUncachedCall.Arguments.Nodes[0]
  contextualFunctionCachedType := prog.checker.GetTypeAtLocation(contextualFunctionCachedArgument)
  if contextualFunctionCachedType == nil {
    t.Fatal("cached contextual function expression has no type")
  }
  ctx := &Context{File: file, Checker: prog.checker, CurrentDirectory: root}
  options := noFloatingPromisesOptions{}

  if result := analyzeFloatingPromise(ctx, uncachedSafe, options); result.unhandled {
    t.Fatal("uncached safe mixed receiver was reported")
  }
  uncachedSafeCanonical := remember(uncachedSafe)
  assertSameCanonicalShape("uncached safe call", uncachedSafeCanonical, cachedSafeCanonical)
  if result := analyzeFloatingPromise(ctx, uncachedUnsafe, options); !result.unhandled {
    t.Fatal("uncached unsafe mixed receiver was not reported")
  }
  uncachedUnsafeCanonical := remember(uncachedUnsafe)
  assertSameCanonicalShape("uncached unsafe call", uncachedUnsafeCanonical, cachedUnsafeCanonical)
  if result := analyzeFloatingPromise(ctx, uncachedFailed, options); !result.unhandled {
    t.Fatal("uncached incompatible mixed receiver was not conservatively reported")
  }
  uncachedFailedCanonical := remember(uncachedFailed)
  assertSameCanonicalShape("uncached failed call", uncachedFailedCanonical, cachedFailedCanonical)
  if result := analyzeFloatingPromise(ctx, nestedUncached, options); result.unhandled {
    t.Fatal("uncached nested safe mixed receiver was reported")
  }
  nestedUncachedCanonical := remember(nestedUncached)
  contextualUncachedCanonical := remember(contextualUncached)
  contextualUncachedArrowType := prog.checker.GetTypeAtLocation(contextualUncachedArrow)
  if contextualUncachedArrowType == nil ||
    prog.checker.TypeToString(contextualUncachedArrowType) != prog.checker.TypeToString(contextualCachedArrowType) {
    t.Fatal("uncached contextual arrow did not retain the canonical generic behavior")
  }
  assertSameCanonicalShape("uncached nested call", nestedUncachedCanonical, nestedCachedCanonical)
  assertSameCanonicalShape("uncached contextual ancestor", contextualUncachedCanonical, contextualCachedCanonical)
  if result := analyzeFloatingPromise(ctx, nestedFunctionUncached, options); result.unhandled {
    t.Fatal("uncached nested function-expression mixed receiver was reported")
  }
  nestedFunctionUncachedCanonical := remember(nestedFunctionUncached)
  contextualFunctionUncachedCanonical := remember(contextualFunctionUncached)
  contextualFunctionUncachedType := prog.checker.GetTypeAtLocation(contextualFunctionUncachedArgument)
  if contextualFunctionUncachedType == nil ||
    prog.checker.TypeToString(contextualFunctionUncachedType) != prog.checker.TypeToString(contextualFunctionCachedType) {
    t.Fatal("uncached contextual function expression did not retain canonical generic behavior")
  }
  assertSameCanonicalShape(
    "uncached nested function-expression call",
    nestedFunctionUncachedCanonical,
    nestedFunctionCachedCanonical,
  )
  assertSameCanonicalShape(
    "uncached contextual function-expression ancestor",
    contextualFunctionUncachedCanonical,
    contextualFunctionCachedCanonical,
  )

  if result := analyzeFloatingPromise(ctx, cachedSafe, options); result.unhandled {
    t.Fatal("cached safe mixed receiver was reported")
  }
  if result := analyzeFloatingPromise(ctx, cachedUnsafe, options); !result.unhandled {
    t.Fatal("cached unsafe mixed receiver was not reported")
  }
  if result := analyzeFloatingPromise(ctx, cachedFailed, options); !result.unhandled {
    t.Fatal("incompatible mixed receiver was not conservatively reported")
  }
  if result := analyzeFloatingPromise(ctx, nestedCached, options); result.unhandled {
    t.Fatal("nested safe mixed receiver was reported")
  }
  if result := analyzeFloatingPromise(ctx, nestedFunctionCached, options); result.unhandled {
    t.Fatal("nested cached function-expression mixed receiver was reported")
  }

  assertCanonical(cachedSafe, cachedSafeCanonical)
  assertCanonical(uncachedSafe, uncachedSafeCanonical)
  assertCanonical(cachedUnsafe, cachedUnsafeCanonical)
  assertCanonical(uncachedUnsafe, uncachedUnsafeCanonical)
  assertCanonical(cachedFailed, cachedFailedCanonical)
  assertCanonical(uncachedFailed, uncachedFailedCanonical)
  assertCanonical(nestedCached, nestedCachedCanonical)
  assertCanonical(nestedUncached, nestedUncachedCanonical)
  assertCanonical(contextualCached, contextualCachedCanonical)
  assertCanonical(contextualUncached, contextualUncachedCanonical)
  assertCanonical(nestedFunctionCached, nestedFunctionCachedCanonical)
  assertCanonical(nestedFunctionUncached, nestedFunctionUncachedCanonical)
  assertCanonical(contextualFunctionCached, contextualFunctionCachedCanonical)
  assertCanonical(contextualFunctionUncached, contextualFunctionUncachedCanonical)
  if got := prog.checker.GetTypeAtLocation(contextualCachedArrow); got != contextualCachedArrowType {
    t.Fatal("cached contextual arrow type changed after mixed-receiver analysis")
  }
  if got := prog.checker.GetTypeAtLocation(contextualFunctionCachedArgument); got != contextualFunctionCachedType {
    t.Fatal("cached contextual function-expression type changed after mixed-receiver analysis")
  }

  if result := analyzeFloatingPromise(ctx, cachedSafe, options); result.unhandled {
    t.Fatal("repeated cached-first analysis changed the safe result")
  }
  if result := analyzeFloatingPromise(ctx, uncachedSafe, options); result.unhandled {
    t.Fatal("repeated uncached-first analysis changed the safe result")
  }
  assertCanonical(cachedSafe, cachedSafeCanonical)
  assertCanonical(uncachedSafe, uncachedSafeCanonical)
}
