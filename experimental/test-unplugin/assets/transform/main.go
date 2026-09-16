package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "io/fs"
  "os"
  "path/filepath"
  "regexp"
  "strings"
)

var markerCall = regexp.MustCompile(`mark\("([^"]*)"\)`)
var typeValue = regexp.MustCompile(`"([^"]+)"`)

type result struct {
  TypeScript   map[string]string   `json:"typescript"`
  Dependencies map[string][]string `json:"dependencies,omitempty"`
}

func main() { os.Exit(run(os.Args[1:])) }

func run(args []string) int {
  if len(args) == 0 {
    return 2
  }
  if args[0] != "transform" {
    return 0
  }
  flags := flag.NewFlagSet("transform", flag.ContinueOnError)
  cwd := flags.String("cwd", "", "")
  _ = flags.String("tsconfig", "", "")
  _ = flags.String("plugins-json", "", "")
  if err := flags.Parse(args[1:]); err != nil {
    return 2
  }
  root := *cwd
  if root == "" {
    root, _ = os.Getwd()
  }
  output := result{TypeScript: map[string]string{}, Dependencies: map[string][]string{}}
  dependency := filepath.Join(root, "src", "contract-input.server.ts")
  counted := false
  skip := map[string]bool{"node_modules": true, ".next": true, ".git": true, ".ttsc": true, ".react-router": true, ".contracts": true}
  err := filepath.WalkDir(root, func(file string, entry fs.DirEntry, err error) error {
    if err != nil {
      if os.IsNotExist(err) {
        return nil
      }
      return err
    }
    if entry.IsDir() {
      if skip[entry.Name()] || strings.HasPrefix(entry.Name(), "dist-") {
        return filepath.SkipDir
      }
      return nil
    }
    base := filepath.Base(file)
    declaration := strings.HasSuffix(base, ".d.ts") || strings.HasSuffix(base, ".d.mts") || strings.HasSuffix(base, ".d.cts") || (strings.HasSuffix(base, ".ts") && strings.Contains(base, ".d."))
    sourceFile := strings.HasSuffix(file, ".ts") || strings.HasSuffix(file, ".tsx") || strings.HasSuffix(file, ".mts") || strings.HasSuffix(file, ".cts")
    if declaration || !sourceFile {
      return nil
    }
    source, err := os.ReadFile(file)
    if err != nil {
      return err
    }
    code := markerCall.ReplaceAllStringFunc(string(source), func(call string) string {
      return fmt.Sprintf("%q", strings.ToUpper(markerCall.FindStringSubmatch(call)[1]))
    })
    relative, err := filepath.Rel(root, file)
    if err != nil {
      return err
    }
    key := filepath.ToSlash(relative)
    if strings.Contains(code, "watchValue()") {
      input, err := os.ReadFile(dependency)
      if err != nil {
        return err
      }
      match := typeValue.FindStringSubmatch(string(input))
      if len(match) != 2 {
        return fmt.Errorf("invalid contract type in %s", dependency)
      }
      code = strings.ReplaceAll(code, "watchValue()", fmt.Sprintf("%q", match[1]))
      output.Dependencies[key] = []string{dependency}
      counted = true
    }
    output.TypeScript[key] = code
    return nil
  })
  if err == nil && counted {
    directory := filepath.Join(root, ".ttsc")
    err = os.MkdirAll(directory, 0o755)
    if err == nil {
      var log *os.File
      log, err = os.OpenFile(filepath.Join(directory, "contract-runs"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
      if err == nil {
        _, err = log.WriteString("1")
        _ = log.Close()
      }
    }
  }
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if len(output.TypeScript) == 0 {
    fmt.Fprintln(os.Stderr, "no TypeScript sources found")
    return 2
  }
  data, err := json.Marshal(output)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  fmt.Fprintln(os.Stdout, string(data))
  return 0
}
