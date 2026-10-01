/** Built-in and repository-script inputs for source units, without compiler resolution. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../../../../../..", import.meta.url));
const requireFromTest = createRequire(path.join(workspaceRoot, "package.json"));

export { assert, fs, path, requireFromTest, workspaceRoot };
