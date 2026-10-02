// gen_shims:hand-maintained
//
// Re-exports tsgo's emit transformer type so ttsc can build a plugin
// transformer and run it ahead of the builtin emit chain. Plugins (typia,
// nestia) return real AST nodes; ttsc inserts their transformer first in the
// same EmitContext as the builtins, so tsgo's module-transform aliases imports
// itself, no text-splice needed.
package transformers

import innertransformers "github.com/microsoft/typescript-go/internal/transformers"

// Transformer is one stage of tsgo's emit transformer chain.
// TransformSourceFile returns the visited source file, which may replace the
// input; its visitor and factory share the stage's EmitContext.
//
// @evidence contracts/common.md#principled-implementation Go alias identity preserves the upstream visitor, factory and context relationship; callers receive the transformed SourceFile returned by the visitor rather than assuming in-place mutation.
// @evidence contracts/common.md#clear-and-simple-design One native transformer stage participates in the existing chain without an additional transform protocol or duplicated visitor state.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Plugins return compiler AST nodes through the supported stage, without text-splice substitutes or monkey-patched builtin passes.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies the possible replacement result and shared context rather than promising preservation of the input node's identity.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type Transformer = innertransformers.Transformer
