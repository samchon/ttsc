import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  parseExpectations,
  runLint,
  rulesFromExpectations,
} from "@ttsc/testing/lint";

const casesRoot = path.resolve(import.meta.dirname, "..", "cases");

export function assertLintCase(relativeFile: string): void {
  const source = fs.readFileSync(path.join(casesRoot, relativeFile), "utf8");
  const expected = parseExpectations(source);
  const result = runLint({
    name: relativeFile,
    source,
    rules: rulesFromExpectations(expected),
    extraSources: collectExtraSources(relativeFile),
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.deepEqual(
    result.diagnostics.map(({ rule, severity, line }) => ({
      rule,
      severity,
      line,
    })),
    expected.map(({ rule, severity, line }) => ({ rule, severity, line })),
    result.stderr,
  );
}

function collectExtraSources(relativeFile: string): Record<string, string> {
  const dir = path.dirname(relativeFile);
  if (dir === ".") return {};
  const root = path.join(casesRoot, dir);
  const out: Record<string, string> = {};
  for (const file of walk(root)) {
    const rel = path.relative(root, file).replaceAll(path.sep, "/");
    if (rel === path.basename(relativeFile)) continue;
    out[path.posix.join("src", rel)] = fs.readFileSync(file, "utf8");
  }
  return out;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(file));
    else if (entry.isFile()) out.push(file);
  }
  return out.sort();
}
