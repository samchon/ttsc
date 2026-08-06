import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { TtscBenchmarkConstant } from "./TtscBenchmarkConstant.ts";

/**
 * Audits Codex graph-benchmark traces without inventing unavailable reasoning.
 *
 * The auditor preserves the CLI's exposed-message, tool-call, usage, savings,
 * comparison, and self-test outputs while keeping executable wiring separate
 * from reusable trace-audit logic.
 */
export namespace TtscBenchmarkGraphTraceAuditor {
  /**
   * Runs the trace-audit CLI for the executable located in the given directory.
   *
   * The directory is accepted as the stable executable boundary; audit inputs
   * and outputs continue to resolve exactly as the legacy CLI specified.
   */
  export function main(entrypointDirectory: string): void {
    void entrypointDirectory;
    audit();
  }

  function audit(): void {
    type JsonObject = Record<string, unknown>;
    type Counts = Record<string, number>;
    type CliArgs = Record<string, string | boolean>;
    type McpArgsSummary = Record<string, string | number | boolean | undefined>;

    interface BuildAuditOptions {
      suiteDir: string | null;
      suiteReport: string | null;
      baselinePath: string | null;
    }

    interface RawCellReport {
      traceDir: string;
      repo: string;
      fixtureBranch?: string;
      tool: string;
      model: string;
      effort: string;
      promptId?: string;
      promptFamily?: string;
    }

    interface CodexUsage {
      input_tokens?: unknown;
      cached_input_tokens?: unknown;
      output_tokens?: unknown;
      reasoning_output_tokens?: unknown;
    }

    interface CodexItem {
      id?: string | null;
      type: string;
      text?: unknown;
      summary?: unknown;
      output_text?: unknown;
      content?: unknown;
      command?: string;
      aggregated_output?: string;
      exit_code?: unknown;
      status?: unknown;
      name?: string;
      tool_name?: string;
      toolName?: string;
      tool?: string;
      identifier?: string;
      arguments?: unknown;
      input?: unknown;
      result?: unknown;
      output?: unknown;
    }

    interface CodexEvent {
      type: string;
      usage?: CodexUsage;
      item?: CodexItem;
    }

    interface UsageTurn {
      input: number;
      cachedInput: number;
      output: number;
      reasoning: number;
    }

    interface AssistantMessage {
      eventIndex: number;
      itemId: string | null;
      turn: number;
      chars: number;
      estimatedTokens: number;
      text: string;
      preview: string;
    }

    interface ReasoningItem {
      eventIndex: number;
      itemId: string | null;
      type: string;
      chars: number;
      estimatedTokens: number;
      textAvailable: boolean;
      text: string;
      preview: string;
    }

    interface GraphDetailsPayload {
      kind: "details";
      nodes: number;
      unknown: number;
      members: number;
      dependencyRefs: number;
      sourceChars: number;
      estimatedSourceTokens: number;
      signatureChars: number;
      estimatedSignatureTokens: number;
      memberSignatureChars: number;
      estimatedMemberSignatureTokens: number;
      dependencyChars: number;
      estimatedDependencyTokens: number;
      coveredEvidenceTextChars: number;
      estimatedCoveredEvidenceTextTokens: number;
      truncatedSources: number;
    }

    interface GraphTracePayload {
      kind: "trace";
      direction: unknown;
      hops: number;
      reached: number;
      path: number;
      candidates: number;
      evidenceChars: number;
      estimatedEvidenceTokens: number;
      pathSignatureChars: number;
      estimatedPathSignatureTokens: number;
      truncated: boolean;
    }

    interface GraphLookupPayload {
      kind: "lookup";
      hits: number;
      signatureChars: number;
      estimatedSignatureTokens: number;
    }

    interface GraphOverviewPayload {
      kind: "overview";
      publicApi: number;
      hotspots: number;
      layers: number;
    }

    interface GraphOtherPayload {
      kind: string;
    }

    type GraphPayload =
      | GraphDetailsPayload
      | GraphTracePayload
      | GraphLookupPayload
      | GraphOverviewPayload
      | GraphOtherPayload;

    function isGraphDetailsPayload(
      payload: GraphPayload | undefined,
    ): payload is GraphDetailsPayload {
      return (
        payload?.kind === "details" &&
        "sourceChars" in payload &&
        typeof payload.sourceChars === "number"
      );
    }

    function isGraphTracePayload(
      payload: GraphPayload | undefined,
    ): payload is GraphTracePayload {
      return (
        payload?.kind === "trace" &&
        "evidenceChars" in payload &&
        typeof payload.evidenceChars === "number"
      );
    }

    function isGraphLookupPayload(
      payload: GraphPayload | undefined,
    ): payload is GraphLookupPayload {
      return (
        payload?.kind === "lookup" &&
        "signatureChars" in payload &&
        typeof payload.signatureChars === "number"
      );
    }

    interface PromptReplayEntry {
      laterTurns: number;
      outputPromptReplayTokens: number;
      exactAvoidablePromptReplayTokens: number;
      replacementSurfacePromptReplayTokens: number;
      candidateOverfetchPromptReplayTokens: number;
    }

    interface ToolCall {
      index: number;
      eventIndex: number;
      itemId: string | null;
      turn: number;
      kind: "command" | "mcp";
      class: string;
      command?: string;
      name?: string;
      args?: McpArgsSummary;
      arguments?: unknown;
      inputKey?: string;
      inputChars: number;
      contentTextChars?: number;
      estimatedContentTextTokens?: number;
      outputChars: number;
      estimatedOutputTokens: number;
      outputDigest: string;
      outputPreview: string;
      exitCode?: unknown;
      status?: unknown;
      graphReplaceable?: boolean;
      graphPayload?: GraphPayload;
      overfetchTypes?: string[];
      promptReplay?: PromptReplayEntry;
    }

    interface OverfetchSignal {
      index: number;
      type: string;
      tool: string;
      reason: string;
      estimatedOutputTokens: number;
      estimatedCandidateTokens: number;
      exactAvoidable: boolean;
    }

    interface HotspotExample {
      run: number;
      index: number;
      outputDigest: string;
      estimatedOutputTokens: number;
      preview: string;
    }

    interface CallHotspot {
      key: string;
      kind: ToolCall["kind"];
      class: string;
      label: string;
      args: McpArgsSummary | undefined;
      count: number;
      outputChars: number;
      estimatedOutputTokens: number;
      estimatedExactAvoidableOutputTokens: number;
      estimatedReplacementSurfaceOutputTokens: number;
      estimatedCandidateOverfetchTokens: number;
      estimatedOutputPromptReplayTokens: number;
      estimatedExactAvoidablePromptReplayTokens: number;
      estimatedReplacementSurfacePromptReplayTokens: number;
      estimatedCandidateOverfetchPromptReplayTokens: number;
      overfetchTypes: Counts;
      examples: HotspotExample[];
    }

    interface Baseline {
      source: string;
      runs: number;
      harness: string | undefined;
      model: string;
      modelVersion: string | undefined;
      effort: string | undefined;
      repo: string;
      promptId: string | undefined;
      promptFamily: string | undefined;
      tokens: number;
      reasoningTokens: number;
      tokensWithReasoning: number;
      tools: number;
      shell: number;
      graph: number;
      assistantMessages: number;
    }

    type ParsedTrace = ReturnType<typeof parseTrace>;
    type AuditRun = ParsedTrace & {
      arm: string;
      run: number;
      file: string;
    };
    type RunSummary = ReturnType<typeof summarizeRuns>;
    type BaselineSavings = ReturnType<typeof savingsAgainstBaseline>;

    interface AuditCell {
      report: string;
      traceDir: string;
      repo: string;
      fixtureBranch?: string;
      tool: string;
      model: string;
      effort: string;
      promptId?: string;
      promptFamily?: string;
      runs: number;
      summary: RunSummary;
      runsDetail: AuditRun[];
      baseline?: Baseline;
      savingsVsBaseline?: BaselineSavings;
    }

    type AuditSuite = ReturnType<typeof summarizeSuite>;

    interface Audit {
      schemaVersion: number;
      generatedAt: string;
      source: string;
      baselineSource: string | null;
      reasoningTextAvailable: boolean;
      reasoningTextNote: string;
      suite: AuditSuite;
      cells: AuditCell[];
    }

    type StoredAudit = Omit<Audit, "source"> & { source?: string };

    interface ComparisonRow {
      index: number;
      label: string;
      source: string;
      baselineSource: string | null;
      cells: number;
      runs: number;
      graphArmRuns: number;
      graphArmRunsWithoutMcp: number;
      medianTokens: number;
      medianReasoningTokens: number;
      medianTokensWithReasoning: number;
      medianToolCalls: number;
      medianCommandCalls: number;
      medianMcpCalls: number;
      medianAssistantMessages: number;
      medianEstimatedToolOutputTokens: number;
      medianExactAvoidableOutputTokens: number;
      medianReplacementSurfaceOutputTokens: number;
      medianCandidateOverfetchTokens: number;
      medianVisibleTraceMaterialTokens: number;
      medianInputTokensNotExplainedByVisibleTraceMaterial: number;
      totalMedianTokensSavedVsBaseline: number;
      totalMedianTokensWithReasoningSavedVsBaseline: number;
      totalStrictExactTokensSavedVsBaseline: number;
      totalLowerBoundTokensSavedVsBaseline: number;
      totalCandidateCeilingTokensSavedVsBaseline: number;
      totalLowerBoundTokensWithReasoningSavedVsBaseline: number;
      totalCandidateCeilingTokensWithReasoningSavedVsBaseline: number;
      reasoningTextAvailable: boolean;
      reasoningTextNote: string;
    }

    type ComparisonDelta = ReturnType<typeof deltaRow>;

    interface AuditComparison {
      schemaVersion: number;
      generatedAt: string;
      baseline: string;
      rows: ComparisonRow[];
      deltas: {
        index: number;
        label: string;
        deltaFromFirst: ComparisonDelta;
      }[];
    }

    const args = parseArgs(process.argv.slice(2));
    const suiteDir = optionalString(args.dir)
      ? path.resolve(requireString(args.dir, "--dir"))
      : null;
    const suiteReport = optionalString(args.report)
      ? path.resolve(requireString(args.report, "--report"))
      : null;
    const outPath = optionalString(args.out)
      ? path.resolve(requireString(args.out, "--out"))
      : null;
    const baselineArg = optionalString(args.baseline);
    const baselinePath =
      baselineArg === "none"
        ? null
        : baselineArg !== undefined
          ? path.resolve(baselineArg)
          : path.join(
              TtscBenchmarkConstant.REPOSITORY_ROOT,
              "website",
              "public",
              "benchmark",
              "graph.json",
            );
    const compareInputs = args.compare ? listArg(args.compare) : [];
    const singleGraphToolNames = new Set([
      "inspect_typescript_graph",
      "inspect_typescript_source_flow",
      "inspect_typescript_codebase",
      "inspect",
      "query",
    ]);

    if (truthy(args["self-test"])) {
      runSelfTest();
      process.exit(0);
    }

    if (compareInputs.length > 0) {
      const comparison = compareAuditInputs(compareInputs, baselinePath);
      printAuditComparison(comparison);
      if (outPath) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, `${JSON.stringify(comparison, null, 2)}\n`);
        console.log(`comparison written: ${outPath}`);
      }
      process.exit(0);
    }

    if (!suiteDir && !suiteReport) {
      console.error(
        "audit-codex-traces.ts: --dir, --report, --compare, or --self-test is required",
      );
      process.exit(2);
    }

    const output = buildAudit({ suiteDir, suiteReport, baselinePath });

    printSuite(output);
    if (outPath) {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
      console.log(`audit written: ${outPath}`);
    }

    function buildAudit({
      suiteDir,
      suiteReport,
      baselinePath,
    }: BuildAuditOptions): Audit {
      if (suiteDir === null && suiteReport === null) {
        throw new Error(
          "buildAudit requires a suite directory or suite report",
        );
      }
      const rootDir =
        suiteDir ??
        path.dirname(requireString(suiteReport, "suite report path"));
      const rawReports = suiteReport
        ? rawReportsFromSuiteReport(suiteReport)
        : fs
            .readdirSync(rootDir)
            .filter((file) => file.endsWith(".raw.json"))
            .map((file) => path.join(rootDir, file));

      const baselineIndex =
        baselinePath && fs.existsSync(baselinePath)
          ? loadBaselineIndex(baselinePath)
          : null;
      const cells = rawReports.map((file) => auditCell(file, baselineIndex));
      const suite = summarizeSuite(cells);
      const reasoningText = summarizeReasoningText(cells);
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: suiteReport ?? rootDir,
        baselineSource:
          baselinePath && fs.existsSync(baselinePath) ? baselinePath : null,
        reasoningTextAvailable: reasoningText.available,
        reasoningTextNote: reasoningText.note,
        suite,
        cells,
      };
    }

    function rawReportsFromSuiteReport(file: string): string[] {
      const report = readJsonObject(file);
      if (typeof report.traceDir === "string" && report.traceDir !== "") {
        return [file];
      }
      const cells = objectArray(report.cells);
      if (cells === undefined) {
        throw new Error(`report has neither traceDir nor cells: ${file}`);
      }
      return (
        cells
          .filter(
            (cell) => cell.harness === undefined || cell.harness === "codex",
          )
          // A cell the suite listed and this audit cannot reach is a failure to
          // report, not one to drop. Silence here was the other half of the
          // zero-cell audit: whatever went wrong, the run exited zero and the
          // reader could not tell an empty suite from an unreadable one.
          .map((cell) => {
            const reportPath = optionalString(cell.report);
            if (reportPath === undefined) {
              throw new Error(
                `${file} holds a cell with no report path, so it is not an auditable suite report`,
              );
            }
            // Resolved against the report that recorded it, the one base every
            // reader of this field uses. Against the current directory it named
            // a different file whenever the run directory was not the directory
            // the audit was typed in, which is every documented invocation:
            // `pnpm --dir benchmarks/graph` puts the audit in the package while
            // the run directory is always somewhere below it.
            const resolved = path.isAbsolute(reportPath)
              ? reportPath
              : path.resolve(path.dirname(file), reportPath);
            if (!fs.existsSync(resolved)) {
              throw new Error(
                `suite cell report is missing: ${resolved} (recorded in ${file})`,
              );
            }
            return resolved;
          })
      );
    }

    function auditCell(
      reportPath: string,
      baselineIndex: Map<string, Baseline> | null,
    ): AuditCell {
      const report = readRawCellReport(reportPath);
      // Against the report that recorded it, the base `cells[].report` uses in
      // `rawReportsFromSuiteReport` just above. Both harnesses record this
      // absolute, so the base only decides what a relative one would mean - and
      // it decides what the error below is allowed to name.
      const traceDir = path.resolve(path.dirname(reportPath), report.traceDir);
      // The last link of the per-cell reachability chain. A cell whose traces
      // are unreachable used to die on a bare ENOENT that named neither the
      // cell nor the report recording it, and a cell whose trace directory is
      // empty audited as `runs: 0` at exit zero - folding a median of zero into
      // the suite summary, a recorded number stating something no trace says.
      if (!fs.existsSync(traceDir)) {
        throw new Error(
          `cell trace directory is missing: ${traceDir} (recorded in ${reportPath})`,
        );
      }
      const traces = fs
        .readdirSync(traceDir)
        .filter((file) => file.endsWith(".stream.jsonl"))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      if (traces.length === 0) {
        throw new Error(
          `cell trace directory holds no *.stream.jsonl: ${traceDir} (recorded in ${reportPath})`,
        );
      }
      const runs: AuditRun[] = traces.map((file) => {
        const match = /^(.*)-run-(\d+)\.stream\.jsonl$/.exec(file);
        const parsed = parseTrace(
          fs.readFileSync(path.join(traceDir, file), "utf8"),
        );
        return {
          arm: match?.[1] ?? "unknown",
          run: Number(match?.[2] ?? 0),
          file: path.relative(process.cwd(), path.join(traceDir, file)),
          ...parsed,
        };
      });

      const cell: AuditCell = {
        // Absolute, so this audit's own `cells[].report` reads back under the
        // same rule the runner's does - and this file is itself accepted as a
        // `--report` input. Recorded against the current directory it named a
        // different file whenever the run directory was not the directory the
        // audit was typed in, which is every documented invocation.
        //
        // `traceDir` and `runsDetail[].file` stay current-directory relative on
        // purpose: nothing resolves them, they are provenance a human reads,
        // and a short path reads better than an absolute one.
        report: reportPath,
        traceDir: path.relative(process.cwd(), traceDir),
        repo: report.repo,
        fixtureBranch: report.fixtureBranch,
        tool: report.tool,
        model: report.model,
        effort: report.effort,
        promptId: report.promptId,
        promptFamily: report.promptFamily,
        runs: runs.length,
        summary: summarizeRuns(runs),
        runsDetail: runs,
      };
      const baseline = baselineIndex?.get(baselineKey(cell));
      if (baseline !== undefined) {
        cell.baseline = baseline;
        cell.savingsVsBaseline = savingsAgainstBaseline(cell.summary, baseline);
      }
      return cell;
    }

    function parseTrace(text: string) {
      const eventTypes: Counts = {};
      const itemTypes: Counts = {};
      const messages: AssistantMessage[] = [];
      const calls: ToolCall[] = [];
      const timeline: JsonObject[] = [];
      const reasoningItems: ReasoningItem[] = [];
      const usageByTurn: UsageTurn[] = [];
      let inputTokens = 0;
      let cachedInputTokens = 0;
      let outputTokens = 0;
      let reasoningTokens = 0;
      let eventIndex = 0;
      let currentTurn = 1;

      for (const raw of text.split("\n")) {
        if (!raw.trim()) continue;
        eventIndex++;
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          continue;
        }
        const event = parseCodexEvent(parsed);
        if (event === undefined) continue;
        eventTypes[event.type ?? "?"] =
          (eventTypes[event.type ?? "?"] ?? 0) + 1;

        if (event.type === "turn.completed") {
          const usage = event.usage ?? {};
          const turn = {
            input: number(usage.input_tokens),
            cachedInput: number(usage.cached_input_tokens),
            output: number(usage.output_tokens),
            reasoning: number(usage.reasoning_output_tokens),
          };
          usageByTurn.push(turn);
          inputTokens += turn.input;
          cachedInputTokens += turn.cachedInput;
          outputTokens += turn.output;
          reasoningTokens += turn.reasoning;
          currentTurn = usageByTurn.length + 1;
          continue;
        }

        if (event.type !== "item.completed") continue;
        const item = event.item;
        if (item === undefined) continue;
        const itemType = item.type ?? "?";
        itemTypes[itemType] = (itemTypes[itemType] ?? 0) + 1;

        if (isReasoningItem(itemType)) {
          const text = textOfItem(item);
          reasoningItems.push({
            eventIndex,
            itemId: item.id ?? null,
            type: itemType,
            chars: text.length,
            estimatedTokens: estimateTokens(text),
            textAvailable: text.length > 0,
            text,
            preview: oneLine(text).slice(0, 240),
          });
        }

        if (itemType === "agent_message") {
          const text = typeof item.text === "string" ? item.text : "";
          const message = {
            eventIndex,
            itemId: item.id ?? null,
            turn: currentTurn,
            chars: text.length,
            estimatedTokens: estimateTokens(text),
            text,
            preview: oneLine(text).slice(0, 240),
          };
          messages.push(message);
          timeline.push({
            index: timeline.length + 1,
            eventIndex,
            itemId: message.itemId,
            turn: message.turn,
            kind: "assistant_message",
            chars: message.chars,
            estimatedTokens: message.estimatedTokens,
            preview: message.preview,
          });
          continue;
        }

        if (itemType === "command_execution") {
          const command = item.command ?? "";
          const output = item.aggregated_output ?? "";
          const call: ToolCall = {
            index: calls.length + 1,
            eventIndex,
            itemId: item.id ?? null,
            turn: currentTurn,
            kind: "command",
            class: classifyCommand(command),
            command,
            inputChars: command.length,
            outputChars: output.length,
            estimatedOutputTokens: estimateTokens(output),
            outputDigest: digest(output),
            outputPreview: oneLine(output).slice(0, 800),
            exitCode: item.exit_code,
            status: item.status,
            graphReplaceable: isGraphReplaceableCommand(command, output),
          };
          calls.push(call);
          timeline.push(toolTimelineEntry(timeline.length + 1, call));
          continue;
        }

        if (itemType === "mcp_tool_call") {
          const name = mcpCallName(item);
          const input = item.arguments ?? item.input ?? {};
          const payload = item.result ?? item.output ?? item.content ?? "";
          const output = stringifyPayload(payload);
          const contentText = extractMcpText(payload);
          const args = summarizeMcpArgs(name, input);
          const call: ToolCall = {
            index: calls.length + 1,
            eventIndex,
            itemId: item.id ?? null,
            turn: currentTurn,
            kind: "mcp",
            class: "graph",
            name,
            args,
            arguments: input,
            inputKey: `${name}:${stableStringify(mcpInputKey(name, input))}`,
            inputChars: jsonChars(input),
            contentTextChars: contentText.length,
            estimatedContentTextTokens: estimateTokens(contentText),
            outputChars: output.length,
            estimatedOutputTokens: estimateTokens(output),
            outputDigest: digest(output),
            outputPreview: oneLine(contentText || output).slice(0, 800),
            graphPayload: analyzeGraphPayload(name, contentText),
            status: item.status,
          };
          calls.push(call);
          timeline.push(toolTimelineEntry(timeline.length + 1, call));
        }
      }

      const commandCalls = calls.filter((call) => call.kind === "command");
      const mcpCalls = calls.filter((call) => call.kind === "mcp");
      const replaceable = commandCalls.filter((call) => call.graphReplaceable);
      const outputChars = calls.reduce(
        (sum, call) => sum + call.outputChars,
        0,
      );
      const mcpContentTextChars = mcpCalls.reduce(
        (sum, call) => sum + number(call.contentTextChars),
        0,
      );
      const replaceableOutputChars = replaceable.reduce(
        (sum, call) => sum + call.outputChars,
        0,
      );
      const estimatedReplaceableTokens = replaceable.reduce(
        (sum, call) => sum + call.estimatedOutputTokens,
        0,
      );
      const overfetch = analyzeMcpOverfetch(calls);
      const promptReplayExposure = summarizePromptReplayExposure(
        calls,
        overfetch.typesByIndex,
        usageByTurn.length,
      );
      const inputLedger = summarizeInputLedger({
        inputTokens,
        cachedInputTokens,
        outputTokens,
        reasoningTokens,
        messages,
        calls,
      });

      return {
        eventTypes,
        itemTypes,
        usage: {
          inputTokens,
          cachedInputTokens,
          outputTokens,
          reasoningTokens,
          tokens: inputTokens + outputTokens,
          tokensWithReasoning: inputTokens + outputTokens + reasoningTokens,
          turns: usageByTurn.length,
          byTurn: usageByTurn,
          ledger: inputLedger,
        },
        reasoning: {
          textAvailable: reasoningItems.some((item) => item.textAvailable),
          textItems: reasoningItems,
          outputTokens: reasoningTokens,
          byTurn: usageByTurn.map((turn, index) => ({
            turn: index + 1,
            reasoning: turn.reasoning,
          })),
          note:
            reasoningItems.length === 0
              ? "No reasoning/thinking text item was present in the Codex stream; only reasoning_output_tokens are auditable."
              : "Reasoning-like stream items were present and are recorded in textItems.",
        },
        messages: {
          count: messages.length,
          chars: messages.reduce((sum, message) => sum + message.chars, 0),
          estimatedTokens: messages.reduce(
            (sum, message) => sum + message.estimatedTokens,
            0,
          ),
          items: messages,
          previews: messages.slice(-6),
        },
        tools: {
          total: calls.length,
          command: commandCalls.length,
          mcp: mcpCalls.length,
          outputChars,
          estimatedOutputTokens: estimateTokensFromChars(outputChars),
          mcpContentTextChars,
          estimatedMcpContentTextTokens:
            estimateTokensFromChars(mcpContentTextChars),
          graphPayloadTotals: summarizeGraphPayloads(mcpCalls),
          graphReplaceableCalls: replaceable.length,
          graphReplaceableOutputChars: replaceableOutputChars,
          estimatedGraphReplaceableTokens: estimatedReplaceableTokens,
          replacementSurfaceOutputTokens:
            estimatedReplaceableTokens + overfetch.exactAvoidableOutputTokens,
          exactAvoidableOutputTokens: overfetch.exactAvoidableOutputTokens,
          duplicateMcpOutputTokens: overfetch.duplicateMcpOutputTokens,
          candidateOverfetchTokens: overfetch.candidateOverfetchTokens,
          promptReplayExposure,
          exactAvoidablePromptReplayTokens:
            promptReplayExposure.exactAvoidablePromptReplayTokens,
          replacementSurfacePromptReplayTokens:
            promptReplayExposure.replacementSurfacePromptReplayTokens,
          candidateOverfetchPromptReplayTokens:
            promptReplayExposure.candidateOverfetchPromptReplayTokens,
          overfetchSignals: overfetch.signals,
          byClass: countBy(calls, (call) => call.class),
          calls: calls.map((call) => ({
            ...call,
            overfetchTypes: overfetch.typesByIndex[call.index] ?? [],
            promptReplay: promptReplayExposure.byCall[call.index] ?? {
              laterTurns: 0,
              outputPromptReplayTokens: 0,
              exactAvoidablePromptReplayTokens: 0,
              replacementSurfacePromptReplayTokens: 0,
              candidateOverfetchPromptReplayTokens: 0,
            },
          })),
          largestOutputs: calls
            .map((call) => ({
              index: call.index,
              kind: call.kind,
              class: call.class,
              label: call.command ?? call.name,
              outputChars: call.outputChars,
              estimatedOutputTokens: call.estimatedOutputTokens,
              outputDigest: call.outputDigest,
              graphReplaceable: call.graphReplaceable === true,
              overfetchTypes: overfetch.typesByIndex[call.index] ?? [],
            }))
            .sort((a, b) => b.outputChars - a.outputChars)
            .slice(0, 10),
        },
        timeline,
      };
    }

    function summarizeRuns(runs: AuditRun[]) {
      const graphArmRuns = runs.filter((run) => run.arm === "graph");
      return {
        graphArmRuns: graphArmRuns.length,
        graphArmRunsWithoutMcp: graphArmRuns.filter(
          (run) => run.tools.mcp === 0,
        ).length,
        graphArmRunsWithShell: graphArmRuns.filter(
          (run) => run.tools.command > 0,
        ).length,
        medianTokens: median(runs.map((run) => run.usage.tokens)),
        medianCachedInputTokens: median(
          runs.map((run) => run.usage.cachedInputTokens),
        ),
        medianReasoningTokens: median(
          runs.map((run) => run.usage.reasoningTokens),
        ),
        medianTokensWithReasoning: median(
          runs.map((run) => run.usage.tokensWithReasoning),
        ),
        medianUncachedInputTokens: median(
          runs.map((run) => run.usage.ledger.uncachedInputTokens),
        ),
        medianVisibleTraceMaterialTokens: median(
          runs.map((run) => run.usage.ledger.visibleTraceMaterialTokens),
        ),
        medianInputTokensNotExplainedByVisibleTraceMaterial: median(
          runs.map(
            (run) =>
              run.usage.ledger.inputTokensNotExplainedByVisibleTraceMaterial,
          ),
        ),
        medianUncachedInputTokensNotExplainedByVisibleTraceMaterial: median(
          runs.map(
            (run) =>
              run.usage.ledger
                .uncachedInputTokensNotExplainedByVisibleTraceMaterial,
          ),
        ),
        medianToolCalls: median(runs.map((run) => run.tools.total)),
        medianCommandCalls: median(runs.map((run) => run.tools.command)),
        medianMcpCalls: median(runs.map((run) => run.tools.mcp)),
        medianAssistantMessages: median(runs.map((run) => run.messages.count)),
        medianAssistantMessageEstimatedTokens: median(
          runs.map((run) => run.messages.estimatedTokens),
        ),
        reasoningTextRuns: runs.filter((run) => run.reasoning.textAvailable)
          .length,
        totalReasoningTextItems: sum(
          runs.map((run) => run.reasoning.textItems.length),
        ),
        medianToolOutputChars: median(runs.map((run) => run.tools.outputChars)),
        medianEstimatedToolOutputTokens: median(
          runs.map((run) => run.tools.estimatedOutputTokens),
        ),
        medianEstimatedMcpContentTextTokens: median(
          runs.map((run) => run.tools.estimatedMcpContentTextTokens),
        ),
        medianEstimatedDetailsSourceTokens: median(
          runs.map(
            (run) => run.tools.graphPayloadTotals.estimatedDetailsSourceTokens,
          ),
        ),
        medianEstimatedDetailsDependencyTokens: median(
          runs.map(
            (run) =>
              run.tools.graphPayloadTotals.estimatedDetailsDependencyTokens,
          ),
        ),
        medianEstimatedDetailsCoveredEvidenceTextTokens: median(
          runs.map(
            (run) =>
              run.tools.graphPayloadTotals
                .estimatedDetailsCoveredEvidenceTextTokens,
          ),
        ),
        medianEstimatedTraceEvidenceTokens: median(
          runs.map(
            (run) => run.tools.graphPayloadTotals.estimatedTraceEvidenceTokens,
          ),
        ),
        medianGraphReplaceableCalls: median(
          runs.map((run) => run.tools.graphReplaceableCalls),
        ),
        medianEstimatedGraphReplaceableTokens: median(
          runs.map((run) => run.tools.estimatedGraphReplaceableTokens),
        ),
        medianReplacementSurfaceOutputTokens: median(
          runs.map((run) => run.tools.replacementSurfaceOutputTokens),
        ),
        medianExactAvoidableOutputTokens: median(
          runs.map((run) => run.tools.exactAvoidableOutputTokens),
        ),
        medianDuplicateMcpOutputTokens: median(
          runs.map((run) => run.tools.duplicateMcpOutputTokens),
        ),
        medianCandidateOverfetchTokens: median(
          runs.map((run) => run.tools.candidateOverfetchTokens),
        ),
        medianExactAvoidablePromptReplayTokens: median(
          runs.map((run) => run.tools.exactAvoidablePromptReplayTokens),
        ),
        medianReplacementSurfacePromptReplayTokens: median(
          runs.map((run) => run.tools.replacementSurfacePromptReplayTokens),
        ),
        medianCandidateOverfetchPromptReplayTokens: median(
          runs.map((run) => run.tools.candidateOverfetchPromptReplayTokens),
        ),
        commandClassTotals: mergeCounts(runs.map((run) => run.tools.byClass)),
        topCommandHotspots: callHotspots(
          runs,
          (call) => call.kind === "command",
        ),
        topMcpHotspots: callHotspots(runs, (call) => call.kind === "mcp"),
        overfetchSignals: runs
          .flatMap((run) =>
            run.tools.overfetchSignals.map((signal) => ({
              run: run.run,
              ...signal,
            })),
          )
          .sort((a, b) => b.estimatedOutputTokens - a.estimatedOutputTokens)
          .slice(0, 20),
        largestOutputs: runs
          .flatMap((run) =>
            run.tools.largestOutputs.map((entry) => ({
              run: run.run,
              ...entry,
            })),
          )
          .sort((a, b) => b.outputChars - a.outputChars)
          .slice(0, 20),
      };
    }

    function summarizeSuite(cells: AuditCell[]) {
      const comparable = cells.filter(
        (
          cell,
        ): cell is AuditCell & {
          baseline: Baseline;
          savingsVsBaseline: BaselineSavings;
        } =>
          cell.baseline !== undefined && cell.savingsVsBaseline !== undefined,
      );
      return {
        cells: cells.length,
        runs: cells.reduce((sum, cell) => sum + cell.runs, 0),
        graphArmRuns: sum(cells.map((cell) => cell.summary.graphArmRuns)),
        graphArmRunsWithoutMcp: sum(
          cells.map((cell) => cell.summary.graphArmRunsWithoutMcp),
        ),
        graphArmRunsWithShell: sum(
          cells.map((cell) => cell.summary.graphArmRunsWithShell),
        ),
        medianTokens: median(cells.map((cell) => cell.summary.medianTokens)),
        medianCachedInputTokens: median(
          cells.map((cell) => cell.summary.medianCachedInputTokens),
        ),
        medianReasoningTokens: median(
          cells.map((cell) => cell.summary.medianReasoningTokens),
        ),
        medianTokensWithReasoning: median(
          cells.map((cell) => cell.summary.medianTokensWithReasoning),
        ),
        medianUncachedInputTokens: median(
          cells.map((cell) => cell.summary.medianUncachedInputTokens),
        ),
        medianVisibleTraceMaterialTokens: median(
          cells.map((cell) => cell.summary.medianVisibleTraceMaterialTokens),
        ),
        medianInputTokensNotExplainedByVisibleTraceMaterial: median(
          cells.map(
            (cell) =>
              cell.summary.medianInputTokensNotExplainedByVisibleTraceMaterial,
          ),
        ),
        medianUncachedInputTokensNotExplainedByVisibleTraceMaterial: median(
          cells.map(
            (cell) =>
              cell.summary
                .medianUncachedInputTokensNotExplainedByVisibleTraceMaterial,
          ),
        ),
        medianToolCalls: median(
          cells.map((cell) => cell.summary.medianToolCalls),
        ),
        medianCommandCalls: median(
          cells.map((cell) => cell.summary.medianCommandCalls),
        ),
        medianMcpCalls: median(
          cells.map((cell) => cell.summary.medianMcpCalls),
        ),
        medianAssistantMessages: median(
          cells.map((cell) => cell.summary.medianAssistantMessages),
        ),
        medianAssistantMessageEstimatedTokens: median(
          cells.map(
            (cell) => cell.summary.medianAssistantMessageEstimatedTokens,
          ),
        ),
        reasoningTextRuns: sum(
          cells.map((cell) => cell.summary.reasoningTextRuns),
        ),
        totalReasoningTextItems: sum(
          cells.map((cell) => cell.summary.totalReasoningTextItems),
        ),
        medianEstimatedToolOutputTokens: median(
          cells.map((cell) => cell.summary.medianEstimatedToolOutputTokens),
        ),
        medianEstimatedMcpContentTextTokens: median(
          cells.map((cell) => cell.summary.medianEstimatedMcpContentTextTokens),
        ),
        medianEstimatedDetailsSourceTokens: median(
          cells.map((cell) => cell.summary.medianEstimatedDetailsSourceTokens),
        ),
        medianEstimatedDetailsDependencyTokens: median(
          cells.map(
            (cell) => cell.summary.medianEstimatedDetailsDependencyTokens,
          ),
        ),
        medianEstimatedDetailsCoveredEvidenceTextTokens: median(
          cells.map(
            (cell) =>
              cell.summary.medianEstimatedDetailsCoveredEvidenceTextTokens,
          ),
        ),
        medianEstimatedTraceEvidenceTokens: median(
          cells.map((cell) => cell.summary.medianEstimatedTraceEvidenceTokens),
        ),
        medianEstimatedGraphReplaceableTokens: median(
          cells.map(
            (cell) => cell.summary.medianEstimatedGraphReplaceableTokens,
          ),
        ),
        medianReplacementSurfaceOutputTokens: median(
          cells.map(
            (cell) => cell.summary.medianReplacementSurfaceOutputTokens,
          ),
        ),
        medianExactAvoidableOutputTokens: median(
          cells.map((cell) => cell.summary.medianExactAvoidableOutputTokens),
        ),
        medianDuplicateMcpOutputTokens: median(
          cells.map((cell) => cell.summary.medianDuplicateMcpOutputTokens),
        ),
        medianCandidateOverfetchTokens: median(
          cells.map((cell) => cell.summary.medianCandidateOverfetchTokens),
        ),
        medianExactAvoidablePromptReplayTokens: median(
          cells.map(
            (cell) => cell.summary.medianExactAvoidablePromptReplayTokens,
          ),
        ),
        medianReplacementSurfacePromptReplayTokens: median(
          cells.map(
            (cell) => cell.summary.medianReplacementSurfacePromptReplayTokens,
          ),
        ),
        medianCandidateOverfetchPromptReplayTokens: median(
          cells.map(
            (cell) => cell.summary.medianCandidateOverfetchPromptReplayTokens,
          ),
        ),
        totalEstimatedGraphReplaceableTokens: sum(
          cells.map(
            (cell) => cell.summary.medianEstimatedGraphReplaceableTokens,
          ),
        ),
        totalExactAvoidableOutputTokens: sum(
          cells.map((cell) => cell.summary.medianExactAvoidableOutputTokens),
        ),
        totalCandidateOverfetchTokens: sum(
          cells.map((cell) => cell.summary.medianCandidateOverfetchTokens),
        ),
        totalExactAvoidablePromptReplayTokens: sum(
          cells.map(
            (cell) => cell.summary.medianExactAvoidablePromptReplayTokens,
          ),
        ),
        totalReplacementSurfacePromptReplayTokens: sum(
          cells.map(
            (cell) => cell.summary.medianReplacementSurfacePromptReplayTokens,
          ),
        ),
        totalCandidateOverfetchPromptReplayTokens: sum(
          cells.map(
            (cell) => cell.summary.medianCandidateOverfetchPromptReplayTokens,
          ),
        ),
        comparableBaselineCells: comparable.length,
        totalMedianTokensSavedVsBaseline: sum(
          comparable.map((cell) => cell.savingsVsBaseline.tokens.saved),
        ),
        medianTokensSavedPctVsBaseline: median(
          comparable.map((cell) => cell.savingsVsBaseline.tokens.savedPct),
        ),
        totalMedianTokensWithReasoningSavedVsBaseline: sum(
          comparable.map(
            (cell) => cell.savingsVsBaseline.tokensWithReasoning.saved,
          ),
        ),
        medianTokensWithReasoningSavedPctVsBaseline: median(
          comparable.map(
            (cell) => cell.savingsVsBaseline.tokensWithReasoning.savedPct,
          ),
        ),
        totalExactAdditionalOutputTokensVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.exactAdditionalOutputTokens,
          ),
        ),
        totalStrictExactTokensSavedVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.strictExactTokens.saved,
          ),
        ),
        medianStrictExactTokensSavedPctVsBaseline: median(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.strictExactTokens.savedPct,
          ),
        ),
        totalReplacementSurfaceOutputTokensVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.replacementSurfaceOutputTokens,
          ),
        ),
        totalCandidateAdditionalOutputTokensVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical
                .candidateAdditionalOutputTokens,
          ),
        ),
        totalExactAdditionalPromptReplayTokensVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical
                .exactAdditionalPromptReplayTokens,
          ),
        ),
        totalReplacementSurfacePromptReplayTokensVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical
                .replacementSurfacePromptReplayTokens,
          ),
        ),
        totalCandidateAdditionalPromptReplayTokensVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical
                .candidateAdditionalPromptReplayTokens,
          ),
        ),
        totalLowerBoundTokensSavedVsBaseline: sum(
          comparable.map(
            (cell) => cell.savingsVsBaseline.theoretical.lowerBoundTokens.saved,
          ),
        ),
        medianLowerBoundTokensSavedPctVsBaseline: median(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.lowerBoundTokens.savedPct,
          ),
        ),
        totalCandidateCeilingTokensSavedVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.candidateCeilingTokens.saved,
          ),
        ),
        medianCandidateCeilingTokensSavedPctVsBaseline: median(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.candidateCeilingTokens
                .savedPct,
          ),
        ),
        totalLowerBoundTokensWithObservedPromptReplaySavedVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical
                .lowerBoundTokensWithObservedPromptReplay.saved,
          ),
        ),
        totalCandidateCeilingTokensWithObservedPromptReplaySavedVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical
                .candidateCeilingTokensWithObservedPromptReplay.saved,
          ),
        ),
        totalLowerBoundTokensWithReasoningSavedVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.lowerBoundTokensWithReasoning
                .saved,
          ),
        ),
        medianLowerBoundTokensWithReasoningSavedPctVsBaseline: median(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical.lowerBoundTokensWithReasoning
                .savedPct,
          ),
        ),
        totalCandidateCeilingTokensWithReasoningSavedVsBaseline: sum(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical
                .candidateCeilingTokensWithReasoning.saved,
          ),
        ),
        medianCandidateCeilingTokensWithReasoningSavedPctVsBaseline: median(
          comparable.map(
            (cell) =>
              cell.savingsVsBaseline.theoretical
                .candidateCeilingTokensWithReasoning.savedPct,
          ),
        ),
        topSavingsVsBaselineCells: comparable
          .map((cell) => ({
            repo: cell.repo,
            promptFamily: cell.promptFamily,
            tool: cell.tool,
            baselineTokens: cell.baseline.tokens,
            measuredTokens: cell.summary.medianTokens,
            savedTokens: cell.savingsVsBaseline.tokens.saved,
            savedPct: cell.savingsVsBaseline.tokens.savedPct,
            baselineTokensWithReasoning: cell.baseline.tokensWithReasoning,
            measuredTokensWithReasoning: cell.summary.medianTokensWithReasoning,
            savedTokensWithReasoning:
              cell.savingsVsBaseline.tokensWithReasoning.saved,
            savedPctWithReasoning:
              cell.savingsVsBaseline.tokensWithReasoning.savedPct,
            exactAdditionalOutputTokens:
              cell.savingsVsBaseline.theoretical.exactAdditionalOutputTokens,
            graphReplacementSurfaceOutputTokens:
              cell.savingsVsBaseline.theoretical
                .graphReplacementSurfaceOutputTokens,
            replacementSurfaceOutputTokens:
              cell.savingsVsBaseline.theoretical.replacementSurfaceOutputTokens,
            candidateAdditionalOutputTokens:
              cell.savingsVsBaseline.theoretical
                .candidateAdditionalOutputTokens,
            replacementSurfacePromptReplayTokens:
              cell.savingsVsBaseline.theoretical
                .replacementSurfacePromptReplayTokens,
            candidateAdditionalPromptReplayTokens:
              cell.savingsVsBaseline.theoretical
                .candidateAdditionalPromptReplayTokens,
            candidateCeilingSavedTokens:
              cell.savingsVsBaseline.theoretical.candidateCeilingTokens.saved,
          }))
          .sort((a, b) => b.savedTokens - a.savedTokens)
          .slice(0, 10),
        topGraphReplaceableCells: cells
          .map((cell) => ({
            repo: cell.repo,
            promptFamily: cell.promptFamily,
            tool: cell.tool,
            medianTokens: cell.summary.medianTokens,
            medianReasoningTokens: cell.summary.medianReasoningTokens,
            medianEstimatedGraphReplaceableTokens:
              cell.summary.medianEstimatedGraphReplaceableTokens,
          }))
          .sort(
            (a, b) =>
              b.medianEstimatedGraphReplaceableTokens -
              a.medianEstimatedGraphReplaceableTokens,
          )
          .slice(0, 10),
        graphRunsWithoutMcpCells: cells
          .filter((cell) => cell.summary.graphArmRunsWithoutMcp > 0)
          .map((cell) => ({
            repo: cell.repo,
            promptFamily: cell.promptFamily,
            tool: cell.tool,
            graphArmRuns: cell.summary.graphArmRuns,
            graphArmRunsWithoutMcp: cell.summary.graphArmRunsWithoutMcp,
            medianTokens: cell.summary.medianTokens,
            medianCommandCalls: cell.summary.medianCommandCalls,
            medianMcpCalls: cell.summary.medianMcpCalls,
          }))
          .sort((a, b) => b.graphArmRunsWithoutMcp - a.graphArmRunsWithoutMcp)
          .slice(0, 10),
        graphRunsWithShellCells: cells
          .filter((cell) => cell.summary.graphArmRunsWithShell > 0)
          .map((cell) => ({
            repo: cell.repo,
            promptFamily: cell.promptFamily,
            tool: cell.tool,
            graphArmRuns: cell.summary.graphArmRuns,
            graphArmRunsWithShell: cell.summary.graphArmRunsWithShell,
            medianTokens: cell.summary.medianTokens,
            medianCommandCalls: cell.summary.medianCommandCalls,
            medianMcpCalls: cell.summary.medianMcpCalls,
          }))
          .sort((a, b) => b.graphArmRunsWithShell - a.graphArmRunsWithShell)
          .slice(0, 10),
        topOverfetchCells: cells
          .map((cell) => ({
            repo: cell.repo,
            promptFamily: cell.promptFamily,
            tool: cell.tool,
            medianCandidateOverfetchTokens:
              cell.summary.medianCandidateOverfetchTokens,
            medianExactAvoidableOutputTokens:
              cell.summary.medianExactAvoidableOutputTokens,
            medianCandidateOverfetchPromptReplayTokens:
              cell.summary.medianCandidateOverfetchPromptReplayTokens,
          }))
          .sort(
            (a, b) =>
              b.medianCandidateOverfetchTokens -
              a.medianCandidateOverfetchTokens,
          )
          .slice(0, 10),
        topToolOutputCells: cells
          .map((cell) => ({
            repo: cell.repo,
            promptFamily: cell.promptFamily,
            tool: cell.tool,
            medianToolCalls: cell.summary.medianToolCalls,
            medianMcpCalls: cell.summary.medianMcpCalls,
            medianCommandCalls: cell.summary.medianCommandCalls,
            medianEstimatedToolOutputTokens:
              cell.summary.medianEstimatedToolOutputTokens,
          }))
          .sort(
            (a, b) =>
              b.medianEstimatedToolOutputTokens -
              a.medianEstimatedToolOutputTokens,
          )
          .slice(0, 10),
        topCommandHotspots: callHotspots(
          cells.flatMap((cell) => cell.runsDetail),
          (call) => call.kind === "command",
        ),
        topMcpHotspots: callHotspots(
          cells.flatMap((cell) => cell.runsDetail),
          (call) => call.kind === "mcp",
        ),
      };
    }

    function summarizeReasoningText(cells: AuditCell[]): {
      available: boolean;
      note: string;
    } {
      const textItems = sum(
        cells.flatMap((cell) =>
          cell.runsDetail.map((run) => run.reasoning.textItems.length),
        ),
      );
      if (textItems > 0) {
        return {
          available: true,
          note: "The Codex stream exposed reasoning-like text items, which are recorded per run. Hidden reasoning outside the stream remains unavailable.",
        };
      }
      return {
        available: false,
        note: "Codex JSON streams exposed reasoning_output_tokens but no hidden reasoning text items in these runs.",
      };
    }

    function callHotspots(
      runs: AuditRun[],
      include: (call: ToolCall) => boolean,
      limit = 15,
    ): CallHotspot[] {
      const groups = new Map<string, CallHotspot>();
      for (const run of runs) {
        for (const call of run.tools.calls ?? []) {
          if (!include(call)) continue;
          const key = callHotspotKey(call);
          const existing = groups.get(key) ?? {
            key,
            kind: call.kind,
            class: call.class,
            label: callHotspotLabel(call),
            args: call.kind === "mcp" ? call.args : undefined,
            count: 0,
            outputChars: 0,
            estimatedOutputTokens: 0,
            estimatedExactAvoidableOutputTokens: 0,
            estimatedReplacementSurfaceOutputTokens: 0,
            estimatedCandidateOverfetchTokens: 0,
            estimatedOutputPromptReplayTokens: 0,
            estimatedExactAvoidablePromptReplayTokens: 0,
            estimatedReplacementSurfacePromptReplayTokens: 0,
            estimatedCandidateOverfetchPromptReplayTokens: 0,
            overfetchTypes: {},
            examples: [],
          };
          existing.count++;
          existing.outputChars += call.outputChars;
          existing.estimatedOutputTokens += call.estimatedOutputTokens;
          existing.estimatedOutputPromptReplayTokens +=
            call.promptReplay?.outputPromptReplayTokens ?? 0;
          if (call.graphReplaceable === true) {
            existing.estimatedReplacementSurfaceOutputTokens +=
              call.estimatedOutputTokens;
            existing.estimatedReplacementSurfacePromptReplayTokens +=
              call.promptReplay?.replacementSurfacePromptReplayTokens ?? 0;
          }
          const exactAvoidable = callExactAvoidableTokens(call);
          if (exactAvoidable > 0) {
            existing.estimatedExactAvoidableOutputTokens += exactAvoidable;
            existing.estimatedReplacementSurfaceOutputTokens += exactAvoidable;
            existing.estimatedExactAvoidablePromptReplayTokens +=
              call.promptReplay?.exactAvoidablePromptReplayTokens ?? 0;
            existing.estimatedReplacementSurfacePromptReplayTokens +=
              call.promptReplay?.replacementSurfacePromptReplayTokens ?? 0;
          }
          existing.estimatedCandidateOverfetchTokens +=
            callCandidateOverfetchTokens(call);
          existing.estimatedCandidateOverfetchPromptReplayTokens +=
            call.promptReplay?.candidateOverfetchPromptReplayTokens ?? 0;
          for (const type of call.overfetchTypes ?? []) {
            existing.overfetchTypes[type] =
              (existing.overfetchTypes[type] ?? 0) + 1;
          }
          if (existing.examples.length < 3) {
            existing.examples.push({
              run: run.run,
              index: call.index,
              outputDigest: call.outputDigest,
              estimatedOutputTokens: call.estimatedOutputTokens,
              preview: call.outputPreview,
            });
          }
          groups.set(key, existing);
        }
      }
      return [...groups.values()]
        .map((group) => ({
          ...group,
          overfetchTypes: Object.fromEntries(
            Object.entries(group.overfetchTypes).sort((a, b) =>
              a[0].localeCompare(b[0]),
            ),
          ),
        }))
        .sort((a, b) => b.estimatedOutputTokens - a.estimatedOutputTokens)
        .slice(0, limit);
    }

    function callHotspotKey(call: ToolCall): string {
      if (call.kind === "command") {
        return `command:${call.class}:${normalizeCommand(call.command ?? "")}`;
      }
      return `mcp:${call.name ?? "mcp_tool_call"}:${stableStringify(call.args)}`;
    }

    function callHotspotLabel(call: ToolCall): string {
      if (call.kind === "command") return normalizeCommand(call.command ?? "");
      return call.name ?? "mcp_tool_call";
    }

    function normalizeCommand(command: string): string {
      return oneLine(command).slice(0, 300);
    }

    function callCandidateOverfetchTokens(call: ToolCall): number {
      const types = new Set(call.overfetchTypes ?? []);
      if (types.has("batchedSourceNeighbors") || types.has("sourceNeighbors")) {
        return sourceNeighborCandidateTokens(call);
      }
      if (types.has("broadOpenTrace") || types.has("wideLookup")) {
        return call.estimatedOutputTokens;
      }
      return 0;
    }

    function callExactAvoidableTokens(call: ToolCall): number {
      const types = new Set(call.overfetchTypes ?? []);
      if (types.has("duplicateMcpCall")) return call.estimatedOutputTokens;
      if (types.has("coveredSourceEvidenceText")) {
        return isGraphDetailsPayload(call.graphPayload)
          ? call.graphPayload.estimatedCoveredEvidenceTextTokens
          : 0;
      }
      return 0;
    }

    function summarizePromptReplayExposure(
      calls: ToolCall[],
      typesByIndex: Record<number, string[]>,
      turns: number,
    ) {
      const byCall: Record<number, PromptReplayEntry> = {};
      const out = {
        observedTurns: turns,
        allToolOutputPromptReplayTokens: 0,
        exactAvoidablePromptReplayTokens: 0,
        replacementSurfacePromptReplayTokens: 0,
        candidateOverfetchPromptReplayTokens: 0,
        byCall,
        note: "Counts only replay into later Codex turns exposed by turn.completed events; Codex does not expose intra-turn prompt replay separately.",
      };
      for (const call of calls) {
        const callTurn = number(call.turn) || turns;
        const laterTurns = Math.max(0, turns - callTurn);
        const types = new Set(typesByIndex[call.index] ?? []);
        const exactOutput = callExactAvoidableTokens({
          ...call,
          overfetchTypes: [...types],
        });
        const replacementOutput =
          call.graphReplaceable === true
            ? call.estimatedOutputTokens
            : exactOutput > 0
              ? exactOutput
              : 0;
        const candidateOutput = callCandidateOverfetchTokens({
          ...call,
          overfetchTypes: [...types],
        });
        const entry = {
          laterTurns,
          outputPromptReplayTokens: call.estimatedOutputTokens * laterTurns,
          exactAvoidablePromptReplayTokens: exactOutput * laterTurns,
          replacementSurfacePromptReplayTokens: replacementOutput * laterTurns,
          candidateOverfetchPromptReplayTokens: candidateOutput * laterTurns,
        };
        byCall[call.index] = entry;
        out.allToolOutputPromptReplayTokens += entry.outputPromptReplayTokens;
        out.exactAvoidablePromptReplayTokens +=
          entry.exactAvoidablePromptReplayTokens;
        out.replacementSurfacePromptReplayTokens +=
          entry.replacementSurfacePromptReplayTokens;
        out.candidateOverfetchPromptReplayTokens +=
          entry.candidateOverfetchPromptReplayTokens;
      }
      return out;
    }

    function summarizeInputLedger({
      inputTokens,
      cachedInputTokens,
      outputTokens,
      reasoningTokens,
      messages,
      calls,
    }: {
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      reasoningTokens: number;
      messages: AssistantMessage[];
      calls: ToolCall[];
    }) {
      const assistantMessageTokens = sum(
        messages.map((message) => message.estimatedTokens),
      );
      const toolOutputTokens = sum(
        calls.map((call) => call.estimatedOutputTokens),
      );
      const toolInputTokens = sum(
        calls.map((call) => estimateTokensFromChars(call.inputChars ?? 0)),
      );
      const visibleTraceMaterialTokens =
        assistantMessageTokens + toolInputTokens + toolOutputTokens;
      const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
      return {
        note: "Visible trace material is assistant text plus tool inputs and outputs visible in the JSON stream. The unexplained fields are accounting gaps, not proof of a hidden category: they may include system/developer/user prompt text, tool schemas, cached history effects, and Codex internal replay that the stream does not separate.",
        inputTokens,
        cachedInputTokens,
        uncachedInputTokens,
        outputTokens,
        reasoningTokens,
        assistantMessageTokens,
        toolInputTokens,
        toolOutputTokens,
        visibleTraceMaterialTokens,
        inputTokensNotExplainedByVisibleTraceMaterial: Math.max(
          0,
          inputTokens - visibleTraceMaterialTokens,
        ),
        uncachedInputTokensNotExplainedByVisibleTraceMaterial: Math.max(
          0,
          uncachedInputTokens - visibleTraceMaterialTokens,
        ),
        visibleTraceMaterialPctOfInput: pct(
          visibleTraceMaterialTokens,
          inputTokens,
        ),
        visibleTraceMaterialPctOfUncachedInput: pct(
          visibleTraceMaterialTokens,
          uncachedInputTokens,
        ),
      };
    }

    function printSuite(audit: Audit): void {
      const s = audit.suite;
      console.log(`Codex trace audit: ${audit.source}`);
      console.log(
        `cells=${s.cells} runs=${s.runs} median tokens=${Math.round(
          s.medianTokens,
        )} median reasoning=${Math.round(
          s.medianReasoningTokens,
        )} median with reasoning=${Math.round(s.medianTokensWithReasoning)}`,
      );
      console.log(
        `median tools=${Math.round(s.medianToolCalls)} (${Math.round(
          s.medianCommandCalls,
        )} shell, ${Math.round(s.medianMcpCalls)} MCP), assistant messages=${Math.round(
          s.medianAssistantMessages,
        )} (~=${Math.round(
          s.medianAssistantMessageEstimatedTokens,
        )} tokens), tool output ~= ${Math.round(
          s.medianEstimatedToolOutputTokens,
        )} tokens/cell`,
      );
      if (s.graphArmRunsWithoutMcp > 0) {
        console.log(
          `invalid graph-arm samples: ${s.graphArmRunsWithoutMcp}/${s.graphArmRuns} graph run(s) made zero MCP calls and should not be used as graph measurements`,
        );
        for (const cell of s.graphRunsWithoutMcpCells.slice(0, 5)) {
          console.log(
            `  ${cell.repo}/${cell.promptFamily}/${cell.tool}: ${cell.graphArmRunsWithoutMcp}/${cell.graphArmRuns} zero-MCP graph run(s), median tools ${Math.round(
              cell.medianCommandCalls,
            )} shell + ${Math.round(cell.medianMcpCalls)} MCP`,
          );
        }
      }
      if (s.graphArmRunsWithShell > 0) {
        console.log(
          `invalid graph-arm samples: ${s.graphArmRunsWithShell}/${s.graphArmRuns} graph run(s) used shell commands and should not be used as graph measurements`,
        );
        for (const cell of s.graphRunsWithShellCells.slice(0, 5)) {
          console.log(
            `  ${cell.repo}/${cell.promptFamily}/${cell.tool}: ${cell.graphArmRunsWithShell}/${cell.graphArmRuns} shell-fallback graph run(s), median tools ${Math.round(
              cell.medianCommandCalls,
            )} shell + ${Math.round(cell.medianMcpCalls)} MCP`,
          );
        }
      }
      console.log(
        `reasoning text items=${s.totalReasoningTextItems} across ${s.reasoningTextRuns} run(s); ${audit.reasoningTextNote}`,
      );
      console.log(
        `input ledger: uncached ~= ${Math.round(
          s.medianUncachedInputTokens,
        )}, visible trace material ~= ${Math.round(
          s.medianVisibleTraceMaterialTokens,
        )}, input not explained by visible trace ~= ${Math.round(
          s.medianInputTokensNotExplainedByVisibleTraceMaterial,
        )} total / ${Math.round(
          s.medianUncachedInputTokensNotExplainedByVisibleTraceMaterial,
        )} uncached tokens/cell`,
      );
      console.log(
        `graph output components ~= ${Math.round(
          s.medianEstimatedDetailsSourceTokens,
        )} details-source, ${Math.round(
          s.medianEstimatedDetailsDependencyTokens,
        )} details-dependencies (${Math.round(
          s.medianEstimatedDetailsCoveredEvidenceTextTokens,
        )} legacy inline evidence), ${Math.round(
          s.medianEstimatedTraceEvidenceTokens,
        )} trace-evidence tokens/cell`,
      );
      console.log(
        `median graph-replaceable shell output ~= ${Math.round(
          s.medianEstimatedGraphReplaceableTokens,
        )} tokens/cell; replacement surface ~= ${Math.round(
          s.medianReplacementSurfaceOutputTokens,
        )} tokens/cell; top cells:`,
      );
      for (const cell of s.topGraphReplaceableCells.slice(0, 8)) {
        console.log(
          `  ${cell.repo}/${cell.promptFamily}: ${Math.round(
            cell.medianEstimatedGraphReplaceableTokens,
          )} replaceable, ${Math.round(cell.medianTokens)} measured + ${Math.round(
            cell.medianReasoningTokens,
          )} reasoning`,
        );
      }
      console.log(
        `median exact avoidable output ~= ${Math.round(
          s.medianExactAvoidableOutputTokens,
        )} tokens/cell; candidate MCP overfetch ~= ${Math.round(
          s.medianCandidateOverfetchTokens,
        )} tokens/cell`,
      );
      console.log(
        `observed prompt replay exposure ~= ${Math.round(
          s.medianReplacementSurfacePromptReplayTokens,
        )} replacement-surface, ${Math.round(
          s.medianCandidateOverfetchPromptReplayTokens,
        )} candidate-overfetch tokens/cell`,
      );
      if (s.topCommandHotspots.length > 0) {
        console.log("top command output hotspots:");
        for (const hotspot of s.topCommandHotspots.slice(0, 5)) {
          console.log(
            `  ${hotspot.class} ${formatHotspotLabel(hotspot.label)}: ${Math.round(
              hotspot.estimatedOutputTokens,
            )} tokens over ${hotspot.count} call(s)` +
              (hotspot.estimatedReplacementSurfaceOutputTokens
                ? `, replacement-surface ${Math.round(
                    hotspot.estimatedReplacementSurfaceOutputTokens,
                  )}`
                : ""),
          );
        }
      }
      if (s.topMcpHotspots.length > 0) {
        console.log("top MCP output hotspots:");
        for (const hotspot of s.topMcpHotspots.slice(0, 5)) {
          console.log(
            `  ${formatHotspotLabel(hotspot.label)} ${formatHotspotArgs(
              hotspot.args,
            )}: ${Math.round(
              hotspot.estimatedOutputTokens,
            )} tokens over ${hotspot.count} call(s)` +
              (hotspot.estimatedCandidateOverfetchTokens
                ? `, candidate-overfetch ${Math.round(
                    hotspot.estimatedCandidateOverfetchTokens,
                  )}`
                : ""),
          );
        }
      }
      if (s.comparableBaselineCells > 0) {
        console.log(
          `baseline comparison: ${s.comparableBaselineCells} cells, saved ${Math.round(
            s.totalMedianTokensSavedVsBaseline,
          )} median tokens (${Math.round(
            s.medianTokensSavedPctVsBaseline,
          )}% median), saved ${Math.round(
            s.totalMedianTokensWithReasoningSavedVsBaseline,
          )} with reasoning (${Math.round(
            s.medianTokensWithReasoningSavedPctVsBaseline,
          )}% median)`,
        );
        console.log(
          `theoretical vs baseline: strict exact saved ${Math.round(
            s.totalStrictExactTokensSavedVsBaseline,
          )} tokens (${Math.round(
            s.medianStrictExactTokensSavedPctVsBaseline,
          )}% median), replacement lower-bound saved ${Math.round(
            s.totalLowerBoundTokensSavedVsBaseline,
          )} tokens (${Math.round(
            s.medianLowerBoundTokensSavedPctVsBaseline,
          )}% median), candidate ceiling saved ${Math.round(
            s.totalCandidateCeilingTokensSavedVsBaseline,
          )} tokens (${Math.round(
            s.medianCandidateCeilingTokensSavedPctVsBaseline,
          )}% median)`,
        );
        if (
          s.totalReplacementSurfacePromptReplayTokensVsBaseline > 0 ||
          s.totalCandidateAdditionalPromptReplayTokensVsBaseline > 0
        ) {
          console.log(
            `observed replay-adjusted theoretical: lower-bound saved ${Math.round(
              s.totalLowerBoundTokensWithObservedPromptReplaySavedVsBaseline,
            )} tokens, candidate ceiling saved ${Math.round(
              s.totalCandidateCeilingTokensWithObservedPromptReplaySavedVsBaseline,
            )} tokens`,
          );
        }
      }
    }

    function compareAuditInputs(
      inputs: string[],
      baselinePath: string | null,
    ): AuditComparison {
      if (inputs.length < 2) {
        throw new Error(
          "--compare requires at least two comma-separated inputs",
        );
      }
      return compareAudits(
        inputs.map((input) => loadAuditForCompare(input, baselinePath)),
      );
    }

    function loadAuditForCompare(
      input: string,
      baselinePath: string | null,
    ): Audit {
      const resolved = path.resolve(input);
      if (fs.statSync(resolved).isDirectory()) {
        const auditPath = path.join(resolved, "codex-trace-audit.json");
        if (fs.existsSync(auditPath)) return loadAuditJson(auditPath);
        const reportPath = path.join(resolved, "report.json");
        if (fs.existsSync(reportPath)) {
          return buildAudit({
            suiteDir: null,
            suiteReport: reportPath,
            baselinePath,
          });
        }
        return buildAudit({
          suiteDir: resolved,
          suiteReport: null,
          baselinePath,
        });
      }

      const parsed: unknown = JSON.parse(fs.readFileSync(resolved, "utf8"));
      if (isStoredAudit(parsed)) {
        return {
          ...parsed,
          source: parsed.source ?? resolved,
        };
      }
      if (
        isObject(parsed) &&
        (typeof parsed.traceDir === "string" || Array.isArray(parsed.cells))
      ) {
        return buildAudit({
          suiteDir: null,
          suiteReport: resolved,
          baselinePath,
        });
      }
      throw new Error(`cannot compare unknown audit/report shape: ${resolved}`);
    }

    function loadAuditJson(file: string): Audit {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!isStoredAudit(parsed)) {
        throw new Error(`not a codex trace audit: ${file}`);
      }
      return {
        ...parsed,
        source: parsed.source ?? file,
      };
    }

    function compareAudits(audits: Audit[]): AuditComparison {
      const rows: ComparisonRow[] = audits.map((audit, index) => ({
        index,
        label: auditLabel(audit, index),
        source: audit.source,
        baselineSource: audit.baselineSource,
        cells: audit.suite.cells,
        runs: audit.suite.runs,
        graphArmRuns: auditGraphArmRuns(audit),
        graphArmRunsWithoutMcp: auditGraphArmRunsWithoutMcp(audit),
        medianTokens: audit.suite.medianTokens,
        medianReasoningTokens: audit.suite.medianReasoningTokens,
        medianTokensWithReasoning: audit.suite.medianTokensWithReasoning,
        medianToolCalls: audit.suite.medianToolCalls,
        medianCommandCalls: audit.suite.medianCommandCalls,
        medianMcpCalls: audit.suite.medianMcpCalls,
        medianAssistantMessages: audit.suite.medianAssistantMessages,
        medianEstimatedToolOutputTokens:
          audit.suite.medianEstimatedToolOutputTokens,
        medianExactAvoidableOutputTokens:
          audit.suite.medianExactAvoidableOutputTokens,
        medianReplacementSurfaceOutputTokens:
          audit.suite.medianReplacementSurfaceOutputTokens,
        medianCandidateOverfetchTokens:
          audit.suite.medianCandidateOverfetchTokens,
        medianVisibleTraceMaterialTokens:
          audit.suite.medianVisibleTraceMaterialTokens,
        medianInputTokensNotExplainedByVisibleTraceMaterial:
          audit.suite.medianInputTokensNotExplainedByVisibleTraceMaterial,
        totalMedianTokensSavedVsBaseline:
          audit.suite.totalMedianTokensSavedVsBaseline,
        totalMedianTokensWithReasoningSavedVsBaseline:
          audit.suite.totalMedianTokensWithReasoningSavedVsBaseline,
        totalStrictExactTokensSavedVsBaseline:
          audit.suite.totalStrictExactTokensSavedVsBaseline,
        totalLowerBoundTokensSavedVsBaseline:
          audit.suite.totalLowerBoundTokensSavedVsBaseline,
        totalCandidateCeilingTokensSavedVsBaseline:
          audit.suite.totalCandidateCeilingTokensSavedVsBaseline,
        totalLowerBoundTokensWithReasoningSavedVsBaseline:
          audit.suite.totalLowerBoundTokensWithReasoningSavedVsBaseline,
        totalCandidateCeilingTokensWithReasoningSavedVsBaseline:
          audit.suite.totalCandidateCeilingTokensWithReasoningSavedVsBaseline,
        reasoningTextAvailable: audit.reasoningTextAvailable,
        reasoningTextNote: audit.reasoningTextNote,
      }));
      const first = rows[0];
      if (first === undefined) {
        throw new Error("at least one audit is required for comparison");
      }
      return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        baseline: first.label,
        rows,
        deltas: rows.map((row) => ({
          index: row.index,
          label: row.label,
          deltaFromFirst: deltaRow(row, first),
        })),
      };
    }

    function auditLabel(audit: Audit, index: number): string {
      const sourcePath = audit.source ? String(audit.source) : "";
      const source = sourcePath ? path.basename(sourcePath) : "";
      if (
        source === "report.json" ||
        source === "codex-trace-audit.json" ||
        source.endsWith(".raw.json")
      ) {
        const parent = path.basename(path.dirname(sourcePath));
        if (parent) return `${parent}/${source}`;
      }
      if (source && source !== "." && source !== path.sep) return source;
      return `audit-${index + 1}`;
    }

    function auditGraphArmRuns(audit: Audit): number {
      const fromSuite = optionalNumber(audit.suite.graphArmRuns);
      if (fromSuite !== undefined) return fromSuite;
      return sum(
        audit.cells.map(
          (cell) => cell.runsDetail.filter((run) => run.arm === "graph").length,
        ),
      );
    }

    function auditGraphArmRunsWithoutMcp(audit: Audit): number {
      const fromSuite = optionalNumber(audit.suite.graphArmRunsWithoutMcp);
      if (fromSuite !== undefined) return fromSuite;
      return sum(
        audit.cells.map(
          (cell) =>
            cell.runsDetail.filter(
              (run) => run.arm === "graph" && number(run.tools.mcp) === 0,
            ).length,
        ),
      );
    }

    function deltaRow(row: ComparisonRow, first: ComparisonRow) {
      return {
        medianTokens: row.medianTokens - first.medianTokens,
        medianReasoningTokens:
          row.medianReasoningTokens - first.medianReasoningTokens,
        medianTokensWithReasoning:
          row.medianTokensWithReasoning - first.medianTokensWithReasoning,
        medianToolCalls: row.medianToolCalls - first.medianToolCalls,
        medianCommandCalls: row.medianCommandCalls - first.medianCommandCalls,
        medianMcpCalls: row.medianMcpCalls - first.medianMcpCalls,
        graphArmRunsWithoutMcp:
          row.graphArmRunsWithoutMcp - first.graphArmRunsWithoutMcp,
        medianAssistantMessages:
          row.medianAssistantMessages - first.medianAssistantMessages,
        medianEstimatedToolOutputTokens:
          row.medianEstimatedToolOutputTokens -
          first.medianEstimatedToolOutputTokens,
        medianExactAvoidableOutputTokens:
          row.medianExactAvoidableOutputTokens -
          first.medianExactAvoidableOutputTokens,
        medianReplacementSurfaceOutputTokens:
          row.medianReplacementSurfaceOutputTokens -
          first.medianReplacementSurfaceOutputTokens,
        medianCandidateOverfetchTokens:
          row.medianCandidateOverfetchTokens -
          first.medianCandidateOverfetchTokens,
        totalMedianTokensSavedVsBaseline:
          row.totalMedianTokensSavedVsBaseline -
          first.totalMedianTokensSavedVsBaseline,
        totalMedianTokensWithReasoningSavedVsBaseline:
          row.totalMedianTokensWithReasoningSavedVsBaseline -
          first.totalMedianTokensWithReasoningSavedVsBaseline,
        totalStrictExactTokensSavedVsBaseline:
          row.totalStrictExactTokensSavedVsBaseline -
          first.totalStrictExactTokensSavedVsBaseline,
        totalLowerBoundTokensSavedVsBaseline:
          row.totalLowerBoundTokensSavedVsBaseline -
          first.totalLowerBoundTokensSavedVsBaseline,
        totalCandidateCeilingTokensSavedVsBaseline:
          row.totalCandidateCeilingTokensSavedVsBaseline -
          first.totalCandidateCeilingTokensSavedVsBaseline,
        totalLowerBoundTokensWithReasoningSavedVsBaseline:
          row.totalLowerBoundTokensWithReasoningSavedVsBaseline -
          first.totalLowerBoundTokensWithReasoningSavedVsBaseline,
        totalCandidateCeilingTokensWithReasoningSavedVsBaseline:
          row.totalCandidateCeilingTokensWithReasoningSavedVsBaseline -
          first.totalCandidateCeilingTokensWithReasoningSavedVsBaseline,
      };
    }

    function printAuditComparison(comparison: AuditComparison): void {
      console.log(
        `Codex trace audit comparison: ${comparison.rows.length} audits`,
      );
      for (const row of comparison.rows) {
        console.log(
          `  [${row.index}] ${row.label}: cells=${row.cells} runs=${row.runs} median tokens=${Math.round(
            row.medianTokens,
          )} + reasoning=${Math.round(
            row.medianReasoningTokens,
          )}, tools=${Math.round(row.medianToolCalls)} (${Math.round(
            row.medianCommandCalls,
          )} shell, ${Math.round(row.medianMcpCalls)} MCP), lower-bound saved=${Math.round(
            row.totalLowerBoundTokensSavedVsBaseline,
          )}, candidate ceiling=${Math.round(
            row.totalCandidateCeilingTokensSavedVsBaseline,
          )}` +
            (row.graphArmRunsWithoutMcp
              ? `, zero-MCP graph runs=${row.graphArmRunsWithoutMcp}/${row.graphArmRuns}`
              : ""),
        );
      }
      for (const entry of comparison.deltas.slice(1)) {
        const d = entry.deltaFromFirst;
        console.log(
          `  delta [${entry.index}] ${entry.label} vs [0]: tokens ${signed(
            d.medianTokens,
          )}, with reasoning ${signed(
            d.medianTokensWithReasoning,
          )}, tools ${signed(d.medianToolCalls)}, lower-bound saved ${signed(
            d.totalLowerBoundTokensSavedVsBaseline,
          )}, candidate ceiling ${signed(
            d.totalCandidateCeilingTokensSavedVsBaseline,
          )}, zero-MCP graph runs ${signed(d.graphArmRunsWithoutMcp)}`,
        );
      }
    }

    function signed(value: number): string {
      const rounded = Math.round(value);
      return rounded > 0 ? `+${rounded}` : String(rounded);
    }

    function formatHotspotLabel(label: string): string {
      const text = oneLine(label);
      return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    }

    function formatHotspotArgs(args: unknown): string {
      if (args === undefined) return "";
      const text = stableStringify(args);
      return text.length > 120 ? `${text.slice(0, 117)}...` : text;
    }

    function graphToolKind(
      name: string,
      requestType: unknown,
    ):
      | "entrypoints"
      | "lookup"
      | "path"
      | "details"
      | "overview"
      | "skip"
      | undefined {
      if (singleGraphToolNames.has(name)) {
        switch (requestType) {
          case "entrypoints":
            return "entrypoints";
          case "lookup":
            return "lookup";
          case "trace":
            return "path";
          case "details":
            return "details";
          case "overview":
            return "overview";
          case "escape":
            return "skip";
          default:
            return undefined;
        }
      }
      return undefined;
    }

    function summarizeMcpArgs(name: string, input: unknown): McpArgsSummary {
      const args = mcpRequestArgs(name, input);
      const kind = graphToolKind(name, args.type);
      if (kind === "details") {
        return {
          type: optionalString(args.type),
          handles: Array.isArray(args.handles) ? args.handles.length : 0,
          source: args.source === true,
          neighbors: args.neighbors === true,
          neighborLimit: number(args.neighborLimit),
        };
      }
      if (kind === "path") {
        return {
          type: optionalString(args.type),
          direction: optionalString(args.direction) ?? "forward",
          focus: optionalString(args.focus) ?? "all",
          path: typeof args.to === "string" && args.to.length > 0,
          maxDepth: number(args.maxDepth),
          maxNodes: number(args.maxNodes),
        };
      }
      if (kind === "lookup" || kind === "entrypoints") {
        return {
          type: optionalString(args.type),
          limit: number(args.limit),
          queryChars: typeof args.query === "string" ? args.query.length : 0,
        };
      }
      if (kind === "overview") {
        return {
          type: optionalString(args.type),
          aspect: optionalString(args.aspect) ?? "all",
        };
      }
      if (kind === "skip") {
        return {
          type: optionalString(args.type),
          reasonChars: typeof args.reason === "string" ? args.reason.length : 0,
        };
      }
      return {};
    }

    function mcpRequestArgs(name: string, input: unknown): JsonObject {
      const args = isObject(input) ? input : {};
      if (!singleGraphToolNames.has(name)) return args;
      return isObject(args.request) ? args.request : {};
    }

    function mcpInputKey(name: string, input: unknown): unknown {
      return singleGraphToolNames.has(name)
        ? mcpRequestArgs(name, input)
        : input;
    }

    function isReasoningItem(type: string): boolean {
      return /reason|think/i.test(type);
    }

    function textOfItem(item: CodexItem): string {
      if (typeof item.text === "string") return item.text;
      if (typeof item.summary === "string") return item.summary;
      if (typeof item.output_text === "string") return item.output_text;
      if (Array.isArray(item.content)) {
        return item.content
          .map((entry) =>
            isObject(entry) && typeof entry.text === "string" ? entry.text : "",
          )
          .filter(Boolean)
          .join("\n");
      }
      return "";
    }

    function toolTimelineEntry(index: number, call: ToolCall): JsonObject {
      return {
        index,
        eventIndex: call.eventIndex,
        itemId: call.itemId,
        turn: call.turn,
        kind: "tool_call",
        toolIndex: call.index,
        toolKind: call.kind,
        class: call.class,
        label: call.command ?? call.name,
        args: call.args ?? {},
        inputChars: call.inputChars ?? 0,
        outputChars: call.outputChars,
        estimatedOutputTokens: call.estimatedOutputTokens,
        outputDigest: call.outputDigest,
        status: call.status,
        preview: call.outputPreview,
        graphPayload: call.graphPayload,
      };
    }

    function stringifyPayload(payload: unknown): string {
      if (typeof payload === "string") return payload;
      if (payload === undefined) return "";
      return JSON.stringify(payload) ?? "";
    }

    function extractMcpText(payload: unknown): string {
      if (typeof payload === "string") return payload;
      if (isObject(payload) && Array.isArray(payload.content)) {
        return payload.content
          .map((entry) =>
            isObject(entry) && typeof entry.text === "string" ? entry.text : "",
          )
          .filter(Boolean)
          .join("\n");
      }
      return "";
    }

    function analyzeGraphPayload(
      name: string,
      text: string,
    ): GraphPayload | undefined {
      const parsed = parseJsonObject(text);
      if (parsed === undefined) return undefined;
      const normalized = graphPayloadResult(name, parsed);
      const kind = normalized.kind;
      const payload = normalized.payload;
      if (kind === "details") {
        const nodes = objectArray(payload.nodes) ?? [];
        const sourceChars = sum(
          nodes.map((node) =>
            typeof node.source === "string" ? node.source.length : 0,
          ),
        );
        const signatureChars = sum(
          nodes.map((node) =>
            typeof node.signature === "string" ? node.signature.length : 0,
          ),
        );
        const memberLists = nodes.map(
          (node) => objectArray(node.members) ?? [],
        );
        const members = memberLists.flat();
        const memberSignatureChars = sum(
          members.map((member) =>
            typeof member.signature === "string" ? member.signature.length : 0,
          ),
        );
        const dependencyChars = sum(
          nodes.map(
            (node) => jsonChars(node.dependsOn) + jsonChars(node.dependedOnBy),
          ),
        );
        const dependencyRefs = sum(
          nodes.map(
            (node) =>
              (Array.isArray(node.dependsOn) ? node.dependsOn.length : 0) +
              (Array.isArray(node.dependedOnBy) ? node.dependedOnBy.length : 0),
          ),
        );
        const coveredEvidenceTextChars =
          coveredSourceEvidenceTextChars(payload);
        const truncated = nodes.filter(
          (node) => node.truncated === true,
        ).length;
        return {
          kind: "details",
          nodes: nodes.length,
          unknown: Array.isArray(payload.unknown) ? payload.unknown.length : 0,
          members: members.length,
          dependencyRefs,
          sourceChars,
          estimatedSourceTokens: estimateTokensFromChars(sourceChars),
          signatureChars,
          estimatedSignatureTokens: estimateTokensFromChars(signatureChars),
          memberSignatureChars,
          estimatedMemberSignatureTokens:
            estimateTokensFromChars(memberSignatureChars),
          dependencyChars,
          estimatedDependencyTokens: estimateTokensFromChars(dependencyChars),
          coveredEvidenceTextChars,
          estimatedCoveredEvidenceTextTokens: estimateTokensFromChars(
            coveredEvidenceTextChars,
          ),
          truncatedSources: truncated,
        };
      }
      if (kind === "path") {
        const hops = objectArray(payload.hops) ?? [];
        const reached = Array.isArray(payload.reached) ? payload.reached : [];
        const path = objectArray(payload.path) ?? [];
        const evidenceChars = sum(hops.map((hop) => jsonChars(hop.evidence)));
        const pathSignatureChars = sum(
          path.map((node) =>
            typeof node.signature === "string" ? node.signature.length : 0,
          ),
        );
        return {
          kind: "trace",
          direction: payload.direction ?? null,
          hops: hops.length,
          reached: reached.length,
          path: path.length,
          candidates: Array.isArray(payload.candidates)
            ? payload.candidates.length
            : 0,
          evidenceChars,
          estimatedEvidenceTokens: estimateTokensFromChars(evidenceChars),
          pathSignatureChars,
          estimatedPathSignatureTokens:
            estimateTokensFromChars(pathSignatureChars),
          truncated: payload.truncated === true,
        };
      }
      if (kind === "lookup" || kind === "entrypoints") {
        const hits = objectArray(payload.hits) ?? [];
        const signatureChars = sum(
          hits.map((hit) =>
            typeof hit.signature === "string" ? hit.signature.length : 0,
          ),
        );
        return {
          kind: "lookup",
          hits: hits.length,
          signatureChars,
          estimatedSignatureTokens: estimateTokensFromChars(signatureChars),
        };
      }
      if (kind === "overview") {
        return {
          kind: "overview",
          publicApi: Array.isArray(payload.publicApi)
            ? payload.publicApi.length
            : 0,
          hotspots: Array.isArray(payload.hotspots)
            ? payload.hotspots.length
            : 0,
          layers: Array.isArray(payload.layers) ? payload.layers.length : 0,
        };
      }
      return { kind: name };
    }

    function graphPayloadResult(
      name: string,
      parsed: JsonObject,
    ): {
      kind:
        | "entrypoints"
        | "lookup"
        | "path"
        | "details"
        | "overview"
        | "skip"
        | undefined;
      payload: JsonObject;
    } {
      if (!singleGraphToolNames.has(name)) {
        return { kind: undefined, payload: parsed };
      }
      const result = isObject(parsed.result) ? parsed.result : parsed;
      switch (result.type) {
        case "entrypoints":
        case "lookup":
        case "trace":
        case "details":
        case "overview":
        case "escape":
          return { kind: graphToolKind(name, result.type), payload: result };
        default:
          return { kind: undefined, payload: parsed };
      }
    }

    function coveredSourceEvidenceTextChars(payload: JsonObject): number {
      const nodes = objectArray(payload.nodes) ?? [];
      const before = JSON.stringify(payload).length;
      const copy = parseJsonObject(JSON.stringify(payload));
      if (copy === undefined) return 0;
      let removed = 0;
      for (const node of objectArray(copy.nodes) ?? []) {
        if (typeof node.source !== "string") continue;
        const start = Number(node.line);
        if (!Number.isFinite(start)) continue;
        const end = start + node.source.split(/\r?\n/).length - 1;
        for (const side of ["dependsOn", "dependedOnBy"]) {
          const refs = objectArray(node[side]) ?? [];
          for (const ref of refs) {
            const evidence = ref.evidence;
            if (!coveredBySource(evidence, node.file, start, end)) continue;
            delete evidence.text;
            removed++;
          }
        }
      }
      if (removed === 0) return 0;
      return Math.max(0, before - JSON.stringify(copy).length);
    }

    function coveredBySource(
      evidence: unknown,
      file: unknown,
      startLine: number,
      endLine: number,
    ): evidence is JsonObject {
      if (
        !isObject(evidence) ||
        typeof evidence.text !== "string" ||
        typeof evidence.file !== "string" ||
        typeof file !== "string"
      ) {
        return false;
      }
      const start = Number(evidence.startLine);
      const end = Number(evidence.endLine ?? evidence.startLine);
      return (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        evidence.file === file &&
        start >= startLine &&
        end <= endLine
      );
    }

    function summarizeGraphPayloads(calls: ToolCall[]) {
      const totals = {
        detailsSourceChars: 0,
        detailsDependencyChars: 0,
        detailsCoveredEvidenceTextChars: 0,
        detailsMemberSignatureChars: 0,
        traceEvidenceChars: 0,
        tracePathSignatureChars: 0,
        lookupSignatureChars: 0,
      };
      for (const call of calls) {
        const payload = call.graphPayload;
        if (isGraphDetailsPayload(payload)) {
          totals.detailsSourceChars += payload.sourceChars;
          totals.detailsDependencyChars += payload.dependencyChars;
          totals.detailsCoveredEvidenceTextChars +=
            payload.coveredEvidenceTextChars ?? 0;
          totals.detailsMemberSignatureChars += payload.memberSignatureChars;
        } else if (isGraphTracePayload(payload)) {
          totals.traceEvidenceChars += payload.evidenceChars;
          totals.tracePathSignatureChars += payload.pathSignatureChars;
        } else if (isGraphLookupPayload(payload)) {
          totals.lookupSignatureChars += payload.signatureChars;
        }
      }
      return {
        ...totals,
        estimatedDetailsSourceTokens: estimateTokensFromChars(
          totals.detailsSourceChars,
        ),
        estimatedDetailsDependencyTokens: estimateTokensFromChars(
          totals.detailsDependencyChars,
        ),
        estimatedDetailsCoveredEvidenceTextTokens: estimateTokensFromChars(
          totals.detailsCoveredEvidenceTextChars,
        ),
        estimatedDetailsMemberSignatureTokens: estimateTokensFromChars(
          totals.detailsMemberSignatureChars,
        ),
        estimatedTraceEvidenceTokens: estimateTokensFromChars(
          totals.traceEvidenceChars,
        ),
        estimatedTracePathSignatureTokens: estimateTokensFromChars(
          totals.tracePathSignatureChars,
        ),
        estimatedLookupSignatureTokens: estimateTokensFromChars(
          totals.lookupSignatureChars,
        ),
      };
    }

    function analyzeMcpOverfetch(calls: ToolCall[]) {
      const seen = new Set<string | undefined>();
      const signals: OverfetchSignal[] = [];
      const typesByIndex: Record<number, string[]> = {};
      let exactAvoidableOutputTokens = 0;
      let duplicateMcpOutputTokens = 0;
      let candidateOverfetchTokens = 0;
      calls.forEach((call, index) => {
        if (call.kind !== "mcp") return;
        const callIndex = call.index ?? index + 1;
        const add = (
          type: string,
          reason: string,
          exact = false,
          candidateTokens?: number,
        ): void => {
          const signal = {
            index: callIndex,
            type,
            tool: call.name ?? "mcp_tool_call",
            reason,
            estimatedOutputTokens: call.estimatedOutputTokens,
            estimatedCandidateTokens:
              candidateTokens ?? call.estimatedOutputTokens,
            exactAvoidable: exact,
          };
          signals.push(signal);
          if (!typesByIndex[callIndex]) typesByIndex[callIndex] = [];
          typesByIndex[callIndex].push(type);
          if (!exact)
            candidateOverfetchTokens +=
              candidateTokens ?? call.estimatedOutputTokens;
        };

        const key = call.inputKey;
        if (seen.has(key)) {
          duplicateMcpOutputTokens += call.estimatedOutputTokens;
          exactAvoidableOutputTokens += call.estimatedOutputTokens;
          add("duplicateMcpCall", "same tool arguments already appeared", true);
        } else {
          seen.add(key);
          const covered = isGraphDetailsPayload(call.graphPayload)
            ? call.graphPayload.estimatedCoveredEvidenceTextTokens
            : 0;
          if (covered > 0) {
            exactAvoidableOutputTokens += covered;
            add(
              "coveredSourceEvidenceText",
              "legacy edge evidence text duplicated returned implementation text",
              true,
              covered,
            );
          }
        }

        const args = call.args ?? {};
        const kind = graphToolKind(call.name ?? "mcp_tool_call", args.type);
        if (kind === "details") {
          if (args.source && args.neighbors && number(args.handles) >= 2) {
            add(
              "batchedSourceNeighbors",
              "legacy source bodies and both dependency directions requested for multiple handles",
              false,
              sourceNeighborCandidateTokens(call),
            );
          } else if (args.source && args.neighbors) {
            add(
              "sourceNeighbors",
              "legacy source body and dependency map requested together",
              false,
              sourceNeighborCandidateTokens(call),
            );
          }
          return;
        }

        if (
          kind === "path" &&
          !args.path &&
          (number(args.maxNodes) >= 30 ||
            number(args.maxDepth) >= 6 ||
            call.outputChars >= 16_000)
        ) {
          add(
            "broadOpenTrace",
            "open trace returned a broad discovery payload; path traces are cheaper once target is known",
          );
          return;
        }

        if (kind === "lookup" && number(args.limit) > 12) {
          add("wideLookup", "lookup limit exceeds the default shortlist size");
        }
      });
      return {
        exactAvoidableOutputTokens,
        duplicateMcpOutputTokens,
        candidateOverfetchTokens,
        signals: signals
          .sort((a, b) => b.estimatedOutputTokens - a.estimatedOutputTokens)
          .slice(0, 20),
        typesByIndex,
      };
    }

    function loadBaselineIndex(file: string): Map<string, Baseline> {
      const graph = readJsonObject(file);
      const agent = objectValue(graph.agent);
      const cells = objectArray(agent?.cells) ?? [];
      const out = new Map<string, Baseline>();
      for (const cell of cells) {
        if (cell.tool !== "baseline") continue;
        const samples = objectArray(objectValue(cell.samples)?.baseline) ?? [];
        if (samples.length === 0) continue;
        const baseline: Baseline = {
          source: path.relative(process.cwd(), file),
          runs: samples.length,
          harness: optionalString(cell.harness),
          model: requireString(cell.model, "baseline model"),
          modelVersion: optionalString(cell.modelVersion),
          effort: optionalString(cell.effort),
          repo: requireString(cell.repo, "baseline repo"),
          promptId: optionalString(cell.promptId),
          promptFamily: optionalString(cell.promptFamily),
          tokens: median(samples.map((sample) => number(sample.tokens))),
          reasoningTokens: median(
            samples.map((sample) => number(sample.reasoning)),
          ),
          tokensWithReasoning: median(
            samples.map(
              (sample) =>
                number(sample.tokensWithReasoning) ||
                number(sample.tokens) + number(sample.reasoning),
            ),
          ),
          tools: median(samples.map((sample) => number(sample.tools))),
          shell: median(samples.map((sample) => number(sample.shell))),
          graph: median(samples.map((sample) => number(sample.graph))),
          assistantMessages: median(
            samples.map((sample) =>
              number(objectValue(sample.types)?.agent_message),
            ),
          ),
        };
        out.set(baselineKey(baseline), baseline);
      }
      return out;
    }

    function baselineKey(cell: {
      repo: string;
      promptId?: string;
      promptFamily?: string;
      model: string;
      modelVersion?: string;
      effort?: string;
    }): string {
      return [
        cell.repo,
        cell.promptId,
        cell.promptFamily,
        cell.modelVersion ?? cell.model,
        cell.effort,
      ].join("\0");
    }

    function savingsAgainstBaseline(summary: RunSummary, baseline: Baseline) {
      const tokenSavings = savings(baseline.tokens, summary.medianTokens);
      const reasoningTokenSavings = savings(
        baseline.reasoningTokens,
        summary.medianReasoningTokens,
      );
      const tokensWithReasoningSavings = savings(
        baseline.tokensWithReasoning,
        summary.medianTokensWithReasoning,
      );
      return {
        tokens: tokenSavings,
        reasoningTokens: reasoningTokenSavings,
        tokensWithReasoning: tokensWithReasoningSavings,
        toolCalls: savings(baseline.tools, summary.medianToolCalls),
        shellCalls: savings(baseline.shell, summary.medianCommandCalls),
        assistantMessages: savings(
          baseline.assistantMessages,
          summary.medianAssistantMessages,
        ),
        theoretical: theoreticalSavings(summary, baseline),
      };
    }

    function theoreticalSavings(summary: RunSummary, baseline: Baseline) {
      const exactAdditional = summary.medianExactAvoidableOutputTokens;
      const replacementSurface = summary.medianReplacementSurfaceOutputTokens;
      const candidateAdditional = summary.medianCandidateOverfetchTokens;
      const exactPromptReplay = summary.medianExactAvoidablePromptReplayTokens;
      const replacementPromptReplay =
        summary.medianReplacementSurfacePromptReplayTokens;
      const candidatePromptReplay =
        summary.medianCandidateOverfetchPromptReplayTokens;
      const exactMeasured = Math.max(0, summary.medianTokens - exactAdditional);
      const lowerBoundMeasured = Math.max(
        0,
        summary.medianTokens - replacementSurface,
      );
      const candidateMeasured = Math.max(
        0,
        summary.medianTokens - replacementSurface - candidateAdditional,
      );
      const exactMeasuredWithReasoning = Math.max(
        0,
        summary.medianTokensWithReasoning - exactAdditional,
      );
      const lowerBoundMeasuredWithReasoning = Math.max(
        0,
        summary.medianTokensWithReasoning - replacementSurface,
      );
      const candidateMeasuredWithReasoning = Math.max(
        0,
        summary.medianTokensWithReasoning -
          replacementSurface -
          candidateAdditional,
      );
      const exactReplayMeasured = Math.max(
        0,
        summary.medianTokens - exactAdditional - exactPromptReplay,
      );
      const lowerBoundReplayMeasured = Math.max(
        0,
        summary.medianTokens - replacementSurface - replacementPromptReplay,
      );
      const candidateReplayMeasured = Math.max(
        0,
        summary.medianTokens -
          replacementSurface -
          replacementPromptReplay -
          candidateAdditional -
          candidatePromptReplay,
      );
      return {
        note: "Exact additional savings are deterministic output removals such as duplicate MCP calls and legacy inline evidence text. The lower bound subtracts measured graph-replaceable shell output plus exact avoidable output; this is a replacement surface, not proof that a graph arm has achieved the saving. Candidate savings are output-surface estimates for MCP overfetch patterns and require a follow-up benchmark before being claimed as achieved savings. Prompt replay fields count only later Codex turns exposed by turn.completed events; intra-turn replay is not separately exposed by the stream.",
        exactAdditionalOutputTokens: exactAdditional,
        graphReplacementSurfaceOutputTokens:
          summary.medianEstimatedGraphReplaceableTokens,
        replacementSurfaceOutputTokens: replacementSurface,
        candidateAdditionalOutputTokens: candidateAdditional,
        exactAdditionalPromptReplayTokens: exactPromptReplay,
        replacementSurfacePromptReplayTokens: replacementPromptReplay,
        candidateAdditionalPromptReplayTokens: candidatePromptReplay,
        strictExactTokens: savings(baseline.tokens, exactMeasured),
        lowerBoundTokens: savings(baseline.tokens, lowerBoundMeasured),
        candidateCeilingTokens: savings(baseline.tokens, candidateMeasured),
        strictExactTokensWithObservedPromptReplay: savings(
          baseline.tokens,
          exactReplayMeasured,
        ),
        lowerBoundTokensWithObservedPromptReplay: savings(
          baseline.tokens,
          lowerBoundReplayMeasured,
        ),
        candidateCeilingTokensWithObservedPromptReplay: savings(
          baseline.tokens,
          candidateReplayMeasured,
        ),
        strictExactTokensWithReasoning: savings(
          baseline.tokensWithReasoning,
          exactMeasuredWithReasoning,
        ),
        lowerBoundTokensWithReasoning: savings(
          baseline.tokensWithReasoning,
          lowerBoundMeasuredWithReasoning,
        ),
        candidateCeilingTokensWithReasoning: savings(
          baseline.tokensWithReasoning,
          candidateMeasuredWithReasoning,
        ),
        remainingMeasuredTokensAfterExactOutput: exactMeasured,
        remainingMeasuredTokensAfterReplacementSurface: lowerBoundMeasured,
        remainingMeasuredTokensAfterCandidateOutput: candidateMeasured,
        remainingMeasuredTokensAfterExactOutputAndPromptReplay:
          exactReplayMeasured,
        remainingMeasuredTokensAfterReplacementSurfaceAndPromptReplay:
          lowerBoundReplayMeasured,
        remainingMeasuredTokensAfterCandidateOutputAndPromptReplay:
          candidateReplayMeasured,
      };
    }

    function savings(baseline: number, measured: number) {
      const saved = baseline - measured;
      return {
        baseline,
        measured,
        saved,
        savedPct: baseline ? (saved / baseline) * 100 : 0,
        remainingPct: baseline ? (measured / baseline) * 100 : 0,
      };
    }

    function pct(numerator: number, denominator: number): number {
      return denominator ? (numerator / denominator) * 100 : 0;
    }

    function classifyCommand(command: string): string {
      if (/\b(rg|grep|Select-String|findstr)\b/i.test(command)) return "search";
      if (/\b(Get-Content|gc|cat|type|head|tail)\b/i.test(command))
        return "read";
      if (/\b(Get-ChildItem|ls|dir)\b/i.test(command)) return "list";
      if (/\b(git)\b/i.test(command)) return "git";
      if (/\b(node|npm|pnpm|yarn|tsc|go)\b/i.test(command)) return "build";
      return "other";
    }

    function isGraphReplaceableCommand(
      command: string,
      output: string,
    ): boolean {
      if (!output) return false;
      if (/\b(rg|grep|Select-String|findstr)\b/i.test(command)) return true;
      if (/\b(Get-Content|gc|cat|type|head|tail)\b/i.test(command)) {
        return /\.[cm]?tsx?\b/i.test(command);
      }
      return false;
    }

    function mcpCallName(item: CodexItem): string {
      return (
        item.name ??
        item.tool_name ??
        item.toolName ??
        item.tool ??
        item.identifier ??
        "mcp_tool_call"
      );
    }

    function countBy<T>(values: T[], key: (value: T) => string): Counts {
      const out: Counts = {};
      for (const value of values) {
        const k = key(value);
        out[k] = (out[k] ?? 0) + 1;
      }
      return out;
    }

    function mergeCounts(counts: Counts[]): Counts {
      const out: Counts = {};
      for (const count of counts) {
        for (const [key, value] of Object.entries(count)) {
          out[key] = (out[key] ?? 0) + value;
        }
      }
      return out;
    }

    function median(values: number[]): number {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const upper = sorted[mid];
      if (upper === undefined) return 0;
      if (sorted.length % 2) return upper;
      const lower = sorted[mid - 1];
      return ((lower ?? upper) + upper) / 2;
    }

    function sum(values: number[]): number {
      return values.reduce((acc, value) => acc + value, 0);
    }

    function estimateTokens(value: unknown): number {
      return estimateTokensFromChars(
        typeof value === "string" ? value.length : 0,
      );
    }

    function estimateTokensFromChars(chars: number): number {
      return Math.ceil(chars / 4);
    }

    function number(value: unknown): number {
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    }

    function optionalNumber(value: unknown): number | undefined {
      return typeof value === "number" && Number.isFinite(value)
        ? value
        : undefined;
    }

    function oneLine(value: unknown): string {
      return String(value).replace(/\s+/g, " ").trim();
    }

    function digest(value: unknown): string {
      return crypto
        .createHash("sha256")
        .update(String(value))
        .digest("hex")
        .slice(0, 16);
    }

    function isObject(value: unknown): value is JsonObject {
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
    }

    function objectValue(value: unknown): JsonObject | undefined {
      return isObject(value) ? value : undefined;
    }

    function objectArray(value: unknown): JsonObject[] | undefined {
      return Array.isArray(value) && value.every(isObject) ? value : undefined;
    }

    function optionalString(value: unknown): string | undefined {
      return typeof value === "string" ? value : undefined;
    }

    function requireString(value: unknown, label: string): string {
      if (typeof value !== "string") {
        throw new Error(`${label} must be a string`);
      }
      return value;
    }

    function readJsonObject(file: string): JsonObject {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!isObject(parsed)) {
        throw new Error(`expected a JSON object: ${file}`);
      }
      return parsed;
    }

    function readRawCellReport(file: string): RawCellReport {
      const report = readJsonObject(file);
      return {
        traceDir: requireString(report.traceDir, `${file}: traceDir`),
        repo: requireString(report.repo, `${file}: repo`),
        fixtureBranch: optionalString(report.fixtureBranch),
        tool: requireString(report.tool, `${file}: tool`),
        model: requireString(report.model, `${file}: model`),
        effort: requireString(report.effort, `${file}: effort`),
        promptId: optionalString(report.promptId),
        promptFamily: optionalString(report.promptFamily),
      };
    }

    function parseCodexEvent(value: unknown): CodexEvent | undefined {
      if (!isObject(value) || typeof value.type !== "string") return undefined;
      const usageObject = objectValue(value.usage);
      const itemObject = objectValue(value.item);
      const itemType = optionalString(itemObject?.type);
      const item: CodexItem | undefined =
        itemObject !== undefined && itemType !== undefined
          ? {
              id:
                typeof itemObject.id === "string" || itemObject.id === null
                  ? itemObject.id
                  : undefined,
              type: itemType,
              text: itemObject.text,
              summary: itemObject.summary,
              output_text: itemObject.output_text,
              content: itemObject.content,
              command: optionalString(itemObject.command),
              aggregated_output: optionalString(itemObject.aggregated_output),
              exit_code: itemObject.exit_code,
              status: itemObject.status,
              name: optionalString(itemObject.name),
              tool_name: optionalString(itemObject.tool_name),
              toolName: optionalString(itemObject.toolName),
              tool: optionalString(itemObject.tool),
              identifier: optionalString(itemObject.identifier),
              arguments: itemObject.arguments,
              input: itemObject.input,
              result: itemObject.result,
              output: itemObject.output,
            }
          : undefined;
      return {
        type: value.type,
        usage:
          usageObject === undefined
            ? undefined
            : {
                input_tokens: usageObject.input_tokens,
                cached_input_tokens: usageObject.cached_input_tokens,
                output_tokens: usageObject.output_tokens,
                reasoning_output_tokens: usageObject.reasoning_output_tokens,
              },
        item,
      };
    }

    const auditSuiteNumberKeys = [
      "cells",
      "runs",
      "graphArmRuns",
      "graphArmRunsWithoutMcp",
      "medianTokens",
      "medianReasoningTokens",
      "medianTokensWithReasoning",
      "medianToolCalls",
      "medianCommandCalls",
      "medianMcpCalls",
      "medianAssistantMessages",
      "medianEstimatedToolOutputTokens",
      "medianExactAvoidableOutputTokens",
      "medianReplacementSurfaceOutputTokens",
      "medianCandidateOverfetchTokens",
      "medianVisibleTraceMaterialTokens",
      "medianInputTokensNotExplainedByVisibleTraceMaterial",
      "totalMedianTokensSavedVsBaseline",
      "totalMedianTokensWithReasoningSavedVsBaseline",
      "totalStrictExactTokensSavedVsBaseline",
      "totalLowerBoundTokensSavedVsBaseline",
      "totalCandidateCeilingTokensSavedVsBaseline",
      "totalLowerBoundTokensWithReasoningSavedVsBaseline",
      "totalCandidateCeilingTokensWithReasoningSavedVsBaseline",
    ] as const;

    function isStoredAudit(value: unknown): value is StoredAudit {
      if (
        !isObject(value) ||
        typeof value.schemaVersion !== "number" ||
        typeof value.generatedAt !== "string" ||
        !(value.source === undefined || typeof value.source === "string") ||
        !(
          value.baselineSource === null ||
          typeof value.baselineSource === "string"
        ) ||
        typeof value.reasoningTextAvailable !== "boolean" ||
        typeof value.reasoningTextNote !== "string" ||
        !isObject(value.suite) ||
        !Array.isArray(value.cells)
      ) {
        return false;
      }
      const suite = value.suite;
      return auditSuiteNumberKeys.every(
        (key) => typeof suite[key] === "number" && Number.isFinite(suite[key]),
      );
    }

    function parseJsonObject(value: unknown): JsonObject | undefined {
      if (typeof value !== "string" || value.trim() === "") return undefined;
      try {
        const parsed = JSON.parse(value);
        return isObject(parsed) ? parsed : undefined;
      } catch {
        return undefined;
      }
    }

    function jsonChars(value: unknown): number {
      if (value === undefined) return 0;
      try {
        return JSON.stringify(value)?.length ?? 0;
      } catch {
        return 0;
      }
    }

    function sourceNeighborCandidateTokens(call: ToolCall): number {
      const payload = call.graphPayload;
      if (!isGraphDetailsPayload(payload)) return call.estimatedOutputTokens;
      const component =
        payload.estimatedSourceTokens + payload.estimatedDependencyTokens;
      return component > 0 ? component : call.estimatedOutputTokens;
    }

    function stableStringify(value: unknown): string {
      if (Array.isArray(value)) {
        return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
      }
      if (isObject(value)) {
        return `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
          .join(",")}}`;
      }
      return JSON.stringify(value);
    }

    function parseArgs(argv: string[]): CliArgs {
      const out: CliArgs = {};
      for (const arg of argv) {
        const match = /^--([^=]+)=(.*)$/.exec(arg);
        if (match?.[1] !== undefined && match[2] !== undefined) {
          out[match[1]] = match[2];
        } else if (arg.startsWith("--")) out[arg.slice(2)] = true;
      }
      return out;
    }

    function listArg(value: unknown): string[] {
      return String(value)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    function truthy(value: unknown): boolean {
      return (
        value === true || value === "1" || value === "true" || value === "yes"
      );
    }

    function runSelfTest(): void {
      const baseline = new Map<string, Baseline>();
      baseline.set(
        [
          "synthetic",
          "synthetic-prompt",
          "common",
          "gpt-5.4-mini",
          "high",
        ].join("\0"),
        {
          source: "self-test",
          runs: 1,
          harness: "codex",
          model: "gpt-5.4-mini",
          modelVersion: "gpt-5.4-mini",
          effort: "high",
          repo: "synthetic",
          promptId: "synthetic-prompt",
          promptFamily: "common",
          tokens: 1000,
          reasoningTokens: 20,
          tokensWithReasoning: 1020,
          tools: 5,
          shell: 2,
          graph: 0,
          assistantMessages: 1,
        },
      );

      const reportPath = path.join(process.cwd(), "synthetic.raw.json");
      const traceDir = path.join(process.cwd(), "synthetic.traces");
      const report: RawCellReport = {
        traceDir,
        repo: "synthetic",
        fixtureBranch: "ttsc",
        tool: "ttsc-graph",
        model: "gpt-5.4-mini",
        effort: "high",
        promptId: "synthetic-prompt",
        promptFamily: "common",
      };
      const trace = [
        {
          type: "item.completed",
          item: {
            id: "reasoning-1",
            type: "reasoning",
            text: "visible reasoning text",
          },
        },
        {
          type: "item.completed",
          item: {
            id: "message-1",
            type: "agent_message",
            text: "final answer",
          },
        },
        {
          type: "item.completed",
          item: {
            id: "command-1",
            type: "command_execution",
            command:
              '"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -Command "rg -n helper src"',
            aggregated_output: "src/app.ts:1:helper();\n",
            exit_code: 0,
            status: "completed",
          },
        },
        mcpItem("mcp-1"),
        mcpItem("mcp-2"),
        {
          type: "turn.completed",
          usage: {
            input_tokens: 600,
            cached_input_tokens: 100,
            output_tokens: 50,
            reasoning_output_tokens: 7,
          },
        },
        {
          type: "turn.completed",
          usage: {
            input_tokens: 80,
            cached_input_tokens: 20,
            output_tokens: 10,
            reasoning_output_tokens: 3,
          },
        },
      ]
        .map((entry) => JSON.stringify(entry))
        .join("\n");

      const originalCwd = process.cwd();
      const cell = auditSyntheticCell(reportPath, report, trace, baseline);
      const suite = summarizeSuite([cell]);
      const reasoningText = summarizeReasoningText([cell]);
      const improvedSuite = {
        ...suite,
        medianTokens: suite.medianTokens - 12,
        medianTokensWithReasoning: suite.medianTokensWithReasoning - 12,
        totalLowerBoundTokensSavedVsBaseline:
          suite.totalLowerBoundTokensSavedVsBaseline + 12,
        totalCandidateCeilingTokensSavedVsBaseline:
          suite.totalCandidateCeilingTokensSavedVsBaseline + 12,
      };
      const comparison = compareAudits([
        {
          schemaVersion: 1,
          generatedAt: new Date(0).toISOString(),
          source: "before",
          baselineSource: "self-test",
          reasoningTextAvailable: reasoningText.available,
          reasoningTextNote: reasoningText.note,
          suite,
          cells: [cell],
        },
        {
          schemaVersion: 1,
          generatedAt: new Date(0).toISOString(),
          source: "after",
          baselineSource: "self-test",
          reasoningTextAvailable: reasoningText.available,
          reasoningTextNote: reasoningText.note,
          suite: improvedSuite,
          cells: [cell],
        },
      ]);

      const comparisonDelta = comparison.deltas[1];
      const syntheticRun = cell.runsDetail[0];
      const cellSavings = cell.savingsVsBaseline;
      if (
        comparisonDelta === undefined ||
        syntheticRun === undefined ||
        cellSavings === undefined
      ) {
        throw new Error("self-test setup did not produce expected audit data");
      }
      assertSelf(reasoningText.available, "reasoning text should be detected");
      // `auditSyntheticCell` rebuilds the cell literal instead of calling
      // `auditCell`, and that duplication is how the recorded spelling drifted
      // apart in the first place: an audit's own cells are read back through
      // `--report`, so a relative one names a different file. Pin the property
      // rather than the duplicate.
      assertSelf(
        path.isAbsolute(cell.report),
        "an audit cell must record its report path absolute",
      );
      assertSelf(
        comparisonDelta.deltaFromFirst.medianTokens === -12,
        "comparison should track median token deltas",
      );
      assertSelf(
        comparisonDelta.deltaFromFirst.totalLowerBoundTokensSavedVsBaseline ===
          12,
        "comparison should track theoretical savings deltas",
      );
      assertSelf(
        syntheticRun.messages.items.length === 1,
        "assistant message should be recorded",
      );
      assertSelf(
        syntheticRun.tools.command === 1 && syntheticRun.tools.mcp === 2,
        "tool call counts should split command and MCP",
      );
      assertSelf(
        suite.graphArmRuns === 1 && suite.graphArmRunsWithoutMcp === 0,
        "graph-arm validity should track zero-MCP graph runs",
      );
      assertSelf(
        syntheticRun.tools.exactAvoidableOutputTokens > 0,
        "duplicate MCP should be strict exact output",
      );
      assertSelf(
        syntheticRun.tools.calls.some((call) =>
          call.overfetchTypes.includes("coveredSourceEvidenceText"),
        ),
        "legacy inline evidence text should be tracked as exact output",
      );
      assertSelf(
        syntheticRun.tools.replacementSurfaceOutputTokens >
          syntheticRun.tools.exactAvoidableOutputTokens,
        "replacement surface should include graph-replaceable shell output",
      );
      assertSelf(
        syntheticRun.tools.exactAvoidablePromptReplayTokens > 0,
        "duplicate MCP should carry later-turn prompt replay exposure",
      );
      assertSelf(
        syntheticRun.tools.replacementSurfacePromptReplayTokens >
          syntheticRun.tools.exactAvoidablePromptReplayTokens,
        "replacement replay exposure should include graph-replaceable shell output",
      );
      assertSelf(
        syntheticRun.usage.ledger.uncachedInputTokens === 560,
        "input ledger should expose uncached input tokens",
      );
      assertSelf(
        syntheticRun.usage.ledger.visibleTraceMaterialTokens > 0,
        "input ledger should estimate visible trace material",
      );
      assertSelf(
        syntheticRun.usage.ledger
          .inputTokensNotExplainedByVisibleTraceMaterial >= 0,
        "input ledger unexplained total should be non-negative",
      );
      assertSelf(
        cellSavings.theoretical.strictExactTokens.saved <
          cellSavings.theoretical.lowerBoundTokens.saved,
        "strict exact saving should stay below replacement lower bound",
      );
      assertSelf(
        number(
          suite.topCommandHotspots[0]?.estimatedReplacementSurfaceOutputTokens,
        ) > 0,
        "command hotspot should report replacement surface",
      );
      assertSelf(
        number(suite.topMcpHotspots[0]?.estimatedExactAvoidableOutputTokens) >
          0,
        "MCP hotspot should report duplicate exact output",
      );
      assertSelf(
        number(
          suite.topMcpHotspots[0]?.estimatedExactAvoidablePromptReplayTokens,
        ) > 0,
        "MCP hotspot should report duplicate prompt replay exposure",
      );
      assertSelf(
        suite.totalCandidateCeilingTokensSavedVsBaseline >=
          suite.totalLowerBoundTokensSavedVsBaseline,
        "candidate ceiling should not be below lower bound",
      );

      console.log(
        JSON.stringify(
          {
            ok: true,
            cwd: originalCwd,
            strictExactSaved: cellSavings.theoretical.strictExactTokens.saved,
            lowerBoundSaved: cellSavings.theoretical.lowerBoundTokens.saved,
            candidateCeilingSaved:
              cellSavings.theoretical.candidateCeilingTokens.saved,
            replacementReplay:
              cellSavings.theoretical.replacementSurfacePromptReplayTokens,
            coveredEvidence:
              cell.summary.medianEstimatedDetailsCoveredEvidenceTextTokens,
            visibleTraceMaterial:
              syntheticRun.usage.ledger.visibleTraceMaterialTokens,
            graphArmRuns: suite.graphArmRuns,
            graphArmRunsWithoutMcp: suite.graphArmRunsWithoutMcp,
          },
          null,
          2,
        ),
      );
    }

    function auditSyntheticCell(
      reportPath: string,
      report: RawCellReport,
      trace: string,
      baselineIndex: Map<string, Baseline>,
    ): AuditCell {
      const parsed = parseTrace(trace);
      const run: AuditRun = {
        arm: "graph",
        run: 1,
        file: "synthetic",
        ...parsed,
      };
      const cell: AuditCell = {
        // Same spelling the real audit path records, so the self-test models
        // the shape this file actually produces rather than a superseded one.
        report: reportPath,
        traceDir: path.relative(process.cwd(), report.traceDir),
        repo: report.repo,
        fixtureBranch: report.fixtureBranch,
        tool: report.tool,
        model: report.model,
        effort: report.effort,
        promptId: report.promptId,
        promptFamily: report.promptFamily,
        runs: 1,
        summary: summarizeRuns([run]),
        runsDetail: [run],
      };
      const baseline = baselineIndex.get(baselineKey(cell));
      if (baseline !== undefined) {
        cell.baseline = baseline;
        cell.savingsVsBaseline = savingsAgainstBaseline(cell.summary, baseline);
      }
      return cell;
    }

    function mcpItem(id: string): JsonObject {
      return {
        type: "item.completed",
        item: {
          id,
          type: "mcp_tool_call",
          server: "ttscgraph",
          tool: "query",
          arguments: {
            question: "Trace helper usage from Service.run.",
            draft: { reason: "Inspect one selected method.", type: "details" },
            review: "Confirmed: details is bounded to one method.",
            request: {
              type: "details",
              handles: ["src/app.ts#Service.run:method"],
              source: true,
              neighbors: true,
            },
          },
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  result: {
                    type: "details",
                    nodes: [
                      {
                        id: "src/app.ts#Service.run:method",
                        name: "Service.run",
                        kind: "method",
                        file: "src/app.ts",
                        line: 1,
                        source: "run() { helper(); }",
                        dependsOn: [
                          {
                            id: "src/app.ts#helper:function",
                            name: "helper",
                            kind: "function",
                            file: "src/app.ts",
                            relation: "calls",
                            evidence: {
                              file: "src/app.ts",
                              startLine: 1,
                              text: "helper",
                            },
                          },
                        ],
                        dependedOnBy: [],
                      },
                    ],
                    unknown: [],
                  },
                }),
              },
            ],
          },
          status: "completed",
        },
      };
    }

    function assertSelf(condition: boolean, message: string): void {
      if (!condition) throw new Error(`self-test failed: ${message}`);
    }
  }
}
