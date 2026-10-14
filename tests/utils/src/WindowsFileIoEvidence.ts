/**
 * Select passive Windows filesystem evidence for one original cold-build task. Provider metadata is validated by the recorder before these normalized rows arrive. Pointer addresses and numeric process IDs are reused, so missing starts, ambiguous reuse and unobserved completion remain unknown.
 *
 * @evidence contracts/common.md#principled-implementation Original task paths and qualified process births select evidence; chronological Create and OperationEnd rows qualify pointer lifetimes without treating missing Close as a live handle.
 * @evidence contracts/common.md#clear-and-simple-design One selector separates task path admission, pointer correlation and issuer generation attribution from native recorder lifecycle.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Event-header PIDs, elapsed time and absent events do not manufacture owner or retirement proof; unrelated file/process rows are omitted.
 * @evidence contracts/common.md#meaningful-documentation Native prose states validated-schema premises, pointer reuse and unknown observations; members describe normalized input and returned evidence.
 * @evidence contracts/portability.md#os-neutral-implementation The Windows recorder supplies actual QueryDosDevice mappings and provider fields; this selector performs no native operation or OS-default case folding.
 * @evidence contracts/performance.md#efficient-algorithms Members own chronological correlation work; the grouping itself runs no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every task gets its own event population and correlation state.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace owns no global state or handles; each selection owns its transient maps and returned evidence.
 */
export namespace WindowsFileIoEvidence {
  /**
   * A provider event decoded by its actual named XML fields.
   *
   * @evidence contracts/common.md#principled-implementation Provider, event revision, time and named scalar fields preserve the recorder's validated schema without using positional property guesses.
   * @evidence contracts/common.md#clear-and-simple-design One row representation carries only fields used by process/thread and file-operation correlation.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Header PID is retained as diagnostic context, never accepted as issuing-owner authority.
   * @evidence contracts/common.md#meaningful-documentation Members identify event coordinates and provider-decoded fields.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This data representation invokes no native primitive.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The type chooses no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A row represents one observation rather than a reusable result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The recorder and selector own event retention, not this type.
   */
  export interface Event {
    /** Validated kernel provider family. */
    provider: "file" | "process";

    /** Actual provider event identifier. */
    id: number;

    /** Template revision validated against the installed provider schema. */
    version: number;

    /** UTC time from the event XML, retained without inventing precision. */
    at: string;

    /** Header PID is diagnostic context and may be the kernel process. */
    headerPid: number;

    /** Named XML fields selected by the recorder's validated template. */
    fields: Record<string, string>;
  }

  /**
   * Original task identity and independently observed process generations.
   *
   * @evidence contracts/common.md#principled-implementation The cold scenario supplies its admitted task token, scratch and process birth observations; device mappings come from the recorder's actual native query.
   * @evidence contracts/common.md#clear-and-simple-design One input binds lexical event paths to the original task and retains independent process-generation anchors.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A task token or PID alone does not certify a process birth or pointer lifetime.
   * @evidence contracts/common.md#meaningful-documentation Members identify observed device aliases, original birth identity and trace completeness limits.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation These inputs carry native observations without making a native call.
   * @evidenceExclude contracts/performance.md#efficient-algorithms The representation executes no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each task has independent correlation premises.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller owns task data and recorder storage.
   */
  export interface Task {
    /** Exact source task token observed at its original admission. */
    token: string;

    /** Original task's physical scratch root used to select connected paths. */
    scratch: string;

    /** Original actor/native-owner generations; identity is an observed UTC birth. */
    processes: readonly { pid: number; identity: string }[];

    /** Observed DOS drive and native-device prefix pairs. */
    devices: readonly { dos: string; native: string }[];

    /** Read-only CIM births sampled before the original task starts. */
    before?: { at: string; processes: readonly { pid: number; birth: string; name: string }[] };

    /** An unmeasured loss count remains null and prevents absence claims. */
    loss: { eventsLost: number | null; possibleWrap: boolean; decodingFailed: boolean };
  }

  /**
   * Select task operations and explicitly connected issuer-generation evidence.
   *
   * Names admit a FileObject lifetime; subsequent operations and their IRPs belong only to that lifetime until a later Create reuses the address. OperationEnd follows the exact preceding IRP, while missing or reused IRPs remain unknown. Successful Close completion is observed data, never an assertion that other handles or readers are absent. Equal boundary timestamps and clock reversal leave attribution unqualified; chronological delivery cannot break ties between events from separate CPUs.
   *
   * @evidence contracts/common.md#principled-implementation Actual named provider fields and device mappings admit task paths. Non-null unsigned 64-bit pointers retain exact hexadecimal identity, unsigned 32-bit statuses preserve raw radix and validated UTC fractions retain nanosecond comparison precision. Strict process/thread intervals qualify issuer births independently of header PIDs; tied boundaries, pointer reuse, malformed time and reversed delivery produce unknown rows instead of ordering guesses.
   * @evidence contracts/common.md#clear-and-simple-design One event fold owns FileObject/IRP lifetime maps and process/thread intervals; output contains task rows, their connected owner evidence and completeness limits.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unrelated Creates invalidate reused addresses without exporting their paths. No absent event, decoded Close alone, PID, diagnostic receipt or pointer value certifies an active or absent reader.
   * @evidence contracts/common.md#meaningful-documentation Prose explains Create admission, IRP correlation, missing/reused intervals and the limits of successful Close evidence.
   * @evidence contracts/portability.md#os-neutral-implementation Supplied native device mappings select equivalent event spellings; native path text is kept and case is never folded under an unmeasured policy. Named schema fields distinguish issuing threads from header PIDs.
   * @evidence contracts/performance.md#efficient-algorithms One pass over E rows retains last lifecycle times for observed pointers/PIDs/TIDs, process/thread intervals and selected operations; path admission visits aliases and path text. Interval lookup visits a queried thread/process history. Transient maps can grow with E because unrelated pointer reuse must invalidate task attribution; returned rows contain selected events and their supporting owners.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each event population is processed under its own task, device mapping and completeness premises.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Maps and selected rows belong to one call; returned evidence transfers to the caller. No native handle or global state is retained, and selected-event/history populations have no internal count cap.
   */
  export function select(events: Iterable<Event>, task: Task) {
    const aliases = [task.scratch.replaceAll("/", "\\")];
    for (const device of task.devices)
      if (aliases[0]!.startsWith(device.dos + "\\"))
        aliases.push(device.native + aliases[0]!.slice(device.dos.length));
    const paths = (value: string | undefined) => value !== undefined && aliases.some((root) => value === root || value.startsWith(root + "\\"));
    const objects = new Map<string, { generation: string; created: Event; closing?: string }>();
    const requests = new Map<string, { generation: string | null; event: Event; object?: string; close: boolean }>();
    const processes = new Map<number, { birth: string; started: string; ended?: string; rows: Event[] }[]>();
    const threads = new Map<number, { pid: number; birth?: string; started: string; ended?: string; rows: Event[] }[]>();
    const selected: { event: Event; objectGeneration: string | null; objectPointer?: string; issuingThread: number | null; issuingAt?: string; owner: unknown; completion?: string; completionDecoded?: unknown; uncertainty?: string }[] = [];
    const uncertainties = new Set<string>();
    const lastTimes = new Map<Event["provider"], bigint>();
    const ambiguousObjects = new Set<string>(), ambiguousRequests = new Set<string>();
    const objectTimes = new Map<string, bigint>(), requestTimes = new Map<string, bigint>();
    const processTimes = new Map<number, bigint>(), threadTimes = new Map<number, bigint>();
    const ambiguousProcesses = new Set<number>(), ambiguousThreads = new Set<number>();
    let reversedTime = false;
    for (const process of task.before?.processes ?? [])
      processes.set(process.pid, [{ birth: process.birth, started: task.before!.at, rows: [] }]);
    let sequence = 0;
    for (const event of events) {
      const fields = event.fields;
      const eventTime = instant(event.at), previousTime = lastTimes.get(event.provider);
      if (eventTime === undefined || (previousTime !== undefined && eventTime < previousTime)) {
        reversedTime = true;
        uncertainties.add("Native time or chronological delivery is unqualified");
      }
      if (eventTime !== undefined) lastTimes.set(event.provider, eventTime);
      if (event.provider === "process") {
        const pid = Number(fields.ProcessID);
        const id = event.id === 1 || event.id === 2 ? pid : Number(fields.ThreadID);
        const times = event.id === 1 || event.id === 2 ? processTimes : threadTimes;
        const ambiguous = event.id === 1 || event.id === 2 ? ambiguousProcesses : ambiguousThreads;
        if (eventTime !== undefined && Number.isSafeInteger(id) && event.id >= 1 && event.id <= 4) {
          if (times.get(id) === eventTime) {
            ambiguous.add(id);
            uncertainties.add("Process or thread lifecycle endpoints share an unordered native timestamp");
          }
          times.set(id, eventTime);
        }
        if (event.id === 1 && Number.isSafeInteger(pid) && fields.CreateTime) {
          const rows = processes.get(pid) ?? [];
          if (rows.at(-1)?.birth === fields.CreateTime) {
            rows.at(-1)!.started = event.at;
            rows.at(-1)!.rows.push(event);
            continue;
          }
          if (rows.at(-1)?.ended === undefined && rows.length) rows.at(-1)!.ended = event.at;
          rows.push({ birth: fields.CreateTime, started: event.at, rows: [event] });
          processes.set(pid, rows);
        } else if (event.id === 2) {
          const current = processes.get(pid)?.at(-1);
          if (current !== undefined && current.birth === fields.CreateTime) { current.ended = event.at; current.rows.push(event); }
        } else if (event.id === 3) {
          const tid = Number(fields.ThreadID);
          if (!Number.isSafeInteger(tid) || !Number.isSafeInteger(pid)) continue;
          const rows = threads.get(tid) ?? [];
          if (rows.at(-1)?.ended === undefined && rows.length) rows.at(-1)!.ended = event.at;
          const owners = (processes.get(pid) ?? []).filter((owner) => within(event.at, owner.started, owner.ended));
          rows.push({ pid, birth: owners.length === 1 ? owners[0]!.birth : undefined, started: event.at, rows: [event] });
          threads.set(tid, rows);
        } else if (event.id === 4) {
          const current = threads.get(Number(fields.ThreadID))?.at(-1);
          if (current?.pid === pid) { current.ended = event.at; current.rows.push(event); }
        }
        continue;
      }
      const object = pointer(fields.FileObject);
      const irp = pointer(fields.Irp);
      if (eventTime !== undefined) {
        if (object !== undefined) {
          if (objectTimes.get(object) === eventTime) {
            ambiguousObjects.add(object);
            uncertainties.add("FileObject lifecycle endpoints share an unordered native timestamp");
          }
          objectTimes.set(object, eventTime);
        }
        if (irp !== undefined) {
          if (requestTimes.get(irp) === eventTime) {
            ambiguousRequests.add(irp);
            uncertainties.add("IRP lifecycle endpoints share an unordered native timestamp");
          }
          requestTimes.set(irp, eventTime);
        }
      }
      if (event.id === 12 && object) {
        if (objects.has(object)) uncertainties.add("FileObject reused; the previous lifetime's unobserved ending is unknown");
        objects.delete(object);
        if (paths(fields.FileName)) objects.set(object, { generation: `${object}:${++sequence}:${event.at}`, created: event });
      }
      if (event.id === 24) {
        const request = irp === undefined ? undefined : requests.get(irp);
        if (request === undefined) continue;
        const requestTime = instant(request.event.at);
        if (eventTime !== undefined && request.object !== undefined && request.object !== object) {
          if (objectTimes.get(request.object) === eventTime) {
            ambiguousObjects.add(request.object);
            uncertainties.add("FileObject operation and completion share an unordered native timestamp");
          }
          objectTimes.set(request.object, eventTime);
        }
        if (eventTime === undefined || requestTime === undefined || eventTime <= requestTime) {
          ambiguousRequests.add(irp!);
          uncertainties.add("IRP admission and completion have ambiguous native time");
        }
        requests.delete(irp!);
        const tid = Number(request.event.fields.IssuingThreadId ?? request.event.fields.ThreadId);
        selected.push({ event, objectGeneration: request.generation, objectPointer: request.object, issuingThread: Number.isSafeInteger(tid) ? tid : null, issuingAt: request.event.at, owner: null, completion: fields.Status ?? "unknown", completionDecoded: decodeStatus(fields.Status) });
        if (request.close && fields.Status !== undefined && nativeSuccess(fields.Status)) {
          if (request.object && objects.get(request.object)?.generation === request.generation) objects.delete(request.object);
        }
        continue;
      }
      const lifetime = object === undefined ? undefined : objects.get(object);
      const named = paths(fields.FileName) || paths(fields.FilePath);
      if (lifetime === undefined && !named) {
        if (irp && requests.delete(irp)) { ambiguousRequests.add(irp); uncertainties.add("IRP reused outside the selected task before completion"); }
        continue;
      }
      const generation = lifetime?.generation ?? null;
      const tid = Number(fields.IssuingThreadId ?? fields.ThreadId);
      selected.push({ event, objectGeneration: generation, objectPointer: object, issuingThread: Number.isSafeInteger(tid) ? tid : null, owner: null,
        ...(generation === null ? { uncertainty: "Create lifetime not observed" } : {}),
      });
      if (generation === null) uncertainties.add("Selected path has no observed Create lifetime");
      if (irp) {
        if (requests.has(irp)) { ambiguousRequests.add(irp); uncertainties.add("IRP reused before observed completion"); }
        requests.set(irp, { generation, event, object, close: event.id === 14 });
      }
    }
    const support = new Set<Event>();
    for (const row of selected) {
      const object = row.objectPointer, irp = pointer(row.event.fields.Irp);
      if (reversedTime || (object !== undefined && ambiguousObjects.has(object)) || (irp !== undefined && ambiguousRequests.has(irp))) {
        row.objectGeneration = null;
        row.uncertainty = "Native time or pointer delivery order is ambiguous";
        row.owner = { certainty: "unknown", reason: "Native time or pointer delivery order is ambiguous" };
        continue;
      }
      if (row.issuingThread === null) {
        row.owner = { certainty: "unknown", reason: "Issuing OS thread was not observed" };
        uncertainties.add("Issuing OS thread was not observed");
        continue;
      }
      // Completion can arrive after the issuing thread exits. Attribute the
      // request at admission, rather than treating the completion as issuance.
      const issuingAt = row.issuingAt ?? row.event.at;
      const matchingThreads = (threads.get(row.issuingThread) ?? []).filter((thread) => within(issuingAt, thread.started, thread.ended));
      const thread = matchingThreads.length === 1 ? matchingThreads[0] : undefined;
      const matchingProcesses = thread === undefined ? [] : (processes.get(thread.pid) ?? []).filter((process) => process.birth === thread.birth && within(issuingAt, process.started, process.ended));
      const process = matchingProcesses.length === 1 ? matchingProcesses[0] : undefined;
      if (ambiguousThreads.has(row.issuingThread) || (thread !== undefined && ambiguousProcesses.has(thread.pid))) {
        row.objectGeneration = null;
        row.owner = { certainty: "unknown", reason: "Issuer lifecycle endpoints share an unordered native timestamp" };
        row.uncertainty = "Issuer lifecycle endpoints share an unordered native timestamp";
        continue;
      }
      if (!thread || !process) {
        row.owner = { certainty: "unknown", reason: "Issuing thread or process generation was not observed" };
        uncertainties.add("Issuing thread or process generation was not observed");
        continue;
      }
      // ETW uses Win32 thread IDs. Source-cleanup receipts use Node's logical
      // worker threadId, which supplies no OS-thread identity for this join.
      row.owner = { certainty: "observed", pid: thread.pid, birth: process.birth, nativeThreadId: row.issuingThread, threadStarted: thread.started,
        // A missing anchor match does not prove that this issuer is foreign.
        original: task.processes.some((original) => original.pid === thread.pid && sameBirth(original.identity, process.birth)),
      };
      for (const event of [...thread.rows, ...process.rows]) support.add(event);
    }
    if (requests.size) uncertainties.add("OperationEnd not observed for selected IRPs");
    if (task.loss.eventsLost === null) uncertainties.add("Lost-event count unavailable");
    else if (task.loss.eventsLost > 0) uncertainties.add("Trace reports lost events");
    if (task.loss.possibleWrap) uncertainties.add("Circular trace may have overwritten earlier events");
    if (task.loss.decodingFailed) uncertainties.add("Trace decoding was incomplete");
    return { taskToken: task.token, scratch: task.scratch, originalProcesses: task.processes, selected, supportingProcessEvents: [...support],
      loss: task.loss, uncertainty: [...uncertainties], completeness: uncertainties.size ? "unknown" : "observed-events-only",
      readerAbsence: "not-established",
    };
  }
}

/** Compare event times only when their actual UTC values parse. */
function within(at: string, lower: string, upper?: string): boolean {
  const value = instant(at), start = instant(lower), end = upper === undefined ? undefined : instant(upper);
  // ProcessTrace can deliver equal timestamps from separate CPUs in arbitrary
  // order. Neither endpoint qualifies an old or newly reused generation.
  return value !== undefined && start !== undefined && value > start && (upper === undefined || (end !== undefined && value < end));
}

/** Exact observed birth instants can connect independently supplied PID anchors. */
function sameBirth(left: string, right: string): boolean {
  const first = instant(left), second = instant(right);
  return first !== undefined && first === second;
}

/** Preserve observed fractional precision instead of collapsing births to milliseconds. */
function instant(value: string): bigint | undefined {
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?(?:Z|\+00:00)$/.exec(value);
  if (!match) return undefined;
  const seconds = Date.parse(match[1]! + "Z");
  return Number.isFinite(seconds) && new Date(seconds).toISOString().slice(0, 19) === match[1]
    ? BigInt(seconds) * 1000000n + BigInt((match[2] ?? "").padEnd(9, "0")) : undefined;
}

/** NTSTATUS success has its sign bit clear; malformed statuses stay unqualified. */
function nativeSuccess(status: string): boolean {
  return decodeStatus(status).ntSuccess === true;
}

/** Preserve the raw status beside exact unsigned 32-bit decoding, or explicit unavailability. */
function decodeStatus(value: string | undefined) {
  try {
    if (value === undefined || !/^(?:0[xX][0-9a-fA-F]+|\d+)$/.test(value)) return { unsigned: null, ntSuccess: null };
    const status = BigInt(value);
    return status >= 0n && status <= 0xffffffffn
      ? { unsigned: status.toString(), ntSuccess: status < 0x80000000n }
      : { unsigned: null, ntSuccess: null };
  } catch { return { unsigned: null, ntSuccess: null }; }
}

/** Keep 64-bit native pointer identity exact across hexadecimal and decimal XML forms. */
function pointer(value: string | undefined): string | undefined {
  if (value === undefined || !/^(?:0[xX][0-9a-fA-F]+|\d+)$/.test(value)) return undefined;
  try { const address = BigInt(value); return address > 0n && address <= 0xffffffffffffffffn ? address.toString(16) : undefined; }
  catch { return undefined; }
}
