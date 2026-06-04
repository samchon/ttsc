// gen_shims:hand-maintained
//
// Re-exports the ModuleKind enum so plugins / ttsc can type emit-format values
// (e.g. an EmitHost.GetEmitModuleFormatOfFile result).
package core

import innercore "github.com/microsoft/typescript-go/internal/core"

// ModuleKind is tsgo's module-format enum (CommonJS, ESNext, NodeNext, ...).
type ModuleKind = innercore.ModuleKind
