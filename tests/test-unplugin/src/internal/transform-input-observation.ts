import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  type TtscTransformFilesystemOperations,
  validateGraphInputObservation,
} from "../../../../packages/unplugin/lib/core/transform.js";

interface IFilesystemState {
  contents?: Buffer;
  kind: "directory" | "file" | "missing";
  lexical?: string;
  readable?: boolean;
  realpath?: string;
}

/** Assert predicate proofs across path kinds, suffixes, owners, and transitions. */
export function assertPredicateProofMatrix(): void {
  const root = path.resolve("predicate-proof-root");
  const directory = state({
    kind: "directory",
    realpath: path.join(root, "directory-target"),
  });
  const directoryProof = {
    directoryExists: true,
    fileExists: false,
    readFile: { ok: false as const },
    realpath: { ok: true as const, path: path.join(root, "directory-target") },
    stat: "directory" as const,
  };
  assert.deepEqual(
    validateGraphInputObservation(
      path.join(root, "punycode.js"),
      directoryProof,
      directory,
    ),
    [],
  );

  const suffixes = [
    ".ts",
    ".tsx",
    ".d.ts",
    ".js",
    ".jsx",
    ".mts",
    ".cts",
    ".mjs",
    ".cjs",
    ".native.ts",
  ];
  for (const suffix of suffixes) {
    assert.deepEqual(
      validateGraphInputObservation(
        path.join(root, `candidate${suffix}`),
        directoryProof,
        directory,
      ),
      [],
      suffix,
    );
  }

  const owners = [
    "relative/value.js",
    "paths/value.ts",
    "rootDirs/value.tsx",
    "node_modules/pkg.js",
    "node_modules/pkg/subpath.js",
    "node_modules/main-target.js",
    "node_modules/types-target.d.ts",
    "node_modules/exports-target.mjs",
    "ancestor/node_modules/pkg.cts",
  ];
  for (const owner of owners) {
    assert.deepEqual(
      validateGraphInputObservation(
        path.join(root, owner),
        directoryProof,
        directory,
      ),
      [],
      owner,
    );
  }

  const absentFileProof = { fileExists: false };
  assert.deepEqual(
    validateGraphInputObservation(
      path.join(root, "absent.ts"),
      absentFileProof,
      state({ kind: "missing" }),
    ),
    [],
  );
  assert.deepEqual(
    validateGraphInputObservation(
      path.join(root, "directory.ts"),
      absentFileProof,
      directory,
    ),
    [],
  );
  assert.deepEqual(
    validateGraphInputObservation(
      path.join(root, "broken.ts"),
      absentFileProof,
      state({ kind: "missing" }),
    ),
    [],
  );
  assert.deepEqual(
    validateGraphInputObservation(
      path.join(root, "appeared.ts"),
      absentFileProof,
      state({ contents: Buffer.from("export {};\n"), kind: "file" }),
    ),
    ["file-exists-changed"],
  );

  const selected = path.join(root, "selected.ts");
  const selectedTarget = path.join(root, "store", "selected.ts");
  const contents = Buffer.from("export const selected = true;\n");
  const selectedProof = {
    directoryExists: false,
    fileExists: true,
    readFile: { hash: sha256(contents), ok: true as const },
    realpath: { ok: true as const, path: selectedTarget },
    stat: "file" as const,
  };
  assert.deepEqual(
    validateGraphInputObservation(
      selected,
      selectedProof,
      state({
        contents,
        kind: "file",
        lexical: selected,
        realpath: selectedTarget,
      }),
    ),
    [],
  );
  assert.deepEqual(
    validateGraphInputObservation(
      selected,
      selectedProof,
      state({
        contents: Buffer.from("export const selected = false;\n"),
        kind: "file",
        lexical: selected,
        realpath: selectedTarget,
      }),
    ),
    ["read-file-changed"],
  );
  assert.deepEqual(
    validateGraphInputObservation(
      selected,
      selectedProof,
      state({
        contents,
        kind: "file",
        lexical: selected,
        realpath: path.join(root, "other", "selected.ts"),
      }),
    ),
    ["realpath-changed"],
  );
  assert.deepEqual(
    validateGraphInputObservation(
      selected,
      selectedProof,
      state({
        kind: "directory",
        lexical: selected,
        realpath: path.join(root, "directory-target"),
      }),
    ),
    [
      "file-exists-changed",
      "directory-exists-changed",
      "stat-changed",
      "read-file-changed",
      "realpath-changed",
    ],
  );

  const unreadable = state({
    kind: "file",
    lexical: selected,
    readable: false,
    realpath: selected,
  });
  const unreadableProof = {
    fileExists: true,
    readFile: { ok: false as const },
    realpath: { ok: true as const, path: selected },
  };
  assert.deepEqual(
    validateGraphInputObservation(selected, unreadableProof, unreadable),
    [],
  );
  assert.deepEqual(
    validateGraphInputObservation(
      selected,
      unreadableProof,
      state({ contents, kind: "file", lexical: selected, realpath: selected }),
    ),
    ["read-file-changed"],
  );

  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), contents]);
  assert.deepEqual(
    validateGraphInputObservation(
      selected,
      { readFile: { hash: sha256(contents), ok: true } },
      state({ contents: bom, kind: "file", realpath: selected }),
    ),
    [],
  );
  assert.deepEqual(
    validateGraphInputObservation(
      selected,
      { directoryExists: true, fileExists: true },
      directory,
    ),
    ["proof-conflict"],
  );
  assertRealFilesystemKinds();
}

/** Exercise the host implementation over real files, links, and broken links. */
function assertRealFilesystemKinds(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-predicate-proof-"));
  try {
    const targetDirectory = path.join(root, "directory-target");
    const directoryLink = path.join(root, "candidate.js");
    fs.mkdirSync(targetDirectory);
    fs.symlinkSync(
      targetDirectory,
      directoryLink,
      process.platform === "win32" ? "junction" : "dir",
    );
    const directoryProof = {
      directoryExists: true,
      fileExists: false,
      readFile: { ok: false as const },
      realpath: {
        ok: true as const,
        path: fs.realpathSync.native(targetDirectory),
      },
      stat: "directory" as const,
    };
    assert.deepEqual(
      validateGraphInputObservation(directoryLink, directoryProof),
      [],
      "a symlink or junction to a directory must remain absent as a file",
    );

    fs.rmSync(directoryLink, { recursive: true });
    fs.writeFileSync(directoryLink, "export const selected = true;\n", "utf8");
    assert.deepEqual(
      validateGraphInputObservation(directoryLink, directoryProof),
      [
        "file-exists-changed",
        "directory-exists-changed",
        "stat-changed",
        "read-file-changed",
        "realpath-changed",
      ],
      "replacing the directory link with a selectable file must invalidate every changed predicate",
    );

    if (process.platform !== "win32") {
      const targetFile = path.join(root, "file-target.ts");
      const fileLink = path.join(root, "file-link.ts");
      const brokenLink = path.join(root, "broken.ts");
      const contents = Buffer.from("export const linked = true;\n");
      fs.writeFileSync(targetFile, contents);
      fs.symlinkSync(targetFile, fileLink, "file");
      assert.deepEqual(
        validateGraphInputObservation(fileLink, {
          directoryExists: false,
          fileExists: true,
          readFile: { hash: sha256(contents), ok: true },
          realpath: {
            ok: true,
            path: fs.realpathSync.native(targetFile),
          },
          stat: "file",
        }),
        [],
        "a file symlink must preserve content and physical identity",
      );
      fs.symlinkSync(path.join(root, "missing-target.ts"), brokenLink, "file");
      assert.deepEqual(
        validateGraphInputObservation(brokenLink, {
          directoryExists: false,
          fileExists: false,
          readFile: { ok: false },
          realpath: { ok: false },
          stat: "missing",
        }),
        [],
        "a broken link must remain distinguishable from a readable file or directory",
      );
    }
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

function state(value: IFilesystemState): TtscTransformFilesystemOperations {
  const missing = (): never => {
    const error = new Error("missing") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  };
  const stats = {
    isDirectory: () => value.kind === "directory",
  };
  return {
    caseSensitive: () => true,
    exists: () => value.kind !== "missing",
    lstat: () => missing(),
    platform: process.platform,
    readFile: () => {
      if (value.kind !== "file" || value.readable === false) return missing();
      return value.contents ?? Buffer.alloc(0);
    },
    readdir: () => [],
    realpath: (location) => {
      if (value.kind === "missing") return missing();
      if (
        value.realpath !== undefined &&
        (value.lexical === undefined ||
          path.resolve(location) === path.resolve(value.lexical))
      ) {
        return value.realpath;
      }
      return path.resolve(location);
    },
    stat: () => (value.kind === "missing" ? missing() : (stats as never)),
    statBigInt: () => (value.kind === "missing" ? missing() : (stats as never)),
  };
}

function sha256(contents: Buffer): string {
  return crypto.createHash("sha256").update(contents).digest("hex");
}
