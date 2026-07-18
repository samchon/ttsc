import { TtscGraphSession } from "@ttsc/graph";
import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

const DUMP_SCHEMA_VERSION = 3;
let fakeBinary: string | undefined;

export interface NativeSessionFixture {
  root: string;
  session: TtscGraphSession;
}

export function createNativeSessionFixture(options: {
  mode: string;
  requestTimeoutMs: number;
  stderr?: string;
  delayMs?: number;
}): NativeSessionFixture {
  const root = TestProject.tmpdir("ttscgraph-native-session-");
  fs.writeFileSync(
    path.join(root, "native-session-fake.json"),
    JSON.stringify({
      mode: options.mode,
      stderr: options.stderr ?? "",
      delayMs: options.delayMs ?? 0,
      schemaVersion: DUMP_SCHEMA_VERSION,
    }),
    "utf8",
  );
  return {
    root,
    session: new TtscGraphSession({
      cwd: root,
      tsconfig: "tsconfig.json",
      binary: resolveNativeSessionFake(),
      requestTimeoutMs: options.requestTimeoutMs,
    }),
  };
}

export function pendingCount(session: TtscGraphSession): number {
  return (
    session as unknown as {
      pending: Map<number, unknown>;
    }
  ).pending.size;
}

export function readPids(root: string): number[] {
  const file = path.join(root, "pids.log");
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(Number);
}

export function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

export async function waitFor(
  predicate: () => boolean,
  description: string,
  timeoutMs = 5_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${description}`);
    }
    await delay(20);
  }
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveNativeSessionFake(): string {
  if (fakeBinary !== undefined) return fakeBinary;
  const output = TestProject.tmpdir("ttscgraph-native-session-fake-");
  const binary = path.join(
    output,
    process.platform === "win32"
      ? "native-session-fake.exe"
      : "native-session-fake",
  );
  const source = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests",
    "test-graph",
    "src",
    "internal",
    "nativeSessionFake",
    "main.go",
  );
  const result = TestProject.spawn("go", ["build", "-o", binary, source]);
  if (result.status !== 0) {
    throw new Error(
      `failed to build native session fake (${String(result.status)})\n${result.stderr ?? ""}`,
    );
  }
  fakeBinary = binary;
  return binary;
}
