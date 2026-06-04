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
//go:linkname GetScriptTransformers github.com/microsoft/typescript-go/internal/compiler.getScriptTransformers
func GetScriptTransformers(emitContext *innerprinter.EmitContext, host innerprinter.EmitHost, sourceFile *innerast.SourceFile) []*innertransformers.Transformer
