# Source Coordinates

Apply to source-map creation or composition, AST location remapping, and translation between compiler and editor positions. Relevant units include `packages/ttsc/driver/transform_source_map.go`, Unplugin's map helpers, `packages/metro/src/core/remapAstLocations.ts`, and the WASM fountain boundary.

The existing contracts are [Metro location remapping](../../../packages/metro/src/core/remapAstLocations.ts) and [WASM positions](../../../packages/wasm/README.md#fountain-api-snapshot-ast-type-checker).

## Preserve the source coordinate meaning

Identify the source and destination text, coordinate units, indexing convention, and path identity used by this operation. Explain map direction and composition order when it translates transformed text back to authored text. Describe the result for generated or unmapped spans instead of manufacturing an authored location.

The WASM API takes UTF-8 byte offsets, while editor line and character inputs may use UTF-16. Name the conversion at the operation that crosses that boundary. A data member that stores a position explains its unit; it does not pretend to perform the conversion.

ASCII-only examples can conceal a unit mismatch. Incorrect map direction or invented locations can make diagnostics, breakpoints, and stack traces point to valid-looking positions in the wrong text.
