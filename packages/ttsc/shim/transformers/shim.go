// gen_shims:hand-maintained
//
// Re-exports tsgo's emit transformer type so ttsc can build a plugin
// transformer and run it ahead of the builtin emit chain. Plugins (typia,
// nestia) return real AST nodes; ttsc inserts their transformer first in the
// same EmitContext as the builtins, so tsgo's module-transform aliases imports
// itself, no text-splice needed.
package transformers

import innertransformers "github.com/microsoft/typescript-go/internal/transformers"

// Transformer is one stage of tsgo's emit transformer chain
// (TransformSourceFile mutates the SourceFile AST in place within the emit
// EmitContext).
type Transformer = innertransformers.Transformer
