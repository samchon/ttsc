package serveprobe

import (
  "crypto/sha256"
  "fmt"
  "os"
  "path/filepath"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type plugin struct{}

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
  var helperContents []byte
  for index, dependency := range dependencies {
    contents, err := readInput(context, dependency)
    if err != nil { return err }
    if operation == "read-configured-helper" { helperContents = contents }
    if !filepath.IsAbs(dependency) {
      dependency = filepath.Join(context.Cwd, dependency)
    }
    dependencies[index] = dependency
  }
  if operation == "read-configured-helper" || operation == "echo-file" {
    suffix := ""
    if operation == "read-configured-helper" {
      suffix = ":" + strings.ToUpper(strings.TrimSpace(string(helperContents)))
    }
    factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
    var visitor *shimast.NodeVisitor
    visitor = shimast.NewNodeVisitor(func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindCallExpression {
        call := node.AsCallExpression()
        expression := call.Expression
        if expression != nil && expression.Kind == shimast.KindIdentifier && expression.Text() == "goUpper" &&
          call.Arguments != nil && len(call.Arguments.Nodes) == 1 {
          argument := call.Arguments.Nodes[0]
          if argument.Kind == shimast.KindStringLiteral {
            replacement := factory.NewStringLiteral(strings.ToUpper(argument.Text()) + suffix, 0)
            replacement.Loc = node.Loc
            return replacement
          }
        }
      }
      return visitor.VisitEachChild(node)
    }, factory, shimast.NodeVisitorHooks{})
    for _, source := range program.TSProgram.GetSourceFiles() {
      if source.IsDeclarationFile { continue }
      // ApplyProgram owns the source-to-source lane used by unplugin. The
      // utility host prints this actual SourceFile; emit-only callbacks are
      // deliberately not invoked by its transform operation.
      transformed := visitor.VisitSourceFile(source)
      source.Statements = transformed.Statements
    }
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
