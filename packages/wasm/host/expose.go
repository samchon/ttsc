package host

// API stability: experimental until v1.0; signatures may change between
// minor releases. Pin exact versions in production playgrounds.
//
// Expose installs `globalThis[apiName]` with the base API endpoints and the
// plugin dispatcher, then keeps the Go runtime alive until Worker termination.
// Invalid or duplicate registration reports failure and returns before binding.
// A native build (without js/wasm) selects an alternative that installs nothing
// and returns immediately, so native entrypoints can import the package.
//
// The contract:
//
//   - globalThis[apiName].version()                        → { version, commit, date, go, goos, goarch }
//   - globalThis[apiName].build({ cwd, tsconfig })         → Promise<ITtscResult>
//   - globalThis[apiName].check({ cwd, tsconfig })         → Promise<ITtscResult>
//   - globalThis[apiName].transform({ cwd, tsconfig })     → Promise<ITtscResult>
//   - globalThis[apiName].plugin({ name, command, ...opts}) → Promise<ITtscResult>
//   - globalThis[apiName].plugins()                        → string[] of registered names
//
// The retained-program verbs (snapshot, releaseSnapshot, snapshots,
// getSourceFiles, getSourceFileText, getDiagnostics, getNodeAtPosition,
// getTypeAtPosition, getSymbolAtPosition) are installed beside them and return
// the same envelope.
//
// build/check/transform encode their structured payloads as JSON in
// ITtscResult.result. Plugin stdout/stderr are captured in the envelope streams.
//
// A matching readiness resolver is invoked: `globalThis[`${apiName}Ready`]`.
// JS callers register this BEFORE go.run begins so they can await wasm boot.
//
// @evidence contracts/common.md#principled-implementation syscall/js bindings and explicit Ready/Failed callbacks implement the Go wasm host protocol; an atomic gate owns one installation per instance, and build constraints select a no-op native alternative behind the same signature.
// @evidence contracts/common.md#clear-and-simple-design Expose owns one registration and readiness boundary; project adapters, plugin invocation and fountain queries remain named helpers with their own state instead of duplicating binding policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Registered plugins use owned invocation streams rather than foreign global-output replacement; rejected duplicate installation is reported through the boot failure boundary.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain setup order, payload channels and runtime lifetime under the documentation skill's context guidance.
// @evidence contracts/performance.md#efficient-algorithms Registration visits P supplied plugins once with map duplicate checks and creates a fixed set of endpoint bindings. Snapshot lookup uses a map; source lookup uses the driver's existing compiler index, with path normalization and hashing proportional to path length. A relative path may require a second indexed lookup. List/diagnostic queries traverse their requested results; parsing, checking and printing remain driver Program work.
// @evidence contracts/performance.md#reuse-equivalent-work Fountain queries reuse the explicitly acquired Program and its checker under one opaque handle; registry and entry locks keep queries within that snapshot's lifetime. Editing MemFS does not refresh an existing snapshot, so callers release and reacquire when they need a new project view rather than sharing by path alone.
// @evidence contracts/performance.md#bound-retention-and-release-resources The wasm instance owns P plugin registrations, pinned js.Func bindings and its keepalive until Worker termination. Each acquired snapshot owns a Program; registry readers finish before release deletes and closes it. Snapshot count, Program bytes and concurrent invocation tasks have no fixed bound. Promise executors release their js.Func after settlement, and InvokePlugin owns its own streams and child work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Expose binds a JavaScript global in the wasm runtime and performs no native filesystem, path or process operation; the native alternative does nothing.
func Expose(apiName string, cfg Config) {
  expose(apiName, cfg)
}
