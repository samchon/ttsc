// gen_shims:hand-maintained
//
// Exposes tsgo's emit-stage internals so ttsc can assemble the emit pipeline
// from real tsgo parts (no tsgo source copy/edit): obtain the builtin
// transformer chain for a file and prepend a plugin transformer that shares the
// same EmitContext, so module-transform aliases plugin-generated imports.
package compiler

import (
  _ "unsafe"

  innerast "github.com/microsoft/typescript-go/internal/ast"
  innerprinter "github.com/microsoft/typescript-go/internal/printer"
  innertransformers "github.com/microsoft/typescript-go/internal/transformers"
)

// GetScriptTransformers returns tsgo's builtin emit transformer chain
// (type-erase, import-elision, runtime-syntax, module-transform, ...) for one
// source file, linked from the internal package via go:linkname.
//
// `sourceFile` is the marking target, not the file that gets transformed.
// Upstream reads it for two per-file constants (in-JS-file, JSX language
// variant) and, unless isolated modules without import elision, JSX transform
// or decorator metadata makes marking unnecessary, hands it to
// emitResolver.MarkLinkedReferencesRecursively, whose marks the import-elision
// transformer later reads back through EmitContext.ParseNode. A caller that runs a plugin pass first must therefore
// pass the PARSE tree here and the transformed tree to TransformSourceFile;
// upstream's own emitter passes one file to both only because it has nothing in
// between. Re-check this when the pin moves: a new use of the parameter inside
// getScriptTransformers could make the two roles diverge further.
//
// @evidence contracts/common.md#principled-implementation Linking the pinned builtin chain preserves compiler transform ordering; the parse-tree argument supplies stable linked-reference marks that transformed nodes retrieve through EmitContext provenance.
// @evidence contracts/common.md#clear-and-simple-design The helper exposes chain assembly without running transforms, keeping plugin insertion in the driver and builtin ordering in the compiler.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The source-file distinction follows the pinned helper's marking semantics rather than masking an arbitrary transform failure; linkage exposes the function without replacing its implementation.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain chain contents, marking versus transformation roles and the version-pin premise, with Go linkage retained outside the prose section.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetScriptTransformers declares a signature only; the implementation owns acquisition and release of resources.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetScriptTransformers declares a signature only; the implementation owns the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetScriptTransformers declares a signature only; the implementation owns any shared work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetScriptTransformers is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
//
//go:linkname GetScriptTransformers github.com/microsoft/typescript-go/internal/compiler.getScriptTransformers
func GetScriptTransformers(emitContext *innerprinter.EmitContext, host innerprinter.EmitHost, sourceFile *innerast.SourceFile) []*innertransformers.Transformer
