package cacheprobe

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type plugin struct{}

// EmitTransform changes only the corpus's independently authored sentinel.
// Config values must cross the actual descriptor/native manifest connection.
// Ordered entries retain their marker through prefix/upper and consume it on
// suffix, so the final literal distinguishes descriptor order and disabled entries.
// The named numeric marker changes only its literal-zero initializer; other
// variables and numeric literals retain their original values.
// The nested native-emission source also owns its plain marker initializer.
// The factory-arrow marker receives a real emit-factory arrow with a standalone
// property access; this does not alter other variables or source-stage text.
func (plugin) EmitTransform(context driver.PluginContext) (driver.PluginTransform, error) {
  operation, _ := context.Entry.Config["operation"].(string)
  prefix, ok := context.Entry.Config["prefix"].(string)
  if !ok && (operation == "" || operation == "prefix") {
    return nil, fmt.Errorf("shared native pipeline requires a prefix")
  }
  suffix, ok := context.Entry.Config["suffix"].(string)
  if !ok && (operation == "" || operation == "suffix") {
    return nil, fmt.Errorf("shared native pipeline requires a suffix")
  }
  switch operation {
  case "source-pipeline":
    // This explicitly selected lane mutates Program source in ApplyProgram.
    return nil, nil
  case "", "prefix", "upper", "suffix", "identity":
  default:
    return nil, fmt.Errorf("unknown shared native pipeline operation %q", operation)
  }
  return func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    nativeEmissionSource := sf != nil && strings.HasSuffix(filepath.ToSlash(sf.FileName().AsString()), "/tools/native-emission/src/main.ts")
    var visitor *shimast.NodeVisitor
    visitor = ec.NewNodeVisitor(func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindVariableDeclaration {
        declaration := node.AsVariableDeclaration()
        name := declaration.Name()
        initializer := declaration.Initializer
        if name != nil && name.Kind == shimast.KindIdentifier && name.Text() == "__TTSC_NATIVE_FACTORY_ARROW__" && initializer != nil {
          visited := visitor.VisitEachChild(node).AsVariableDeclaration()
          f := ec.Factory
          standalone := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
          access := standalone.NewPropertyAccessExpression(f.NewIdentifier("input"), nil, standalone.NewIdentifier("value"), shimast.NodeFlagsNone)
          parameter := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("input"), nil, nil, nil)
          arrow := f.NewArrowFunction(nil, nil, f.NewNodeList([]*shimast.Node{parameter}), nil, nil, f.NewToken(shimast.KindEqualsGreaterThanToken), access)
          return f.UpdateVariableDeclaration(visited, visited.Name(), visited.ExclamationToken, visited.Type, arrow)
        }
        if name != nil && name.Kind == shimast.KindIdentifier &&
          (name.Text() == "__TTSC_OWN_MARKER__" || (nativeEmissionSource && name.Text() == "marker")) &&
          initializer != nil && initializer.Kind == shimast.KindNumericLiteral && initializer.Text() == "0" {
          // Preserve the existing visitor's processing of any other declaration
          // children before replacing only this initializer through the emit factory.
          visited := visitor.VisitEachChild(node).AsVariableDeclaration()
          return ec.Factory.UpdateVariableDeclaration(visited, visited.Name(), visited.ExclamationToken, visited.Type,
            ec.Factory.NewNumericLiteral("100", 0))
        }
      }
      if node != nil && node.Kind == shimast.KindStringLiteral {
        text := node.Text()
        if operation == "" && text == "__TTSC_NATIVE_PIPELINE__" {
          return ec.Factory.NewStringLiteral(strings.ToUpper(prefix+"plugin")+suffix, 0)
        }
        const ordered = "__TTSC_ORDERED__:"
        if operation != "" && strings.HasPrefix(text, ordered) {
          payload := strings.TrimPrefix(text, ordered)
          switch operation {
          case "prefix":
            return ec.Factory.NewStringLiteral(ordered+prefix+payload, 0)
          case "upper":
            return ec.Factory.NewStringLiteral(ordered+strings.ToUpper(payload), 0)
          case "suffix":
            return ec.Factory.NewStringLiteral(payload+suffix, 0)
          }
        }
      }
      return visitor.VisitEachChild(node)
    })
    return visitor.VisitSourceFile(sf)
  }, nil
}

func (plugin) ApplyProgram(program *driver.Program, context driver.PluginContext) error {
  runLog, ok := context.Entry.Config["runLog"].(string)
  if !ok || runLog == "" {
    // Ordered entries observe the same Program without adding compile ticks.
    operation, _ := context.Entry.Config["operation"].(string)
    if operation == "prefix" || operation == "upper" || operation == "suffix" || operation == "identity" {
      if err := appendContextReceipt(program, context); err != nil {
        return err
      }
      return reportConfiguredDependencies(program, context)
    }
    return fmt.Errorf("real-envelope compile probe requires a runLog string")
  }
  if !filepath.IsAbs(runLog) {
    runLog = filepath.Join(context.Cwd, runLog)
  }
  file, err := os.OpenFile(runLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
  if err != nil {
    return err
  }
  info, err := file.Stat()
  if err != nil {
    _ = file.Close()
    return err
  }
  attempt := info.Size()
  if _, err := file.Write([]byte{1}); err != nil {
    _ = file.Close()
    return err
  }
  if err := file.Close(); err != nil {
    return err
  }
  raceAttempt, _ := context.Entry.Config["raceAttempt"].(float64)
  if attempt == int64(raceAttempt) {
    raceFile, _ := context.Entry.Config["raceFile"].(string)
    raceContent, _ := context.Entry.Config["raceContent"].(string)
    if raceFile != "" && raceContent != "" {
      if !filepath.IsAbs(raceFile) {
        raceFile = filepath.Join(context.Cwd, raceFile)
      }
      if err := os.WriteFile(raceFile, []byte(raceContent), 0o644); err != nil {
        return err
      }
    }
  }
  if err := appendContextReceipt(program, context); err != nil {
    return err
  }
  if operation, _ := context.Entry.Config["operation"].(string); operation == "source-pipeline" {
    prefix, prefixOK := context.Entry.Config["prefix"].(string)
    suffix, suffixOK := context.Entry.Config["suffix"].(string)
    if !prefixOK || !suffixOK {
      return fmt.Errorf("source pipeline requires prefix and suffix strings")
    }
    // The utility host prints the actual Program source after ApplyProgram;
    // its transform lane does not invoke EmitTransform. This independently
    // authored sentinel therefore crosses that real source-to-source lane.
    factory := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
    var visitor *shimast.NodeVisitor
    visitor = shimast.NewNodeVisitor(func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindStringLiteral && node.Text() == "__TTSC_NATIVE_PIPELINE__" {
        replacement := factory.NewStringLiteral(strings.ToUpper(prefix+"plugin")+suffix, 0)
        replacement.Loc = node.Loc
        return replacement
      }
      return visitor.VisitEachChild(node)
    }, factory, shimast.NodeVisitorHooks{})
    for _, source := range program.TSProgram.GetSourceFiles() {
      if !source.IsDeclarationFile {
        transformed := visitor.VisitSourceFile(source)
        source.Statements = transformed.Statements
      }
    }
  }
  return reportConfiguredDependencies(program, context)
}

// reportConfiguredDependencies declares explicitly selected resident sources
// or the actual Program's non-declaration sources through the per-entry API. Config
// paths are native cwd-relative or absolute; source spelling passed to the
// reporter comes from the loaded Program. Every contributing entry must make
// its own completeness declaration. The two source selections cannot coexist;
// absence of both performs no work.
// Duplicate and self dependencies are reported unchanged for the host's actual
// aggregation policy; no JSON envelope or all-file completeness is fabricated.
func reportConfiguredDependencies(program *driver.Program, context driver.PluginContext) error {
  configuredFiles, present := context.Entry.Config["reportedFiles"]
  configuredProgramSources, programSourcesPresent := context.Entry.Config["reportedProgramSources"]
  if present && programSourcesPresent {
    return fmt.Errorf("reportedFiles and reportedProgramSources cannot both be configured")
  }
  if !present && !programSourcesPresent {
    return nil
  }
  if programSourcesPresent {
    enabled, ok := configuredProgramSources.(bool)
    if !ok || !enabled {
      return fmt.Errorf("reportedProgramSources must be true")
    }
  }
  stringsOf := func(value any, option string) ([]string, error) {
    entries, ok := value.([]any)
    if !ok {
      return nil, fmt.Errorf("%s must be an array of path strings", option)
    }
    paths := make([]string, 0, len(entries))
    for _, entry := range entries {
      file, ok := entry.(string)
      if !ok {
        return nil, fmt.Errorf("%s must contain only path strings", option)
      }
      paths = append(paths, file)
    }
    return paths, nil
  }
  var files []string
  var err error
  if present {
    files, err = stringsOf(configuredFiles, "reportedFiles")
    if err != nil {
      return err
    }
  }
  var dependencies []string
  if configured, present := context.Entry.Config["reportedDependencies"]; present {
    dependencies, err = stringsOf(configured, "reportedDependencies")
    if err != nil {
      return err
    }
  }
  if present && len(files) == 0 {
    return nil
  }
  if program == nil || program.TSProgram == nil {
    if programSourcesPresent {
      return fmt.Errorf("reportedProgramSources requires the actual loaded Program")
    }
    return fmt.Errorf("reportedFiles requires the actual loaded Program")
  }
  resolve := func(file string) string {
    native := filepath.FromSlash(file)
    if !filepath.IsAbs(native) {
      native = filepath.Join(context.Cwd, native)
    }
    return filepath.Clean(native)
  }
  selected := make(map[string]bool, len(files))
  for _, file := range files {
    selected[resolve(file)] = false
  }
  var actual []string
  // The upstream accessor does not dispatch driver linked hooks again from
  // inside ApplyProgram, unlike driver.Program.SourceFiles.
  for _, source := range program.TSProgram.GetSourceFiles() {
    if source.IsDeclarationFile {
      continue
    }
    if programSourcesPresent {
      actual = append(actual, source.FileName().AsString())
      continue
    }
    key := resolve(source.FileName().AsString())
    if seen, wanted := selected[key]; wanted && !seen {
      selected[key] = true
      actual = append(actual, source.FileName().AsString())
    }
  }
  for file, found := range selected {
    if !found {
      return fmt.Errorf("reportedFiles source is not in the loaded Program: %s", file)
    }
  }
  for _, file := range actual {
    for _, dependency := range dependencies {
      context.ReportFileDependency(file, dependency)
    }
    context.ReportFileDependenciesComplete(file)
  }
  return nil
}

// appendContextReceipt records an actually invoked entry's supplied config.
// Optional absolute destinations belong to the E2E coordinator. The
// records preserve the existing context schema and keep raw config-path anchors
// separate. Paths and case-policy receipts read the actual loaded Program only
// when requested; they do not reparse config, infer alias resolution or guess a
// compiler case policy from the operating-system name.
// No receipt proves source rewriting, emit or project-root identity, and
// absent/empty destination config performs no IO.
func appendContextReceipt(program *driver.Program, context driver.PluginContext) error {
  records := []struct {
    option string
    value  any
  }{
    {
      option: "contextReceipt",
      value: struct {
        Name      string `json:"name"`
        Operation any    `json:"operation"`
        Prefix    any    `json:"prefix"`
        Suffix    any    `json:"suffix"`
      }{
        Name:      context.Entry.Name,
        Operation: context.Entry.Config["operation"],
        Prefix:    context.Entry.Config["prefix"],
        Suffix:    context.Entry.Config["suffix"],
      },
    },
    {
      option: "configPathReceipt",
      value: struct {
        Name       string `json:"name"`
        Config     any    `json:"config"`
        ConfigFile any    `json:"configFile"`
        Cwd        string `json:"cwd"`
        Tsconfig   string `json:"tsconfig"`
      }{
        Name:       context.Entry.Name,
        Config:     context.Entry.Config["config"],
        ConfigFile: context.Entry.Config["configFile"],
        Cwd:        context.Cwd,
        Tsconfig:   context.Tsconfig,
      },
    },
    {option: "pathsReceipt"},
    {option: "casePolicyReceipt"},
  }
  for _, record := range records {
    configured, present := context.Entry.Config[record.option]
    if !present {
      continue
    }
    receipt, ok := configured.(string)
    if !ok {
      return fmt.Errorf("%s must be an absolute path string", record.option)
    }
    if receipt == "" {
      continue
    }
    if !filepath.IsAbs(receipt) {
      return fmt.Errorf("%s must be an absolute path string", record.option)
    }
    value := record.value
    if record.option == "pathsReceipt" {
      if program == nil || program.TSProgram == nil {
        return fmt.Errorf("pathsReceipt requires the actual loaded Program")
      }
      options := program.TSProgram.Options()
      if options == nil {
        return fmt.Errorf("pathsReceipt requires actual compiler options")
      }
      var paths map[string][]string
      if options.Paths != nil {
        paths = make(map[string][]string)
        for pattern, targets := range options.Paths.Entries() {
          paths[pattern] = targets
        }
      }
      value = struct {
        Name  string              `json:"name"`
        Paths map[string][]string `json:"paths"`
      }{
        Name:  context.Entry.Name,
        Paths: paths,
      }
    } else if record.option == "casePolicyReceipt" {
      if program == nil || program.TSProgram == nil {
        return fmt.Errorf("casePolicyReceipt requires the actual loaded Program")
      }
      value = struct {
        Name                      string `json:"name"`
        UseCaseSensitiveFileNames bool   `json:"useCaseSensitiveFileNames"`
      }{
        Name:                      context.Entry.Name,
        UseCaseSensitiveFileNames: program.TSProgram.UseCaseSensitiveFileNames(),
      }
    }
    file, err := os.OpenFile(receipt, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
    if err != nil {
      return err
    }
    if err := json.NewEncoder(file).Encode(value); err != nil {
      _ = file.Close()
      return err
    }
    if err := file.Close(); err != nil {
      return err
    }
  }
  return nil
}

func init() {
  driver.RegisterPlugin(plugin{})
}
