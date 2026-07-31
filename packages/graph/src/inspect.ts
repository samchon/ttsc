import { TtscGraphApplication } from "./TtscGraphApplication";
import { printInspectHelp } from "./help";
import {
  GraphArgumentError,
  type ILauncherOption,
  type IProjectOptions,
  nonNegativeIntegerOption,
  positiveIntegerOption,
  projectOptions,
} from "./launcherArgs";
import { TtscGraphSession } from "./model/TtscGraphSession";
import { ITtscGraphApplication } from "./structures/ITtscGraphApplication";

type ParsedValue = string | boolean;

interface IInspectOption extends ILauncherOption {
  multiple?: boolean;
}

interface IParsedInspectArgs {
  values: ReadonlyMap<string, ParsedValue>;
  multiples: ReadonlyMap<string, readonly string[]>;
  positionals: readonly string[];
}

interface IInspectInvocation {
  project: IProjectOptions;
  pretty: boolean;
  props: ITtscGraphApplication.IProps;
}

const SHARED_OPTIONS = [
  { key: "cwd", flags: ["--cwd"], kind: "value" },
  { key: "tsconfig", flags: ["--tsconfig", "-p"], kind: "value" },
  { key: "pretty", flags: ["--pretty"], kind: "flag" },
] as const satisfies readonly IInspectOption[];

/**
 * Run one semantic graph request outside MCP.
 *
 * This is deliberately a one-shot session: a shell invocation cannot reuse the
 * resident compiler process that an MCP client keeps open, but it does answer
 * from the same current compiler snapshot and application contract.
 */
export async function runInspect(argv: readonly string[]): Promise<number> {
  if (argv[0] === "help" || argv.includes("--help") || argv.includes("-h")) {
    printInspectHelp();
    return 0;
  }
  const invocation = parseInvocation(argv);
  const session = new TtscGraphSession(invocation.project);
  try {
    const output = await new TtscGraphApplication(() =>
      session.graph(),
    ).inspect_typescript_graph(invocation.props);
    process.stdout.write(
      `${JSON.stringify(output, undefined, invocation.pretty ? 2 : undefined)}\n`,
    );
    return 0;
  } finally {
    session.close();
  }
}

function parseInvocation(argv: readonly string[]): IInspectInvocation {
  const command = argv[0];
  if (command === undefined) {
    throw new GraphArgumentError(
      "inspect requires a request; run 'ttsc-graph inspect --help' for usage",
    );
  }
  const parsed = parseInspectArgs(argv.slice(1), optionsFor(command));
  const project = projectOptions(parsed.values);
  const pretty = parsed.values.get("pretty") === true;
  const build = (
    question: string,
    request: ITtscGraphApplication.IProps["request"],
  ): IInspectInvocation => ({
    project,
    pretty,
    props: {
      question,
      draft: {
        reason:
          "The CLI request maps directly to the smallest graph operation.",
        type: request.type,
      },
      review: "Confirmed: run the CLI-selected graph request.",
      request,
    },
  });

  switch (command) {
    case "overview": {
      expectPositionals(command, parsed.positionals, 0);
      const aspect = choice(parsed.values, "aspect", [
        "all",
        "layers",
        "hotspots",
        "publicApi",
      ] as const);
      return build("Summarize the project's compiler-resolved architecture.", {
        type: "overview",
        ...(aspect === undefined ? {} : { aspect }),
      });
    }
    case "entrypoints": {
      const question = expectPositionals(command, parsed.positionals, 1)[0]!;
      return build(question, {
        type: "entrypoints",
        query: question,
        ...optionalPositive(parsed.values, "limit", 8),
        ...optionalNonNegative(parsed.values, "neighbors", 2),
      });
    }
    case "lookup": {
      const query = expectPositionals(command, parsed.positionals, 1)[0]!;
      return build(query, {
        type: "lookup",
        query,
        ...optionalPositive(parsed.values, "limit", 6),
        ...(parsed.values.get("include_external") === true
          ? { includeExternal: true }
          : {}),
      });
    }
    case "details": {
      const handles = expectAtLeastOnePositional(command, parsed.positionals);
      return build(`Inspect ${handles.join(", ")}.`, {
        type: "details",
        handles: [...handles],
        ...(parsed.values.get("neighbors") === true ? { neighbors: true } : {}),
        ...optionalPositive(parsed.values, "neighbor_limit", 3),
        ...optionalPositive(
          parsed.values,
          "member_limit",
          Number.MAX_SAFE_INTEGER,
        ),
        ...optionalPositive(parsed.values, "dependency_limit", 4),
        ...(parsed.values.get("include_external") === true
          ? { includeExternal: true }
          : {}),
      });
    }
    case "trace": {
      const from = expectPositionals(command, parsed.positionals, 1)[0]!;
      const to = stringOption(parsed.values, "to");
      const direction = choice(parsed.values, "direction", [
        "forward",
        "reverse",
        "impact",
      ] as const);
      const focus = choice(parsed.values, "focus", [
        "all",
        "execution",
        "types",
      ] as const);
      const maxDepth = optionalPositive(
        parsed.values,
        "max_depth",
        to === undefined && direction === "impact"
          ? 4
          : to === undefined
            ? 8
            : 12,
      );
      const maxNodes = optionalPositive(
        parsed.values,
        "max_nodes",
        direction === "impact" ? 16 : 32,
      );
      return build(`Trace ${from}${to === undefined ? "" : ` to ${to}`}.`, {
        type: "trace",
        from,
        ...(to === undefined ? {} : { to }),
        ...(direction === undefined ? {} : { direction }),
        ...(focus === undefined ? {} : { focus }),
        ...maxDepth,
        ...maxNodes,
        ...(parsed.values.get("include_external") === true
          ? { includeExternal: true }
          : {}),
      });
    }
    case "tour": {
      const question = expectPositionals(command, parsed.positionals, 1)[0]!;
      return build(question, {
        type: "tour",
        reinterpretations: [...(parsed.multiples.get("hint") ?? [])],
        ...optionalPositive(parsed.values, "limit", 5),
        ...(parsed.values.get("no_tests") === true
          ? { includeTests: false }
          : {}),
      });
    }
    default:
      throw new GraphArgumentError(
        `unknown inspect request ${command}; run 'ttsc-graph inspect --help' for usage`,
      );
  }
}

function optionsFor(command: string): readonly IInspectOption[] {
  switch (command) {
    case "overview":
      return [
        ...SHARED_OPTIONS,
        { key: "aspect", flags: ["--aspect"], kind: "value" },
      ];
    case "entrypoints":
      return [
        ...SHARED_OPTIONS,
        { key: "limit", flags: ["--limit"], kind: "value" },
        { key: "neighbors", flags: ["--neighbors"], kind: "value" },
      ];
    case "lookup":
      return [
        ...SHARED_OPTIONS,
        { key: "limit", flags: ["--limit"], kind: "value" },
        {
          key: "include_external",
          flags: ["--include-external"],
          kind: "flag",
        },
      ];
    case "details":
      return [
        ...SHARED_OPTIONS,
        { key: "neighbors", flags: ["--neighbors"], kind: "flag" },
        {
          key: "neighbor_limit",
          flags: ["--neighbor-limit"],
          kind: "value",
        },
        {
          key: "member_limit",
          flags: ["--member-limit"],
          kind: "value",
        },
        {
          key: "dependency_limit",
          flags: ["--dependency-limit"],
          kind: "value",
        },
        {
          key: "include_external",
          flags: ["--include-external"],
          kind: "flag",
        },
      ];
    case "trace":
      return [
        ...SHARED_OPTIONS,
        { key: "to", flags: ["--to"], kind: "value" },
        { key: "direction", flags: ["--direction"], kind: "value" },
        { key: "focus", flags: ["--focus"], kind: "value" },
        { key: "max_depth", flags: ["--max-depth"], kind: "value" },
        { key: "max_nodes", flags: ["--max-nodes"], kind: "value" },
        {
          key: "include_external",
          flags: ["--include-external"],
          kind: "flag",
        },
      ];
    case "tour":
      return [
        ...SHARED_OPTIONS,
        { key: "hint", flags: ["--hint"], kind: "value", multiple: true },
        { key: "limit", flags: ["--limit"], kind: "value" },
        { key: "no_tests", flags: ["--no-tests"], kind: "flag" },
      ];
    default:
      return SHARED_OPTIONS;
  }
}

function parseInspectArgs(
  argv: readonly string[],
  definitions: readonly IInspectOption[],
): IParsedInspectArgs {
  const flags = new Map<string, IInspectOption>();
  for (const definition of definitions) {
    for (const flag of definition.flags) flags.set(flag, definition);
  }

  const values = new Map<string, ParsedValue>();
  const multiples = new Map<string, string[]>();
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    const parsed = matchOption(arg, flags);
    if (parsed === undefined) {
      if (arg.startsWith("-"))
        throw new GraphArgumentError(`unknown option ${arg}`);
      positionals.push(arg);
      continue;
    }
    const { definition, flag, inline } = parsed;
    if (definition.kind !== "value") {
      if (inline !== undefined)
        throw new GraphArgumentError(`${flag} does not take a value`);
      values.set(definition.key, true);
      continue;
    }
    const value = inline ?? argv[++i];
    if (value === undefined || value.startsWith("-")) {
      throw new GraphArgumentError(`${flag} requires a non-empty value`);
    }
    if (value.trim() === "") {
      throw new GraphArgumentError(`${flag} requires a non-empty value`);
    }
    if (definition.multiple === true) {
      const list = multiples.get(definition.key) ?? [];
      list.push(value);
      multiples.set(definition.key, list);
    } else {
      values.set(definition.key, value);
    }
  }
  return { values, multiples, positionals };
}

function matchOption(
  arg: string,
  flags: ReadonlyMap<string, IInspectOption>,
): { definition: IInspectOption; flag: string; inline?: string } | undefined {
  const exact = flags.get(arg);
  if (exact !== undefined) return { definition: exact, flag: arg };
  for (const [flag, definition] of flags) {
    const prefix = `${flag}=`;
    if (arg.startsWith(prefix)) {
      return { definition, flag, inline: arg.slice(prefix.length) };
    }
  }
  return undefined;
}

function expectPositionals(
  command: string,
  positionals: readonly string[],
  count: number,
): readonly string[] {
  if (positionals.length !== count) {
    throw new GraphArgumentError(
      `inspect ${command} requires ${String(count)} positional argument${count === 1 ? "" : "s"}`,
    );
  }
  if (positionals.some((value) => value.trim() === "")) {
    throw new GraphArgumentError(
      `inspect ${command} requires non-empty arguments`,
    );
  }
  return positionals;
}

function expectAtLeastOnePositional(
  command: string,
  positionals: readonly string[],
): readonly string[] {
  if (
    positionals.length === 0 ||
    positionals.some((value) => value.trim() === "")
  ) {
    throw new GraphArgumentError(
      `inspect ${command} requires at least one handle`,
    );
  }
  return positionals;
}

function optionalPositive(
  values: ReadonlyMap<string, ParsedValue>,
  key: string,
  maximum: number,
): Record<string, number> {
  return values.has(key)
    ? { [camelCase(key)]: positiveIntegerOption(values, key, maximum) }
    : {};
}

function optionalNonNegative(
  values: ReadonlyMap<string, ParsedValue>,
  key: string,
  maximum: number,
): Record<string, number> {
  return values.has(key)
    ? { [camelCase(key)]: nonNegativeIntegerOption(values, key, maximum) }
    : {};
}

function choice<T extends string>(
  values: ReadonlyMap<string, ParsedValue>,
  key: string,
  options: readonly T[],
): T | undefined {
  const value = stringOption(values, key);
  if (value === undefined) return undefined;
  if ((options as readonly string[]).includes(value)) return value as T;
  throw new GraphArgumentError(
    `--${key.replaceAll("_", "-")} must be one of ${options.join(", ")}`,
  );
}

function stringOption(
  values: ReadonlyMap<string, ParsedValue>,
  key: string,
): string | undefined {
  const value = values.get(key);
  return typeof value === "string" ? value : undefined;
}

function camelCase(key: string): string {
  return key.replace(/_([a-z])/g, (_match, letter: string) =>
    letter.toUpperCase(),
  );
}
