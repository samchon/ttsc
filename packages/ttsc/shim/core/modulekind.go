// gen_shims:hand-maintained
//
// Re-exports the ModuleKind enum so plugins / ttsc can type emit-format values
// (e.g. an EmitHost.GetEmitModuleFormatOfFile result).
package core

import innercore "github.com/microsoft/typescript-go/internal/core"

// ModuleKind is tsgo's module-format enum (CommonJS, ESNext, NodeNext, ...).
//
// @evidence contracts/common.md#principled-implementation A Go alias preserves upstream module-format identity, matching CompilerOptions and emit-host decisions without translating enum values.
// @evidence contracts/common.md#clear-and-simple-design One compiler discriminator connects configuration and emit format, with constants maintained in the adjacent core shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Formats remain actual compiler constants rather than hardcoded consumer-specific output choices.
// @evidence contracts/common.md#meaningful-documentation Native prose gives representative formats and package context explains the emit-host consumer.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This type declaration describes a data shape only; it opens no file, builds no path and branches on no platform.
type ModuleKind = innercore.ModuleKind
