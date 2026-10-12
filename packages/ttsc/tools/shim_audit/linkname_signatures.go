package main

import (
  "errors"
  "fmt"
  "go/ast"
  "go/types"
  "io/fs"
  "path/filepath"
  "sort"
  "strings"

  "golang.org/x/tools/go/packages"
)

// checkLinknameSignatures fails when a bodyless //go:linkname declaration in a
// bridge disagrees with the signature of the compiler function it names, a
// method's receiver counting as the first parameter. The Go toolchain links
// such a pair without complaint and the mismatch surfaces only as corrupted
// arguments at run time, so a compiler bump that changes a linked signature
// must fail here instead. Every bridge module below shimRoot is loaded with its
// dependencies, so the target is checked against the pinned compiler's types.
func checkLinknameSignatures(shimRoot string) error {
  var dirs []string
  err := filepath.WalkDir(shimRoot, func(path string, entry fs.DirEntry, err error) error {
    if err != nil {
      return err
    }
    if entry.IsDir() && path == filepath.Join(shimRoot, facadeDirName) {
      return filepath.SkipDir
    }
    if !entry.IsDir() && entry.Name() == "go.mod" {
      dirs = append(dirs, filepath.Dir(path))
    }
    return nil
  })
  if err != nil {
    return err
  }
  sort.Strings(dirs)
  var problems []string
  for _, dir := range dirs {
    found, err := linknameSignatureProblems(dir)
    if err != nil {
      return err
    }
    problems = append(problems, found...)
  }
  if len(problems) > 0 {
    return fmt.Errorf("go:linkname declarations disagree with their targets:\n  %s", strings.Join(problems, "\n  "))
  }
  return nil
}

// linknameSignatureProblems reports every mismatched bodyless linkname
// declaration of the package rooted at dir.
func linknameSignatureProblems(dir string) ([]string, error) {
  loaded, err := packages.Load(&packages.Config{
    Dir:  dir,
    Mode: packages.NeedName | packages.NeedSyntax | packages.NeedTypes | packages.NeedTypesInfo | packages.NeedImports | packages.NeedDeps,
  }, ".")
  if err != nil {
    return nil, fmt.Errorf("load %s: %w", dir, err)
  }
  all := map[string]*types.Package{}
  var loadErrors []error
  packages.Visit(loaded, nil, func(pkg *packages.Package) {
    if pkg.Types != nil {
      all[pkg.PkgPath] = pkg.Types
    }
    for _, e := range pkg.Errors {
      loadErrors = append(loadErrors, e)
    }
  })
  if err := errors.Join(loadErrors...); err != nil {
    return nil, fmt.Errorf("load %s: %w", dir, err)
  }
  var problems []string
  for _, pkg := range loaded {
    for _, file := range pkg.Syntax {
      links := map[string]string{}
      for _, group := range file.Comments {
        for _, comment := range group.List {
          if fields := strings.Fields(comment.Text); len(fields) == 3 && fields[0] == "//go:linkname" {
            links[fields[1]] = fields[2]
          }
        }
      }
      for _, decl := range file.Decls {
        fn, ok := decl.(*ast.FuncDecl)
        if !ok || fn.Body != nil || fn.Recv != nil {
          continue
        }
        target, linked := links[fn.Name.Name]
        if !linked {
          continue
        }
        position := pkg.Fset.Position(fn.Pos())
        local := pkg.TypesInfo.Defs[fn.Name].Type().(*types.Signature)
        want, err := linknameTargetSignature(all, target)
        if err != nil {
          problems = append(problems, fmt.Sprintf("%s: %s -> %s: %v", position, fn.Name.Name, target, err))
          continue
        }
        if mismatch := compareLinkedSignatures(local, want); mismatch != "" {
          problems = append(problems, fmt.Sprintf("%s: %s -> %s: %s", position, fn.Name.Name, target, mismatch))
        }
      }
    }
  }
  return problems, nil
}

// linknameTargetSignature resolves "path.name" or "path.(*T).name" against the
// loaded dependency graph. A method's receiver becomes the first parameter.
func linknameTargetSignature(all map[string]*types.Package, target string) (*types.Signature, error) {
  slash := strings.LastIndexByte(target, '/')
  dot := strings.IndexByte(target[slash+1:], '.')
  if dot < 0 {
    return nil, errors.New("malformed target")
  }
  path, rest := target[:slash+1+dot], target[slash+1+dot+1:]
  pkg := all[path]
  if pkg == nil {
    return nil, fmt.Errorf("package %s is not compiled into the bridge", path)
  }
  if !strings.HasPrefix(rest, "(") {
    fn, ok := pkg.Scope().Lookup(rest).(*types.Func)
    if !ok {
      return nil, fmt.Errorf("no function %s", rest)
    }
    return fn.Signature(), nil
  }
  closing := strings.IndexByte(rest, ')')
  if closing < 0 || closing+2 > len(rest) {
    return nil, errors.New("malformed method target")
  }
  receiver, name := strings.TrimPrefix(rest[1:closing], "*"), rest[closing+2:]
  typeName, ok := pkg.Scope().Lookup(receiver).(*types.TypeName)
  if !ok {
    return nil, fmt.Errorf("no type %s", receiver)
  }
  object, _, _ := types.LookupFieldOrMethod(types.NewPointer(typeName.Type()), true, pkg, name)
  method, ok := object.(*types.Func)
  if !ok {
    return nil, fmt.Errorf("no method %s", name)
  }
  signature := method.Signature()
  params := []*types.Var{signature.Recv()}
  for i := range signature.Params().Len() {
    params = append(params, signature.Params().At(i))
  }
  return types.NewSignatureType(nil, nil, nil, types.NewTuple(params...), signature.Results(), signature.Variadic()), nil
}

// compareLinkedSignatures describes the first difference between the local
// declaration and its target, or returns "" when they are identical.
func compareLinkedSignatures(local, want *types.Signature) string {
  if local.Params().Len() != want.Params().Len() {
    return fmt.Sprintf("%d parameters, target has %d (%s)", local.Params().Len(), want.Params().Len(), want)
  }
  if local.Results().Len() != want.Results().Len() {
    return fmt.Sprintf("%d results, target has %d (%s)", local.Results().Len(), want.Results().Len(), want)
  }
  for i := range local.Params().Len() {
    if !types.Identical(local.Params().At(i).Type(), want.Params().At(i).Type()) {
      return fmt.Sprintf("parameter %d is %s, target has %s", i, local.Params().At(i).Type(), want.Params().At(i).Type())
    }
  }
  for i := range local.Results().Len() {
    if !types.Identical(local.Results().At(i).Type(), want.Results().At(i).Type()) {
      return fmt.Sprintf("result %d is %s, target has %s", i, local.Results().At(i).Type(), want.Results().At(i).Type())
    }
  }
  if local.Variadic() != want.Variadic() {
    return "variadic parameter differs from the target"
  }
  return ""
}
