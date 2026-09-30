package driver_test

import (
  "encoding/json"
  "reflect"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

// TestSourceSDKInterfaceProperties preserves the source-plugin fixture's exact
// property lists and checks the semantic graph beyond lexical enumeration.
//
// The old fixture enumerated AST properties while merely retaining a checker.
// Both paths are exercised here so inherited fields cannot masquerade as an
// equivalent checker result and method declarations cannot become properties
// of the lexical list.
//
//  1. Build the original User/Product declarations and adjacent boundary types.
//  2. Walk interface members and query their types through the live checker.
//  3. Compare original ordered JSON lists and semantic inherited/empty results.
// @evidence contracts/testing.md#behavioral-verification Program.SourceFiles and interface/property AST accessors must preserve User's id,email,name and Product's sku,price; Checker_getPropertiesOfType must resolve those symbols plus inherited id on Derived, while lexical enumeration excludes a method and Empty has no properties.
// @evidence contracts/testing.md#independent-expectations Literal JSON ["id","email","name"] and ["sku","price"] retain the former emitted-output assertions independently of traversal output. Authored Base/Derived/WithMethod/Empty declarations independently determine inherited and empty semantic controls.
// @evidence contracts/testing.md#distinguishing-cases Separate User/Product inventories catch merged or truncated ownership; Empty exercises zero members, WithMethod separates property signatures from methods, and Derived differs from its lexical own-field list because id is inherited. Checker property order is normalized only for the independent semantic set oracle.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry calls sourceSDKProgram and public AST/checker operations directly in the driver-unit batch. It creates temporary source/config inputs and releases the checker lease, with no native artifact or CLI; canonical runtime-plugin E2E retains source-build/module-overlay transport.
func TestSourceSDKInterfaceProperties(t *testing.T) {
  source := "interface User {\n  id: number;\n  email: string;\n  name: string;\n}\n\ninterface Product {\n  sku: string;\n  price: number;\n}\n\nexport const userProps: readonly string[] = typeProperties<User>();\nexport const productProps: readonly string[] = typeProperties<Product>();\nconsole.log(userProps, productProps);\n" +
    "interface Empty {}\ninterface WithMethod { value: string; run(): void; }\ninterface Base { id: number; }\ninterface Derived extends Base { title: string; }\n"
  program, checker, _ := sourceSDKProgram(t, source)
  lexical := map[string][]string{}
  semantic := map[string][]string{}
  for _, file := range program.SourceFiles() {
    if file.IsDeclarationFile { continue }
    for _, statement := range file.Statements.Nodes {
      if statement.Kind != shimast.KindInterfaceDeclaration { continue }
      declaration := statement.AsInterfaceDeclaration()
      name := declaration.Name().Text()
      names := []string{}
      for _, member := range declaration.Members.Nodes {
        if member.Kind == shimast.KindPropertySignature { names = append(names, member.AsPropertySignatureDeclaration().Name().Text()) }
      }
      lexical[name] = names
      typ := checker.GetTypeAtLocation(declaration.Name())
      if typ == nil { t.Fatalf("%s type missing", name) }
      properties := []string{}
      for _, property := range shimchecker.Checker_getPropertiesOfType(checker, typ) { properties = append(properties, property.Name) }
      semantic[name] = properties
    }
  }
  for name, expected := range map[string]string{"User": `["id","email","name"]`, "Product": `["sku","price"]`} {
    for lane, actual := range map[string][]string{"AST": lexical[name], "Checker": semantic[name]} {
      encoded, err := json.Marshal(actual)
      if err != nil { t.Fatal(err) }
      if string(encoded) != expected { t.Fatalf("%s %s properties: %s, want %s", name, lane, encoded, expected) }
    }
  }
  if !reflect.DeepEqual(lexical["Empty"], []string{}) || !reflect.DeepEqual(semantic["Empty"], []string{}) { t.Fatalf("Empty acquired properties: AST=%v Checker=%v", lexical["Empty"], semantic["Empty"]) }
  if !reflect.DeepEqual(lexical["WithMethod"], []string{"value"}) { t.Fatalf("method entered lexical properties: %v", lexical["WithMethod"]) }
  if !reflect.DeepEqual(lexical["Derived"], []string{"title"}) { t.Fatalf("Derived lexical fields: %v", lexical["Derived"]) }
  inherited := map[string]bool{}
  for _, name := range semantic["Derived"] { inherited[name] = true }
  if len(semantic["Derived"]) != 2 || !inherited["id"] || !inherited["title"] { t.Fatalf("Derived semantic properties: %v, want id,title", semantic["Derived"]) }
}
