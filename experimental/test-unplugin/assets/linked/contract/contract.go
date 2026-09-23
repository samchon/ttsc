// Package contract is the host matrix's linked transform plugin: a contributor
// to ttsc's utility host, so every compile goes through TypeScript-Go's program
// and the envelope carries the compiler's verdict, its reference graph, and its
// resolution candidates, the way a first-party plugin's does.
//
// It rewrites every `watchValue()` initializer to the value the contract input
// names, the same protocol as the standalone source plugin beside it: a
// `FROM_<NAME>` value comes from `src/<name>-input.server.ts`, a `RACE_` value
// is rewritten without its prefix right after it is read, and a `fixed` entry
// in the plugin's config replaces every value. Each compile that rewrote a
// consumer appends one byte to `.ttsc/contract-runs`, and every compile appends
// one to the `runLog` file the plugin's config names, when it names one: the
// predicate matrix counts compiles that way, so it shares this host build.
package contract

import (
  "fmt"
  "os"
  "path/filepath"
  "regexp"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

var typeValue = regexp.MustCompile(`export type ContractInput = "([^"]*)";`)

type plugin struct{}

func init() {
  driver.RegisterPlugin(plugin{})
}

// ApplyProgram rewrites the consumers of every project-owned source file and
// reports the contract inputs each consumer's value was read from as that
// file's dependencies. It declares no completeness: the compiler's verdict on a
// file depends on its whole reference closure, which stays the host's bound.
func (plugin) ApplyProgram(prog *driver.Program, ctx driver.PluginContext) error {
  root := ctx.Cwd
  fixed, _ := ctx.Entry.Config["fixed"].(string)
  dependency := filepath.Join(root, "src", "contract-input.server.ts")
  factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
  counted := false
  for _, file := range prog.SourceFiles() {
    if !ownedByProject(root, file.FileName()) {
      continue
    }
    var value string
    var read []string
    var failure error
    rewritten := false
    visit := func(node *shimast.Node) {
      decl := node.AsVariableDeclaration()
      if decl.Initializer == nil || !isWatchValueCall(decl.Initializer) {
        return
      }
      if failure != nil {
        return
      }
      if !rewritten {
        var err error
        value, read, err = contractValue(root, dependency)
        if err != nil {
          failure = err
          return
        }
        if fixed != "" {
          value = fixed
        }
        rewritten = true
      }
      literal := factory.NewStringLiteral(value, shimast.TokenFlagsNone)
      literal.Loc = shimcore.UndefinedTextRange()
      literal.Parent = node
      decl.Initializer = literal
    }
    walk(file.AsNode(), visit)
    if failure != nil {
      return failure
    }
    if !rewritten {
      continue
    }
    counted = true
    for _, input := range read {
      ctx.ReportFileDependency(file.FileName(), input)
    }
  }
  if runLog, ok := ctx.Entry.Config["runLog"].(string); ok && runLog != "" {
    if err := appendRun(runLog); err != nil {
      return err
    }
  }
  if !counted {
    return nil
  }
  return appendRun(filepath.Join(root, ".ttsc", "contract-runs"))
}

// appendRun appends one byte to the run log at file, creating its directory.
func appendRun(file string) error {
  if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
    return err
  }
  log, err := os.OpenFile(file, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
  if err != nil {
    return err
  }
  if _, err := log.WriteString("1"); err != nil {
    _ = log.Close()
    return err
  }
  return log.Close()
}

// ownedByProject reports whether file lies below root and outside any
// node_modules directory: the program can hold implementation files of
// source-distributed dependencies, which are not the contract's consumers.
func ownedByProject(root string, file string) bool {
  relative, err := filepath.Rel(root, filepath.FromSlash(file))
  if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
    return false
  }
  for _, segment := range strings.Split(filepath.ToSlash(relative), "/") {
    if segment == "node_modules" {
      return false
    }
  }
  return true
}

// walk calls visit on every variable declaration below node.
func walk(node *shimast.Node, visit func(*shimast.Node)) {
  if node == nil {
    return
  }
  if node.Kind == shimast.KindVariableDeclaration {
    visit(node)
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    walk(child, visit)
    return false
  })
}

// isWatchValueCall reports whether node is the bare call `watchValue()`.
func isWatchValueCall(node *shimast.Node) bool {
  if node.Kind != shimast.KindCallExpression {
    return false
  }
  call := node.AsCallExpression()
  if call.Arguments != nil && len(call.Arguments.Nodes) != 0 {
    return false
  }
  return call.Expression != nil &&
    call.Expression.Kind == shimast.KindIdentifier &&
    call.Expression.AsIdentifier().Text == "watchValue"
}

// contractValue reads the value the contract input names, and the files it
// read for it, the way the standalone source plugin does.
func contractValue(root string, dependency string) (string, []string, error) {
  files := []string{dependency}
  value, err := readContractValue(dependency)
  if err != nil {
    return "", nil, err
  }
  source := dependency
  if name, found := strings.CutPrefix(value, "FROM_"); found {
    source = filepath.Join(root, "src", strings.ToLower(name)+"-input.server.ts")
    files = append(files, source)
    if value, err = readContractValue(source); err != nil {
      return "", nil, err
    }
  }
  if strings.HasPrefix(value, "RACE_") {
    edited := fmt.Sprintf("export type ContractInput = %q;\n", strings.TrimPrefix(value, "RACE_"))
    if err := os.WriteFile(source, []byte(edited), 0o644); err != nil {
      return "", nil, err
    }
  }
  return value, files, nil
}

func readContractValue(file string) (string, error) {
  input, err := os.ReadFile(file)
  if err != nil {
    return "", err
  }
  match := typeValue.FindStringSubmatch(string(input))
  if match == nil {
    return "", fmt.Errorf("invalid contract type in %s", file)
  }
  return match[1], nil
}
