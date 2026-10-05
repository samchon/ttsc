import { graphWorkspaceHelper, GraphWorkspaceService, type GraphWorkspaceInput } from "@scope/graph-preservation-shared";
import { graphAliasHelper } from "@graph-preservation/core/helper";
import type { GraphAliasPayload } from "@graph-preservation-exact";
export function graphWorkspaceRun(input: GraphWorkspaceInput): number { return graphWorkspaceHelper(input); }
export class GraphWorkspaceApp extends GraphWorkspaceService {}
export function graphAliasRun(input: GraphAliasPayload): number { return graphAliasHelper(input.value); }
