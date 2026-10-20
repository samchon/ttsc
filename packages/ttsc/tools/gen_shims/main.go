// Package main generates go:linkname-based shim.go files for every
// typescript-go internal package listed below.
//
// Adapted from tsgolint's tools/gen_shims/main.go
// (https://github.com/oxc-project/tsgolint, MIT License).
// Copyright (c) 2025 VoidZero Inc. & Contributors.
// Copyright (c) 2025 typescript-eslint and other contributors.
// Copyright (c) 2026 Jeongho Nam (ttsc adaptation — host-specific packages
// list, extra_shim lookup path and selected private field support).
//
// Usage:
//
//  cd packages/ttsc
//  go run -modfile=tools/gen_shims/go.mod ./tools/gen_shims/main.go
//  go run -modfile=tools/gen_shims/go.mod ./tools/gen_shims/main.go -check
//
// -shim and -internal select a compiler target: the shim root and the
// compiler's internal import prefix. The defaults are the TypeScript 7.0 target.
// -check writes nothing and fails when a committed file differs from the output.
//
// Each shim directory (`<shim root>/<name>`) may contain an
// `extra-shim.json` file (an absent file means no extras); the generator writes its output to
// `<shim root>/<name>/shim.go` or a configured private support file, formatted
// as gofmt with two-space indentation like the repository's Go sources.
package main

import (
  "bytes"
  "flag"
  "fmt"
  "go/format"
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

// defaultInternalPrefix is the TypeScript 7.0 compiler's internal tree.
const defaultInternalPrefix = "github.com/microsoft/typescript-go/internal/"

// tsgoInternalPrefix is the internal tree of the target being generated.
var tsgoInternalPrefix = defaultInternalPrefix

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
  "stringutil",
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
  // ExtraFieldFiles routes selected field accessors to private generated
  // support beside a hand-maintained shim. Other fields remain in shim.go.
  ExtraFieldFiles map[string]string
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

// generatedFile is one generator output and its destination.
type generatedFile struct {
  path   string
  source []byte
}

func main() {
  shimRoot := flag.String("shim", "./shim", "shim root of the compiler target")
  internal := flag.String("internal", defaultInternalPrefix, "internal import prefix of the compiler target")
  check := flag.Bool("check", false, "report stale generated files without writing them")
  flag.Parse()
  tsgoInternalPrefix = *internal

  var stale []string
  for _, output := range generate(*shimRoot) {
    if *check {
      if current, err := os.ReadFile(output.path); err != nil || !bytes.Equal(current, output.source) {
        stale = append(stale, output.path)
      }
      continue
    }
    if err := os.WriteFile(output.path, output.source, 0o644); err != nil {
      log.Fatalf("gen_shims: writing %v: %v", output.path, err)
    }
    fmt.Fprintf(os.Stdout, "gen_shims: wrote %s (%d bytes)\n", output.path, len(output.source))
  }
  if len(stale) > 0 {
    log.Fatalf("gen_shims: stale generated files (run without -check):\n  %s", strings.Join(stale, "\n  "))
  }
}

// generate renders every shim of the target rooted at shimRoot without writing
// it, so -check and a regeneration share one output.
func generate(shimRoot string) []generatedFile {
  fullNames := make([]string, len(packagesToShim))
  for i, pkg := range packagesToShim {
    fullNames[i] = tsgoInternalPrefix + pkg
  }

  loaded, err := packages.Load(&packages.Config{
    Dir:  path.Join(shimRoot, "ast"), // any shim module works as anchor; they all require the compiler
    Mode: packages.LoadSyntax,
  }, fullNames...)
  if err != nil {
    log.Fatalf("gen_shims: packages.Load: %v", err)
  }
  if err := validateShimPackages(loaded, fullNames); err != nil {
    log.Fatalf("gen_shims: packages.Load: %v", err)
  }

  var outputs []generatedFile
  var shimHeaderBuilder strings.Builder
  var shimBuilder strings.Builder
  var tempBuffer bytes.Buffer

  for _, pkg := range loaded {
    shimDirPath := path.Join(shimRoot, strings.TrimPrefix(pkg.PkgPath, tsgoInternalPrefix))

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
    // mirrored records the extra_ mirror structs this file already declares.
    mirrored := map[string]bool{}
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
          if filename, separate := extraShim.ExtraFieldFiles[name]; separate {
            output, err := generatePrivateFieldSupport(named, extraShim.ExtraFields[name], pkg.Name)
            if err != nil {
              log.Fatalf("gen_shims: field support %s: %v", name, err)
            }
            if path.Base(filename) != filename || !strings.HasSuffix(filename, "_gen.go") {
              log.Fatalf("gen_shims: invalid generated field support filename %q", filename)
            }
            formatted, err := formatShim(output)
            if err != nil {
              log.Fatalf("gen_shims: field support %s: %v", name, err)
            }
            outputs = append(outputs, generatedFile{path: path.Join(shimDirPath, filename), source: formatted})
            matchedExtraFields[name] = true
            continue
          }
          importPackage("unsafe", true)
          matchedExtraFields[name] = true
          mirrorStructName := "extra_" + name

          strct, ok := named.Underlying().(*types.Struct)
          if !ok {
            log.Fatalf("gen_shims: expected %v to be struct", name)
          }
          writeMirrorStructs(&shimBuilder, name, strct, mirrored, func(t types.Type) string {
            return strings.ReplaceAll(types.TypeString(t, qualifierOnlyPackageName), "checker.thisAssignmentDeclarationKind", "int32")
          })

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
      formatted, err := formatShim([]byte(shimHeaderBuilder.String() + shimBuilder.String()))
      if err != nil {
        log.Fatalf("gen_shims: %v: %v", shimGoPath, err)
      }
      outputs = append(outputs, generatedFile{path: shimGoPath, source: formatted})
    }

    shimHeaderBuilder.Reset()
    shimBuilder.Reset()
  }
  return outputs
}

// writeMirrorStructs writes a mirror struct `extra_<name>` whose field layout
// matches the unexported original, so the generated accessors' unsafe.Pointer
// casts read the right offsets. An unexported pointer-to-struct field is
// mirrored in turn. seen holds the mirrors the file already declares: a cycle
// of unexported pointers then terminates, and a struct reached through two
// fields is declared once. typeString spells every other field type.
func writeMirrorStructs(out *strings.Builder, name string, s *types.Struct, seen map[string]bool, typeString func(types.Type) string) {
  if seen[name] {
    return
  }
  seen[name] = true
  out.WriteString("type extra_")
  out.WriteString(name)
  out.WriteString(" struct {")

  type dependency struct {
    name   string
    layout *types.Struct
  }
  var dependencies []dependency
  for field := range s.Fields() {
    out.WriteString("\n  ")
    if !field.Embedded() {
      out.WriteString(field.Name())
      out.WriteByte(' ')
    }
    if pointer, ok := field.Type().(*types.Pointer); ok {
      if named, ok := pointer.Elem().(*types.Named); ok && !named.Obj().Exported() {
        if structure, ok := named.Underlying().(*types.Struct); ok {
          dependencies = append(dependencies, dependency{named.Obj().Name(), structure})
          out.WriteString("*extra_")
          out.WriteString(named.Obj().Name())
          continue
        }
      }
    }
    out.WriteString(typeString(field.Type()))
  }
  out.WriteString("\n}\n")
  for _, dep := range dependencies {
    writeMirrorStructs(out, dep.name, dep.layout, seen, typeString)
  }
}

// formatShim applies the repository's Go layout to generated source: gofmt,
// then two spaces for each leading tab. gofmt indents with tabs and aligns with
// spaces, so leading tabs are exactly the indentation.
func formatShim(source []byte) ([]byte, error) {
  formatted, err := format.Source(source)
  if err != nil {
    return nil, err
  }
  lines := bytes.Split(formatted, []byte("\n"))
  for i, line := range lines {
    trimmed := bytes.TrimLeft(line, "\t")
    lines[i] = append(bytes.Repeat([]byte("  "), len(line)-len(trimmed)), trimmed...)
  }
  return bytes.Join(lines, []byte("\n")), nil
}

// validateShimPackages admits a complete, error-free package population before
// generation opens any output file. packages.Load can report module-resolution
// failures through an empty result with no top-level error.
//
// @evidence contracts/common.md#principled-implementation Every requested identity must occur exactly once and every returned package must be requested and error-free, preventing incomplete upstream observations from authorizing generated writes.
// @evidence contracts/common.md#clear-and-simple-design One admission pass precedes all per-package writes and reports the complete returned population's problems together.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The boundary validates loader observations without suppressing Go module failures or inventing package contents.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the empty-success loader behavior and the before-write admission guarantee.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Package import identities are Go identifiers; this validator performs no native filesystem or process operation.
// @evidence contracts/performance.md#efficient-algorithms Requested and returned identities are counted with maps; work follows their population and diagnostic text, with no package reload.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This validates one actual load result and caches no mutable compiler-source observation.
// @evidence contracts/performance.md#bound-retention-and-release-resources Count maps and diagnostics are call-local; the caller retains loaded package ownership and receives only an error.
func validateShimPackages(loaded []*packages.Package, requested []string) error {
  if len(requested) == 0 {
    return fmt.Errorf("no shim packages requested")
  }
  counts := make(map[string]int, len(requested))
  for _, name := range requested {
    counts[name] = 0
  }
  var problems []string
  for _, pkg := range loaded {
    if pkg == nil {
      problems = append(problems, "nil package result")
      continue
    }
    count, expected := counts[pkg.PkgPath]
    if !expected {
      problems = append(problems, "unexpected package "+pkg.PkgPath)
    } else {
      counts[pkg.PkgPath] = count + 1
    }
    for _, failure := range pkg.Errors {
      problems = append(problems, failure.Error())
    }
  }
  for _, name := range requested {
    switch count := counts[name]; {
    case count == 0:
      problems = append(problems, "missing package "+name)
    case count != 1:
      problems = append(problems, fmt.Sprintf("package %s loaded %d times", name, count))
    }
  }
  if len(problems) != 0 {
    return fmt.Errorf("incomplete shim package load:\n%s", strings.Join(problems, "\n"))
  }
  return nil
}

// generatePrivateFieldSupport derives a private accessor and its complete
// struct layout from the loaded upstream type. It does not expose raw state as
// a public producer; the hand-maintained operation owns its usable lifetime.
func generatePrivateFieldSupport(named *types.Named, fields []string, packageName string) ([]byte, error) {
  structure, ok := named.Underlying().(*types.Struct)
  if !ok {
    return nil, fmt.Errorf("%s is not a struct", named.Obj().Name())
  }
  imports := map[string]string{"unsafe": "unsafe"}
  qualifier := func(pkg *types.Package) string {
    imports[pkg.Path()] = pkg.Name()
    return pkg.Name()
  }
  var body strings.Builder
  mirror := "extra_" + named.Obj().Name()
  fmt.Fprintf(&body, "type %s struct {\n", mirror)
  available := map[string]*types.Var{}
  for field := range structure.Fields() {
    available[field.Name()] = field
    // Every field participates in layout, including fields not being read.
    if !field.Embedded() {
      fmt.Fprintf(&body, "  %s ", field.Name())
    }
    body.WriteString(types.TypeString(field.Type(), qualifier))
    body.WriteByte('\n')
  }
  body.WriteString("}\n\n")
  for _, name := range fields {
    field, exists := available[name]
    if !exists {
      return nil, fmt.Errorf("%s has no field %s", named.Obj().Name(), name)
    }
    getter := strings.ToLower(named.Obj().Name()[:1]) + named.Obj().Name()[1:] + "_" + name
    fmt.Fprintf(&body, "func %s(value *%s) %s {\n  return ((*%s)(unsafe.Pointer(value))).%s\n}\n", getter,
      types.TypeString(named, qualifier), types.TypeString(field.Type(), qualifier), mirror, name)
  }
  var output strings.Builder
  output.WriteString("// Code generated by packages/ttsc/tools/gen_shims. DO NOT EDIT.\n\n")
  fmt.Fprintf(&output, "package %s\n\nimport (\n", packageName)
  for _, location := range slices.Sorted(maps.Keys(imports)) {
    fmt.Fprintf(&output, "  %s %q\n", imports[location], location)
  }
  output.WriteString(")\n\n")
  output.WriteString(body.String())
  return []byte(output.String()), nil
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
