package cacheprobe

import (
  "fmt"
  "os"
  "path/filepath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type plugin struct{}

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
