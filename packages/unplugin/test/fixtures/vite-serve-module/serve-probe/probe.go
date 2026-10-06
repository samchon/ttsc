package serveprobe

import (
  "crypto/sha256"
  "fmt"
  "os"
  "path/filepath"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type plugin struct{}

// EmitTransform replaces only the authored goUpper call. The real compiler
// retains every other statement, its source map and the banner preamble.
// Helper bytes are read and witnessed at consumption, rather than copied into
// an invented compiler output or resolution graph.
func (plugin) EmitTransform(context driver.PluginContext) (driver.PluginTransform, error) {
  operation, _ := context.Entry.Config["operation"].(string)
  if operation == "emit-dependencies" {
    return nil, nil
  }
  if operation != "read-configured-helper" && operation != "echo-file" {
    return nil, fmt.Errorf("unsupported serve fixture operation %q", operation)
  }
  helper, _ := context.Entry.Config["path"].(string)
  if helper == "" {
    return nil, fmt.Errorf("read-configured-helper requires path")
  }
  suffix := ""
  if operation == "read-configured-helper" {
    contents, err := readInput(context, helper)
    if err != nil {
      return nil, err
    }
    suffix = ":" + strings.ToUpper(strings.TrimSpace(string(contents)))
  }
  return func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visitor = ec.NewNodeVisitor(func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindCallExpression {
        call := node.AsCallExpression()
        expression := call.Expression
        if expression != nil && expression.Kind == shimast.KindIdentifier && expression.Text() == "goUpper" &&
          call.Arguments != nil && len(call.Arguments.Nodes) == 1 {
          argument := call.Arguments.Nodes[0]
          if argument.Kind == shimast.KindStringLiteral {
            return ec.Factory.NewStringLiteral(strings.ToUpper(argument.Text()) + suffix, 0)
          }
        }
      }
      return visitor.VisitEachChild(node)
    })
    return visitor.VisitSourceFile(sf)
  }, nil
}

// ApplyProgram declares the fixture's actual external asset reads for every
// non-declaration source in this Program. Native compiler resolution supplies
// its own missing candidates and type-root predicates; this fixture never
// manufactures either. Completeness is entry-local and covers these explicit
// plugin reads, not the compiler's independently observed input population.
func (plugin) ApplyProgram(program *driver.Program, context driver.PluginContext) error {
  operation, _ := context.Entry.Config["operation"].(string)
  var dependencies []string
  switch operation {
  case "echo-file":
    // The actual Program contains and emits the lazy source. No invented
    // extraOutputs envelope substitutes for that compiler-owned output.
    selected, _ := context.Entry.Config["path"].(string)
    if selected == "" { return fmt.Errorf("echo-file requires path") }
    if !filepath.IsAbs(selected) { selected = filepath.Join(context.Cwd, selected) }
    found := false
    for _, source := range program.TSProgram.GetSourceFiles() {
      if filepath.Clean(source.FileName()) == filepath.Clean(selected) { found = true; break }
    }
    if !found { return fmt.Errorf("lazy source is not in the loaded Program: %s", selected) }
  case "read-configured-helper":
    helper, _ := context.Entry.Config["path"].(string)
    if helper == "" {
      return fmt.Errorf("read-configured-helper requires path")
    }
    dependencies = append(dependencies, helper)
  case "emit-dependencies":
    entries, ok := context.Entry.Config["dependencies"].([]any)
    if !ok {
      return fmt.Errorf("emit-dependencies requires dependency array")
    }
    for _, entry := range entries {
      dependency, ok := entry.(string)
      if !ok || dependency == "" {
        return fmt.Errorf("dependencies must be nonempty path strings")
      }
      dependencies = append(dependencies, dependency)
    }
  default:
    return fmt.Errorf("unsupported serve fixture operation %q", operation)
  }
  for index, dependency := range dependencies {
    if _, err := readInput(context, dependency); err != nil {
      return err
    }
    if !filepath.IsAbs(dependency) {
      dependency = filepath.Join(context.Cwd, dependency)
    }
    dependencies[index] = dependency
  }
  for _, source := range program.TSProgram.GetSourceFiles() {
    if source.IsDeclarationFile {
      continue
    }
    for _, dependency := range dependencies {
      context.ReportFileDependency(source.FileName(), dependency)
    }
    context.ReportFileDependenciesComplete(source.FileName())
  }
  return nil
}

// readInput reports the digest of exactly the bytes consumed by this call and
// the actual resolved file identity. A failed read or realpath remains a
// fixture failure; no newer snapshot or synthetic absence supplies proof.
func readInput(context driver.PluginContext, location string) ([]byte, error) {
  if !filepath.IsAbs(location) {
    location = filepath.Join(context.Cwd, location)
  }
  contents, err := os.ReadFile(location)
  if err != nil {
    return nil, err
  }
  real, err := filepath.EvalSymlinks(location)
  if err != nil {
    return nil, err
  }
  digest := fmt.Sprintf("%x", sha256.Sum256(contents))
  context.ReportHostInputHash(location, &digest)
  context.ReportHostInputRealpath(location, &real)
  return contents, nil
}

func init() { driver.RegisterPlugin(plugin{}) }
