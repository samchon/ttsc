package linthost

import (
  "errors"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
)

// TestTypeAliasReferenceNodeUsesBorrowedBuilderContext verifies checked alias metadata reaches a reference node in a borrowed context.
//
// A builder pointer alone cannot serialize an alias: symbol naming and argument
// conversion need the checker host and an entered enclosing-file context.
//
//  1. Acquire the real checker and its mutex, then query authored alias metadata.
//  2. Convert global and namespace metadata and require Pair<string> and Named.Pair<string>.
//  3. Exercise nested conversion, nil return, callback error and panic recovery.
//
// @evidence contracts/testing.md#behavioral-verification A real fixture Program/checker produces alias metadata and the actual upstream conversion must yield a TypeReference with the authored name and string keyword argument; nested and recovered calls execute the same endpoint.
// @evidence contracts/testing.md#independent-expectations The fixture's global Pair<T> and namespace Named.Pair<T> declarations establish literal identifier and qualified-name expectations; both Holder properties supply the independently authored string argument.
// @evidence contracts/testing.md#distinguishing-cases Ordinary and nested conversion contrast with nil callback return, exact callback error identity and a propagated panic followed by healthy conversion. The nested call is made from inside an outer WithNodeBuilderContext callback and must still return a correct reference; the test does not compare the two builder pointers.
// @evidence contracts/testing.md#execution-ownership Unit entry TestTypeAliasReferenceNodeUsesBorrowedBuilderContext runs one loadProgram and creates its dedicated checker with the actual returned mutex over a temporary single-file project in the Go test process and holds that mutex across metadata queries and all exposed WithNodeBuilderContext and ToTypeReferenceNode calls; it installs no consumer and builds no native compiler artifact.
func TestTypeAliasReferenceNodeUsesBorrowedBuilderContext(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"strict":true},"files":["main.ts"]}`)
  writeFile(t, filepath.Join(root, "main.ts"), `type Pair<T> = [T, T]; namespace Named { export type Pair<T> = [T, T]; } class Holder { value!: Pair<string>; qualified!: Named.Pair<string>; }`)
  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.close()
  checker, checkerMutex := shimchecker.NewChecker(prog.tsProgram, nil)
  if checker == nil || checkerMutex == nil {
    t.Fatal("checker and mutex were not acquired")
  }
  prog.checker = checker
  checkerMutex.Lock()
  defer checkerMutex.Unlock()
  holder := shimchecker.Checker_getDeclaredTypeOfSymbol(prog.checker, classSymbol(t, prog, "Holder"))
  value := shimchecker.Checker_getTypeOfPropertyOfType(prog.checker, holder, "value")
  if value == nil || value.Alias() == nil {
    t.Fatal("Pair<string> alias metadata missing")
  }
  alias := value.Alias()
  if alias.Symbol() == nil || alias.Symbol().Name() != "Pair" || len(alias.TypeArguments()) != 1 || prog.checker.TypeToString(alias.TypeArguments()[0]) != "string" {
    t.Fatal("authored alias identity or argument missing")
  }
  enclosing := classSymbol(t, prog, "Holder").Declarations()[0]
  emit := shimprinter.NewEmitContext()
  assertReference := func(node *shimast.Node) {
    t.Helper()
    if node == nil || node.Kind != shimast.KindTypeReference {
      t.Fatalf("expected TypeReference, got %#v", node)
    }
    reference := node.AsTypeReferenceNode()
    if reference.TypeName.Kind != shimast.KindIdentifier || reference.TypeName.AsIdentifier().Text != "Pair" {
      t.Fatal("alias reference name is not Pair")
    }
    arguments := node.TypeArguments()
    if len(arguments) != 1 || arguments[0].Kind != shimast.KindStringKeyword {
      t.Fatalf("alias argument is not string: %#v", arguments)
    }
  }
  convert := func() {
    t.Helper()
    node, err := shimchecker.WithNodeBuilderContext(prog.checker, emit, enclosing, func(builder *shimchecker.NodeBuilderImpl) (*shimast.Node, error) {
      return alias.ToTypeReferenceNode(builder), nil
    })
    if err != nil {
      t.Fatal(err)
    }
    assertReference(node)
  }
  convert()
  qualifiedType := shimchecker.Checker_getTypeOfPropertyOfType(prog.checker, holder, "qualified")
  if qualifiedType == nil || qualifiedType.Alias() == nil {
    t.Fatal("Named.Pair<string> metadata missing")
  }
  qualifiedNode, qualifiedError := shimchecker.WithNodeBuilderContext(prog.checker, emit, enclosing, func(builder *shimchecker.NodeBuilderImpl) (*shimast.Node, error) {
    return qualifiedType.Alias().ToTypeReferenceNode(builder), nil
  })
  if qualifiedError != nil {
    t.Fatal(qualifiedError)
  }
  if qualifiedNode == nil || qualifiedNode.Kind != shimast.KindTypeReference {
    t.Fatal("qualified alias did not reach a reference")
  }
  qualifiedName := qualifiedNode.AsTypeReferenceNode().TypeName
  if qualifiedName.Kind != shimast.KindQualifiedName || qualifiedName.AsQualifiedName().Left.Kind != shimast.KindIdentifier || qualifiedName.AsQualifiedName().Left.AsIdentifier().Text != "Named" || qualifiedName.AsQualifiedName().Right.Text() != "Pair" {
    t.Fatal("authored namespace qualification was not preserved")
  }
  if arguments := qualifiedNode.TypeArguments(); len(arguments) != 1 || arguments[0].Kind != shimast.KindStringKeyword {
    t.Fatal("qualified alias argument is not string")
  }
  node, err := shimchecker.WithNodeBuilderContext(prog.checker, emit, enclosing, func(outer *shimchecker.NodeBuilderImpl) (*shimast.Node, error) {
    convert()
    return alias.ToTypeReferenceNode(outer), nil
  })
  if err != nil {
    t.Fatal(err)
  }
  assertReference(node)
  node, err = shimchecker.WithNodeBuilderContext(prog.checker, emit, enclosing, func(*shimchecker.NodeBuilderImpl) (*shimast.Node, error) { return nil, nil })
  if node != nil || err != nil {
    t.Fatal("nil callback result was changed")
  }
  failure := errors.New("authored callback failure")
  node, err = shimchecker.WithNodeBuilderContext(prog.checker, emit, enclosing, func(*shimchecker.NodeBuilderImpl) (*shimast.Node, error) { return nil, failure })
  if node != nil || err != failure {
    t.Fatal("callback failure identity was changed")
  }
  convert()
  func() {
    defer func() {
      if recovered := recover(); recovered != failure {
        t.Fatalf("callback panic = %v", recovered)
      }
    }()
    _, _ = shimchecker.WithNodeBuilderContext(prog.checker, emit, enclosing, func(*shimchecker.NodeBuilderImpl) (*shimast.Node, error) { panic(failure) })
  }()
  convert()
}
