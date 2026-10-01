import assert from "node:assert/strict";
import type { ITtscGraphDump } from "../../../../../packages/graph/src/structures/ITtscGraphDump";
import type { ITtscGraphSnapshot } from "../../../../../packages/graph/src/structures/ITtscGraphSnapshot";
import type { TtscGraphLinePeer } from "../../../../../packages/graph/src/model/TtscGraphLinePeer";
import { TtscGraphProtocol } from "../../../../../packages/graph/src/model/TtscGraphProtocol";
import { TtscGraphSessionState } from "../../../../../packages/graph/src/model/TtscGraphSessionState";
import { DUMP_SCHEMA_VERSION } from "../../../../../packages/graph/src/model/loadGraph";

/** Recorded declared transport operations; it generates no response or line. */
export interface StatePort {
  peer: TtscGraphLinePeer.Connection;
  events: TtscGraphLinePeer.Events;
  writes: Record<string, unknown>[];
  retirement: boolean[];
  diagnostic: string;
  live: boolean;
}

/** Exercise authored state with explicit caller-supplied typed envelopes/events. */
export function sessionState() {
  const ports: StatePort[] = [];
  let closed = 0;
  let artifact = "";
  const session = new TtscGraphSessionState({
    decode: TtscGraphProtocol.decode,
    beforeRequest: async () => undefined,
    artifacts: () => artifact,
    close: () => { closed++; },
    open: (events) => {
      const port: StatePort = { events, writes: [], retirement: [], diagnostic: "", live: true, peer: undefined! };
      port.peer = {
        get stderr() { return port.diagnostic; },
        alive: () => port.live,
        write: (line, done) => { port.writes.push(JSON.parse(line)); done(); },
        close: (terminate) => { port.retirement.push(terminate); if (terminate) port.live = false; },
      };
      ports.push(port);
      return port.peer;
    },
  });
  return { session, ports, closed: () => closed, setArtifacts: (value: string) => { artifact = value; } };
}

/** Wait for queue admission without a clock, process, file or generated peer. */
export async function admitted(ports: StatePort[], writes = 1): Promise<StatePort> {
  for (let turn = 0; turn < 20; turn++) {
    const port = ports.at(-1);
    if (port !== undefined && port.live && port.writes.length >= writes) return port;
    await Promise.resolve();
  }
  assert.fail("state queue did not admit the expected request");
}

/** Complete current request using the original empty valid full-dump input. */
export function emptyResponse(id: number, changed = true): ITtscGraphSnapshot {
  const dump: ITtscGraphDump = {
    project: "/fixture", tsconfig: "tsconfig.json",
    provenance: { schemaVersion: DUMP_SCHEMA_VERSION, capabilities: [], producer: { tool: "state-input", version: "test", typescript: "test" }, universe: { configs: [], roots: [] }, sources: [] },
    nodes: [], edges: [], diagnostics: [],
  };
  return { id, protocolVersion: 1, mode: changed ? "initial" : "unchanged", capabilities: [], changed, ...(changed ? { dump } : {}) };
}

export function pendingCount(session: TtscGraphSessionState): number {
  return (session as unknown as { pending: Map<number, unknown> }).pending.size;
}

/** Assert peer retirement exactly once, independent of kernel adapter coverage. */
export function assertRetired(port: StatePort): void {
  assert.equal(port.live, false);
  assert.deepEqual(port.retirement, [false, true]);
}
