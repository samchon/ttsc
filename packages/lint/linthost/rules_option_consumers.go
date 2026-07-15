// Option-consumer declarations.
//
// The engine rejects a configuration options payload aimed at an optionless
// rule (see `ruleAcceptsOptions` in engine.go) so a config typo or an
// unsupported option surfaces instead of being silently dropped. A rule proves
// it is *not* optionless one of three ways: a `ValidateOptions` schema, the
// format category (its options arrive from the top-level `format` block), or
// the `ConsumesOptions` marker below.
//
// The rules here read an options payload at runtime — via `ctx.DecodeOptions`
// or `ctx.Options` — but decode it leniently without a `ValidateOptions`
// schema. Each must advertise option support so its payload keeps flowing.
// Rules that already implement `ValidateOptions` (for example
// `no-restricted-syntax`, `unicorn/better-regex`, `typescript/no-restricted-types`)
// are deliberately absent: they advertise support through the validator and
// listing them here too would be redundant. Keeping the full lenient-decoder
// set in one place makes it auditable against the rule registry.
package linthost

// boundaries/* (except `boundaries/dependencies`, which validates its options)
// each decode the shared `boundariesOptions` payload.
func (boundariesElementTypes) ConsumesOptions() bool { return true }
func (boundariesExternal) ConsumesOptions() bool     { return true }
func (boundariesEntryPoint) ConsumesOptions() bool   { return true }
func (boundariesNoPrivate) ConsumesOptions() bool    { return true }
func (boundariesNoUnknown) ConsumesOptions() bool    { return true }

// Core / stylistic rules that decode a positional or object options payload.
func (banTsComment) ConsumesOptions() bool            { return true }
func (defaultCase) ConsumesOptions() bool             { return true }
func (noEmpty) ConsumesOptions() bool                 { return true }
func (noEmptyFunction) ConsumesOptions() bool         { return true }
func (noDuplicateImports) ConsumesOptions() bool      { return true }
func (noElseReturn) ConsumesOptions() bool            { return true }
func (noExtendNative) ConsumesOptions() bool          { return true }
func (noFallthrough) ConsumesOptions() bool           { return true }
func (noInnerDeclarations) ConsumesOptions() bool     { return true }
func (noPromiseExecutorReturn) ConsumesOptions() bool { return true }
func (noReturnAssign) ConsumesOptions() bool          { return true }
func (noUnusedExpressions) ConsumesOptions() bool     { return true }
func (preferConst) ConsumesOptions() bool             { return true }

// functional/* rules that decode a functional-pattern options payload.
func (functionalParameters) ConsumesOptions() bool                  { return true }
func (functionalImmutableData) ConsumesOptions() bool               { return true }
func (functionalNoLet) ConsumesOptions() bool                       { return true }
func (functionalNoTryStatements) ConsumesOptions() bool             { return true }
func (functionalPreferImmutableTypes) ConsumesOptions() bool        { return true }
func (functionalPreferReadonlyType) ConsumesOptions() bool          { return true }
func (functionalReadonlyType) ConsumesOptions() bool                { return true }
func (functionalTypeDeclarationImmutability) ConsumesOptions() bool { return true }

// TypeScript rules that decode an options payload.
func (noFloatingPromises) ConsumesOptions() bool        { return true }
func (noMisusedPromises) ConsumesOptions() bool         { return true }
func (switchExhaustivenessCheck) ConsumesOptions() bool { return true }

// Remaining plugin-namespace rules with lenient option decoders.
func (reactPerfRule) ConsumesOptions() bool                     { return true }
func (onlyExportComponents) ConsumesOptions() bool              { return true }
func (storybookNoUninstalledAddons) ConsumesOptions() bool      { return true }
func (testingLibraryRule) ConsumesOptions() bool                { return true }
func (cypressUnsafeToChainCommand) ConsumesOptions() bool       { return true }
func (unicornTextEncodingIdentifierCase) ConsumesOptions() bool { return true }
