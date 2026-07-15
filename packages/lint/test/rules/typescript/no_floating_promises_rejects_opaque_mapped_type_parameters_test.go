package linthost

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestNoFloatingPromisesRejectsOpaqueMappedTypeParameters verifies generic
// candidate proofs fail closed when mapped-type inference is not observable
// through public properties or index infos.
//
// The callable case is separate because its call signature would otherwise
// enter the supported callback proof before the ordinary latent-type walk.
func TestNoFloatingPromisesRejectsOpaqueMappedTypeParameters(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "main.ts"), `interface PlainMappedCatch {
  catch<T = undefined>(value: { [K in keyof T]: T[K] }): T;
}
type MappedCallback<T> =
  ((reason: unknown) => undefined) & { [K in keyof T]: T[K] };
interface CallableMappedCatch {
  catch<T = undefined>(onRejected: MappedCallback<T>): T;
}
declare const plainMapped: PlainMappedCatch;
declare const plainValue: {};
declare const callableMapped: CallableMappedCatch;
declare const callableValue: ((reason: unknown) => undefined) & {};
plainMapped.catch(plainValue);
callableMapped.catch(callableValue);
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
  files := prog.userSourceFiles()
  if len(files) != 1 || prog.checker == nil {
    t.Fatalf("program setup mismatch: files=%d checker=%v", len(files), prog.checker != nil)
  }
  file := files[0]
  callAt := func(marker string) *shimast.CallExpression {
    t.Helper()
    offset := strings.Index(file.Text(), marker)
    if offset < 0 {
      t.Fatalf("mapped-type fixture marker %q not found", marker)
    }
    node := shimast.GetNodeAtPosition(file, offset, false)
    for node != nil && node.Kind != shimast.KindCallExpression {
      node = node.Parent
    }
    if node == nil || node.AsCallExpression() == nil {
      t.Fatalf("mapped-type fixture call at %q not found", marker)
    }
    return node.AsCallExpression()
  }
  signatureAt := func(call *shimast.CallExpression) *shimchecker.Signature {
    t.Helper()
    access := call.Expression.AsPropertyAccessExpression()
    if access == nil {
      t.Fatal("mapped-type fixture call is not a property access")
    }
    receiverType := prog.checker.GetTypeAtLocation(access.Expression)
    if receiverType == nil {
      t.Fatal("mapped-type fixture receiver has no type")
    }
    property := prog.checker.GetPropertyOfType(receiverType, "catch")
    if property == nil {
      t.Fatal("mapped-type fixture catch property not found")
    }
    propertyType := prog.checker.GetTypeOfSymbolAtLocation(property, call.Expression)
    if propertyType == nil {
      t.Fatal("mapped-type fixture catch property has no type")
    }
    signatures := prog.checker.GetSignaturesOfType(propertyType, shimchecker.SignatureKindCall)
    if len(signatures) != 1 || len(signatures[0].TypeParameters()) != 1 {
      t.Fatalf("mapped-type fixture signature mismatch: signatures=%d", len(signatures))
    }
    return signatures[0]
  }
  mappedPart := func(parameterType *shimchecker.Type) *shimchecker.Type {
    var find func(*shimchecker.Type) *shimchecker.Type
    seen := make(map[*shimchecker.Type]bool)
    find = func(candidate *shimchecker.Type) *shimchecker.Type {
      if candidate == nil || seen[candidate] {
        return nil
      }
      seen[candidate] = true
      if candidate.Flags()&shimchecker.TypeFlagsObject != 0 &&
        candidate.ObjectFlags()&(shimchecker.ObjectFlagsMapped|shimchecker.ObjectFlagsReverseMapped) != 0 {
        return candidate
      }
      if candidate.Flags()&shimchecker.TypeFlagsUnionOrIntersection != 0 {
        for _, part := range candidate.Types() {
          if found := find(part); found != nil {
            return found
          }
        }
      }
      return nil
    }
    return find(parameterType)
  }

  for _, marker := range []string{"plainMapped.catch", "callableMapped.catch"} {
    call := callAt(marker)
    signature := signatureAt(call)
    parameterType := floatingPromiseParameterType(prog.checker, call, signature, 0)
    if parameterType == nil {
      t.Fatalf("%s parameter has no type", marker)
    }
    opaquePart := mappedPart(parameterType)
    if opaquePart == nil {
      t.Fatalf("%s parameter exposes no mapped constituent", marker)
    }
    if len(shimchecker.Checker_getPropertiesOfType(prog.checker, opaquePart)) != 0 ||
      len(prog.checker.GetIndexInfosOfType(opaquePart)) != 0 {
      t.Fatalf("%s mapped constituent unexpectedly exposes a public member contract", marker)
    }
    if !floatingPromiseTypeContainsOpaqueMappedObject(prog.checker, parameterType, nil) {
      t.Fatalf("%s mapped constituent escaped the opaque-shape guard", marker)
    }
    if !floatingPromiseTypeContainsAnyTypeParameter(
      prog.checker,
      parameterType,
      signature.TypeParameters(),
      call.Expression,
      nil,
    ) {
      t.Fatalf("%s mapped constituent escaped the latent-type guard", marker)
    }
    if got := floatingPromiseSignatureApplicability(prog.checker, call, signature); got != floatingPromiseCallUncertain {
      t.Fatalf("%s applicability = %d, want uncertain", marker, got)
    }
  }
}
