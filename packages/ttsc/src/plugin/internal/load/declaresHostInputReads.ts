import path from "node:path";

/**
 * Whether a descriptor declared the state of every file it read outside its
 * module graph, so an answer computed from its evaluation can be proven by what
 * the evaluation recorded (samchon/ttsc#1561).
 *
 * The declaration is `hostInputHashes`: a descriptor that returns it names each
 * file it read with the state it read it in, `{}` when it read none. Nothing
 * else can vouch for the reads a descriptor leaves out. Node's permission model
 * reports a read it would deny only through `--permission-audit`, which no Node
 * 22 release has; without it a denial the descriptor catches looks, to its
 * answer, like a file that is absent. An answer from a descriptor without the
 * declaration holds only for the evaluation that produced it.
 *
 * A `hostInputs` entry without a fingerprint is a declared input whose state
 * the descriptor could not prove, the way the protocol reports contradictory
 * observations, so it leaves the answer unproven too.
 */
export function declaresHostInputReads(descriptor: unknown): boolean {
  if (
    typeof descriptor !== "object" ||
    descriptor === null ||
    Array.isArray(descriptor)
  )
    return false;
  const { hostInputHashes, hostInputs } = descriptor as {
    hostInputHashes?: unknown;
    hostInputs?: unknown;
  };
  if (
    typeof hostInputHashes !== "object" ||
    hostInputHashes === null ||
    Array.isArray(hostInputHashes)
  )
    return false;
  if (hostInputs === undefined) return true;
  if (!Array.isArray(hostInputs)) return false;
  const fingerprinted = new Set(
    Object.keys(hostInputHashes).map((file) => path.resolve(file)),
  );
  return hostInputs.every(
    (input) =>
      typeof input === "string" && fingerprinted.has(path.resolve(input)),
  );
}
