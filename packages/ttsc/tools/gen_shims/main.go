// Package main generates go:linkname-based shim.go files for every
// typescript-go internal package listed below.
//
// Adapted from tsgolint's tools/gen_shims/main.go
// (https://github.com/oxc-project/tsgolint, MIT License).
// Copyright (c) 2025 VoidZero Inc. & Contributors.
// Copyright (c) 2025 typescript-eslint and other contributors.
// Copyright (c) 2026 Jeongho Nam (ttsc adaptation — host-specific packages
// list and extra_shim lookup path; generator algorithm unchanged).
//
// Usage:
//
//  cd packages/ttsc
//  go run ./tools/gen_shims
//
// Each shim directory (`packages/ttsc/shim/<name>`) must contain an
// `extra-shim.json` file; the generator writes its output to
// `packages/ttsc/shim/<name>/shim.go`.
package main

import (
  "bytes"
  "fmt"
  "go/types"
  "log"
  "maps"
  "os"
  "path"
  "slices"
  "strings"

  "github.com/go-json-experiment/json"

  "golang.org/x/text/cases"
  "golang.org/x/text/language"
  "golang.org/x/tools/go/packages"
)

const tsgoInternalPrefix = "github.com/microsoft/typescript-go/internal/"

// Packages for which we generate a shim. Mirrors tsgolint's list with
// project/lsp/lsproto removed for the current host boundary and the rest kept
// verbatim so gen_shims output stays comparable across projects.
var packagesToShim = []string{
  "ast",
  "bundled",
  "checker",
  "compiler",
  "core",
  "parser",
  "scanner",
  "tsoptions",
  "tspath",
  "vfs",
  "vfs/cachedvfs",
  "vfs/osvfs",
}

// ExtraShim is the schema for the per-shim-directory `extra-shim.json` file.
// It lets maintainers extend the generated output beyond what gen_shims can
// derive automatically from the public API surface.
type ExtraShim struct {
  // ExtraFunctions lists unexported function names that should be shimmed via
  // go:linkname in addition to the exported ones gen_shims discovers itself.
  ExtraFunctions []string
  // ExtraMethods maps type name → method names for unexported or
  // otherwise-unlinkable methods that should be forwarded.
  ExtraMethods map[string][]string
  // ExtraFields maps type name → field names whose values should be exposed
  // through unsafe pointer casts (used when go:linkname cannot reach them).
  ExtraFields map[string][]string
  // IgnoreFunctions lists exported function names that gen_shims should skip
  // entirely, typically because the caller supplies a hand-written alternative.
  IgnoreFunctions []string
}

// signatureHasUnexportedType reports whether any parameter of the function
// signature refers to an unexported named type (optionally through a pointer).
// Such functions cannot be linked safely because the shim package cannot
// reference the unexported type by name.
func signatureHasUnexportedType(t types.Signature) bool {
  if params := t.Params(); params != nil {
    for v := range params.Variables() {
      ty := v.Type()
      if ptrType, ok := ty.(*types.Pointer); ok {
        ty = ptrType.Elem()
      }
      if named, ok := ty.(*types.Named); ok {
        if !named.Obj().Exported() {
          return true
        }
      }
    }
  }
  return false
}

func main() {
  fullNames := make([]string, len(packagesToShim))
  for i, pkg := range packagesToShim {
    fullNames[i] = tsgoInternalPrefix + pkg
  }

  loaded, err := packages.Load(&packages.Config{
    Dir:  "./shim/ast", // any shim module works as anchor; they all require typescript-go
    Mode: packages.LoadSyntax,
  }, fullNames...)
  if err != nil {
    log.Fatalf("gen_shims: packages.Load: %v", err)
  }

  var shimHeaderBuilder strings.Builder
  var shimBuilder strings.Builder
  var tempBuffer bytes.Buffer

  for _, pkg := range loaded {
    if len(pkg.Errors) != 0 {
      for _, e := range pkg.Errors {
        fmt.Fprintln(os.Stderr, "gen_shims:", e)
      }
      log.Fatalf("gen_shims: package %s failed to load (see errors above)", pkg.PkgPath)
    }
    shimDirPath := path.Join("./shim/", strings.TrimPrefix(pkg.PkgPath, tsgoInternalPrefix))

    var extraShim ExtraShim
    extraShimFilePath := path.Join(shimDirPath, "extra-shim.json")
    if data, err := os.ReadFile(extraShimFilePath); err == nil {
      if err := json.Unmarshal(data, &extraShim); err != nil {
        fmt.Fprintf(os.Stderr, "gen_shims: error parsing %v: %v\n", extraShimFilePath, err)
        os.Exit(1)
      }
    }
    if extraShim.ExtraMethods == nil {
      extraShim.ExtraMethods = map[string][]string{}
    }
    if extraShim.ExtraFunctions == nil {
      extraShim.ExtraFunctions = []string{}
    }
    if extraShim.ExtraFields == nil {
      extraShim.ExtraFields = map[string][]string{}
    }
    if extraShim.IgnoreFunctions == nil {
      extraShim.IgnoreFunctions = []string{}
    }

    // importedPackages tracks every package import the generated file needs.
    // true  = referenced by name (needs a named import).
    // false = only needed for its side-effects (blank import "_").
    importedPackages := map[string]bool{}
    importPackage := func(path string, directly bool) {
      if directly {
        importedPackages[path] = true
      } else if _, ok := importedPackages[path]; !ok {
        importedPackages[path] = false
      }
    }

    // qualifierOnlyPackageName records a direct import for every package the
    // type-string references and returns just the package short name, producing
    // output like `ast.Node` instead of a full path.
    var qualifierOnlyPackageName types.Qualifier = func(p *types.Package) string {
      importPackage(p.Path(), true)
      return p.Name()
    }
    // qualifierEmptyPackageName omits the package qualifier entirely; used when
    // writing the receiver type inside a go:linkname directive where the package
    // prefix must not appear.
    var qualifierEmptyPackageName types.Qualifier = func(p *types.Package) string { return "" }

    // emitGoLinknameDirective appends a `//go:linkname localName pkg.Func`
    // pragma line to shimBuilder, registering unsafe and the source package as
    // blank imports so the linker can resolve the symbol.
    emitGoLinknameDirective := func(localName string, fn *types.Func) {
      importPackage("unsafe", false)
      importPackage(pkg.Types.Path(), false)
      shimBuilder.WriteString("//go:linkname ")
      shimBuilder.WriteString(localName)
      shimBuilder.WriteByte(' ')
      shimBuilder.WriteString(fn.Pkg().Path())
      shimBuilder.WriteByte('.')
      if recv := fn.Signature().Recv(); recv != nil {
        shimBuilder.WriteByte('(')
        shimBuilder.WriteString(types.TypeString(recv.Type(), qualifierEmptyPackageName))
        shimBuilder.WriteByte(')')
        shimBuilder.WriteByte('.')
      }
      shimBuilder.WriteString(fn.Name())
      shimBuilder.WriteByte('\n')
    }

    // emitLinkedFunction emits a go:linkname directive and a matching func
    // declaration for fn. Generic functions (TypeParams != nil) and functions
    // with unexported parameter types are skipped (returns false).
    emitLinkedFunction := func(fn *types.Func) bool {
      if fn.Signature().TypeParams() != nil {
        return false
      }
      if signatureHasUnexportedType(*fn.Signature()) {
        fmt.Fprintf(os.Stderr, "gen_shims: skipping %s.%s (unexported types)\n", fn.Pkg().Name(), fn.Name())
        return false
      }
      name := cases.Title(language.English, cases.NoLower).String(fn.Name())
      emitGoLinknameDirective(name, fn)
      shimBuilder.WriteString("func ")
      shimBuilder.WriteString(name)
      types.WriteSignature(&tempBuffer, fn.Signature(), qualifierOnlyPackageName)
      shimBuilder.Write(tempBuffer.Bytes())
      tempBuffer.Reset()
      shimBuilder.WriteString("\n")
      return true
    }

    matchedExtraFunctions := make(map[string]bool, len(extraShim.ExtraFunctions))
    for _, name := range extraShim.ExtraFunctions {
      matchedExtraFunctions[name] = false
    }
    matchedExtraMethods := make(map[string]map[string]bool, len(extraShim.ExtraMethods))
    for name, methods := range extraShim.ExtraMethods {
      matchedExtraMethods[name] = make(map[string]bool, len(methods))
      for _, method := range methods {
        matchedExtraMethods[name][method] = false
      }
    }
    matchedExtraFields := make(map[string]bool, len(extraShim.ExtraFields))
    for name := range extraShim.ExtraFields {
      matchedExtraFields[name] = false
    }

    scope := pkg.Types.Scope()
    for _, name := range scope.Names() {
      object := scope.Lookup(name)
      if !object.Exported() {
        fn, isFunc := object.(*types.Func)
        if _, exists := matchedExtraFunctions[name]; isFunc && exists {
          if emitLinkedFunction(fn) {
            matchedExtraFunctions[name] = true
          }
        }
        continue
      }

      printReexport := func(kind string) {
        importPackage(pkg.Types.Path(), true)
        shimBuilder.WriteString(kind)
        shimBuilder.WriteString(" ")
        shimBuilder.WriteString(name)
        shimBuilder.WriteString(" = ")
        shimBuilder.WriteString(pkg.Name)
        shimBuilder.WriteString(".")
        shimBuilder.WriteString(name)
        shimBuilder.WriteString("\n")
      }

      switch typedObj := object.(type) {
      case *types.TypeName:
        t := typedObj.Type()
        named, isNamed := t.(*types.Named)
        if isNamed {
          _, nameWithTypeParams, _ := strings.Cut(types.TypeString(named, qualifierOnlyPackageName), ".")
          importPackage(pkg.Types.Path(), true)
          shimBuilder.WriteString("type ")
          shimBuilder.WriteString(nameWithTypeParams)
          shimBuilder.WriteString(" = ")
          shimBuilder.WriteString(pkg.Name)
          shimBuilder.WriteString(".")
          shimBuilder.WriteString(name)

          typeParams := slices.Collect(named.TypeParams().TypeParams())
          if len(typeParams) > 0 {
            shimBuilder.WriteByte('[')
            for i, ty := range typeParams {
              if i > 0 {
                shimBuilder.WriteByte(',')
              }
              shimBuilder.WriteString(ty.String())
            }
            shimBuilder.WriteByte(']')
          }
          shimBuilder.WriteString("\n")
        } else {
          printReexport("type")
        }

        if extraMethods, ok := matchedExtraMethods[name]; isNamed && ok {
          for method := range named.Methods() {
            methodName := method.Name()
            if _, exists := extraMethods[methodName]; !exists {
              continue
            }
            extraMethods[methodName] = true
            prefix := name + "_"
            emitGoLinknameDirective(prefix+methodName, method)
            funcDeclStr := types.ObjectString(method, qualifierOnlyPackageName)
            recvStart := 0
            recvEnd := 0
            paramsStart := 0
            for i, s := range funcDeclStr {
              if s == '(' {
                if recvStart == 0 {
                  recvStart = i + 1
                }
                if recvEnd != 0 {
                  paramsStart = i + 1
                  break
                }
              }
              if s == ')' && recvEnd == 0 {
                recvEnd = i
              }
            }
            shimBuilder.WriteString("func ")
            shimBuilder.WriteString(prefix)
            shimBuilder.WriteString(funcDeclStr[recvEnd+2 : paramsStart])
            shimBuilder.WriteString("recv ")
            shimBuilder.WriteString(funcDeclStr[recvStart:recvEnd])
            if method.Signature().Params() != nil {
              shimBuilder.WriteString(", ")
            }
            shimBuilder.WriteString(funcDeclStr[paramsStart:])
            shimBuilder.WriteString("\n")
          }
        }

        if _, ok := matchedExtraFields[name]; isNamed && ok {
          importPackage("unsafe", true)
          matchedExtraFields[name] = true
          mirrorStructName := "extra_" + name

          // emitExtraStruct emits a mirror struct (`extra_<Name>`) whose field
          // layout matches the unexported original so that unsafe.Pointer casts
          // in the generated accessor functions are safe. Unexported pointer
          // fields whose element type is also unexported are recursively mirrored.
          var emitExtraStruct func(name string, s *types.Struct)
          emitExtraStruct = func(name string, s *types.Struct) {
            shimBuilder.WriteString("type extra_")
            shimBuilder.WriteString(name)
            shimBuilder.WriteString(" struct {")

            dependencies := []struct {
              string
              *types.Struct
            }{}
            for field := range s.Fields() {
              shimBuilder.WriteString("\n  ")
              if !field.Embedded() {
                shimBuilder.WriteString(field.Name())
                shimBuilder.WriteByte(' ')
              }

              ptrType, ok := field.Type().(*types.Pointer)
              if ok {
                named, ok := ptrType.Elem().(*types.Named)
                if ok && !named.Obj().Exported() {
                  strct, ok := named.Underlying().(*types.Struct)
                  if ok {
                    n := named.Obj().Name()
                    dependencies = append(dependencies, struct {
                      string
                      *types.Struct
                    }{n, strct})
                    shimBuilder.WriteString("extra_")
                    shimBuilder.WriteString(n)
                    continue
                  }
                }
              }

              shimBuilder.WriteString(
                strings.ReplaceAll(types.TypeString(field.Type(), qualifierOnlyPackageName), "checker.thisAssignmentDeclarationKind", "int32"),
              )
            }
            shimBuilder.WriteString("\n}\n")
            for _, dep := range dependencies {
              emitExtraStruct(dep.string, dep.Struct)
            }
          }

          strct, ok := named.Underlying().(*types.Struct)
          if !ok {
            log.Fatalf("gen_shims: expected %v to be struct", name)
          }
          emitExtraStruct(name, strct)

          mappedFieldTypes := make(map[string]*types.Var, strct.NumFields())
          for field := range strct.Fields() {
            mappedFieldTypes[field.Name()] = field
          }

          for _, field := range extraShim.ExtraFields[name] {
            shimBuilder.WriteString("func ")
            shimBuilder.WriteString(name)
            shimBuilder.WriteByte('_')
            shimBuilder.WriteString(field)
            shimBuilder.WriteString("(v *")
            shimBuilder.WriteString(pkg.Name)
            shimBuilder.WriteByte('.')
            shimBuilder.WriteString(name)
            shimBuilder.WriteString(") ")

            fieldVar, ok := mappedFieldTypes[field]
            if !ok {
              log.Fatalf("gen_shims: expected struct %q to contain field %q", name, field)
            }
            shimBuilder.WriteString(types.TypeString(fieldVar.Type(), qualifierOnlyPackageName))
            shimBuilder.WriteString(" {\n")
            shimBuilder.WriteString("  return ((*")
            shimBuilder.WriteString(mirrorStructName)
            shimBuilder.WriteString(")(unsafe.Pointer(v))).")
            shimBuilder.WriteString(field)
            shimBuilder.WriteString("\n")
            shimBuilder.WriteString("}\n")
          }
        }
      case *types.Const:
        printReexport("const")
      case *types.Var:
        printReexport("var")
      case *types.Func:
        if !slices.Contains(extraShim.IgnoreFunctions, name) {
          emitLinkedFunction(typedObj)
        }
      }
    }

    // Verify that every extra function/method requested in extra-shim.json was
    // actually found in the package. A missing symbol means the json file is
    // stale relative to the upstream typescript-go API.
    exit := false
    for fnName, found := range matchedExtraFunctions {
      if found {
        continue
      }
      fmt.Fprintf(os.Stderr, "gen_shims: ERROR couldn't find %v function\n", fnName)
      exit = true
    }
    for name, methods := range matchedExtraMethods {
      for methodName, found := range methods {
        if found {
          continue
        }
        fmt.Fprintf(os.Stderr, "gen_shims: ERROR couldn't find %v.%v method\n", name, methodName)
        exit = true
      }
    }
    if exit {
      os.Exit(1)
    }

    shimHeaderBuilder.WriteString("\n// Code generated by packages/ttsc/tools/gen_shims. DO NOT EDIT.\n\n")
    shimHeaderBuilder.WriteString("package ")
    shimHeaderBuilder.WriteString(pkg.Name)
    shimHeaderBuilder.WriteString("\n\n")
    importsList := slices.Collect(maps.Keys(importedPackages))
    slices.Sort(importsList)
    for _, imported := range importsList {
      shimHeaderBuilder.WriteString("import ")
      if !importedPackages[imported] {
        shimHeaderBuilder.WriteString("_ ")
      }
      shimHeaderBuilder.WriteString("\"")
      shimHeaderBuilder.WriteString(imported)
      shimHeaderBuilder.WriteString("\"\n")
    }
    shimHeaderBuilder.WriteString("\n")

    shimGoPath := path.Join(shimDirPath, "shim.go")
    if isHandMaintained(shimGoPath) {
      fmt.Fprintf(os.Stderr, "gen_shims: skipping %s (hand-maintained marker present; remove '// gen_shims:hand-maintained' to regenerate)\n", shimGoPath)
    } else {
      file, err := os.Create(shimGoPath)
      if err != nil {
        log.Fatalf("gen_shims: opening %v for write: %v", shimGoPath, err)
      }
      file.WriteString(shimHeaderBuilder.String())
      file.WriteString(shimBuilder.String())
      if err := file.Close(); err != nil {
        log.Fatalf("gen_shims: closing %v: %v", shimGoPath, err)
      }
      fmt.Fprintf(os.Stdout, "gen_shims: wrote %s (%d bytes)\n", shimGoPath, len(shimBuilder.String()))
    }

    shimHeaderBuilder.Reset()
    shimBuilder.Reset()
  }
}

// isHandMaintained reports whether the given shim file opts out of regeneration
// by carrying the magic marker `// gen_shims:hand-maintained` within its first
// 200 bytes. Hand-maintained shim files combine generated re-exports with
// `go:linkname` declarations or other content that gen_shims cannot reproduce;
// silently overwriting them would break consumers (e.g. @ttsc/lint).
func isHandMaintained(shimGoPath string) bool {
  file, err := os.Open(shimGoPath)
  if err != nil {
    return false
  }
  defer file.Close()
  buf := make([]byte, 200)
  n, _ := file.Read(buf)
  return strings.Contains(string(buf[:n]), "gen_shims:hand-maintained")
}
