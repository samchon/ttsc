package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestNoFloatingPromisesHonorsJavaScriptGenericDefaults verifies partial
// explicit type arguments use the Checker's JavaScript default substitution.
//
// A JSDoc empty-object default becomes any for a signature declared in
// JavaScript. Treating that signature as TypeScript would turn an uncertain
// return into a falsely safe concrete object.
//
//  1. Import unsafe-any and safe-undefined JSDoc method defaults into TypeScript.
//  2. Recover each JavaScript signature and fill its omitted type argument.
//  3. Assert only the JavaScript-any return remains conservatively unhandled.
func TestNoFloatingPromisesHonorsJavaScriptGenericDefaults(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "allowJs": true,
    "checkJs": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts", "src/js-catch.js"]
}
`)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `import { JsSafeCatch, JsUncertainCatch } from "./js-catch";
declare const uncertain: JsUncertainCatch;
declare const safe: JsSafeCatch;
uncertain.catch<undefined>(() => undefined);
safe.catch<undefined>(() => undefined);
`)
  writeFile(t, filepath.Join(root, "src", "js-catch.js"), `export class JsUncertainCatch {
  /**
   * @template T
   * @template [U={}]
   * @param {() => T} onRejected
   * @returns {U}
   */
  catch(onRejected) {
    return /** @type {any} */ (onRejected());
  }
}

export class JsSafeCatch {
  /**
   * @template T
   * @template [U=undefined]
   * @param {() => T} onRejected
   * @returns {U}
   */
  catch(onRejected) {
    return /** @type {any} */ (onRejected());
  }
}
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
    t.Fatal("program has no checker")
  }
  var file *shimast.SourceFile
  for _, candidate := range prog.userSourceFiles() {
    if filepath.Base(candidate.FileName()) == "main.ts" {
      file = candidate
      break
    }
  }
  if file == nil {
    t.Fatal("TypeScript fixture source not found")
  }
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
      t.Fatalf("call expression at %q not found", marker)
    }
    return node.AsCallExpression()
  }
  signatureAt := func(call *shimast.CallExpression) *shimchecker.Signature {
    t.Helper()
    access := call.Expression.AsPropertyAccessExpression()
    if access == nil {
      t.Fatal("JavaScript generic-default call is not a property access")
    }
    receiverType := prog.checker.GetTypeAtLocation(access.Expression)
    if receiverType == nil {
      t.Fatal("JavaScript generic-default receiver has no type")
    }
    property := prog.checker.GetPropertyOfType(receiverType, "catch")
    if property == nil {
      t.Fatal("JavaScript catch property not found")
    }
    propertyType := prog.checker.GetTypeOfSymbolAtLocation(property, call.Expression)
    if propertyType == nil {
      t.Fatal("JavaScript catch property has no type")
    }
    signatures := prog.checker.GetSignaturesOfType(propertyType, shimchecker.SignatureKindCall)
    if len(signatures) != 1 {
      t.Fatalf("JavaScript catch signatures = %d, want one", len(signatures))
    }
    return signatures[0]
  }

  ctx := &Context{File: file, Checker: prog.checker, CurrentDirectory: root}
  cases := []struct {
    marker        string
    filledDefault string
    unhandled     bool
  }{
    {marker: "uncertain.catch", filledDefault: "any", unhandled: true},
    {marker: "safe.catch", filledDefault: "undefined", unhandled: false},
  }
  for _, test := range cases {
    call := callAt(test.marker)
    signature := signatureAt(call)
    if !floatingPromiseSignatureIsJavaScript(signature) {
      t.Fatalf("%s signature was not recognized as JavaScript", test.marker)
    }
    if got := floatingPromiseSignatureApplicability(prog.checker, call, signature);
      got != floatingPromiseCallApplicable {
      t.Fatalf("%s applicability = %d, want applicable", test.marker, got)
    }
    typeParameters := signature.TypeParameters()
    if len(typeParameters) != 2 {
      t.Fatalf("%s type parameters = %d, want two", test.marker, len(typeParameters))
    }
    inferred := floatingPromiseNakedReturnInferences(
      prog.checker,
      call,
      signature,
      typeParameters[1],
      1,
    )
    if len(inferred) != 1 || prog.checker.TypeToString(inferred[0]) != test.filledDefault {
      t.Fatalf("%s filled default mismatch", test.marker)
    }
    if got := floatingPromiseSignatureReturnIsUnhandled(
      ctx,
      call.AsNode(),
      call,
      signature,
      noFloatingPromisesOptions{},
    ); got != test.unhandled {
      t.Fatalf("%s unhandled = %v, want %v", test.marker, got, test.unhandled)
    }
  }
}
