/** Authored project-resolution functions shared by in-process unit fixtures. */
export { default as assert } from "node:assert/strict";
export { default as fs } from "node:fs";
export { default as os } from "node:os";
export { default as path } from "node:path";

export { readProjectConfig } from "../../../../packages/ttsc/src/compiler/internal/project/readProjectConfig";
export { resolveProjectConfig } from "../../../../packages/ttsc/src/compiler/internal/project/resolveProjectConfig";
export { resolveProjectIdentity } from "../../../../packages/ttsc/src/compiler/internal/project/resolveProjectIdentity";
