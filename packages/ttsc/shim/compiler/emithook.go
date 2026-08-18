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
// variant) and then hands it to emitResolver.MarkLinkedReferencesRecursively,
// whose marks the import-elision transformer later reads back through
// EmitContext.ParseNode. A caller that runs a plugin pass first must therefore
// pass the PARSE tree here and the transformed tree to TransformSourceFile;
// upstream's own emitter passes one file to both only because it has nothing in
// between. Re-check this when the pin moves: a new use of the parameter inside
// getScriptTransformers could make the two roles diverge further.
//
//go:linkname GetScriptTransformers github.com/microsoft/typescript-go/internal/compiler.getScriptTransformers
func GetScriptTransformers(emitContext *innerprinter.EmitContext, host innerprinter.EmitHost, sourceFile *innerast.SourceFile) []*innertransformers.Transformer
