package driver

import (
  "errors"
  "strings"
  "sync"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtsoptions "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// pluginEmitHost implements printer.EmitHost (and, structurally,
// SourceFileMayBeEmittedHost + OutputPathsHost — their methods are a subset) by
// delegating to the driver Program, exactly like tsgo's internal emitHost. It
// carries the emit resolver from the program's single checker.
type pluginEmitHost struct {
  program      *shimcompiler.Program
  emitResolver shimprinter.EmitResolver
}

func (h *pluginEmitHost) Options() *shimcore.CompilerOptions { return h.program.Options() }
func (h *pluginEmitHost) SourceFiles() []*shimast.SourceFile { return h.program.SourceFiles() }
func (h *pluginEmitHost) UseCaseSensitiveFileNames() bool {
  return h.program.UseCaseSensitiveFileNames()
}
func (h *pluginEmitHost) GetCurrentDirectory() string    { return h.program.GetCurrentDirectory() }
func (h *pluginEmitHost) CommonSourceDirectory() string  { return h.program.CommonSourceDirectory() }
func (h *pluginEmitHost) IsEmitBlocked(file string) bool { return h.program.IsEmitBlocked(file) }
func (h *pluginEmitHost) WriteFile(fileName string, text string) error {
  return h.program.Host().FS().WriteFile(fileName, text)
}
func (h *pluginEmitHost) GetEmitModuleFormatOfFile(file shimast.HasFileName) shimcore.ModuleKind {
  return h.program.GetEmitModuleFormatOfFile(file)
}
func (h *pluginEmitHost) GetEmitResolver() shimprinter.EmitResolver {
  return guardedEmitResolver{h.emitResolver}
}

// guardedEmitResolver makes tsgo's const-enum inliner safe against plugin-built
// nodes. The inliner calls GetConstantValue on every property/element access it
// visits — including synthetic ones a plugin injects — and tsgo's checker can
// nil-panic while computing a contextual type for such a node. A failure there
// only means "not a const enum", so recover to nil and leave the node as-is.
type guardedEmitResolver struct {
  shimprinter.EmitResolver
}

func (g guardedEmitResolver) GetConstantValue(node *shimast.Node) (result any) {
  defer func() {
    if recover() != nil {
      result = nil
    }
  }()
  return g.EmitResolver.GetConstantValue(node)
}
func (h *pluginEmitHost) GetProjectReferenceFromSource(path shimtspath.Path) *shimtsoptions.SourceOutputAndProjectReference {
  return h.program.GetProjectReferenceFromSource(path)
}
func (h *pluginEmitHost) IsSourceFileFromExternalLibrary(file *shimast.SourceFile) bool {
  return h.program.IsSourceFileFromExternalLibrary(file)
}

// PluginTransform transforms one source file in the emit phase, bound to the
// emit EmitContext: nodes it builds with ec.Factory (and links with
// ec.SetOriginal) are recognized and aliased by tsgo's builtin module-transform.
// Returning nil leaves the file unchanged. This is the AST-integration contract
// that replaces text-splice: a plugin returns AST, not text. The shape mirrors a
// classic ts.TransformerFactory (SourceFile -> SourceFile) so an existing
// node-based transformer plugs in by just accepting the EmitContext.
type PluginTransform func(ec *shimprinter.EmitContext, sourceFile *shimast.SourceFile) *shimast.SourceFile

// EmitWithPluginTransformer emits with a single plugin transformer. It is a thin
// wrapper over EmitWithPluginTransformers.
func (p *Program) EmitWithPluginTransformer(transform PluginTransform, writeFile shimcompiler.WriteFile) ([]Diagnostic, error) {
  return p.EmitWithPluginTransformers([]PluginTransform{transform}, writeFile)
}

// EmitLinkedTransforms emits using only the linked plugins' hooks, with no
// host-owned transformer. It is the no-transform convenience form of
// EmitWithPluginTransformers, which honors linked plugins on every emit it
// runs.
func (p *Program) EmitLinkedTransforms(writeFile shimcompiler.WriteFile) ([]Diagnostic, error) {
  return p.EmitWithPluginTransformers(nil, writeFile)
}

// restoreOriginalDeclarationSymbols copies the binder symbol from each original
// parse-tree node onto the synthetic node a plugin transform recreated in its
// place. A plugin that rewrites a node nested inside a class/interface/enum (for
// example a decorator call on a controller method) forces the visitor to rebuild
// every ancestor container to hold the changed child; those rebuilt containers
// carry an `original` link (set by the emit context) but NOT the binder symbol,
// because the emit context's update hook only records the original, it does not
// copy `DeclarationBase.Symbol`.
//
// #201 added this against a real panic in the walk that
// MarkLinkedReferencesRecursively used to run over the transformed tree. That
// walk no longer happens here — the builtin chain is built from the parse tree
// below — so the original trigger is gone, and no probe reproduces a panic with
// this call stubbed out.
//
// Keep it anyway, because the remaining exposure is real and unproven rather
// than absent. tsgo's own defense against a plugin-built node is
// ast.IsParseTreeNode, and a REBUILT container defeats it: the emit context
// stamps NodeFlagsSynthesized when its factory creates a node, but
// ast.updateNode then ASSIGNS `updated.Flags = original.Flags` and clears the
// marker again, so a container carrying no symbol still reports as a parse-tree
// node. Most EmitResolver reference methods bail on that predicate and would
// therefore let such a container through to checker name resolution, where
// resolveName reaches getSymbolOfDeclaration(container) — an unguarded
// dereference for a class, class expression, or interface (enum and module are
// nil-checked upstream). Whether the builtin transformers actually route a
// rebuilt container there is what the probes could not settle.
//
// Restoring the symbol from the original (the symbol object is shared and
// node-independent for lookup) makes that path resolve the way it would on the
// parse tree, at the cost of one walk per file. EmitContext.ParseNode is
// unaffected either way: it walks MostOriginal before testing the predicate, so
// it always lands on the genuine parse node.
func restoreOriginalDeclarationSymbols(ec *shimprinter.EmitContext, node *shimast.Node) {
  if node == nil {
    return
  }
  if data := node.DeclarationData(); data != nil && data.Symbol == nil {
    if original := ec.MostOriginal(node); original != nil {
      if originalData := original.DeclarationData(); originalData != nil {
        data.Symbol = originalData.Symbol
      }
    }
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    restoreOriginalDeclarationSymbols(ec, child)
    return false
  })
}

// EmitWithPluginTransformers emits every source file by assembling tsgo's
// JavaScript emit pipeline from shim parts and running the plugin transformers
// FIRST (in order) in the same EmitContext as the builtin chain (type-erase,
// import-elision, module-transform, ...). No text-splice and no hand-rolled
// import aliasing: tsgo's module-transform aliases the plugins' injected
// imports itself.
//
// Linked plugins are honored on every call: registered ProgramPlugins apply
// to the program before emit (once per Program), and registered
// EmitTransformPlugins are chained after the caller's transforms in
// registration order.
//
// Because the JavaScript side bypasses tsgo's own emitter, it reproduces that
// emitter's whole printSourceFile step via PrintFileWithSourceMap: a
// `sourceMap` / `inlineSourceMap` build emits a `.js.map` (and
// `//# sourceMappingURL=` trailer) just like a plain build, even when a
// transform expanded one source line into many; an `emitBOM` build still starts
// with the byte order mark; and the caller's WriteFile still receives the
// WriteFileData the emitter would hand it. All non-JavaScript outputs stay
// delegated to tsgo's normal dts-only emitter so declaration files, declaration
// maps, and any future declaration-lane outputs are not silently lost by the
// hand-assembled JS path.
func (p *Program) EmitWithPluginTransformers(transforms []PluginTransform, writeFile shimcompiler.WriteFile) ([]Diagnostic, error) {
  if p == nil || p.TSProgram == nil {
    return nil, errors.New("driver: nil program")
  }
  // Linked plugins ride inside whichever host binary owns the emit pass, and
  // the host does not know which linked packages ttsc compiled into it. Honor
  // them at the funnel every host emits through: linked ProgramPlugins mutate
  // the program before the per-file loop below, and linked EmitTransformPlugins
  // join the per-file chain after the host's own transforms. A host that only
  // passes its own transform would otherwise link, register, and silently never
  // run the linked hooks.
  if err := p.ApplyLinkedPlugins(); err != nil {
    return nil, err
  }
  linked, err := p.plugins.emitTransforms()
  if err != nil {
    return nil, err
  }
  if len(linked) != 0 {
    transforms = append(append([]PluginTransform{}, transforms...), linked...)
  }
  host := &pluginEmitHost{program: p.TSProgram, emitResolver: p.Checker.GetEmitResolver()}
  options := p.TSProgram.Options()
  for _, sf := range shimcompiler.GetSourceFilesToEmit(host, nil, false) {
    paths := shimcompiler.GetOutputPathsFor(sf, options, host, false)
    if paths.JsFilePath() != "" && !p.outputEscapesOutDir(paths.JsFilePath()) {
      ec := shimprinter.NewEmitContext()
      out := sf
      for _, transform := range transforms {
        if transform == nil {
          continue
        }
        if next := transform(ec, out); next != nil {
          out = next
        }
      }
      shimast.SetParentInChildrenUnset(out.AsNode())
      restoreOriginalDeclarationSymbols(ec, out.AsNode())
      // Build the chain from the PARSE tree and transform the plugin's tree.
      // The two roles are one argument in tsgo's own emitter only because it
      // has no plugin pass between them: emitJSFile hands getScriptTransformers
      // the file it parsed, then reassigns it to the transform result. Here
      // they are genuinely different files, and only the parse tree belongs on
      // the left.
      //
      // getScriptTransformers reads its file for three things: whether it is a
      // JS file, whether its language variant is JSX, and
      // emitResolver.MarkLinkedReferencesRecursively. The first two are fixed
      // per file and survive UpdateSourceFile, so marking is the whole
      // difference — and marking is a per-node checker resolution walk under
      // the single checker mutex, which on a plugin-expanded tree runs over
      // nodes the binder never saw.
      //
      // Marking the plugin's tree instead does not merely cost time, it emits
      // broken JavaScript. Import elision reads those marks back for the file's
      // parse-tree imports, so a reference the plugin REBUILT — a fresh
      // identifier linked with SetOriginal, which is what any partial rewrite
      // produces — leaves its import unmarked. The module transform still
      // aliases the reference, and elision still drops the binding it names, so
      // the file ends up with `dep_1.foo` and no `const dep_1 = require(...)`:
      // ReferenceError at load. Walking the parse tree marks the reference the
      // checker actually analyzed and keeps the binding.
      //
      // The same reasoning covers a transform that removes an import's last
      // value use: the marks describe the checked file, so the import survives,
      // which is what ts-patch and TypeScript 5-6 did by marking at check time.
      //
      // Nothing is lost by not walking the plugin's nodes. A synthetic node has
      // no NodeLinks of its own, and the marks it could contribute either
      // duplicate one the parse tree already carries or belong to an import the
      // plugin synthesized, which elision preserves unconditionally because it
      // has no parse original. Marking the parse tree is also idempotent across
      // repeated emits on one Program: marks are monotonic and never cleared,
      // so a watch rebuild no longer inherits whatever the previous pass's
      // plugin tree happened to mark.
      for _, tr := range shimcompiler.GetScriptTransformers(ec, host, sf) {
        out = tr.TransformSourceFile(out)
      }
      // Print through the source-map-aware helper so a `sourceMap` /
      // `inlineSourceMap` build still gets its `.js.map` and sourceMappingURL
      // trailer, and an `emitBOM` build its leading mark: the hand-assembled
      // emit pipeline does not run tsgo's emitter, so everything printSourceFile
      // would otherwise do around the printer has to happen here. With maps and
      // emitBOM off this is the same bare-printer output as before.
      printed := shimcompiler.PrintFileWithSourceMap(ec, out.AsNode(), out, options, host, paths.JsFilePath(), paths.SourceMapFilePath())
      // A source-level preamble (e.g. @ttsc/banner linked into a typia host)
      // shifts the map's source coordinates; correct them here too, so the
      // preamble-plus-transform combination is not left uncorrected the way it
      // would be if only the utility host's WriteFile patched maps. Covers both
      // the external `.js.map` and an inline base64 map embedded in the JS.
      if p.SourcePreamble != "" {
        dropLines := strings.Count(p.SourcePreamble, "\n")
        if adjusted, ok := AdjustEmittedSourceMap(paths.JsFilePath(), printed.JS, dropLines); ok {
          printed.JS = adjusted
        }
        if printed.MapPath != "" {
          if adjusted, ok := AdjustEmittedSourceMap(printed.MapPath, printed.MapText, dropLines); ok {
            printed.MapText = adjusted
          }
        }
      }
      // The emitter hands its writeFile callback a WriteFileData for the
      // JavaScript and a nil one for the map (printSourceFile:
      // `writeText(sourceMapFilePath, sourceMap, nil)`), so this lane does the
      // same. See writePluginEmitOutput for what the struct carries here and
      // why the remaining fields stay zero.
      if err := p.writePluginEmitOutput(paths.JsFilePath(), printed.JS, &shimcompiler.WriteFileData{
        SourceMapUrlPos: printed.SourceMapUrlPos,
      }, writeFile); err != nil {
        return nil, err
      }
      if err := p.writePluginEmitOutput(printed.MapPath, printed.MapText, nil, writeFile); err != nil {
        return nil, err
      }
    }
  }
  // The declaration pass below doubles as this lane's build-information pass,
  // so it also runs for a JavaScript-only `incremental` / `composite` project
  // that has no declarations to write at all.
  if !options.GetEmitDeclarations() && !p.emitsBuildInfo() {
    return nil, nil
  }

  // What the build information this pass writes does and does not claim.
  //
  // The JavaScript above was hand-assembled and written outside tsgo's
  // emitter, so tsgo's snapshot never saw it happen and records the JS emit of
  // every file as still pending. That error is one-directional and safe: a
  // consumer reading it can only decide to emit again, never to skip a file
  // ttsc actually transformed. Making the record exact would mean running
  // tsgo's own JavaScript emit a second time and discarding its output, paying
  // a full emit to describe work already done. Everything else in the file —
  // the compiler version, the resolved options, per-file versions and
  // signatures, and the declaration state this pass does produce — is accurate.
  //
  // ttsc itself never reads build information back (see
  // `shimcompiler.EmitFreshWithBuildInfo`), so this asymmetry costs a ttsc
  // rebuild nothing.
  var wfMu sync.Mutex
  result := p.emitProgram(shimcompiler.EmitOptions{
    EmitOnly: shimcompiler.EmitOnlyDts,
    WriteFile: func(fileName string, text string, data *shimcompiler.WriteFileData) error {
      wfMu.Lock()
      defer wfMu.Unlock()
      if p.outputEscapesOutDir(fileName) {
        if data != nil {
          data.SkippedDtsWrite = true
        }
        return nil
      }
      if writeFile != nil {
        return writeFile(fileName, text, data)
      }
      return DefaultWriteFile(fileName, text)
    },
  })
  if result != nil && len(result.Diagnostics) != 0 {
    return p.convertProgramDiagnostics(result.Diagnostics), nil
  }
  return nil, nil
}

// writePluginEmitOutput writes one artifact of the hand-assembled emit, passing
// the caller's WriteFile the same WriteFileData tsgo's emitter would.
//
// What this lane can populate, and what it deliberately cannot:
//
//   - SourceMapUrlPos: the offset of the `//# sourceMappingURL=` trailer, or -1
//     when none was written. PrintFileWithSourceMap records it exactly where
//     printSourceFile does, so a consumer that relocates or rewrites the trailer
//     works the same on both lanes. This is why a nil data was a real loss and
//     not merely a cosmetic one.
//   - Diagnostics: always empty. The emitter's field carries its accumulated
//     emitterDiagnostics, which on the JavaScript lane are its own write
//     failures; here a write failure is returned as an `error` from
//     EmitWithPluginTransformers instead, and the declaration lane's diagnostics
//     reach the caller through tsgo's own EmitOnlyDts pass and its own
//     WriteFileData. Empty therefore means "nothing to report", not "never
//     populated".
//   - BuildInfo: always nil. It is the `.tsbuildinfo` payload, and this lane
//     emits only JavaScript and its map.
//   - SkippedDtsWrite: an out-parameter for the callee, left zero. Each write
//     gets its own struct so one file's callback cannot observe another's.
//
// Nothing on this lane reads the struct back afterwards: unlike tsgo's emitter,
// EmitWithPluginTransformers builds no EmitResult, so there is no EmittedFiles
// list for a callee-set SkippedDtsWrite to keep a file out of.
func (p *Program) writePluginEmitOutput(fileName, text string, data *shimcompiler.WriteFileData, writeFile shimcompiler.WriteFile) error {
  if fileName == "" || p.outputEscapesOutDir(fileName) {
    return nil
  }
  if writeFile != nil {
    return writeFile(fileName, text, data)
  }
  return DefaultWriteFile(fileName, text)
}
