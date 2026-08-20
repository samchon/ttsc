import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { readLogLines } from "./logLines";

const require_ = createRequire(import.meta.url);
const graphLib = path.dirname(require_.resolve("@ttsc/graph"));

/** The resident client, loaded from the built package the product ships. */
const { TtscLintDaemon } = require_(
  path.join(graphLib, "model", "TtscLintDaemon.js"),
) as {
  TtscLintDaemon: new (
    target: { binary: string; manifest: string; projectContext?: string },
    cwd: string,
    tsconfig: string,
  ) => ITtscLintDaemon;
};

/** What a case may ask of one open sidecar. */
export interface ITtscLintDaemon {
  ask(verb: string, invalidate: boolean): Promise<string | null>;
  close(): void;
}

export interface ITtscLintDaemonFixture {
  /** The directory the sidecar runs in, where it records what it saw. */
  root: string;
  daemon: ITtscLintDaemon;
}

/**
 * Opens a daemon against a stand-in sidecar.
 *
 * `mode` picks the sidecar generation: `serve` answers the stream, `no-serve`
 * is one built before `lsp-serve` existed and rejects the subcommand outright.
 * `rejectVerb` is the narrower case on top of `serve`, a sidecar that answers
 * the stream and does not know one verb on it.
 */
export function createLintDaemonFixture(options: {
  mode: "serve" | "no-serve";
  rejectVerb?: string;
  projectContext?: string;
}): ITtscLintDaemonFixture {
  const root = TestProject.tmpdir("ttsc-lint-daemon-");
  fs.writeFileSync(
    path.join(root, "lint-daemon-fake.json"),
    JSON.stringify({
      mode: options.mode,
      rejectVerb: options.rejectVerb ?? "",
    }),
    "utf8",
  );
  const daemon = new TtscLintDaemon(
    {
      binary: resolveLintDaemonFake(),
      manifest: '[{"name":"@ttsc/lint","stage":"check"}]',
      ...(options.projectContext === undefined
        ? {}
        : { projectContext: options.projectContext }),
    },
    root,
    "tsconfig.json",
  );
  return { daemon, root };
}

/** The flags the sidecar was spawned with, one entry per spawn. */
export function readSidecarArguments(root: string): string[][] {
  return readLogLines(path.join(root, "sidecar-arguments.log")).map(
    (line) => JSON.parse(line) as string[],
  );
}

/** Every request line the sidecar received, in order. */
export function readSidecarRequests(root: string): Record<string, unknown>[] {
  return readLogLines(path.join(root, "sidecar-requests.log")).map(
    (line) => JSON.parse(line) as Record<string, unknown>,
  );
}

let fakeBinary: string | undefined;

function resolveLintDaemonFake(): string {
  if (fakeBinary !== undefined) return fakeBinary;
  const output = TestProject.tmpdir("ttsc-lint-daemon-fake-");
  const binary = path.join(
    output,
    process.platform === "win32" ? "lint-daemon-fake.exe" : "lint-daemon-fake",
  );
  const source = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests",
    "test-graph",
    "src",
    "internal",
    "lintDaemonFake",
    "main.go",
  );
  const result = TestProject.spawn("go", ["build", "-o", binary, source]);
  if (result.status !== 0) {
    throw new Error(
      `failed to build lint daemon fake (${String(result.status)})\n${result.stderr ?? ""}`,
    );
  }
  fakeBinary = binary;
  return binary;
}
