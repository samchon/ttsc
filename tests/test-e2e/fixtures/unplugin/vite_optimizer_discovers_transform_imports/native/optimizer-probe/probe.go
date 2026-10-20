package optimizerprobe

import (
  "encoding/json"
  "fmt"
  "path/filepath"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type plugin struct{}

// SourcePreamble adds configured imports before parsing so the optimizer must inspect transformed text.
func (plugin) SourcePreamble(context driver.PluginContext) (string, error) {
  imports, ok := context.Entry.Config["imports"].([]any)
  if !ok {
    return "", fmt.Errorf("optimizer fixture requires an imports array")
  }
  var preamble strings.Builder
  for _, entry := range imports {
    specifier, ok := entry.(string)
    if !ok || specifier == "" {
      return "", fmt.Errorf("optimizer imports must be nonempty strings")
    }
    encoded, err := json.Marshal(specifier)
    if err != nil {
      return "", err
    }
    preamble.WriteString("import ")
    preamble.Write(encoded)
    preamble.WriteString(";\n")
  }
  // Configuration fully determines the preamble; this plugin reads no files.
  context.ReportDependenciesComplete()
  return preamble.String(), nil
}

// ApplyProgram adds local-import edges to selected project-relative sources without reading the helpers.
func (plugin) ApplyProgram(program *driver.Program, context driver.PluginContext) error {
  configured, present := context.Entry.Config["sourceImports"]
  if !present {
    return nil
  }
  imports, ok := configured.(map[string]any)
  if !ok {
    return fmt.Errorf("sourceImports must map source paths to module specifiers")
  }
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  for _, source := range program.TSProgram.GetSourceFiles() {
    if source.IsDeclarationFile {
      continue
    }
    relative, err := filepath.Rel(context.Cwd, string(source.FileName()))
    if err != nil {
      // Project-relative selectors cannot name a source on another volume.
      continue
    }
    value, selected := imports[filepath.ToSlash(relative)]
    if !selected {
      continue
    }
    specifier, ok := value.(string)
    if !ok || specifier == "" {
      return fmt.Errorf("sourceImports values must be nonempty strings")
    }
    declaration := factory.NewImportDeclaration(nil, nil, factory.NewStringLiteral(specifier, 0), nil)
    source.Statements = factory.NewNodeList(append([]*shimast.Node{declaration}, source.Statements.Nodes...))
  }
  return nil
}

func init() { driver.RegisterPlugin(plugin{}) }
