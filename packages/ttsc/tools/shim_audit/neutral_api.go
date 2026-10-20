package main

import (
  "fmt"
  "go/ast"
  "go/parser"
  "go/token"
  "io/fs"
  "os"
  "path/filepath"
  "sort"
  "strings"
)

// neutralFileName is the file in each shim package that declares the
// version-neutral API: functions that every compiler target declares with
// identical signatures, so one plugin source compiles on all of them.
const neutralFileName = "neutral.go"

// neutralFunction is the shape of one exported neutral function that the
// targets must agree on. Parameter and result types are spelled through each
// target's own aliases, so the type check belongs to compiling plugin code on
// every target; this records what the source alone can compare.
type neutralFunction struct {
  params   int
  results  int
  variadic bool
}

// checkNeutralAPI fails when the shim roots of two compiler targets declare
// different version-neutral APIs: a package with a neutral.go in one root and
// not the other, or a function present in one target only or with a
// different parameter count, result count or variadic final parameter.
func checkNeutralAPI(firstRoot string, secondRoot string) error {
  first, err := readNeutralAPI(firstRoot)
  if err != nil {
    return err
  }
  second, err := readNeutralAPI(secondRoot)
  if err != nil {
    return err
  }
  var problems []string
  packages := map[string]bool{}
  for pkg := range first {
    packages[pkg] = true
  }
  for pkg := range second {
    packages[pkg] = true
  }
  for _, pkg := range sortedKeys(packages) {
    a, inFirst := first[pkg]
    b, inSecond := second[pkg]
    switch {
    case !inFirst:
      problems = append(problems, fmt.Sprintf("%s: neutral API only in %s", pkg, secondRoot))
      continue
    case !inSecond:
      problems = append(problems, fmt.Sprintf("%s: neutral API only in %s", pkg, firstRoot))
      continue
    }
    names := map[string]bool{}
    for name := range a {
      names[name] = true
    }
    for name := range b {
      names[name] = true
    }
    for _, name := range sortedKeys(names) {
      x, inA := a[name]
      y, inB := b[name]
      switch {
      case !inA:
        problems = append(problems, fmt.Sprintf("%s.%s: declared only in %s", pkg, name, secondRoot))
      case !inB:
        problems = append(problems, fmt.Sprintf("%s.%s: declared only in %s", pkg, name, firstRoot))
      case x != y:
        problems = append(problems, fmt.Sprintf("%s.%s: %d parameters and %d results (variadic %t) in %s, %d and %d (variadic %t) in %s", pkg, name, x.params, x.results, x.variadic, firstRoot, y.params, y.results, y.variadic, secondRoot))
      }
    }
  }
  if len(problems) > 0 {
    return fmt.Errorf("version-neutral shim APIs differ between targets:\n  %s", strings.Join(problems, "\n  "))
  }
  return nil
}

// readNeutralAPI maps each package below root that has a neutral.go, by its
// slash-separated directory, to that file's exported functions.
func readNeutralAPI(root string) (map[string]map[string]neutralFunction, error) {
  api := map[string]map[string]neutralFunction{}
  err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
    if err != nil {
      return err
    }
    if entry.IsDir() || entry.Name() != neutralFileName {
      return nil
    }
    rel, err := filepath.Rel(root, filepath.Dir(path))
    if err != nil {
      return err
    }
    source, err := os.ReadFile(path)
    if err != nil {
      return err
    }
    file, err := parser.ParseFile(token.NewFileSet(), path, source, parser.SkipObjectResolution)
    if err != nil {
      return err
    }
    functions := map[string]neutralFunction{}
    for _, decl := range file.Decls {
      fn, ok := decl.(*ast.FuncDecl)
      if !ok || fn.Recv != nil || !fn.Name.IsExported() {
        continue
      }
      functions[fn.Name.Name] = neutralFunction{
        params:   fieldCount(fn.Type.Params),
        results:  fieldCount(fn.Type.Results),
        variadic: isVariadic(fn.Type.Params),
      }
    }
    api[filepath.ToSlash(rel)] = functions
    return nil
  })
  return api, err
}

// fieldCount counts the values a field list declares, so `a, b string` is two.
func fieldCount(list *ast.FieldList) int {
  if list == nil {
    return 0
  }
  count := 0
  for _, field := range list.List {
    if len(field.Names) == 0 {
      count++
    } else {
      count += len(field.Names)
    }
  }
  return count
}

func isVariadic(list *ast.FieldList) bool {
  if list == nil || len(list.List) == 0 {
    return false
  }
  _, ok := list.List[len(list.List)-1].Type.(*ast.Ellipsis)
  return ok
}

func sortedKeys(set map[string]bool) []string {
  keys := make([]string, 0, len(set))
  for key := range set {
    keys = append(keys, key)
  }
  sort.Strings(keys)
  return keys
}
