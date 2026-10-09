/**
 * One OS process-list reading, including its original creation representation.
 *
 * Windows identities are UTC CIM creation dates formatted with seven fractional
 * digits. Linux/Darwin identities are C-locale ps lstart values observed in UTC,
 * with second precision. Neither representation is a held kernel lifetime.
 *
 * @evidence contracts/common.md#principled-implementation PID and numeric parent remain separate from the creation identity; a parent number alone cannot identify its original generation.
 * @evidence contracts/common.md#clear-and-simple-design The record retains the scanner's existing identity, parent and diagnostic command fields without introducing a second process protocol.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No process name or command grants ancestry or native retirement authority.
 * @evidence contracts/common.md#meaningful-documentation Native prose states platform representations, precision and the absence of a kernel lifetime certificate; fields explain each observation.
 * @evidence contracts/portability.md#os-neutral-implementation The caller's scanner supplies UTC Windows CIM or UTC C-locale POSIX ps identities; command text remains an uninterpreted observation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms This record declares values without executing a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A reading does not own reusable computation.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The observation owner retains records; this type acquires no native resource.
 */
export interface ObservedProcessReading {
  /** Numeric process ID at this observation, subject to later reuse. */
  pid: number;

  /** Numeric creator ID, which may now name another generation. */
  parent: number;

  /** Creation representation of this process generation, not its parent. */
  identity: string;

  /** Optional displayed command, used separately for source-build admission. */
  command: string | null;

  /** Displayed executable name, with no ancestry or lifetime authority. */
  name: string;
}

/**
 * Extend an observed tree only through current, possible parent generations.
 *
 * The original root identity is acquired once. Existing tracked children may
 * remain observable after their parent exits. A clearly older proposed child
 * cannot belong to a newer parent generation, as documented by Win32_Process.
 * Equal creation values remain possible edges, including coarse POSIX seconds.
 * Relevant invalid identities or duplicate PIDs fail observation explicitly.
 *
 * Creation comparison is an API-supported stale-parent heuristic. It neither
 * proves parentage nor certifies kernel retirement, and two records cannot
 * establish arbitrary clock adjustments. The caller still owns original native
 * completion, unknown-state retention and observer disposal.
 *
 * @evidence contracts/common.md#principled-implementation A current identity match qualifies each retained parent before birth ordering rejects a clearly older child. Validated fixed-width UTC keys preserve Windows fractional digits and POSIX whole seconds without Date millisecond truncation; equal values retain ambiguity. Original root identity is never replaced, and invalid relevant metadata fails instead of manufacturing an empty joined tree.
 * @evidence contracts/common.md#clear-and-simple-design One pure update owns ancestry admission; a current PID index and parent adjacency lists support a queue seeded by still-observed tracked generations. Private creation parsing owns the two actual scanner formats.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The operation has no name allowlist, PID action, timeout, guessed successful closure or fixture exception. Timestamp ordering supplies only a stale-parent rejection guard, not native lifetime authority.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain original-root retention, orphan observations, equal/unknown handling and clock/lifetime limits; related scanner prose owns UTC production.
 * @evidence contracts/portability.md#os-neutral-implementation The explicit host platform selects Windows UTC round-trip or Linux/Darwin UTC C-locale lstart parsing. Gregorian field validation rejects malformed values, and POSIX second ties remain possible ancestry. Other platform formats are unsupported rather than guessed with locale-dependent Date.parse.
 * @evidence contracts/performance.md#efficient-algorithms Indexing R readings and T retained generations, then visiting each current queued PID and child edge once takes O(R+T) collection work plus identity text parsing. Only relevant birth keys are parsed and reused within this snapshot; temporary indexes use O(R+T) space.
 * @evidence contracts/performance.md#reuse-equivalent-work The caller's tracked map preserves previously admitted generation observations. Every update rechecks current identity membership and parses current relevant creation values; local birth keys cannot authorize reuse across scans.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the historical tracked map until observer disposal; this function retains no state or native handle after returning. A malformed relevant row can leave partial observations in that map, so its thrown error must remain an observation failure rather than release authority.
 */
export function updateObservedProcessTree(
  tracked: Map<number, ObservedProcessReading>,
  rootPid: number,
  rows: readonly ObservedProcessReading[],
  platform: NodeJS.Platform,
): void {
  const current = new Map<number, ObservedProcessReading>();
  const children = new Map<number, ObservedProcessReading[]>();
  const duplicates = new Set<number>();
  const births = new Map<ObservedProcessReading, string>();
  const birth = (row: ObservedProcessReading): string => {
    let value = births.get(row);
    if (value === undefined) {
      value = processCreation(row, platform);
      births.set(row, value);
    }
    return value;
  };
  const unique = (pid: number): void => {
    if (duplicates.has(pid))
      throw new Error(`Ambiguous observed process generation for PID ${pid}`);
  };
  for (const row of rows) {
    if (current.has(row.pid)) duplicates.add(row.pid);
    current.set(row.pid, row);
    let siblings = children.get(row.parent);
    if (siblings === undefined) children.set(row.parent, (siblings = []));
    siblings.push(row);
  }
  const root = current.get(rootPid);
  if (root !== undefined) {
    unique(rootPid);
    birth(root);
    if (!tracked.has(rootPid)) tracked.set(rootPid, root);
  }
  const pending: ObservedProcessReading[] = [];
  for (const row of tracked.values()) {
    const live = current.get(row.pid);
    if (live === undefined) continue;
    unique(live.pid);
    birth(live);
    if (live.identity === row.identity) pending.push(row);
  }
  const visited = new Set<number>();
  for (let index = 0; index < pending.length; ++index) {
    const parent = pending[index]!;
    if (visited.has(parent.pid)) continue;
    visited.add(parent.pid);
    unique(parent.pid);
    const parentBirth = birth(parent);
    for (const child of children.get(parent.pid) ?? []) {
      if (child.pid === rootPid) continue;
      unique(child.pid);
      if (birth(child) < parentBirth) continue;
      if (tracked.get(child.pid)?.identity !== child.identity)
        tracked.set(child.pid, child);
      pending.push(tracked.get(child.pid)!);
    }
  }
}

/** Validate the scanner's calendar representation before lexical UTC ordering. */
function processCreation(
  row: ObservedProcessReading,
  platform: NodeJS.Platform,
): string {
  const invalid = (): never => {
    throw new Error(
      `Unknown ${platform} process creation identity for PID ${row.pid}`,
    );
  };
  if (
    !Number.isSafeInteger(row.pid) ||
    row.pid <= 0 ||
    typeof row.identity !== "string"
  )
    return invalid();
  let match: RegExpExecArray | null;
  let year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number;
  let fraction = "0000000";
  let weekday: string | undefined;
  if (platform === "win32") {
    match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{7})Z$/.exec(
      row.identity,
    );
    if (match === null) return invalid();
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
    hour = Number(match[4]);
    minute = Number(match[5]);
    second = Number(match[6]);
    fraction = match[7]!;
  } else if (platform === "linux" || platform === "darwin") {
    match = /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) {1,2}(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/.exec(
      row.identity,
    );
    if (match === null) return invalid();
    weekday = match[1]!;
    month = MONTHS.indexOf(match[2]!) + 1;
    day = Number(match[3]);
    hour = Number(match[4]);
    minute = Number(match[5]);
    second = Number(match[6]);
    year = Number(match[7]);
  } else return invalid();
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    year < 1 || year > 9999 || month < 1 || month > 12 ||
    day < 1 || day > days[month - 1]! || hour > 23 || minute > 59 || second > 59
  )
    return invalid();
  if (weekday !== undefined) {
    const calendar = new Date(0);
    calendar.setUTCFullYear(year, month - 1, day);
    if (WEEKDAYS[calendar.getUTCDay()] !== weekday) return invalid();
  }
  const two = (value: number): string => String(value).padStart(2, "0");
  return `${String(year).padStart(4, "0")}-${two(month)}-${two(day)}T${two(hour)}:${two(minute)}:${two(second)}.${fraction}Z`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
