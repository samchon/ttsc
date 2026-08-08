import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EvidenceBenchmarkRuntime } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkRuntime";

/**
 * Verifies isolation never severs a thread that already exists.
 *
 * A Codex home is not only configuration. The rollout a resume replays and the
 * Goal state the runner reconciles against both live inside it, in separate
 * stores, and neither can be read from anywhere else. So handing a run that
 * already owns a thread a fresh directory does not isolate that run, it ends
 * it: the resume asks for a thread that, from where it now stands, was never
 * created.
 *
 * Isolation arrived mid-cohort and did exactly that. The first cell resumed
 * after it stopped with `no rollout found for thread id`; seeding the rollout by
 * hand moved the failure to `Retained state has no exact empty Goal boundary`,
 * because the Goal store is a different file and was equally empty. Both
 * symptoms, one cause, and the run was two objectives from finishing.
 *
 * 1. A run with no retained session is isolated, whether or not it is a fork.
 * 2. A run that already owns a thread, and has no isolated home of its own,
 *    keeps the home that thread lives in.
 * 3. A run that already owns a thread and does have an isolated home keeps
 *    that one, so isolation survives every resume after the first.
 */
export const test_benchmark_runtime_keeps_an_existing_thread_in_its_own_home =
  (): void => {
    const credential: string = path.join(os.homedir(), ".codex", "auth.json");
    if (!fs.existsSync(credential)) return; // Not logged in; the guard has its own case.
    const operatorHome: string = path.join(os.homedir(), ".codex");

    const root: string = fs.mkdtempSync(
      path.join(os.tmpdir(), "evidence-home-adopt-"),
    );
    try {
      // Step 1: no retained session, so this run's thread is created here.
      const fresh: string = EvidenceBenchmarkRuntime.prepareCodexHome(
        path.join(root, "fresh"),
      );
      if (path.resolve(fresh) === path.resolve(operatorHome))
        throw new Error(
          "A run with no thread of its own must be isolated; it returned the operator's home.",
        );
      if (!fs.existsSync(path.join(fresh, "config.toml")))
        throw new Error("An isolated home must carry the generated configuration.");

      // Step 2: a retained session with no isolated home beside it. The thread
      // predates isolation, so the home it lives in is the only one that holds
      // its rollout and its Goal state.
      const adopted: string = EvidenceBenchmarkRuntime.prepareCodexHome(
        path.join(root, "retained"),
        "019fd289-2dad-7982-b0fc-118955e08129",
      );
      if (path.resolve(adopted) !== path.resolve(operatorHome))
        throw new Error(
          `A run that already owns a thread must keep the home that thread lives in, got: ${adopted}`,
        );
      // Nothing may be written into the operator's home on the way past. It is
      // not this runner's to configure, and overwriting the real `config.toml`
      // would replace the operator's MCP table with the cell's.
      if (fs.existsSync(path.join(root, "retained", "codex-home")))
        throw new Error(
          "Adopting a thread's home must not also create the isolated one it declined to use.",
        );

      // Step 3: the same retained session, once an isolated home exists. Every
      // resume after the first must stay isolated rather than falling back.
      const isolatedRoot: string = path.join(root, "already");
      fs.mkdirSync(path.join(isolatedRoot, "codex-home"), { recursive: true });
      const kept: string = EvidenceBenchmarkRuntime.prepareCodexHome(
        isolatedRoot,
        "019fd289-2dad-7982-b0fc-118955e08129",
      );
      if (path.resolve(kept) !== path.resolve(path.join(isolatedRoot, "codex-home")))
        throw new Error(
          `A run launched under isolation must keep it on every later resume, got: ${kept}`,
        );
      if (!fs.existsSync(path.join(kept, "config.toml")))
        throw new Error(
          "A kept isolated home must still be given the generated configuration.",
        );
    } finally {
      fs.rmSync(root, { force: true, recursive: true });
    }
  };
