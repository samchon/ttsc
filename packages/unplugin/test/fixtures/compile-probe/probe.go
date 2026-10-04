package cacheprobe

import (
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
func (plugin) EmitTransform(context driver.PluginContext) (driver.PluginTransform, error) {
  prefix, ok := context.Entry.Config["prefix"].(string)
  if !ok { return nil, fmt.Errorf("shared native pipeline requires a prefix") }
  suffix, ok := context.Entry.Config["suffix"].(string)
  if !ok { return nil, fmt.Errorf("shared native pipeline requires a suffix") }
  return func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visitor = ec.NewNodeVisitor(func(node *shimast.Node) *shimast.Node {
      if node != nil && node.Kind == shimast.KindStringLiteral && node.Text() == "__TTSC_NATIVE_PIPELINE__" {
        return ec.Factory.NewStringLiteral(strings.ToUpper(prefix + "plugin") + suffix, 0)
      }
      return visitor.VisitEachChild(node)
    })
    return visitor.VisitSourceFile(sf)
  }, nil
}

func (plugin) ApplyProgram(_ *driver.Program, context driver.PluginContext) error {
  runLog, ok := context.Entry.Config["runLog"].(string)
  if !ok || runLog == "" {
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
  return nil
}

func init() {
  driver.RegisterPlugin(plugin{})
}
