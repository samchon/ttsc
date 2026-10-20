package ast

import innertspath "github.com/microsoft/typescript-go/internal/tspath"

// Version-neutral Symbol and SourceFile accessors.
//
// TypeScript 7.0 exposes Symbol state as fields, and TypeScript 7.1 hides it
// behind getters. A type alias can add neither, so plugin code that must
// compile on both compiler targets reads that state through these functions,
// which the 7.1 bridge declares with identical signatures over its getters.

// SymbolNameOf returns the symbol's escaped name as the binder stored it. It
// differs from SymbolName, which spells a private class member's declared name.
//
// @evidence contracts/common.md#principled-implementation Reads the Name field the 7.0 binder writes, the same value the 7.1 Name getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No name is derived or normalized; the stored value is returned unchanged.
// @evidence contracts/common.md#meaningful-documentation Native prose names the escaped-name meaning and the SymbolName distinction.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The accessor acquires and retains nothing.
func SymbolNameOf(symbol *Symbol) string { return symbol.Name }

// SymbolFlagsOf returns the symbol's SymbolFlags.
//
// @evidence contracts/common.md#principled-implementation Reads the Flags field, the same value the 7.1 Flags getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The flags are returned unchanged.
// @evidence contracts/common.md#meaningful-documentation Native prose names the returned flag family.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The accessor acquires and retains nothing.
func SymbolFlagsOf(symbol *Symbol) SymbolFlags { return symbol.Flags }

// SymbolCheckFlagsOf returns the checker's CheckFlags, nonzero only on
// transient symbols the checker created.
//
// @evidence contracts/common.md#principled-implementation Reads the CheckFlags field, the same value the 7.1 CheckFlags getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The flags are returned unchanged.
// @evidence contracts/common.md#meaningful-documentation Native prose states when the value is nonzero.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The accessor acquires and retains nothing.
func SymbolCheckFlagsOf(symbol *Symbol) CheckFlags { return symbol.CheckFlags }

// SymbolDeclarationsOf returns the declarations that contribute to the symbol.
// The slice is the compiler's own; callers must not modify it.
//
// @evidence contracts/common.md#principled-implementation Reads the Declarations field, the same slice the 7.1 Declarations getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The compiler's slice is returned without copying or filtering.
// @evidence contracts/common.md#meaningful-documentation Native prose states that the slice is compiler-owned.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidence contracts/performance.md#bound-retention-and-release-resources Returns the compiler-owned slice without allocating; the compiler owns its lifetime.
func SymbolDeclarationsOf(symbol *Symbol) []*Node { return symbol.Declarations }

// SymbolValueDeclarationOf returns the declaration that introduced the
// symbol's value meaning, or nil when it has none.
//
// @evidence contracts/common.md#principled-implementation Reads the ValueDeclaration field, the same node the 7.1 ValueDeclaration getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The node is returned unchanged, including nil.
// @evidence contracts/common.md#meaningful-documentation Native prose states the nil meaning.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The accessor acquires and retains nothing.
func SymbolValueDeclarationOf(symbol *Symbol) *Node { return symbol.ValueDeclaration }

// SymbolMembersOf returns the symbol's member table, or nil when it has none.
// The table is the compiler's own; callers must not modify it.
//
// @evidence contracts/common.md#principled-implementation Reads the Members field, the same table the 7.1 Members getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The table is returned without allocating one, so a nil table stays nil.
// @evidence contracts/common.md#meaningful-documentation Native prose states the nil meaning and compiler ownership.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidence contracts/performance.md#bound-retention-and-release-resources Returns the compiler-owned table without allocating; the compiler owns its lifetime.
func SymbolMembersOf(symbol *Symbol) SymbolTable { return symbol.Members }

// SymbolExportsOf returns the symbol's export table, or nil when it has none.
// The table is the compiler's own; callers must not modify it.
//
// @evidence contracts/common.md#principled-implementation Reads the Exports field, the same table the 7.1 Exports getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The table is returned without allocating one, so a nil table stays nil.
// @evidence contracts/common.md#meaningful-documentation Native prose states the nil meaning and compiler ownership.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidence contracts/performance.md#bound-retention-and-release-resources Returns the compiler-owned table without allocating; the compiler owns its lifetime.
func SymbolExportsOf(symbol *Symbol) SymbolTable { return symbol.Exports }

// SymbolParentOf returns the symbol that contains this one, or nil for a
// top-level symbol.
//
// @evidence contracts/common.md#principled-implementation Reads the Parent field, the same symbol the 7.1 Parent getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The parent is returned unchanged, including nil.
// @evidence contracts/common.md#meaningful-documentation Native prose states the nil meaning.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The accessor acquires and retains nothing.
func SymbolParentOf(symbol *Symbol) *Symbol { return symbol.Parent }

// SymbolExportSymbolOf returns the export symbol a local declaration merges
// into, or nil when it has none.
//
// @evidence contracts/common.md#principled-implementation Reads the ExportSymbol field, the same symbol the 7.1 ExportSymbol getter returns.
// @evidence contracts/common.md#clear-and-simple-design One field read per accessor keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The export symbol is returned unchanged, including nil.
// @evidence contracts/common.md#meaningful-documentation Native prose states the merge meaning and nil.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A field read performs no native filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A single field read chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The accessor coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The accessor acquires and retains nothing.
func SymbolExportSymbolOf(symbol *Symbol) *Symbol { return symbol.ExportSymbol }

// SourceFilePathKey returns the key the Program files a source under: the
// canonical form of its absolute path.
//
// @evidence contracts/common.md#principled-implementation Returns SourceFile.Path, the key 7.0 files a source under.
// @evidence contracts/common.md#clear-and-simple-design One method call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The key is the file's own, not recomputed.
// @evidence contracts/common.md#meaningful-documentation Native prose states the canonical-key meaning.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The key is stored on the file; no native operation runs.
// @evidenceExclude contracts/performance.md#efficient-algorithms A stored value is returned.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func SourceFilePathKey(file *SourceFile) innertspath.Path {
  return file.Path()
}
