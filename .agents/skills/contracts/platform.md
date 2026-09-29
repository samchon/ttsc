# Filesystem And Process Portability

Apply to operations that access the host filesystem, interpret native paths or file identity, launch or coordinate native processes, or choose OS-specific resource behavior. Include types that define these boundaries, such as a native path or process launch descriptor. Review the entry point together with the helpers and adapters that establish its behavior.

Pure calculations, ordinary configuration values and browser virtual filesystems do not acquire this contract just because their package also contains native operations. A virtual filesystem's POSIX path grammar belongs to its own product contract. Select cohesive files containing the native boundary in the package's `evidence.config.json`; for a genuinely unrelated declaration sharing such a file, exclude only this checklist item with a reason identifying its actual role.

## Portable behavior

Preserve the defined behavior on every supported OS. Identify the actual filesystem, path-identity, process or platform-sensitive operations and explain how the implementation handles the differences relevant to them. Account for native roots and separators, filesystem case behavior, file kinds, line endings and command invocation where the operation depends on them. Keep native paths distinct from URLs and protocol paths, and use argument-vector process APIs for ordinary commands.

These differences can change which file a compiler reads, whether two resources are treated as one, or what command a process executes. A successful run on one OS does not establish the same behavior on another. Explain the platform evidence available and any capability or coverage limitation instead of writing "works cross-platform."

Necessary native implementations belong behind an explicit platform boundary. Name that boundary and the corresponding behavior on other supported platforms. A platform-specific launcher or shell path must explain its quoting and argument transport; a supported OS difference is a reason for an explicit adapter, not a reason to patch a foreign module or hard-code a consumer.

For a boundary type, identify the path, identity or process semantics its fields represent and the operation that interprets them. For an operation, identify the actual mechanisms and relevant failure behavior. Record unresolved portability defects under the common [behavioral correctness contract](common.md#behavioral-correctness); do not turn a known limitation into a claim that all platforms are supported correctly.
