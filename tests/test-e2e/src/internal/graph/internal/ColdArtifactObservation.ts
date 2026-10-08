import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { matchesObservedProcessCommand } from "../../../../../utils/src/matchesObservedProcessCommand";

interface ProcessReading {
  pid: number;
  parent: number;
  identity: string;
  command: string | null;
  name: string;
}

interface BuildAdmission {
  invocation: string;
  instance: string;
  sequence: number;
  process: ProcessReading;
  targetOwner: ProcessReading;
  owner: ProcessReading;
  deadline: number;
  scratch: string;
  entry: string;
  guards: ObservedGuard[];
}

interface ObservedGuard {
  file: string;
  record: {
    taskToken: string;
    boundaryToken: string;
    state: string;
    retainedPaths: string[];
    generation?: string;
    completionNonce?: string;
  };
  identity: { dev: number; ino: number; birthtimeMs: number };
}

/**
 * Observe real process generations independently of producer success.
 *
 * The public owner supplies its original close contract. OS observations add a
 * separate conservative process observation, not a replacement native retirement
 * receipt. Inputs are sampled before process identities; apparent disappearance
 * while the original generation is still reported refuses release verification.
 * A process listing alone cannot certify its original kernel lifetime. Only this actor's tree
 * is retained in the observation log. Windows creation times and POSIX ps start
 * times qualify the original numeric identities; no process is terminated or
 * adopted by its PID here. POSIX ps has second precision, so it cannot replace
 * the original native receipt; ambiguous reuse cannot establish readiness.
 */
export class ColdArtifactObservation {
  private latest: ProcessReading[] = [];
  private readonly tracked = new Map<number, ProcessReading>();
  private failure: Error | undefined;
  private readonly child;
  private readonly closed: Promise<void>;
  private scanned = false;
  private inputs: { path: string; exists: boolean }[] = [];
  private readonly admissions: BuildAdmission[] = [];
  private observerClosed = false;
  private scannerClosed = false;
  private scanRequest: string | undefined;
  private incompleteAdmission = false;

  public constructor(
    private readonly rootPid: number,
    private readonly directory: string,
  ) {
    this.child = spawn(
      process.execPath,
      [
        path.resolve(
          import.meta.dirname,
          "../../../../fixtures/graph/cold-artifact-process-observer.cjs",
        ),
        path.join(directory, "observer.stop"),
      ],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
    );
    let buffer = "",
      stderr = "";
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      buffer += chunk;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const scan = JSON.parse(line) as {
            kind: string;
            rows: ProcessReading[];
            inputs: { path: string; exists: boolean }[];
            request: string | null;
          };
          if (scan.kind === "scanner-closed") {
            this.scannerClosed = true;
            continue;
          }
          assert.equal(scan.kind, "scan");
          this.latest = scan.rows;
          this.inputs = scan.inputs;
          this.scanRequest = scan.request ?? undefined;
          this.scanned = true;
          const root = scan.rows.find((row) => row.pid === rootPid);
          if (root && !this.tracked.has(rootPid))
            this.tracked.set(rootPid, root);
          let changed = true;
          while (changed) {
            changed = false;
            for (const row of scan.rows) {
              const parent = this.tracked.get(row.parent);
              if (
                !parent ||
                this.tracked.get(row.pid)?.identity === row.identity
              )
                continue;
              if (
                !scan.rows.some(
                  (live) =>
                    live.pid === parent.pid &&
                    live.identity === parent.identity,
                )
              )
                continue;
              this.tracked.set(row.pid, row);
              changed = true;
            }
          }
          // Preserve the offending observation even when an invariant below
          // rejects it; a failed assertion must not erase its own evidence.
          fs.appendFileSync(
            path.join(directory, "process-scans.jsonl"),
            JSON.stringify({
              request: scan.request,
              inputs: scan.inputs,
              rows: scan.rows.filter(
                (row) => this.tracked.get(row.pid)?.identity === row.identity,
              ),
            }) + "\n",
          );
          for (const admission of this.admissions) {
            if (
              !scan.rows.some((row) =>
                [
                  admission.process,
                  admission.targetOwner,
                  admission.owner,
                ].some(
                  (owner) =>
                    row.pid === owner.pid && row.identity === owner.identity,
                ),
              )
            )
              continue;
            for (const input of scan.inputs.filter(
              (input) =>
                input.path === admission.scratch ||
                input.path === admission.entry ||
                admission.guards.some((guard) => guard.file === input.path),
            ))
              assert.equal(
                input.exists,
                true,
                `Source/cache input released before original native owner joined: ${input.path}`,
              );
          }
        } catch (error) {
          this.failure =
            error instanceof Error ? error : new Error(String(error));
        }
      }
    });
    this.child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    this.closed = new Promise((resolve, reject) => {
      this.child.once("error", reject);
      this.child.once("close", (code) => {
        this.observerClosed = true;
        code === 0
          ? resolve()
          : reject(new Error(`Process observer exited ${code}: ${stderr}`));
      });
    });
    void this.closed.catch((error: unknown) => {
      this.failure = error instanceof Error ? error : new Error(String(error));
    });
  }

  public async ready(): Promise<void> {
    await this.until(
      () => this.scanned && this.tracked.has(this.rootPid),
      30_000,
      "OS observer did not acquire original root identity",
    );
  }

  /** Require live go build, exact key/scratch trace and real Go compiler work. */
  public async build(
    traceRoot: string,
    pluginCache: string,
    goTmp: string,
    excluded?: BuildAdmission,
    oldWork: ReadonlySet<string> = new Set(),
  ): Promise<BuildAdmission> {
    let admitted: BuildAdmission | undefined;
    const deadline = Date.now() + 120_000;
    await this.until(
      () => {
        const events = traceEvents(traceRoot);
        const keys = events.filter(
          (event) =>
            event.event === "capability-resolution" &&
            event.data?.phase === "plugin-build-environment-key-created",
        );
        const attempts = events.filter(
          (event) =>
            event.event === "process-attempt" &&
            event.argv?.[1] === "build" &&
            typeof event.invocation === "string" &&
            typeof event.instance === "string" &&
            typeof event.sequence === "number" &&
            event.invocation !== excluded?.invocation &&
            event.cwd !== excluded?.scratch &&
            (!excluded ||
              event.instance !== excluded.instance ||
              event.sequence > excluded.sequence) &&
            !events.some(
              (terminal) =>
                terminal.event === "process-result" &&
                terminal.invocation === event.invocation,
            ),
        );
        for (const key of keys) {
          if (typeof key.data?.key !== "string") continue;
          const sourceKey = key.data.key;
          const candidates = attempts.filter(
            (event) =>
              event.instance === key.instance &&
              event.sequence! > key.sequence! &&
              event.cwd?.includes(`ttsc-plugin-${sourceKey}-`) &&
              fs.existsSync(event.cwd),
          );
          assert.ok(
            candidates.length <= 1,
            "Multiple live source invocations cannot bind one observed Go command",
          );
          const scratch = candidates[0];
          if (!scratch || !fs.existsSync(scratch.cwd!)) continue;
          const entry = path.join(pluginCache, "plugins", key.data.key);
          assert.equal(
            fs.existsSync(
              path.join(
                entry,
                process.platform === "win32" ? "plugin.exe" : "plugin",
              ),
            ),
            false,
            "cold source profile already has a published executable",
          );
          const go = this.latest.find(
            (row) =>
              this.tracked.get(row.pid)?.identity === row.identity &&
              (!excluded ||
                row.pid !== excluded.process.pid ||
                row.identity !== excluded.process.identity) &&
              matchesObservedProcessCommand(row.command, scratch.argv!, process.platform),
          );
          const work = compilerWork(goTmp, oldWork);
          if (!go || !work) continue;
          const targetOwner = this.latest.find(
            (row) =>
              row.pid === go.parent &&
              this.tracked.get(row.pid)?.identity === row.identity &&
              row.command?.includes("__source-process"),
          );
          if (!targetOwner) continue;
          // Windows' inner waits for the target; its original outer owns the
          // Job and joins the whole tree before publishing retirement.
          const owner =
            process.platform === "win32"
              ? this.latest.find(
                  (row) =>
                    targetOwner.command?.includes(
                      "__source-process --inner ",
                    ) &&
                    row.pid === targetOwner.parent &&
                    this.tracked.get(row.pid)?.identity === row.identity &&
                    row.command?.includes("__source-process --result "),
                )
              : targetOwner;
          if (!owner) continue;
          // Malformed or unknown guards cannot turn an observed native reader
          // into permission to reclaim its source/cache inputs.
          this.incompleteAdmission = true;
          const scratchGuards = guardRecords(scratch.cwd!);
          const entryGuards = guardRecords(entry);
          const guards = scratchGuards.flatMap((first) => {
            const matched = entryGuards.filter(
              (next) =>
                next.record.taskToken === first.record.taskToken &&
                next.record.boundaryToken === first.record.boundaryToken,
            );
            return matched.length ? [first, ...matched] : [];
          });
          assert.ok(
            guards.length >= 2,
            "Actual admitted source/cache guards missing",
          );
          for (const guard of guards)
            assert.equal(guard.record.state, "pending");
          admitted = {
            invocation: scratch.invocation!,
            instance: scratch.instance!,
            sequence: scratch.sequence!,
            process: go,
            targetOwner,
            owner,
            deadline,
            scratch: scratch.cwd!,
            entry,
            guards,
          };
          this.admissions.push(admitted);
          const inputFile = path.join(this.directory, "observer-inputs.json");
          const temporary = `${inputFile}.tmp`;
          fs.writeFileSync(
            temporary,
            JSON.stringify([
              scratch.cwd!,
              entry,
              ...guards.map((guard) => guard.file),
            ]),
          );
          fs.renameSync(temporary, inputFile);
          fs.appendFileSync(
            path.join(this.directory, "actual-build-admissions.jsonl"),
            JSON.stringify({
              go,
              targetOwner,
              owner,
              key: key.data.key,
              invocation: scratch.invocation,
              instance: scratch.instance,
              sequence: scratch.sequence,
              argv: scratch.argv,
              cwd: scratch.cwd,
              work,
              entry,
              guards,
            }) + "\n",
          );
          return true;
        }
        return false;
      },
      120_000,
      "Actual cold go build/source key/compiler work admission was not observed",
    );
    await this.until(
      () =>
        this.inputs.some(
          (input) => input.path === admitted!.scratch && input.exists,
        ) &&
        this.inputs.some(
          (input) => input.path === admitted!.entry && input.exists,
        ) &&
        admitted!.guards.every((guard) =>
          this.inputs.some(
            (input) => input.path === guard.file && input.exists,
          ),
        ) &&
        this.latest.some(
          (row) =>
            row.pid === admitted!.process.pid &&
            row.identity === admitted!.process.identity,
        ),
      Math.max(1, Math.min(30_000, deadline - Date.now())),
      "Active original build and protected source/cache input snapshot were not observed together",
    );
    this.incompleteAdmission = false;
    return admitted!;
  }

  /** Require an OS query started after this caller's transport response. */
  public async active(admission: BuildAdmission): Promise<void> {
    const request = crypto.randomUUID();
    const file = path.join(this.directory, "observer-request.json");
    const temporary = `${file}.tmp`;
    fs.appendFileSync(
      path.join(this.directory, "active-observation-requests.jsonl"),
      JSON.stringify({ request, process: admission.process }) + "\n",
    );
    fs.writeFileSync(temporary, JSON.stringify({ request }));
    fs.renameSync(temporary, file);
    const remaining = admission.deadline - Date.now();
    assert.ok(remaining > 0, "Original cold preparation deadline expired");
    await this.until(
      () => this.scanRequest === request,
      Math.min(30_000, remaining),
      "OS observer did not start a new scan after the transport response",
    );
    assert.ok(
      this.latest.some(
        (row) =>
          row.pid === admission.process.pid &&
          row.identity === admission.process.identity,
      ),
      "A fresh post-response scan did not observe the original Go build active",
    );
  }

  public async absent(admission: BuildAdmission): Promise<void> {
    await this.until(
      () => {
        const live = this.latest.some((row) =>
          [admission.process, admission.targetOwner, admission.owner].some(
            (owner) => row.pid === owner.pid && row.identity === owner.identity,
          ),
        );
        if (live)
          for (const input of this.inputs)
            assert.equal(
              input.exists,
              true,
              `Source/cache input released before original native owner joined: ${input.path}`,
            );
        return !live;
      },
      30_000,
      "Original admitted native source-process owner remains alive",
    );
  }

  public async joined(): Promise<void> {
    await this.until(
      () =>
        !this.latest.some(
          (row) => this.tracked.get(row.pid)?.identity === row.identity,
        ),
      30_000,
      "Original actor or observed descendants remain alive",
    );
  }

  /** Check original resources after the public owner settles its input lease. */
  public async retired(admission: BuildAdmission): Promise<void> {
    const failures: unknown[] = [];
    try {
      await this.until(
        () =>
          !fs.existsSync(admission.scratch) &&
          admission.guards.every((guard) => !fs.existsSync(guard.file)),
        30_000,
        "Original task scratch or admitted native guards were not released",
      );
      this.unpublished(admission);
    } catch (error) {
      failures.push(error);
    }
    try {
      fs.appendFileSync(
        path.join(this.directory, "resource-release.jsonl"),
        JSON.stringify({
          at: new Date().toISOString(),
          invocation: admission.invocation,
          scratch: {
            path: admission.scratch,
            exists: fs.existsSync(admission.scratch),
          },
          guards: admission.guards.map((guard) => ({
            ...guard,
            exists: fs.existsSync(guard.file),
            current: fs.existsSync(guard.file)
              ? fs.readFileSync(guard.file, "utf8")
              : null,
          })),
        }) + "\n",
      );
    } catch (error) {
      failures.push(error);
    }
    if (failures.length)
      throw new AggregateError(
        failures,
        "Original resource release was not confirmed",
      );
  }

  /** A partially observed admission cannot authorize input reclamation. */
  public get hasIncompleteAdmission(): boolean {
    return this.incompleteAdmission;
  }

  public unpublished(admission: BuildAdmission): void {
    assert.equal(
      fs.existsSync(
        path.join(
          admission.entry,
          process.platform === "win32" ? "plugin.exe" : "plugin",
        ),
      ),
      false,
      "Cancelled source key published a late executable",
    );
  }

  /** Both original actors must acknowledge closure, even after an error exit. */
  public get isJoined(): boolean {
    return this.observerClosed && this.scannerClosed;
  }

  public async close(): Promise<void> {
    this.child.stdin.end();
    await bounded(this.closed, 30_000, "OS observer did not close");
    if (this.failure) throw this.failure;
  }

  private async until(
    predicate: () => boolean,
    milliseconds: number,
    label: string,
  ): Promise<void> {
    const deadline = Date.now() + milliseconds;
    while (true) {
      if (this.failure) throw this.failure;
      if (predicate()) return;
      if (Date.now() >= deadline) throw new Error(label);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

/** Preserve the caller's finite bound without manufacturing producer success. */
export async function bounded<T>(
  operation: Promise<T>,
  milliseconds: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

interface TraceEvent {
  event: string;
  invocation?: string;
  instance?: string;
  sequence?: number;
  argv?: string[];
  cwd?: string;
  data?: { phase?: string; key?: string };
}
function traceEvents(root: string): TraceEvent[] {
  const result: TraceEvent[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
    const text = fs.readFileSync(path.join(root, entry.name), "utf8");
    for (const line of text
      .slice(0, text.lastIndexOf("\n") + 1)
      .split("\n")
      .filter(Boolean))
      result.push(JSON.parse(line));
  }
  return result;
}

function guardRecords(root: string): ObservedGuard[] {
  const directory = path.join(root, ".ttsc-native-retirements");
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const file = path.join(directory, name);
      const record = JSON.parse(
        fs.readFileSync(file, "utf8"),
      ) as ObservedGuard["record"];
      assert.equal(typeof record.taskToken, "string");
      assert.equal(typeof record.boundaryToken, "string");
      assert.ok(record.retainedPaths.includes(root));
      const { dev, ino, birthtimeMs } = fs.statSync(file);
      return { file, record, identity: { dev, ino, birthtimeMs } };
    });
}

function compilerWork(
  root: string,
  oldWork: ReadonlySet<string>,
): string | undefined {
  for (const work of fs.readdirSync(root, { withFileTypes: true })) {
    if (
      !work.isDirectory() ||
      !work.name.startsWith("go-build") ||
      oldWork.has(work.name)
    )
      continue;
    const directory = path.join(root, work.name);
    for (const task of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!task.isDirectory()) continue;
      for (const name of ["importcfg", "_pkg_.a", "importcfg.link"]) {
        const marker = path.join(directory, task.name, name);
        if (fs.existsSync(marker) && fs.statSync(marker).size > 0)
          return marker;
      }
    }
  }
  return undefined;
}

/**
 * Exchange identity is process-specific; no content from another session
 * counts.
 */
export function artifactExchanges(pid: number): string[] {
  return fs
    .readdirSync(os.tmpdir())
    .filter((name) => name.startsWith(`ttsc-graph-artifacts-${pid}-`));
}
