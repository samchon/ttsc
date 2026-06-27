import fs from "node:fs";
import path from "node:path";

import { TtscGraphMemory } from "../model/TtscGraphMemory";
import { ITtscGraphDecorator } from "../structures/ITtscGraphDecorator";
import { ITtscGraphEdge } from "../structures/ITtscGraphEdge";
import { ITtscGraphEvidence } from "../structures/ITtscGraphEvidence";
import { ITtscGraphExpand } from "../structures/ITtscGraphExpand";
import { ITtscGraphNode } from "../structures/ITtscGraphNode";
import { accessAliasesFor } from "./accessAliases";
import { resolveGraphHandle } from "./resolveHandle";

// A whole declaration body can be large, so the full source is opt-in and capped
// when asked for; the default response carries only the declared shape.
const MAX_SOURCE_LINES = 200;
// A signature is the declaration head up to the body brace: a handful of lines.
const MAX_SIGNATURE_LINES = 6;
// Neighbor lists are a map, not a dump; keep them scannable.
const DEFAULT_NEIGHBORS = 12;
const MAX_NEIGHBORS = 40;
const SOURCE_NEIGHBORS = 3;
const MAX_FLOW_DEPTH = 3;
const MAX_FLOW_PATHS = 4;
// A container's outline can be long (a big class); keep it bounded.
const MAX_MEMBERS = 80;
// Structural relationships are navigation, not the dependency picture expand is for.
const STRUCTURAL_KINDS = new Set<string>(["contains", "exports", "imports"]);
// Kinds whose value is their member outline, not a source body.
const CONTAINER_KINDS = new Set<string>([
  "class",
  "interface",
  "namespace",
  "module",
  "enum",
  "file",
]);

/**
 * Resolve each handle to its declared shape: its signature, and for a container
 * the outline of its members, and only when asked, its full source body. This
 * is the graph's edge over a plain file read: it answers from the resolved
 * structure it already holds, so the agent reads compact shape, not inlined
 * code, unless it explicitly needs a body's logic.
 */
export function runExpand(
  graph: TtscGraphMemory,
  props: ITtscGraphExpand.IProps,
): ITtscGraphExpand {
  const wantSource = props.source === true;
  const neighborLimit = bound(
    props.neighborLimit,
    DEFAULT_NEIGHBORS,
    1,
    MAX_NEIGHBORS,
  );
  const effectiveNeighborLimit =
    wantSource && props.neighbors === true
      ? Math.min(neighborLimit, SOURCE_NEIGHBORS)
      : neighborLimit;
  const nodes: ITtscGraphExpand.INode[] = [];
  const unknown: string[] = [];
  for (const handle of props.handles) {
    const resolved = resolveGraphHandle(graph, handle);
    if (resolved.node === undefined) {
      unknown.push(handle);
      continue;
    }
    const node = resolved.node;
    const expanded: ITtscGraphExpand.INode = {
      id: node.id,
      name: node.qualifiedName ?? node.name,
      kind: node.kind,
      file: node.file,
    };
    if (node.evidence?.startLine) expanded.line = node.evidence.startLine;
    const sig = signatureOf(graph.project, node);
    if (sig !== undefined) expanded.signature = sig;
    const signatureLiterals = literalSummaries(sig);
    const decorators = decoratorsOf(node);
    if (decorators !== undefined) expanded.decorators = decorators;
    if (node.implementation !== undefined)
      expanded.implementation = node.implementation;
    const calls = dependencySummaries(graph, node, executionKinds, 8);
    if (calls.length > 0) expanded.calls = calls;
    const flow = executionFlow(graph, node);
    if (flow.length > 0) expanded.flow = flow;
    const types = dependencySummaries(graph, node, typeKinds, 8);
    if (types.length > 0) expanded.types = types;
    if (CONTAINER_KINDS.has(node.kind)) {
      const list = members(graph, node);
      if (list.length > 0) expanded.members = list;
    }
    let source:
      | {
          file: string;
          text: string;
          truncated: boolean;
          startLine: number;
          endLine: number;
        }
      | undefined;
    if (wantSource) {
      source = readSource(graph.project, node);
      if (source !== undefined) {
        expanded.source = source.text;
        const literals = uniqueStrings([
          ...signatureLiterals,
          ...literalSummaries(source.text),
        ]).slice(0, 12);
        if (literals.length > 0) expanded.literals = literals;
        expanded.sourceSpan = {
          file: source.file,
          startLine: source.startLine,
          endLine: source.endLine,
        };
        if (source.truncated) expanded.truncated = true;
      }
    } else if (signatureLiterals.length > 0) {
      expanded.literals = signatureLiterals.slice(0, 12);
    }
    if (props.neighbors === true) {
      expanded.dependsOn = refs(
        graph,
        graph.outgoing(node.id),
        "to",
        effectiveNeighborLimit,
        source,
      );
      expanded.dependedOnBy = refs(
        graph,
        graph.incoming(node.id),
        "from",
        effectiveNeighborLimit,
        source,
      );
    }
    nodes.push(expanded);
  }
  const answerChecklist = answerChecklistOf(nodes);
  const finalAnswerChecklist =
    answerChecklist === undefined
      ? []
      : finalAnswerChecklistOf(answerChecklist);
  const answerFacts = answerFactsOf(nodes);
  const result = {} as ITtscGraphExpand;
  if (finalAnswerChecklist.length > 0)
    result.finalAnswerChecklist = finalAnswerChecklist;
  if (answerChecklist !== undefined) result.answerChecklist = answerChecklist;
  if (answerFacts.length > 0) result.answerFacts = answerFacts;
  result.nodes = nodes;
  result.unknown = unknown;
  return result;
}

/** The members a container owns (via `contains`), each with its own signature. */
function members(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
): ITtscGraphExpand.IMember[] {
  const out: ITtscGraphExpand.IMember[] = [];
  for (const edge of graph.outgoing(node.id)) {
    if (edge.kind !== "contains") continue;
    const member = graph.node(edge.to);
    if (member === undefined) continue;
    const m: ITtscGraphExpand.IMember = {
      name: member.qualifiedName ?? member.name,
      kind: member.kind,
    };
    if (member.evidence?.startLine) m.line = member.evidence.startLine;
    const sig = signatureOf(graph.project, member);
    if (sig !== undefined) m.signature = sig;
    const decorators = decoratorsOf(member);
    if (decorators !== undefined) m.decorators = decorators;
    out.push(m);
    if (out.length >= MAX_MEMBERS) break;
  }
  return out;
}

/** Map dependency edges to references on their far endpoint, dropping structure. */
function refs(
  graph: TtscGraphMemory,
  edges: readonly ITtscGraphEdge[],
  end: "to" | "from",
  limit: number,
  coveredSource?: {
    file: string;
    startLine: number;
    endLine: number;
  },
): ITtscGraphExpand.IReference[] {
  const ranked: Array<{ ref: ITtscGraphExpand.IReference; rank: number }> = [];
  for (const edge of edges) {
    if (STRUCTURAL_KINDS.has(edge.kind)) continue;
    const other = graph.node(end === "to" ? edge.to : edge.from);
    if (other === undefined) continue;
    const ref: ITtscGraphExpand.IReference = {
      id: other.id,
      name: other.qualifiedName ?? other.name,
      kind: other.kind,
      file: other.file,
      relation: edge.kind,
    };
    if (other.evidence?.startLine) ref.line = other.evidence.startLine;
    const rawEvidence = edgeEvidenceOf(edge);
    const evidence = edgeEvidenceForExpand(edge, coveredSource);
    if (evidence !== undefined) ref.evidence = evidence;
    const aliases = accessAliasesFor(other, rawEvidence?.text);
    if (aliases !== undefined) ref.aliases = aliases;
    ranked.push({ ref, rank: refRank(ref, edge) });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  const out: ITtscGraphExpand.IReference[] = [];
  for (const item of ranked) {
    out.push(item.ref);
    if (out.length >= limit) break;
  }
  return out;
}

const executionKinds = new Set(["calls", "instantiates", "renders"]);
const typeKinds = new Set([
  "type_ref",
  "extends",
  "implements",
  "overrides",
]);

function dependencySummaries(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  kinds: ReadonlySet<string>,
  limit: number,
): string[] {
  const ranked: Array<{ text: string; rank: number }> = [];
  for (const edge of graph.outgoing(node.id)) {
    if (!kinds.has(edge.kind)) continue;
    const other = graph.node(edge.to);
    if (other === undefined || other.kind === "file") continue;
    const name = other.qualifiedName ?? other.name;
    const aliases = accessAliasesFor(other, edge.evidence?.text);
    const aliasText =
      aliases === undefined || aliases.length === 0
        ? name
        : `${aliases[0]} -> ${name}${aliases.length > 1 ? ` aliases ${aliases.slice(1).join(", ")}` : ""}`;
    ranked.push({
      text: aliasText,
      rank: refRank(
        {
          id: other.id,
          name,
          kind: other.kind,
          file: other.file,
          relation: edge.kind,
        },
        edge,
      ),
    });
  }
  ranked.sort((a, b) => a.rank - b.rank);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of ranked) {
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    out.push(item.text);
    if (out.length >= limit) break;
  }
  return out;
}

function executionFlow(graph: TtscGraphMemory, node: ITtscGraphNode): string[] {
  const found: Array<{ text: string; depth: number; order: number }> = [];
  let order = 0;
  const queue: Array<{
    id: string;
    depth: number;
    path: string[];
    seen: Set<string>;
  }> = [
    {
      id: node.id,
      depth: 0,
      path: [node.qualifiedName ?? node.name],
      seen: new Set([node.id]),
    },
  ];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= MAX_FLOW_DEPTH) continue;
    const edges = graph
      .outgoing(current.id)
      .filter((edge) => executionKinds.has(edge.kind))
      .map((edge) => ({
        edge,
        rank: edgeKindRank(edge.kind) * 100_000 + evidenceRank(edge),
      }))
      .sort((a, b) => a.rank - b.rank);
    for (const { edge } of edges) {
      const other = graph.node(edge.to);
      if (other === undefined || other.kind === "file") continue;
      if (current.seen.has(other.id)) continue;
      const label = dependencyLabel(graph, other, edge);
      const path = [...current.path, label];
      found.push({ text: path.join(" -> "), depth: current.depth + 1, order });
      order++;
      queue.push({
        id: other.id,
        depth: current.depth + 1,
        path,
        seen: new Set([...current.seen, other.id]),
      });
    }
  }
  found.sort((a, b) => b.depth - a.depth || a.order - b.order);
  return found.slice(0, MAX_FLOW_PATHS).map((item) => item.text);
}

function dependencyLabel(
  graph: TtscGraphMemory,
  node: ITtscGraphNode,
  edge: ITtscGraphEdge,
): string {
  const name = signatureLabel(graph, node);
  const aliases = accessAliasesFor(node, edge.evidence?.text);
  if (aliases === undefined || aliases.length === 0) return name;
  const extra = aliases.length > 1 ? ` aliases ${aliases.slice(1).join(", ")}` : "";
  return `${aliases[0]} -> ${name}${extra}`;
}

function signatureLabel(graph: TtscGraphMemory, node: ITtscGraphNode): string {
  const name = node.qualifiedName ?? node.name;
  if (node.kind !== "method" && node.kind !== "function") return name;
  const params = signatureParams(signatureOf(graph.project, node));
  return params === undefined ? name : `${name}(${params})`;
}

function signatureParams(signature: string | undefined): string | undefined {
  if (signature === undefined) return undefined;
  const open = signature.indexOf("(");
  if (open < 0) return undefined;
  let depth = 0;
  for (let i = open; i < signature.length; i++) {
    const ch = signature[i];
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) {
        const text = signature
          .slice(open + 1, i)
          .replace(/\s+/g, " ")
          .replace(/\s*,\s*/g, ", ")
          .replace(/,\s*$/, "")
          .trim();
        if (text === "") return "";
        return text.length > 140 ? `${text.slice(0, 137).trim()}...` : text;
      }
    }
  }
  return undefined;
}

function answerFactsOf(nodes: ITtscGraphExpand.INode[]): string[] {
  const out: string[] = [];
  const push = (fact: string): void => {
    if (out.length < 12 && !out.includes(fact)) out.push(fact);
  };
  for (const node of nodes) {
    for (const flow of node.flow?.slice(0, 2) ?? []) {
      push(`${node.name} flow: ${flow}`);
    }
    if (node.calls !== undefined && node.calls.length > 0) {
      push(`${node.name} calls: ${node.calls.slice(0, 6).join(", ")}`);
    }
    if (node.types !== undefined && node.types.length > 0) {
      push(`${node.name} types: ${node.types.slice(0, 6).join(", ")}`);
    }
    if (node.sourceSpan !== undefined) {
      const span =
        node.sourceSpan.endLine === undefined
          ? `${node.sourceSpan.file}:${node.sourceSpan.startLine}`
          : `${node.sourceSpan.file}:${node.sourceSpan.startLine}-${node.sourceSpan.endLine}`;
      push(`${node.name} source: ${span}`);
    }
  }
  return out;
}

function answerChecklistOf(
  nodes: ITtscGraphExpand.INode[],
): ITtscGraphExpand.IAnswerChecklist | undefined {
  const exactIdentifiers: string[] = [];
  const aliases: string[] = [];
  const parameters: string[] = [];
  const calls: string[] = [];
  const literals: string[] = [];
  const types: string[] = [];
  const flow: string[] = [];
  const sourceSpans: string[] = [];

  const addExact = (value: string | undefined): void => {
    const text = cleanIdentifier(value);
    if (text !== undefined && !exactIdentifiers.includes(text))
      exactIdentifiers.push(text);
  };
  const addAlias = (value: string | undefined): void => {
    const text = cleanIdentifier(value);
    if (text === undefined) return;
    if (!aliases.includes(text)) aliases.push(text);
    addExact(text);
  };
  const addParameter = (value: string | undefined): void => {
    const text = cleanParameter(value);
    if (text === undefined) return;
    if (!parameters.includes(text)) parameters.push(text);
    addExact(text);
  };
  const addType = (value: string | undefined): void => {
    const text = cleanIdentifier(value);
    if (text === undefined) return;
    if (!types.includes(text)) types.push(text);
    addExact(text);
  };
  const addFlow = (value: string | undefined): void => {
    const text = value?.trim();
    if (text !== undefined && text !== "" && !flow.includes(text))
      flow.push(text);
  };
  const addCall = (value: string | undefined): void => {
    const text = cleanIdentifier(value);
    if (text !== undefined && !calls.includes(text)) calls.push(text);
  };
  const addLiteral = (value: string | undefined): void => {
    const text = cleanLiteral(value);
    if (text !== undefined && !literals.includes(text)) literals.push(text);
  };

  for (const node of nodes) {
    addExact(node.name);
    collectSignatureChecklist(
      node.signature,
      addParameter,
      addType,
      addExact,
    );
    for (const call of node.calls ?? []) {
      collectLabelChecklist(
        call,
        (value) => {
          addExact(value);
          addCall(value);
        },
        addAlias,
        addParameter,
        addType,
      );
    }
    for (const type of node.types ?? []) addType(type);
    for (const literal of node.literals ?? []) addLiteral(literal);
    for (const item of node.flow?.slice(0, 2) ?? []) {
      if (flow.length >= 2) break;
      addFlow(item);
      for (const label of item.split(" -> ")) {
        collectLabelChecklist(label, addExact, addAlias, addParameter, addType);
      }
    }
    for (const ref of node.dependsOn ?? []) {
      addExact(ref.name);
      for (const alias of ref.aliases ?? []) addAlias(alias);
    }
    if (node.sourceSpan !== undefined) {
      const span =
        node.sourceSpan.endLine === undefined
          ? `${node.sourceSpan.file}:${node.sourceSpan.startLine}`
          : `${node.sourceSpan.file}:${node.sourceSpan.startLine}-${node.sourceSpan.endLine}`;
      if (!sourceSpans.includes(span)) sourceSpans.push(span);
    }
  }

  if (exactIdentifiers.length === 0 && flow.length === 0) return undefined;
  const checklist: ITtscGraphExpand.IAnswerChecklist = {
    copyExact: prioritizeCopyExact(
      exactIdentifiers,
      calls,
      parameters,
      literals,
      types,
    ),
    exactIdentifiers: exactIdentifiers.slice(0, 32),
  };
  if (aliases.length > 0) checklist.aliases = aliases.slice(0, 16);
  if (parameters.length > 0) checklist.parameters = parameters.slice(0, 16);
  if (calls.length > 0) checklist.calls = calls.slice(0, 16);
  if (literals.length > 0) checklist.literals = literals.slice(0, 16);
  if (types.length > 0) checklist.types = types.slice(0, 16);
  if (flow.length > 0) checklist.flow = flow.slice(0, 2);
  if (sourceSpans.length > 0) checklist.sourceSpans = sourceSpans.slice(0, 8);
  return checklist;
}

function finalAnswerChecklistOf(
  checklist: ITtscGraphExpand.IAnswerChecklist,
): string[] {
  const out: string[] = [];
  if (checklist.flow !== undefined && checklist.flow.length > 0) {
    out.push(`Use exact flow: ${checklist.flow[0]}`);
  }
  if (checklist.calls !== undefined && checklist.calls.length > 0) {
    out.push(`Use exact calls: ${checklist.calls.slice(0, 8).join(", ")}`);
  }
  if (checklist.literals !== undefined && checklist.literals.length > 0) {
    out.push(`Use exact literals: ${checklist.literals.slice(0, 8).join(", ")}`);
  }
  if (checklist.copyExact.length > 0) {
    out.push(`Use exact identifiers: ${checklist.copyExact.join(", ")}`);
  }
  if (checklist.sourceSpans !== undefined && checklist.sourceSpans.length > 0) {
    out.push(`Cite source spans: ${checklist.sourceSpans.join(", ")}`);
  }
  return out.slice(0, 4);
}

function prioritizeCopyExact(
  exactIdentifiers: string[],
  calls: string[],
  parameters: string[],
  literals: string[],
  types: string[],
): string[] {
  const out: string[] = [];
  const push = (value: string): void => {
    if (!out.includes(value)) out.push(value);
  };
  for (const value of exactIdentifiers.slice(0, 16)) push(value);
  for (const value of calls.slice(0, 12)) push(value);
  for (const value of parameters.slice(0, 8)) push(value);
  for (const value of literals.slice(0, 8)) push(value);
  for (const value of types.slice(0, 8)) push(value);
  return out.slice(0, 24);
}

function collectLabelChecklist(
  text: string,
  addExact: (value: string | undefined) => void,
  addAlias: (value: string | undefined) => void,
  addParameter: (value: string | undefined) => void,
  addType: (value: string | undefined) => void,
): void {
  if (text.includes(" -> ")) {
    for (const part of text.split(" -> ")) {
      collectLabelChecklist(part, addExact, addAlias, addParameter, addType);
    }
    return;
  }
  const aliasMarker = " aliases ";
  const aliasIndex = text.indexOf(aliasMarker);
  const label =
    aliasIndex < 0 ? text.trim() : text.slice(0, aliasIndex).trim();
  if (aliasIndex >= 0) {
    for (const alias of text.slice(aliasIndex + aliasMarker.length).split(",")) {
      addAlias(alias);
    }
  }
  const open = label.indexOf("(");
  addExact(open < 0 ? label : label.slice(0, open));
  collectSignatureChecklist(label, addParameter, addType, addExact);
}

function collectSignatureChecklist(
  signature: string | undefined,
  addParameter: (value: string | undefined) => void,
  addType: (value: string | undefined) => void,
  addExact: (value: string | undefined) => void,
): void {
  const params = signatureParams(signature);
  if (params === undefined) return;
  for (const param of splitTopLevelCommas(params)) {
    const colon = param.indexOf(":");
    if (colon < 0) {
      addParameter(param);
      continue;
    }
    addParameter(param.slice(0, colon));
    for (const type of typeIdentifiers(param.slice(colon + 1))) {
      addType(type);
    }
  }
  const arrow = signature?.match(/\)\s*:\s*([^;{]+)/);
  if (arrow?.[1] !== undefined) {
    for (const type of typeIdentifiers(arrow[1])) addExact(type);
  }
}

function splitTopLevelCommas(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  let angle = 0;
  let paren = 0;
  let bracket = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "<") angle++;
    else if (ch === ">" && angle > 0) angle--;
    else if (ch === "(") paren++;
    else if (ch === ")" && paren > 0) paren--;
    else if (ch === "[") bracket++;
    else if (ch === "]" && bracket > 0) bracket--;
    else if (ch === "," && angle === 0 && paren === 0 && bracket === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out.filter((item) => item !== "");
}

function typeIdentifiers(text: string): string[] {
  const matches = text.match(/[$A-Z][\w$]*(?:\.[A-Z_$][\w$]*)*/g) ?? [];
  const skipped = new Set(["Promise", "Readonly", "Array", "Record"]);
  return matches.filter((item) => !skipped.has(item));
}

function cleanIdentifier(value: string | undefined): string | undefined {
  const text = value
    ?.replace(/\s+/g, " ")
    .replace(/^[`'"]|[`'"]$/g, "")
    .trim();
  if (text === undefined || text === "") return undefined;
  return text;
}

function cleanParameter(value: string | undefined): string | undefined {
  const text = cleanIdentifier(value)
    ?.replace(/^\.\.\./, "")
    .replace(/\?$/, "");
  if (text === undefined || !/^[$A-Z_a-z][\w$]*$/.test(text))
    return undefined;
  return text;
}

function literalSummaries(text: string | undefined): string[] {
  if (text === undefined) return [];
  const out: string[] = [];
  for (const match of text.matchAll(/(["'`])((?:\\.|(?!\1).){1,80})\1/g)) {
    const value = cleanLiteral(match[2]);
    if (value !== undefined && !out.includes(value)) out.push(value);
    if (out.length >= 20) break;
  }
  return out;
}

function cleanLiteral(value: string | undefined): string | undefined {
  const text = value?.replace(/\s+/g, " ").trim();
  if (
    text === undefined ||
    text === "" ||
    text.length > 40 ||
    /^[{}()[\],.:;]+$/.test(text)
  ) {
    return undefined;
  }
  return text;
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

function bound(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = value === undefined || !Number.isFinite(value) ? fallback : value;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function refRank(
  ref: ITtscGraphExpand.IReference,
  edge: ITtscGraphEdge,
): number {
  return (
    edgeKindRank(edge.kind) * 100_000 +
    evidenceRank(edge) +
    (ref.file.startsWith("bundled://") ? 20_000 : 0)
  );
}

function evidenceRank(edge: ITtscGraphEdge): number {
  const line = edge.evidence?.startLine ?? 9_999;
  const col = edge.evidence?.startCol ?? 999;
  return line * 100 + col;
}

function edgeKindRank(kind: string): number {
  switch (kind) {
    case "calls":
      return 0;
    case "instantiates":
      return 1;
    case "accesses":
    case "renders":
      return 2;
    case "tests":
      return 3;
    case "overrides":
    case "decorates":
      return 4;
    case "extends":
    case "implements":
      return 5;
    case "type_ref":
      return 6;
    default:
      return 10;
  }
}

/** Decorator facts already captured on a node, omitted when absent. */
export function decoratorsOf(
  node: ITtscGraphNode,
): ITtscGraphDecorator[] | undefined {
  return node.decorators !== undefined && node.decorators.length > 0
    ? node.decorators
    : undefined;
}

/** Relationship evidence already captured on an edge, omitted when absent. */
export function edgeEvidenceOf(
  edge: ITtscGraphEdge,
): ITtscGraphEvidence | undefined {
  return edge.evidence;
}

/**
 * In `symbol_details(source:true, neighbors:true)`, same-node edge evidence text
 * is already visible in the returned source body. Keep the coordinates and omit
 * only that duplicate excerpt.
 */
function edgeEvidenceForExpand(
  edge: ITtscGraphEdge,
  coveredSource:
    | {
        file: string;
        startLine: number;
        endLine: number;
      }
    | undefined,
): ITtscGraphEvidence | undefined {
  const evidence = edgeEvidenceOf(edge);
  if (evidence === undefined || coveredSource === undefined) return evidence;
  const endLine = evidence.endLine ?? evidence.startLine;
  if (
    evidence.text !== undefined &&
    evidence.file === coveredSource.file &&
    evidence.startLine >= coveredSource.startLine &&
    endLine <= coveredSource.endLine
  ) {
    const { text: _text, ...rest } = evidence;
    return rest;
  }
  return evidence;
}

/** Read a file's lines once, or undefined when it cannot be read. */
function fileLines(project: string, file: string): string[] | undefined {
  if (file === "") return undefined;
  try {
    return fs.readFileSync(path.join(project, file), "utf8").split(/\r?\n/);
  } catch {
    return undefined;
  }
}

/**
 * The declaration signature: the head of the declaration up to and including
 * the line that opens its body (`{`), or the single declaration line when there
 * is no brace, capped so a wrapped signature cannot run away.
 */
export function signatureOf(
  project: string,
  node: ITtscGraphNode,
): string | undefined {
  const evidence = node.evidence;
  const lines =
    evidence === undefined ? undefined : fileLines(project, evidence.file);
  if (lines === undefined || evidence === undefined) return undefined;
  const start = Math.max(0, evidence.startLine - 1);
  const out: string[] = [];
  for (
    let i = start;
    i < lines.length && out.length < MAX_SIGNATURE_LINES;
    i++
  ) {
    const line = lines[i];
    if (line === undefined) break;
    out.push(line);
    if (line.includes("{")) break;
  }
  const text = out.join("\n").trim();
  return text === "" ? undefined : text;
}

/** Slice a node's full declaration source from disk, capped at MAX_SOURCE_LINES. */
function readSource(
  project: string,
  node: ITtscGraphNode,
):
  | {
      file: string;
      text: string;
      truncated: boolean;
      startLine: number;
      endLine: number;
    }
  | undefined {
  const evidence = node.implementation ?? node.evidence;
  const lines =
    evidence === undefined ? undefined : fileLines(project, evidence.file);
  if (lines === undefined || evidence === undefined) return undefined;
  const start = Math.max(0, evidence.startLine - 1);
  const end = Math.min(evidence.endLine ?? evidence.startLine, lines.length);
  let slice = lines.slice(start, Math.max(start + 1, end));
  let truncated = false;
  if (slice.length > MAX_SOURCE_LINES) {
    slice = slice.slice(0, MAX_SOURCE_LINES);
    truncated = true;
  }
  return {
    file: evidence.file,
    text: slice.join("\n"),
    truncated,
    startLine: start + 1,
    endLine: start + slice.length,
  };
}
