package driver

import (
  "context"
  "errors"
  "fmt"
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
  return h.emitResolver
}

// guardedEmitResolver only resolves member accesses from the program's input
// trees. ParseNode follows original links but trusts the synthesized flag:
// standalone factories leave it clear, even on generated nodes with copied
// source positions. Recovering a checker panic is too late to prevent that
// lookup from recording diagnostics on a parameter the binder never saw.
type guardedEmitResolver struct {
  shimprinter.EmitResolver
  originalMembers map[*shimast.Node]struct{}
}

func (g guardedEmitResolver) GetConstantValue(node *shimast.Node) any {
  if _, original := g.originalMembers[node]; !original {
    return nil
  }
  return g.EmitResolver.GetConstantValue(node)
}

func collectOriginalMembers(node *shimast.Node, members map[*shimast.Node]struct{}) {
  if node.Kind == shimast.KindPropertyAccessExpression || node.Kind == shimast.KindElementAccessExpression {
    members[node] = struct{}{}
  }
  node.ForEachChild(func(child *shimast.Node) bool {
    collectOriginalMembers(child, members)
    return false
  })
}
func (h *pluginEmitHost) GetProjectReferenceFromSource(path shimtspath.Path) *shimtsoptions.SourceOutputAndProjectReference {
  return h.program.GetProjectReferenceFromSource(path)
}
func (h *pluginEmitHost) IsSourceFileFromExternalLibrary(file *shimast.SourceFile) bool {
  return h.program.IsSourceFileFromExternalLibrary(file)
}

// PluginTransform transforms one source file in the emit phase, bound to the
// emit EmitContext. ec.Factory and ec.SetOriginal supply the identity channels
// used by builtin transforms; they do not make every arbitrary constructed tree
// valid. Injected bindings must use the supported generated-name policy and
// preserve the original links needed by the particular transformation.
// Returning nil leaves the file unchanged. This is the AST-integration contract
// that replaces text-splice: a plugin returns AST, not text. The shape mirrors a
// classic source-file transformer, with EmitContext supplied on each call;
// adapting an existing transformer still requires the native AST and context
// APIs rather than only changing its function signature.
//
// @evidence contracts/common.md#principled-implementation Generated AST identity belongs to the shared emit context, allowing builtin import and module transforms to interpret plugin nodes.
// @evidence contracts/common.md#clear-and-simple-design A per-source callback returns an optional replacement; the host owns ordering and printing.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported AST factory and original links replace textual alias guesses or patched compiler methods.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies context identity, nil behavior, and source transformation following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The callback signature defines AST work rather than native path or process operations.
// @evidenceExclude contracts/performance.md#efficient-algorithms Concrete callbacks select their algorithms; the signature performs no traversal.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The signature owns no shared-work coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Resource lifetime belongs to the concrete callback and emit owner, not this function type.
type PluginTransform func(ec *shimprinter.EmitContext, sourceFile *shimast.SourceFile) *shimast.SourceFile

// EmitWithPluginTransformer emits with a single plugin transformer. It is a thin
// wrapper over EmitWithPluginTransformers.
//
// @evidence contracts/common.md#principled-implementation The single-transform entry uses the same linked-plugin and builtin emit pipeline as the multi-transform entry.
// @evidence contracts/common.md#clear-and-simple-design One slice construction delegates all emit policy to EmitWithPluginTransformers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No alternate single-transform path bypasses linked hooks or error handling.
// @evidence contracts/common.md#meaningful-documentation The native comment identifies the single-transform convenience role following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The delegated emitter owns native output paths and filesystem behavior.
// @evidenceExclude contracts/performance.md#efficient-algorithms The delegated emitter owns traversal and printing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The delegated emitter owns generation hook reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The wrapper acquires no separate resource or retained buffer.
func (p *Program) EmitWithPluginTransformer(transform PluginTransform, writeFile shimcompiler.WriteFile) ([]Diagnostic, error) {
  return p.EmitWithPluginTransformers([]PluginTransform{transform}, writeFile)
}

// EmitLinkedTransforms emits using only the linked plugins' hooks, with no
// host-owned transformer. It is the no-transform convenience form of
// EmitWithPluginTransformers, which honors linked plugins on every emit it
// runs.
//
// @evidence contracts/common.md#principled-implementation Omitting host transforms still honors the project's linked transform hooks through the shared pipeline.
// @evidence contracts/common.md#clear-and-simple-design A nil host-transform list delegates all scheduling and output policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Linked-only emit does not silently skip registrations because the caller supplied no transform.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes linked-only and host-owned transforms following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The delegated emitter owns native output operations.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shared emitter owns traversal and printing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The shared emitter owns hook latching.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This wrapper acquires no independent retained resource.
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
// It guards the walk MarkLinkedReferencesRecursively would run over a
// transformed tree. That walk does not happen here, because the builtin chain
// is built from the parse tree below, and no probe reproduces a panic with this
// call stubbed out. The restoration stays because the remaining exposure is
// unproven rather than absent. tsgo's own defense against a plugin-built node is ast.IsParseTreeNode,
// which most EmitResolver reference methods test to bail out early — and a
// REBUILT container does not trip it. The emit context stamps
// NodeFlagsSynthesized when its factory creates a node, but ast.updateNode then
// ASSIGNS `updated.Flags = original.Flags` and clears the marker again, so a
// container carrying no symbol still answers "parse tree node" and is let
// through to checker name resolution. There resolveName reaches
// getSymbolOfDeclaration(container), an unguarded dereference for a class,
// class expression, or interface (enum and module are nil-checked upstream).
// What the probes could not settle is whether the builtin transformers ever
// actually hand a rebuilt container to one of those methods.
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
// With no effective transform, ordinary native emission owns bundled output,
// declarations and build information. This entry still corrects source maps
// for the source preamble before delivering them to its writer.
//
// Because the JavaScript side bypasses tsgo's own emitter, it reproduces that
// emitter's whole printSourceFile step via PrintFileWithSourceMap: a
// `sourceMap` build can emit an external `.js.map` and trailer, while
// `inlineSourceMap` embeds its map in the trailer instead. Map production follows
// the printer's source-kind and destination conditions, even when a transform
// expands source lines; `emitBOM` adds its leading mark. JavaScript WriteFileData
// carries the fields documented by writePluginEmitOutput, not every field of
// ordinary native emit. Declarations, declaration maps and build information
// delegate to the native dts-only pass when that pass is required.
//
// @evidence contracts/common.md#principled-implementation Plugin AST transforms share the builtin emit context; parse-tree identity qualifies checker resolution, while native declaration emit retains compiler-owned declaration semantics.
// @evidence contracts/common.md#clear-and-simple-design JavaScript transformation and declaration emission are separate phases with one buffered output owner and shared diagnostic classification.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Supported factories, original-node ownership, and compiler transformers replace hardcoded import aliases or patched checker functions; noEmitOnError withholds writes until both phases succeed.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain ordering, context integration, maps/BOM, and declaration delegation following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Compiler output paths and native containment checks govern writes; no shell or OS-specific output directory is assumed.
// @evidence contracts/performance.md#efficient-algorithms Without effective transforms, native whole-program emission and authored source-map correction own output work. Otherwise one original-tree member index precedes the eligible-file loop; each file runs the ordered callback chain and builtin transforms, followed by printing/maps and any native declaration pass. AST size, callback count/work, output bytes, native path checks and declaration work govern cost; callbacks may perform additional traversals.
// @evidence contracts/performance.md#reuse-equivalent-work Linked program hooks are latched per generation, and the existing checker/resolver serves all per-file transforms instead of constructing independent compiler programs.
// @evidence contracts/performance.md#bound-retention-and-release-resources The invocation retains original-member references and, under noEmitOnError, all pending output text without a byte cap. Success flushes once; return ends this local ownership, not caller-held output or Program/checker lifetimes. Write failure can leave an already-written prefix; no rollback is promised.
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
  options := p.TSProgram.Options()
  if options.NoEmit.IsTrue() {
    // Analysis-only incremental projects may still write build information.
    // Delegate that policy to the ordinary emitter without running JS hooks.
    result, diagnostics, err := p.EmitAllRaw(writeFile)
    if err != nil {
      return diagnostics, err
    }
    return p.pluginEmitDiagnostics("analysis-only emit", result.Diagnostics)
  }
  if result := shimcompiler.HandleNoEmitOnError(context.Background(), p.TSProgram, nil); result != nil {
    return p.pluginEmitDiagnostics("pre-emit checking", result.Diagnostics)
  }
  hasTransform := false
  for _, transform := range transforms {
    if transform != nil {
      hasTransform = true
      break
    }
  }
  if !hasTransform {
    correctSourceMap := p.NewSourceMapCorrector()
    result, diagnostics, err := p.EmitAllRaw(func(fileName, text string, data *shimcompiler.WriteFileData) error {
      corrected, err := correctSourceMap(fileName, text)
      if err != nil {
        return err
      }
      if writeFile != nil {
        return writeFile(fileName, corrected, data)
      }
      return DefaultWriteFile(fileName, corrected)
    })
    if err != nil || result == nil {
      return diagnostics, err
    }
    phase := "JavaScript emit"
    if options.GetEmitDeclarations() {
      phase = "declaration emit"
    }
    return p.pluginEmitDiagnostics(phase, result.Diagnostics)
  }
  // Snapshot ownership before any transformer runs, including transforms that
  // mutate their input in place or reuse a member from another source file.
  members := make(map[*shimast.Node]struct{})
  for _, sf := range p.TSProgram.SourceFiles() {
    collectOriginalMembers(sf.AsNode(), members)
  }
  host := &pluginEmitHost{program: p.TSProgram, emitResolver: guardedEmitResolver{p.Checker.GetEmitResolver(), members}}

  // noEmitOnError applies to the whole build. The JS lane runs before the
  // declaration lane, so defer callbacks until both have succeeded. Outside
  // that option keep upstream's emit-despite-errors behavior.
  output := newPluginEmitOutput(writeFile, options.NoEmitOnError.IsTrue())
  correctSourceMap := p.NewSourceMapCorrector()
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
      // Upstream passes one file to both roles only because it has no plugin
      // pass between them: emitJSFile hands getScriptTransformers the file it
      // parsed, then reassigns it to the transform result. Here they differ.
      //
      // getScriptTransformers reads its file for three things: in-JS-file, JSX
      // language variant, and emitResolver.MarkLinkedReferencesRecursively. The
      // first two survive UpdateSourceFile, so marking is the whole difference,
      // and marking is a per-node checker resolution walk under the single
      // checker mutex.
      //
      // Marking the plugin's tree does not merely spend that walk on nodes the
      // binder never saw, it emits broken JavaScript. Elision reads the marks
      // back for the file's parse-tree imports, so a reference the plugin
      // REBUILT (a fresh identifier linked with SetOriginal, which is what any
      // partial rewrite produces) leaves its import unmarked. The module
      // transform still aliases that reference and elision still drops the
      // binding the alias names: `dep_1.foo` with no `const dep_1 =
      // require(...)`, a ReferenceError at load. The emit_plugin_rebuilt_*
      // tests pin each import binding shape, plus the ES module lane where the
      // whole import declaration disappears instead of just its binding.
      //
      // Nothing is lost by skipping the plugin's nodes. UpdateSourceFile
      // rebuilds a SourceFile through copyFrom, which carries over neither
      // Locals nor Symbol, and an ordinary import binds into Locals, so no
      // resolveName branch reaches an import from a synthetic identifier. An
      // import the plugin synthesized needs no mark at all: it has no parse
      // original, and elision preserves it unconditionally.
      //
      // Marks accumulate on the checker and are never cleared, so marking one
      // fixed tree per file also stops a second emit on the same Program from
      // inheriting the first pass's plugin-tree marks.
      for _, tr := range shimcompiler.GetScriptTransformers(ec, host, sf) {
        out = tr.TransformSourceFile(out)
      }
      // Print through the source-map-aware helper for an external sourceMap or
      // an inlineSourceMap trailer, and an emitBOM leading mark: the hand-assembled
      // emit pipeline does not run tsgo's emitter, so everything printSourceFile
      // would otherwise do around the printer has to happen here. With maps and
      // emitBOM off the output is the bare printer's.
      printed := shimcompiler.PrintFileWithSourceMap(ec, out.AsNode(), out, options, host, paths.JsFilePath(), paths.SourceMapFilePath())
      // A source-level preamble (e.g. @ttsc/banner linked into a typia host)
      // shifts the map's source coordinates; correct them here too, so the
      // preamble-plus-transform combination is not left uncorrected the way it
      // would be if only the utility host's WriteFile patched maps. Covers both
      // the external `.js.map` and an inline base64 map embedded in the JS.
      if p.SourcePreamble != "" {
        var err error
        if printed.JS, err = correctSourceMap(paths.JsFilePath(), printed.JS); err != nil {
          return nil, err
        }
        if printed.MapPath != "" {
          if printed.MapText, err = correctSourceMap(printed.MapPath, printed.MapText); err != nil {
            return nil, err
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
      }, output.write); err != nil {
        return nil, fmt.Errorf("driver: native plugin JavaScript emit failed: %w", err)
      }
      if err := p.writePluginEmitOutput(printed.MapPath, printed.MapText, nil, output.write); err != nil {
        return nil, fmt.Errorf("driver: native plugin source map emit failed: %w", err)
      }
    }
  }
  // The declaration pass below doubles as this lane's build-information pass,
  // so it also runs for a JavaScript-only `incremental` / `composite` project
  // that has no declarations to write at all.
  if !options.GetEmitDeclarations() && !p.emitsBuildInfo() {
    if result := shimcompiler.HandleNoEmitOnError(context.Background(), p.TSProgram, nil); result != nil {
      return p.pluginEmitDiagnostics("JavaScript emit", result.Diagnostics)
    }
    return nil, output.flush()
  }

  // What the build information this pass writes does and does not claim.
  //
  // The JavaScript above was hand-assembled and written outside tsgo's
  // emitter, so tsgo's snapshot never saw it happen and records the JS emit of
  // every file as still pending. That error is one-directional and safe: a
  // consumer reading it can only decide to emit again, never to skip a file
  // ttsc actually transformed. Making the record exact would mean running
  // tsgo's own JavaScript emit a second time and discarding its output, paying
  // a full emit to describe work already done. Other build-information fields
  // come from this native declaration pass; they are not a separate certificate
  // of arbitrary plugin reads or of the hand-assembled JavaScript output.
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
      corrected, err := correctSourceMap(fileName, text)
      if err != nil {
        return err
      }
      text = corrected
      return output.write(fileName, text, data)
    },
  })
  var diagnostics []Diagnostic
  if result != nil && len(result.Diagnostics) != 0 {
    var err error
    diagnostics, err = p.pluginEmitDiagnostics("declaration emit", result.Diagnostics)
    if err != nil {
      return diagnostics, err
    }
  }
  return diagnostics, output.flush()
}

// writePluginEmitOutput writes one artifact of the hand-assembled emit, passing
// the caller's WriteFile the supported WriteFileData fields described below.
//
// What this lane can populate, and what it deliberately cannot:
//
//   - SourceMapUrlPos: the offset of the `//# sourceMappingURL=` trailer, or -1
//     when none was written. PrintFileWithSourceMap records it exactly where
//     printSourceFile does, so a consumer that relocates or rewrites the trailer
//     works the same on both lanes.
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
