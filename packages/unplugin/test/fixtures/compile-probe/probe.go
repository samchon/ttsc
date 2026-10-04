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
  case "", "prefix", "upper", "suffix", "identity":
  default:
    return nil, fmt.Errorf("unknown shared native pipeline operation %q", operation)
  }
  return func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visitor = ec.NewNodeVisitor(func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindVariableDeclaration {
        declaration := node.AsVariableDeclaration()
        name := declaration.Name()
        initializer := declaration.Initializer
        if name != nil && name.Kind == shimast.KindIdentifier && name.Text() == "__TTSC_OWN_MARKER__" &&
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
          return ec.Factory.NewStringLiteral(strings.ToUpper(prefix + "plugin") + suffix, 0)
        }
        const ordered = "__TTSC_ORDERED__:"
        if operation != "" && strings.HasPrefix(text, ordered) {
          payload := strings.TrimPrefix(text, ordered)
          switch operation {
          case "prefix":
            return ec.Factory.NewStringLiteral(ordered + prefix + payload, 0)
          case "upper":
            return ec.Factory.NewStringLiteral(ordered + strings.ToUpper(payload), 0)
          case "suffix":
            return ec.Factory.NewStringLiteral(payload + suffix, 0)
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
      return appendContextReceipt(program, context)
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
  return appendContextReceipt(program, context)
}

// appendContextReceipt records an actually invoked entry's supplied config.
// Optional absolute destinations belong to the E2E coordinator. The
// records preserve the existing context schema and keep raw config-path anchors
// separate. A paths receipt reads the actual loaded Program options only when
// requested; it does not reparse the config or infer successful alias resolution.
// No receipt proves source rewriting, emit or project-root identity, and
// absent/empty destination config performs no IO.
func appendContextReceipt(program *driver.Program, context driver.PluginContext) error {
  records := []struct {
    option string
    value any
  }{
    {
      option: "contextReceipt",
      value: struct {
        Name string `json:"name"`
        Operation any `json:"operation"`
        Prefix any `json:"prefix"`
        Suffix any `json:"suffix"`
      }{
        Name: context.Entry.Name,
        Operation: context.Entry.Config["operation"],
        Prefix: context.Entry.Config["prefix"],
        Suffix: context.Entry.Config["suffix"],
      },
    },
    {
      option: "configPathReceipt",
      value: struct {
        Name string `json:"name"`
        Config any `json:"config"`
        ConfigFile any `json:"configFile"`
        Cwd string `json:"cwd"`
        Tsconfig string `json:"tsconfig"`
      }{
        Name: context.Entry.Name,
        Config: context.Entry.Config["config"],
        ConfigFile: context.Entry.Config["configFile"],
        Cwd: context.Cwd,
        Tsconfig: context.Tsconfig,
      },
    },
    { option: "pathsReceipt" },
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
        Name string `json:"name"`
        Paths map[string][]string `json:"paths"`
      }{
        Name: context.Entry.Name,
        Paths: paths,
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
