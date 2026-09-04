import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../../../packages/ttsc/lib/internal/projectInputPathIdentity.js";
import {
  discoverNearestProjectTsconfig,
  findNearestProjectTsconfig,
  findProjectTsconfigs,
} from "../../../../packages/unplugin/lib/core/projectDiscovery.js";
import {
  type TtscTransformFilesystemOperations,
  type TtscWatchInputKeyBaseline,
  captureWatchInputBaseline,
  captureWatchInputFileBaseline,
  isWatchInputKeyBaseline,
  validateGraphInputObservation,
  watchInputEvidenceMatchesBaseline,
} from "../../../../packages/unplugin/lib/core/transform.js";
import { viteServeMissingInputWatchKey } from "../../../../packages/unplugin/lib/core/viteServe.js";

interface IFilesystemState {
  contents?: Buffer;
  kind: "directory" | "file" | "missing" | "other";
  lexical?: string;
  readable?: boolean;
  realpath?: string;
}

/** Assert predicate proofs across path kinds and transitions. */
export function assertPredicateProofMatrix(): void {
  const root = path.resolve("predicate-proof-root");
  const missingCandidate = path.join(root, "missing", "tsconfig.json");
  const candidateBaseline = captureWatchInputFileBaseline(
    missingCandidate,
    state({ kind: "missing" }),
  );
  assert.ok(candidateBaseline);
  assert.deepEqual(Object.keys(candidateBaseline).sort(), [
    "fileExists",
    "identity",
  ]);
  assert.equal(candidateBaseline.fileExists, false);
  assert.equal(isWatchInputKeyBaseline(candidateBaseline), true);
  assert.equal(
    watchInputEvidenceMatchesBaseline(
      {
        identity: candidateBaseline.identity,
        missing: true,
        state: {
          codec: "predicates",
          observation: { fileExists: false },
        },
      },
      candidateBaseline,
    ),
    true,
    "a project candidate needs only the file predicate used by discovery",
  );
  assert.equal(
    watchInputEvidenceMatchesBaseline(
      {
        identity: candidateBaseline.identity,
        missing: true,
        state: { codec: "host", hash: "unavailable" },
      },
      candidateBaseline,
    ),
    false,
    "a predicate-only baseline must not claim coverage for a content proof",
  );
  for (const strongerState of [
    { codec: "graph", hash: "unavailable", realpath: null },
    {
      codec: "predicates",
      observation: { directoryExists: false },
    },
    {
      codec: "predicates",
      observation: { readFile: { ok: false } },
    },
    {
      codec: "predicates",
      observation: { realpath: { ok: false } },
    },
    { codec: "predicates", observation: { stat: "missing" } },
  ] as const) {
    assert.equal(
      watchInputEvidenceMatchesBaseline(
        {
          identity: candidateBaseline.identity,
          missing: true,
          state: strongerState,
        },
        candidateBaseline,
      ),
      false,
      `a file predicate must not claim the stronger ${JSON.stringify(strongerState)} proof`,
    );
  }
  const specialCandidate = path.join(root, "special", "tsconfig.json");
  const specialBaseline = captureWatchInputFileBaseline(
    specialCandidate,
    state({ kind: "other" }),
  );
  const regularBaseline = captureWatchInputFileBaseline(
    specialCandidate,
    state({ kind: "file" }),
  );
  assert.ok(specialBaseline);
  assert.ok(regularBaseline);
  assert.equal(
    specialBaseline.fileExists,
    false,
    "a non-regular filesystem entry must not satisfy project discovery",
  );
  assert.equal(regularBaseline.fileExists, true);
  assert.equal(
    watchInputEvidenceMatchesBaseline(
      {
        identity: regularBaseline.identity,
        missing: false,
        state: {
          codec: "predicates",
          observation: { fileExists: true },
        },
      },
      specialBaseline,
    ),
    false,
    "replacing a non-regular candidate with a file must invalidate the baseline",
  );
  const broadBaseline = captureWatchInputBaseline(
    specialCandidate,
    state({ contents: Buffer.from("export {};\n"), kind: "file" }),
  );
  assert.ok(broadBaseline);
  assert.equal(isWatchInputKeyBaseline(broadBaseline), true);
  for (const malformed of [
    { fileExists: false },
    { ...candidateBaseline, identity: false },
    { ...candidateBaseline, hostHash: broadBaseline.hostHash },
    { ...broadBaseline, fileExists: false },
    { ...broadBaseline, graphHash: "not-a-content-state" },
    { ...broadBaseline, realpath: { ok: false, path: specialCandidate } },
    { ...broadBaseline, realpath: { ok: true } },
  ]) {
    assert.equal(
      isWatchInputKeyBaseline(malformed),
      false,
      `a malformed serialized baseline must fail closed: ${JSON.stringify(malformed)}`,
    );
    assert.equal(
      watchInputEvidenceMatchesBaseline(
        {
          identity: broadBaseline.identity,
          missing: false,
          state: {
            codec: "graph",
            hash: broadBaseline.graphHash,
            realpath: null,
          },
        },
        malformed as TtscWatchInputKeyBaseline,
      ),
      false,
      "a malformed baseline must never suppress invalidation",
    );
  }
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
  const typeRoot = path.join(root, "node_modules", "@types");
  const typeRootFilesystem = {
    ...directory,
    readdir: () =>
      ["zeta", "alpha"].map(
        (name) =>
          ({
            isDirectory: () => true,
            isFile: () => false,
            name,
          }) as fs.Dirent,
      ),
  };
  assert.deepEqual(
    validateGraphInputObservation(
      typeRoot,
      {
        accessibleEntries: {
          directories: ["alpha", "zeta"],
          files: [],
        },
      },
      typeRootFilesystem,
    ),
    [],
    "automatic type discovery must preserve TypeScript-Go's accessible directory listing",
  );
  assert.deepEqual(
    validateGraphInputObservation(
      typeRoot,
      {
        accessibleEntries: {
          directories: ["alpha"],
          files: [],
        },
      },
      typeRootFilesystem,
    ),
    ["accessible-entries-changed"],
    "adding an automatic type package must invalidate the recorded resolver input",
  );
  assert.deepEqual(
    validateGraphInputObservation(
      typeRoot,
      {
        accessibleEntries: {
          directories: ["alpha"],
          files: [],
        },
        directoryExists: false,
      },
      typeRootFilesystem,
    ),
    ["proof-conflict"],
    "a nonempty compiler directory listing cannot describe a missing directory",
  );

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
      {
        directoryExists: false,
        fileExists: false,
        readFile: { ok: false },
        realpath: { ok: true, path: path.join(root, "broken.ts") },
        stat: "missing",
      },
      state({ kind: "missing" }),
    ),
    [],
    "a failed native realpath must replay TypeScript-Go's lexical fallback",
  );
  const windowsBroken = "C:\\predicate-proof-root\\broken.ts";
  assert.deepEqual(
    validateGraphInputObservation(
      windowsBroken,
      {
        fileExists: false,
        realpath: { ok: true, path: windowsBroken },
      },
      state({ kind: "missing" }, "win32"),
    ),
    [],
    "realpath fallback must follow the observed filesystem's path semantics",
  );
  for (const scenario of [
    {
      file: "C:\\predicate-proof-root\\nested\\..\\selected.ts",
      lexical: "C:\\predicate-proof-root\\selected.ts",
      platform: "win32" as const,
      target: "C:\\predicate-proof-store\\selected.ts",
    },
    {
      file: "/predicate-proof-root/a\\b/../selected.ts",
      lexical: "/predicate-proof-root/selected.ts",
      platform: "linux" as const,
      target: "/predicate-proof-store/selected.ts",
    },
  ]) {
    assert.deepEqual(
      validateGraphInputObservation(
        scenario.file,
        { realpath: { ok: true, path: scenario.target } },
        state(
          {
            kind: "file",
            lexical: scenario.lexical,
            realpath: scenario.target,
          },
          scenario.platform,
        ),
      ),
      [],
      `${scenario.platform} lexical equality must not depend on the host platform`,
    );
  }
  for (const scenario of [
    {
      file: "C:\\predicate-proof-root\\nested\\..\\fallback.ts",
      normalized: "C:\\predicate-proof-root\\fallback.ts",
      platform: "win32" as const,
    },
    {
      file: "/predicate-proof-root/a\\b/../fallback.ts",
      normalized: "/predicate-proof-root/fallback.ts",
      platform: "linux" as const,
    },
  ]) {
    assert.deepEqual(
      validateGraphInputObservation(
        scenario.file,
        { realpath: { ok: true, path: scenario.normalized } },
        state({ kind: "file" }, scenario.platform),
      ),
      [],
      `${scenario.platform} realpath fallback must not depend on the host platform`,
    );
  }
  const posix = createFilesystemPathIdentityContext({
    caseSensitive: () => true,
    platform: "linux",
    realpath: (location) => path.posix.resolve(location),
  });
  assert.notEqual(
    posix.resolve("/repo/a\\b.ts").key,
    posix.resolve("/repo/a/b.ts").key,
    "POSIX path identity must not treat a backslash as a directory separator on a Windows host",
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
  assert.notEqual(
    viteServeMissingInputWatchKey(
      path.join(root, "alias-a", "candidate.ts"),
      "exists",
    ),
    viteServeMissingInputWatchKey(
      path.join(root, "alias-b", "candidate.ts"),
      "exists",
    ),
    "Vite polls must not merge lexical aliases that can later diverge",
  );
  assert.notEqual(
    viteServeMissingInputWatchKey(
      path.join(root, "alias-a", "candidate.ts"),
      "exists",
    ),
    viteServeMissingInputWatchKey(
      path.join(root, "alias-a", "candidate.ts"),
      "file",
    ),
    "Vite polls must not merge distinct availability predicates",
  );
  const polledTypeRoot = path.join(root, "node_modules", "@types");
  assert.notEqual(
    viteServeMissingInputWatchKey(polledTypeRoot, {
      accessibleEntries: { directories: [], files: [] },
      directoryExists: true,
    }),
    viteServeMissingInputWatchKey(polledTypeRoot, {
      accessibleEntries: { directories: ["generated"], files: [] },
      directoryExists: true,
    }),
    "Vite polls must key the complete rich predicate set",
  );
  assert.equal(
    viteServeMissingInputWatchKey(polledTypeRoot, {
      directoryExists: false,
      fileExists: false,
    }),
    viteServeMissingInputWatchKey(polledTypeRoot, {
      fileExists: false,
      directoryExists: false,
    }),
    "Vite poll keys must not depend on predicate property insertion order",
  );
  assertProjectTsconfigDiscovery();
  assertRealFilesystemKinds();
}

/** Assert implicit project discovery from one table-driven stat seam. */
function assertProjectTsconfigDiscovery(): void {
  type Kind = "directory" | "error" | "file" | "unprovable";
  for (const scenario of [
    {
      entries: new Map([["/repo/app/tsconfig.json", "file"]]),
      expected: "/repo/app/tsconfig.json",
      name: "nearest regular file",
      platform: "linux" as NodeJS.Platform,
      start: "/repo/app/src",
    },
    {
      entries: new Map([
        ["/repo/app/tsconfig.json", "directory"],
        ["/repo/tsconfig.json", "file"],
      ]),
      expected: "/repo/tsconfig.json",
      name: "directory collision",
      platform: "linux" as NodeJS.Platform,
      start: "/repo/app",
    },
    {
      entries: new Map([
        ["/repo/app/tsconfig.json", "error"],
        ["/repo/tsconfig.json", "file"],
      ]),
      expected: "/repo/tsconfig.json",
      name: "stat failure",
      platform: "linux" as NodeJS.Platform,
      start: "/repo/app",
    },
    {
      entries: new Map([
        ["/repo/app/tsconfig.json", "unprovable"],
        ["/repo/tsconfig.json", "file"],
      ]),
      expected: "/repo/tsconfig.json",
      name: "unprovable kind",
      platform: "linux" as NodeJS.Platform,
      start: "/repo/app",
    },
    {
      entries: new Map<string, Kind>(),
      expected: undefined,
      name: "filesystem root and no ancestor",
      platform: "linux" as NodeJS.Platform,
      start: "/",
    },
    {
      entries: new Map([["C:\\repo\\tsconfig.json", "file"]]),
      expected: "C:\\repo\\tsconfig.json",
      name: "Windows spelling",
      platform: "win32" as NodeJS.Platform,
      start: "C:\\repo\\app",
    },
  ] satisfies {
    entries: Map<string, Kind>;
    expected: string | undefined;
    name: string;
    platform: NodeJS.Platform;
    start: string;
  }[]) {
    const actual = findNearestProjectTsconfig(scenario.start, {
      platform: scenario.platform,
      stat: (location) => {
        const kind = scenario.entries.get(location) ?? "error";
        if (kind === "error") {
          throw new Error("unavailable candidate");
        }
        return {
          isFile: () => {
            if (kind === "unprovable") {
              throw new Error("unprovable candidate kind");
            }
            return kind === "file";
          },
        };
      },
    });
    assert.equal(actual, scenario.expected, scenario.name);
  }

  let observations = 0;
  assert.equal(
    findNearestProjectTsconfig("/repo/app", {
      platform: "linux",
      stat: (location) => {
        if (location !== "/repo/app/tsconfig.json") {
          throw new Error("unexpected ancestor observation");
        }
        observations += 1;
        return { isFile: () => observations === 1 };
      },
    }),
    "/repo/app/tsconfig.json",
    "one atomic stat proof must decide a candidate that would change kind on a second observation",
  );
  assert.equal(observations, 1);

  let nearerObservations = 0;
  assert.deepEqual(
    discoverNearestProjectTsconfig("/repo/app/src", {
      platform: "linux",
      stat: (location) => {
        if (location === "/repo/app/src/tsconfig.json") {
          nearerObservations += 1;
          if (nearerObservations === 1) {
            throw new Error("temporarily missing");
          }
          return { isFile: () => true };
        }
        if (location === "/repo/app/tsconfig.json") {
          return { isFile: () => true };
        }
        throw new Error(`unexpected candidate ${location}`);
      },
    }),
    {
      candidates: [
        { file: "/repo/app/src/tsconfig.json", fileExists: false },
        { file: "/repo/app/tsconfig.json", fileExists: true },
      ],
      file: "/repo/app/tsconfig.json",
    },
    "the selected project and its candidate proof must come from one discovery pass",
  );
  assert.equal(
    nearerObservations,
    1,
    "project selection must not rediscover a candidate that can return before evidence capture",
  );

  const directories = new Map<string, string[]>([
    ["/repo", [".git", "packages"]],
    ["/repo/packages", ["app"]],
    ["/repo/packages/app", []],
  ]);
  const configs = new Map([
    ["/repo/tsconfig.json", "file"],
    ["/repo/packages/app/tsconfig.json", "file"],
  ]);
  const discovered = findProjectTsconfigs("/repo", {
    platform: "linux",
    readdir: (location: string) =>
      (directories.get(location) ?? []).map((name) => ({
        isDirectory: () => true,
        name,
      })),
    stat: (location: string) => {
      if (configs.get(location) !== "file") {
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      }
      return { isFile: () => true };
    },
  });
  assert.deepEqual(discovered, {
    candidates: [
      "/repo/packages/app/tsconfig.json",
      "/repo/packages/tsconfig.json",
      "/repo/tsconfig.json",
    ],
    complete: true,
    files: ["/repo/packages/app/tsconfig.json", "/repo/tsconfig.json"],
  });
  const windowsDirectories = new Map<string, string[]>([
    ["C:\\repo", [".ttsc", "packages"]],
    ["C:\\repo\\packages", ["app"]],
    ["C:\\repo\\packages\\app", []],
  ]);
  const windowsConfigs = new Set([
    "C:\\repo\\tsconfig.json",
    "C:\\repo\\packages\\app\\tsconfig.json",
  ]);
  assert.deepEqual(
    findProjectTsconfigs("C:\\repo", {
      platform: "win32",
      readdir: (location: string) =>
        (windowsDirectories.get(location) ?? []).map((name) => ({
          isDirectory: () => true,
          name,
        })),
      stat: (location: string) => {
        if (!windowsConfigs.has(location)) {
          const error = new Error("missing") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
        return { isFile: () => true };
      },
    }),
    {
      candidates: [
        "C:\\repo\\packages\\app\\tsconfig.json",
        "C:\\repo\\packages\\tsconfig.json",
        "C:\\repo\\tsconfig.json",
      ],
      complete: true,
      files: [
        "C:\\repo\\packages\\app\\tsconfig.json",
        "C:\\repo\\tsconfig.json",
      ],
    },
    "the project map must preserve the observed Windows path platform",
  );
  const linkedTree = new Map<
    string,
    Array<{ directory: boolean; link?: boolean; name: string }>
  >([
    ["/repo", [{ directory: false, link: true, name: "linked" }]],
    ["/repo/linked", [{ directory: false, link: true, name: "back-to-root" }]],
  ]);
  assert.deepEqual(
    findProjectTsconfigs("/repo", {
      platform: "linux",
      readdir: (location: string) =>
        (linkedTree.get(location) ?? []).map((entry) => ({
          isDirectory: () => entry.directory,
          isSymbolicLink: () => entry.link === true,
          name: entry.name,
        })),
      realpath: (location: string) => {
        if (location === "/repo") return "/physical/repo";
        if (location === "/repo/linked") return "/external/project";
        if (location === "/repo/linked/back-to-root") {
          return "/physical/repo";
        }
        return location;
      },
      stat: (location: string) => {
        if (
          location === "/repo/linked" ||
          location === "/repo/linked/back-to-root"
        ) {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (location === "/repo/linked/tsconfig.json") {
          return { isDirectory: () => false, isFile: () => true };
        }
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
    }),
    {
      candidates: ["/repo/linked/tsconfig.json", "/repo/tsconfig.json"],
      complete: true,
      files: ["/repo/linked/tsconfig.json"],
    },
    "the project map must follow a linked project once and cut its physical ancestor cycle",
  );
  assert.deepEqual(
    findProjectTsconfigs("/repo", {
      platform: "linux",
      readdir: (location: string) =>
        location === "/repo"
          ? ["alias-a", "alias-b"].map((name) => ({
              isDirectory: () => false,
              isSymbolicLink: () => true,
              name,
            }))
          : [],
      realpath: (location: string) =>
        location === "/repo" ? "/physical/repo" : "/external/project",
      stat: (location: string) => {
        if (location === "/repo/alias-a" || location === "/repo/alias-b") {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (location.endsWith("/tsconfig.json")) {
          return { isDirectory: () => false, isFile: () => true };
        }
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
    }),
    {
      candidates: [
        "/repo/alias-a/tsconfig.json",
        "/repo/alias-b/tsconfig.json",
        "/repo/tsconfig.json",
      ],
      complete: true,
      files: [
        "/repo/alias-a/tsconfig.json",
        "/repo/alias-b/tsconfig.json",
        "/repo/tsconfig.json",
      ],
    },
    "independent lexical aliases of one physical project must both remain in the static key",
  );
  assert.deepEqual(
    findProjectTsconfigs("/repo", {
      platform: "linux",
      readdir: (location: string) =>
        location === "/repo"
          ? [
              {
                isDirectory: () => false,
                isSymbolicLink: () => true,
                name: "linked",
              },
            ]
          : [],
      realpath: (location: string) => {
        if (location === "/repo") throw new Error("identity unavailable");
        return "/external/project";
      },
      stat: (location: string) => {
        if (location === "/repo/linked") {
          return { isDirectory: () => true, isFile: () => false };
        }
        const error = new Error("missing") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
    }),
    {
      candidates: ["/repo/tsconfig.json"],
      complete: false,
      files: [],
    },
    "an unprovable ancestor identity must refuse linked traversal instead of risking a cycle",
  );
  assert.deepEqual(
    findProjectTsconfigs("/repo", {
      platform: "linux",
      readdir: (location: string) => {
        if (location === "/repo/packages") {
          throw new Error("unreadable directory");
        }
        return (directories.get(location) ?? []).map((name) => ({
          isDirectory: () => true,
          name,
        }));
      },
      stat: (location: string) => {
        if (configs.get(location) !== "file") {
          const error = new Error("missing") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
        return { isFile: () => true };
      },
    }),
    {
      candidates: ["/repo/tsconfig.json"],
      complete: false,
      files: ["/repo/tsconfig.json"],
    },
    "an unreadable subtree must refuse a complete reusable project map",
  );
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

    const project = path.join(root, "project");
    const app = path.join(project, "packages", "app");
    const ancestorConfig = path.join(project, "tsconfig.json");
    const childConfig = path.join(app, "tsconfig.json");
    fs.mkdirSync(app, { recursive: true });
    fs.writeFileSync(ancestorConfig, "{}\n", "utf8");
    fs.mkdirSync(childConfig);
    assert.equal(
      findNearestProjectTsconfig(app),
      ancestorConfig,
      "a directory named tsconfig.json must not shadow an ancestor file",
    );
    fs.rmSync(childConfig, { recursive: true });
    fs.symlinkSync(
      targetDirectory,
      childConfig,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(
      findNearestProjectTsconfig(app),
      ancestorConfig,
      "a directory link named tsconfig.json must not shadow an ancestor file",
    );
    fs.rmSync(childConfig, { recursive: true });
    fs.writeFileSync(childConfig, "{}\n", "utf8");
    assert.equal(
      findNearestProjectTsconfig(app),
      childConfig,
      "the nearest regular config file must win",
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
          realpath: { ok: true, path: path.resolve(brokenLink) },
          stat: "missing",
        }),
        [],
        "a broken link must remain distinguishable from a readable file or directory",
      );
      fs.rmSync(childConfig);
      fs.symlinkSync(targetFile, childConfig, "file");
      assert.equal(
        findNearestProjectTsconfig(app),
        childConfig,
        "a file link must win without losing its lexical config spelling",
      );
      fs.rmSync(childConfig);
      fs.symlinkSync(
        path.join(root, "missing-config.json"),
        childConfig,
        "file",
      );
      assert.equal(
        findNearestProjectTsconfig(app),
        ancestorConfig,
        "a broken config link must not shadow an ancestor file",
      );
    }
  } finally {
    fs.rmSync(root, { force: true, recursive: true });
  }
}

function state(
  value: IFilesystemState,
  platform: NodeJS.Platform = process.platform,
): TtscTransformFilesystemOperations {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const missing = (): never => {
    const error = new Error("missing") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  };
  const stats = {
    isDirectory: () => value.kind === "directory",
    isFile: () => value.kind === "file",
  };
  return {
    caseSensitive: () => true,
    exists: () => value.kind !== "missing",
    lstat: () => missing(),
    platform,
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
          pathApi.resolve(location) === pathApi.resolve(value.lexical))
      ) {
        return value.realpath;
      }
      return pathApi.resolve(location);
    },
    stat: () => (value.kind === "missing" ? missing() : (stats as never)),
    statBigInt: () => (value.kind === "missing" ? missing() : (stats as never)),
  };
}

function sha256(contents: Buffer): string {
  return crypto.createHash("sha256").update(contents).digest("hex");
}
