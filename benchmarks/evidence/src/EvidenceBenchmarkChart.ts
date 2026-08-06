import { EvidenceBenchmarkInstruction } from "./EvidenceBenchmarkInstruction";
import type {
  ITtscEvidenceBenchmarkReport,
  ITtscEvidenceBenchmarkReportCell,
} from "./structures/ITtscEvidenceBenchmarkReport";

/**
 * Draws the published comparison charts from a report, and from nothing else.
 *
 * Rendering is separated from collection because the two have different inputs.
 * Collection reads the ignored run tree, which exists on the machine that ran a
 * cohort and nowhere else; rendering needs only the aggregate this repository
 * tracks. Keeping them in one function is what made every chart unreproducible
 * outside that one machine, so nothing here touches the filesystem or knows
 * where its report came from.
 */
export namespace EvidenceBenchmarkChart {
  /**
   * One arm's coverage of the reference graph, as the aggregate records it.
   *
   * The figure is a measurement, so it arrives as data rather than as a table
   * written into this module. `measured` separates a counted codebase from an
   * arm that is complete by construction: the plugin enforces every edge as a
   * build gate, so an Evidence cell that compiled satisfied the graph and there
   * was nothing to count.
   */
  export interface ICoverage {
    model: string;
    subject: string;
    arm: ITtscEvidenceBenchmarkReportCell["arm"];
    /** Share of the graph satisfied, from 0 to 1. */
    score: number;
    measured: boolean;
  }

  /** What every chart is drawn from: one report, plus coverage when it exists. */
  export interface IProps {
    report: ITtscEvidenceBenchmarkReport;
    /** Empty when no cohort's coverage has been measured yet. */
    coverage: readonly ICoverage[];
  }

  /** Every subject on one token axis, above the coverage each one reached. */
  export const summary = (props: IProps): string =>
    renderPhaseChart(props, {
      title: "Benchmark: Plain against Evidence",
      description:
        "Coverage of the provenance graph per subject, then token spend per subject with stacked shades for backend development and review, frontend development and review, and overall review. Work time and API cost read beside each bar.",
      subtitle:
        "Coverage is higher-is-better. Token spend is lower-is-better and shares one axis across subjects; stacked shades show development and review phases, and work time and cost sit beside each bar.",
      notes: API_PRICE_NOTES,
      dataAttribute: "tokens",
      cellValue: (cell) => cell.tokens,
      stageValue: (stage) => stage.tokens,
      format: formatTokens,
    });

  /**
   * One subject's two arms across every measured axis.
   *
   * Coverage carries no phases because it is a property of the artifact rather
   * than of the work that made it. The three spend axes carry the same stacked
   * shades, so a reader comparing them sees which phase moved rather than only
   * that a total did.
   *
   * Cost has no per-phase counter of its own. Its segments are the cell's price
   * apportioned by each phase's token share, which is exact wherever every
   * request was billed at one rate and an apportionment otherwise; the footnote
   * says so rather than letting the bar imply a measurement.
   */
  export const arms = (
    props: IProps & { model: string; subject: string },
  ): string => {
    const cells: ITtscEvidenceBenchmarkReportCell[] = props.report.cells
      .filter(
        (cell) => cell.model === props.model && cell.subject === props.subject,
      )
      .sort((left, right) => armOrder(left.arm) - armOrder(right.arm));
    const models: string = [
      ...new Set(cells.map((cell) => displayModel(cell.model))),
    ].join(", ");
    const axes: readonly {
      label: string;
      hint: string;
      measured?: (cell: ITtscEvidenceBenchmarkReportCell) => boolean;
      value: (cell: ITtscEvidenceBenchmarkReportCell) => number;
      phase: (cell: ITtscEvidenceBenchmarkReportCell) => readonly IPhaseValue[];
      format: (value: number) => string;
    }[] = [
      {
        label: "Tokens",
        hint: "lower is better",
        value: (cell) => cell.tokens,
        phase: (cell) => phaseValues(cell, (stage) => stage.tokens),
        format: formatTokens,
      },
      {
        label: "Work time",
        hint: "lower is better",
        value: (cell) => cell.workElapsedMs,
        phase: (cell) => phaseValues(cell, (stage) => stage.elapsedMs),
        format: formatDuration,
      },
      {
        label: "API cost",
        hint: "lower is better · apportioned by token share",
        // A price is emitted only after every retained request reconciles with
        // the cell's own counters, so it can be absent. Drawing that as $0.00
        // reports a cell that cost nothing, and comparing it with its arm
        // reports a saving of everything.
        measured: (cell) => cell.apiCost !== null,
        value: (cell) => cell.apiCost?.amountUsd ?? 0,
        phase: (cell) => {
          const price: number = cell.apiCost?.amountUsd ?? 0;
          const total: number = Math.max(1, cell.tokens);
          return phaseValues(cell, (stage) => stage.tokens).map((phase) => ({
            ...phase,
            value: (phase.value / total) * price,
          }));
        },
        format: (value) => `$${formatPrice(value)}`,
      },
    ];
    const blockHeight: number =
      44 + Math.max(1, cells.length) * ROW_HEIGHT + 14;
    const coverage = renderCoverage(
      { report: { ...props.report, cells }, coverage: props.coverage },
      { title: "Coverage", top: HEADER_HEIGHT, rowHeight: 40 },
    );
    const coverageHeight: number =
      coverage.height === 0 ? 0 : coverage.height + 24 + coverage.notes * 15;
    const height: number =
      HEADER_HEIGHT + coverageHeight + axes.length * (blockHeight + 16) + 62;
    const body: string[] = [...coverage.body];
    let cursor: number = HEADER_HEIGHT + coverageHeight;
    axes.forEach((axis, axisIndex) => {
      // A stage record can sum to more than the cell total it belongs to, since
      // the total excludes idleness the records keep, so scaling by the total
      // alone let a bar run past its own track and off the canvas.
      const maximum: number = Math.max(
        1,
        ...cells
          .filter((cell) => axis.measured?.(cell) ?? true)
          .map((cell) =>
            Math.max(
              axis.value(cell),
              axis.phase(cell).reduce((sum, phase) => sum + phase.value, 0),
            ),
          ),
      );
      body.push(
        `<rect x="${MARGIN - 8}" y="${cursor}" width="${WIDTH - 2 * MARGIN + 16}" height="${blockHeight}" rx="10" class="group" fill-opacity="${axisIndex % 2 === 0 ? "0.78" : "0.42"}"/>`,
        `<text x="${LABEL_X}" y="${cursor + 29}" class="group-title">${escapeXml(axis.label)}</text>`,
        `<text x="${VALUE_X}" y="${cursor + 28}" text-anchor="end" class="group-meta">${escapeXml(axis.hint)}</text>`,
      );
      cells.forEach((cell, index) => {
        const y: number = cursor + 44 + index * ROW_HEIGHT;
        body.push(
          `<text x="${LABEL_X}" y="${y + 21}" class="row-label" fill="${armColor(cell.arm)}">${escapeXml(title(cell.arm))}</text>`,
          `<text x="${LABEL_X}" y="${y + 44}" class="row-status">${escapeXml(cell.status)}</text>`,
          `<rect x="${BAR_X}" y="${y + 3}" width="${BAR_MAXIMUM_WIDTH}" height="36" rx="7" class="track"/>`,
        );
        const measured: boolean = axis.measured?.(cell) ?? true;
        const phases: readonly IPhaseValue[] = measured ? axis.phase(cell) : [];
        if (measured)
          body.push(
            ...segments(phases, {
              arm: cell.arm,
              y,
              maximum,
              dataAttribute: "",
              remainder:
                axis.value(cell) -
                phases.reduce((sum, phase) => sum + phase.value, 0),
            }),
          );
        const baseline: ITtscEvidenceBenchmarkReportCell | undefined =
          cells.find((candidate) => candidate.arm === "plain");
        const comparable: boolean =
          measured &&
          baseline !== undefined &&
          (axis.measured?.(baseline) ?? true) &&
          axis.value(baseline) !== 0 &&
          cell.arm !== "plain";
        const delta: string = comparable
          ? ` (${Math.round((axis.value(cell) / axis.value(baseline!) - 1) * 100)}%)`
          : "";
        body.push(
          `<text x="${VALUE_X}" y="${y + 26}" text-anchor="end" class="value">${escapeXml(measured ? `${axis.format(axis.value(cell))}${delta}` : "unavailable")}</text>`,
        );
      });
      cursor += blockHeight + 16;
    });
    return document({
      height,
      title: `${title(props.subject)}: Plain against Evidence`,
      description:
        "Coverage of the provenance graph, then token spend, work time and API cost. Every spend axis carries the same stacked phase shades.",
      subtitle: `One subject, one instruction sequence, ${models}. The Evidence arm adds a compiler-enforced provenance graph.`,
      body,
      notes: API_PRICE_NOTES.map(
        (note, index) =>
          `<text x="${MARGIN}" y="${height - 47 + index * 15}" class="table-note">${escapeXml(note)}</text>`,
      ),
      generatedAt: props.report.generatedAt,
    });
  };

  /* ------------------------------------------------------------------ phases */

  type PhaseName =
    | "backend-development"
    | "backend-review"
    | "frontend-development"
    | "frontend-review"
    | "overall-review";

  interface IPhaseValue {
    name: PhaseName;
    short: string;
    value: number;
  }

  interface IPhaseMetric {
    title: string;
    description: string;
    subtitle: string;
    notes: readonly string[];
    dataAttribute: string;
    cellValue: (cell: ITtscEvidenceBenchmarkReportCell) => number;
    stageValue: (
      stage: ITtscEvidenceBenchmarkReportCell["stages"][number],
    ) => number;
    format: (value: number) => string;
  }

  const PHASES: readonly {
    name: PhaseName;
    label: string;
    short: string;
    hint: string;
  }[] = [
    {
      name: "backend-development",
      label: "Backend Dev",
      short: "BE Dev",
      hint: "First implementation of the schema, the API and their tests",
    },
    {
      name: "backend-review",
      label: "Backend Review",
      short: "BE Rev",
      hint: "Read the requirements and the backend in full, loop until dry",
    },
    {
      name: "frontend-development",
      label: "Frontend Dev",
      short: "FE Dev",
      hint: "Hooks and screens built against the generated SDK",
    },
    {
      name: "frontend-review",
      label: "Frontend Review",
      short: "FE Rev",
      hint: "The same loop until dry over the frontend, gated on live reloads rather than a build",
    },
    {
      name: "overall-review",
      label: "Overall Review",
      short: "Overall",
      hint: "Both layers and the live journeys together, loop until dry, then the closing gates",
    },
  ];

  const PHASE_OPACITY: readonly number[] = [0.44, 0.58, 0.7, 0.84, 1];

  const phaseValues = (
    cell: ITtscEvidenceBenchmarkReportCell,
    select: (
      stage: ITtscEvidenceBenchmarkReportCell["stages"][number],
    ) => number,
  ): readonly IPhaseValue[] => {
    const values: Record<PhaseName, number> = {
      "backend-development": 0,
      "backend-review": 0,
      "frontend-development": 0,
      "frontend-review": 0,
      "overall-review": 0,
    };
    for (const stage of cell.stages)
      values[stagePhase(stage.name)] += select(stage);
    return PHASES.map((phase) => ({
      name: phase.name,
      short: phase.short,
      value: values[phase.name],
    }));
  };

  const stagePhase = (stage: string): PhaseName => {
    // Supplementation reminders belong to the Review they supplement, however
    // many of them a scope needed. The bound lives on the instruction module, so
    // raising it there must not silently drop stages out of a chart here.
    const supplement =
      /^(backend|frontend|overall)-remind-([1-9][0-9]*)$/u.exec(stage);
    if (
      supplement !== null &&
      Number(supplement[2]) <=
        EvidenceBenchmarkInstruction.REVIEW_SUPPLEMENT_LIMIT
    )
      return `${supplement[1] as "backend" | "frontend" | "overall"}-review`;
    switch (stage) {
      case "backend-start":
        return "backend-development";
      case "backend-review":
      case "backend-remind":
      case "backend-final":
        return "backend-review";
      case "frontend-start":
        return "frontend-development";
      case "frontend-review":
      case "frontend-remind":
      case "frontend-final":
        return "frontend-review";
      case "overall-review":
      case "overall-remind":
      case "overall-final":
        return "overall-review";
      default:
        throw new Error(`Unknown benchmark stage: ${stage}`);
    }
  };

  /**
   * The stacked shades of one bar, and the remainder that belongs to no stage.
   *
   * The five phases sum to less than the number the same row prints, so the
   * widest bar stopped short of its own scale. The gap is not one named thing:
   * judging a Review is inside a cell's totals and inside no stage, but one
   * cell's stage records already contain its inspection and another's leave
   * more outside than inspection accounts for. The segment is therefore what it
   * can be proved to be, the part of the total no stage claims, and passing
   * zero draws the phases alone.
   *
   * A negative remainder is a real state rather than a guard: stage records can
   * sum above the total, because the total excludes idleness they keep. Nothing
   * is drawn for it, and the caller's axis maximum covers the overflow.
   */
  const segments = (
    phases: readonly IPhaseValue[],
    props: {
      arm: ITtscEvidenceBenchmarkReportCell["arm"];
      y: number;
      maximum: number;
      dataAttribute: string;
      remainder?: number;
    },
  ): string[] => {
    const data = (value: number): string =>
      props.dataAttribute === ""
        ? ""
        : ` data-${props.dataAttribute}="${value}"`;
    const body: string[] = [];
    let offset: number = 0;
    phases.forEach((phase, index) => {
      const width: number = (phase.value / props.maximum) * BAR_MAXIMUM_WIDTH;
      if (width <= 0) return;
      const opacity: number = PHASE_OPACITY[index] ?? PHASE_OPACITY.at(-1)!;
      body.push(
        `<rect x="${(BAR_X + offset).toFixed(2)}" y="${props.y + 3}" width="${width.toFixed(2)}" height="36" fill="${armColor(props.arm)}" fill-opacity="${opacity}" class="phase-segment" data-phase="${phase.name}"${data(phase.value)}/>`,
      );
      if (width >= phase.short.length * 6.5 + 12)
        body.push(
          `<text x="${(BAR_X + offset + width / 2).toFixed(2)}" y="${props.y + 27}" text-anchor="middle" class="segment-label">${escapeXml(phase.short)}</text>`,
        );
      offset += width;
    });
    const remainder: number = props.remainder ?? 0;
    const remainderWidth: number =
      (remainder / props.maximum) * BAR_MAXIMUM_WIDTH;
    if (remainderWidth > 0.5)
      body.push(
        `<rect x="${(BAR_X + offset).toFixed(2)}" y="${props.y + 3}" width="${remainderWidth.toFixed(2)}" height="36" fill="${UNATTRIBUTED_COLOR}" class="phase-segment" data-phase="unattributed"${data(remainder)}/>`,
      );
    return body;
  };

  /**
   * The shade key, one entry per line with what the stage actually is.
   *
   * Six shades of one colour across a row said which segment was which and
   * nothing about what any of them meant, and the names alone do not carry it:
   * a reader cannot tell from "Backend Review" that it is a loop that repeats
   * until a round changes nothing. Stacked vertically there is room to say so.
   */
  const phaseLegend = (): string[] =>
    [
      ...PHASES.map((phase, index) => ({
        fill: armColor("plain"),
        opacity: PHASE_OPACITY[index] ?? 1,
        label: phase.label,
        hint: phase.hint,
      })),
      {
        fill: UNATTRIBUTED_COLOR,
        opacity: 1,
        label: "Unattributed",
        hint: "The part of a total no stage record accounts for, judging a Review included",
      },
    ].flatMap((entry, index) => {
      const y: number = LEGEND_TOP + index * LEGEND_ROW_HEIGHT;
      return [
        `<rect x="${MARGIN}" y="${y}" width="18" height="12" rx="3" fill="${entry.fill}" fill-opacity="${entry.opacity}"/>`,
        `<text x="${MARGIN + 26}" y="${y + 11}" class="legend-label">${escapeXml(entry.label)}</text>`,
        `<text x="${MARGIN + 176}" y="${y + 11}" class="legend">${escapeXml(entry.hint)}</text>`,
      ];
    });

  /* ----------------------------------------------------------------- charts */

  const renderPhaseChart = (props: IProps, metric: IPhaseMetric): string => {
    const groups: [string, ITtscEvidenceBenchmarkReportCell[]][] = [
      ...Map.groupBy(props.report.cells, (cell) => cell.subject),
    ];
    const groupHeight = (
      cells: readonly ITtscEvidenceBenchmarkReportCell[],
    ): number => 44 + Math.max(1, cells.length) * ROW_HEIGHT + 14;
    const groupContentHeight: number = Math.max(
      64,
      groups.reduce((sum, [, cells]) => sum + groupHeight(cells) + 16, -16),
    );
    const coverage = renderCoverage(props, {
      title: "Requirement Coverage",
      top: HEADER_HEIGHT,
      rowHeight: 40,
    });
    const coverageHeight: number =
      coverage.height === 0
        ? 0
        : coverage.height + 16 + 20 + coverage.notes * 15;
    const height: number =
      HEADER_HEIGHT +
      coverageHeight +
      groupContentHeight +
      (metric.notes.length * 15 + 30) +
      36;
    const maximum: number = Math.max(
      1,
      ...props.report.cells.map((cell) =>
        Math.max(
          metric.cellValue(cell),
          phaseValues(cell, metric.stageValue).reduce(
            (sum, phase) => sum + phase.value,
            0,
          ),
        ),
      ),
    );
    let cursor: number = HEADER_HEIGHT + coverageHeight;
    const body: string[] = [...coverage.body];
    groups.forEach(([subject, unsorted], groupIndex) => {
      const cells: ITtscEvidenceBenchmarkReportCell[] = [...unsorted].sort(
        (left, right) =>
          armOrder(left.arm) - armOrder(right.arm) ||
          left.model.localeCompare(right.model),
      );
      const blockHeight: number = groupHeight(cells);
      const models: string = [
        ...new Set(cells.map((cell) => displayModel(cell.model))),
      ].join(", ");
      body.push(
        `<rect x="${MARGIN - 8}" y="${cursor}" width="${WIDTH - 2 * MARGIN + 16}" height="${blockHeight}" rx="10" class="group" fill-opacity="${groupIndex % 2 === 0 ? "0.78" : "0.42"}"/>`,
        `<text x="${LABEL_X}" y="${cursor + 29}" class="group-title">${escapeXml(title(subject))}</text>`,
        `<text x="${VALUE_X}" y="${cursor + 28}" text-anchor="end" class="group-meta">${escapeXml(models)}</text>`,
      );
      cells.forEach((cell, index) => {
        const y: number = cursor + 44 + index * ROW_HEIGHT;
        const baseline: ITtscEvidenceBenchmarkReportCell | undefined =
          cells.find(
            (candidate) =>
              candidate.arm === "plain" && candidate.model === cell.model,
          );
        body.push(
          `<text x="${LABEL_X}" y="${y + 21}" class="row-label" fill="${armColor(cell.arm)}">${escapeXml(title(cell.arm))}</text>`,
          `<text x="${LABEL_X}" y="${y + 44}" class="row-status">${escapeXml(cell.status)}</text>`,
          `<rect x="${BAR_X}" y="${y + 3}" width="${BAR_MAXIMUM_WIDTH}" height="36" rx="7" class="track"/>`,
        );
        const phases: readonly IPhaseValue[] = phaseValues(
          cell,
          metric.stageValue,
        );
        body.push(
          ...segments(phases, {
            arm: cell.arm,
            y,
            maximum,
            dataAttribute: metric.dataAttribute,
            remainder:
              metric.cellValue(cell) -
              phases.reduce((sum, phase) => sum + phase.value, 0),
          }),
          `<text x="${VALUE_X}" y="${y + 19}" text-anchor="end" class="value">${escapeXml(phaseValueLabel(cell, baseline, metric))}</text>`,
          `<text x="${VALUE_X}" y="${y + 43}" text-anchor="end" class="cost-value">${escapeXml(formatApiCostLine(cell))}</text>`,
        );
      });
      cursor += blockHeight + 16;
    });
    if (props.report.cells.length === 0)
      body.push(
        `<text x="${LABEL_X}" y="${HEADER_HEIGHT + 28}" class="empty">No launched cells</text>`,
      );
    return document({
      height,
      title: metric.title,
      description: metric.description,
      subtitle: metric.subtitle,
      body,
      notes: metric.notes.map(
        (note, index) =>
          `<text x="${MARGIN}" y="${height - 34 - (metric.notes.length - 1 - index) * 15}" class="table-note">${escapeXml(note)}</text>`,
      ),
      generatedAt: props.report.generatedAt,
    });
  };

  /**
   * The coverage block, or nothing when no coverage has been measured.
   *
   * Rows follow the order the subjects appear in the report, which is the order
   * the spend groups below use, so the two blocks cannot disagree about which
   * subject comes first. An arm that is complete by construction has nothing to
   * say per subject, so its identical rows collapse into one.
   */
  const renderCoverage = (
    props: IProps,
    layout: { title: string; top: number; rowHeight: number },
  ): { body: string[]; height: number; notes: number } => {
    const subjects: string[] = [
      ...new Set(props.report.cells.map((cell) => cell.subject)),
    ];
    // A coverage entry is drawn only when the report carries the cell it
    // describes. Matching on the subject alone would let another model's figure
    // appear beside this one's spend, under a row label that names neither.
    const charted: ReadonlySet<string> = new Set(
      props.report.cells.map((cell) => `${cell.model}/${cell.subject}`),
    );
    const relevant: ICoverage[] = props.coverage.filter((entry) =>
      charted.has(`${entry.model}/${entry.subject}`),
    );
    const measured: ICoverage[] = subjects.flatMap((subject) =>
      relevant.filter((entry) => entry.subject === subject && entry.measured),
    );
    const asserted: ICoverage[] = relevant.filter(
      (entry) => entry.measured === false,
    );
    const collapsed: boolean =
      asserted.length > 1 &&
      new Set(asserted.map((entry) => `${entry.arm}/${entry.score}`)).size ===
        1;
    const rows: { label: string; percent: number; arm: ICoverage["arm"] }[] = [
      ...measured.map((entry) => ({
        label: `${title(entry.subject)} ${title(entry.arm)}`,
        percent: entry.score * 100,
        arm: entry.arm,
      })),
      ...(collapsed
        ? [
            {
              label: `${title(asserted[0]!.arm)} (every)`,
              percent: asserted[0]!.score * 100,
              arm: asserted[0]!.arm,
            },
          ]
        : asserted.map((entry) => ({
            label: `${title(entry.subject)} ${title(entry.arm)}`,
            percent: entry.score * 100,
            arm: entry.arm,
          }))),
    ];
    if (rows.length === 0) return { body: [], height: 0, notes: 0 };
    const notes: string[] = [
      COVERAGE_COMPOSITION_NOTE,
      ...(asserted.length === 0
        ? []
        : [
            `${title(asserted[0]!.arm)} is complete by construction: the compiler rejects a missing edge, so nothing is counted.`,
          ]),
    ];
    const height: number = 52 + rows.length * layout.rowHeight + 14;
    const body: string[] = [
      `<rect x="${MARGIN - 8}" y="${layout.top}" width="${WIDTH - 2 * MARGIN + 16}" height="${height}" rx="10" class="group" fill-opacity="0.78"/>`,
      `<text x="${LABEL_X}" y="${layout.top + 31}" class="group-title">${escapeXml(layout.title)}</text>`,
      `<text x="${VALUE_X}" y="${layout.top + 30}" text-anchor="end" class="group-meta">higher is better</text>`,
    ];
    // Bars here reach 100% of their track, so a value pinned to the right margin
    // sits on top of the bar it labels. Each reads just past its own end instead,
    // which also puts the number where the eye already is.
    rows.forEach((row, index) => {
      const y: number = layout.top + 52 + index * layout.rowHeight;
      const filled: number = (row.percent / 100) * BAR_MAXIMUM_WIDTH;
      body.push(
        `<text x="${LABEL_X}" y="${y + 24}" class="row-label" fill="${armColor(row.arm)}">${escapeXml(row.label)}</text>`,
        `<rect x="${BAR_X}" y="${y + 3}" width="${BAR_MAXIMUM_WIDTH}" height="30" rx="7" class="track"/>`,
        `<rect x="${BAR_X}" y="${y + 3}" width="${filled.toFixed(2)}" height="30" rx="7" fill="${armColor(row.arm)}" data-coverage="${row.percent}"/>`,
        `<text x="${VALUE_X}" y="${y + 25}" text-anchor="end" class="value" fill="${armColor(row.arm)}">${row.percent.toFixed(1)}%</text>`,
      );
    });
    body.push(
      ...notes.map(
        (note, index) =>
          `<text x="${MARGIN}" y="${layout.top + height + 18 + index * 15}" class="table-note">${escapeXml(note)}</text>`,
      ),
    );
    return { body, height, notes: notes.length };
  };

  /** The frame every chart shares: title, subtitle, shade key, and footer. */
  const document = (props: {
    height: number;
    title: string;
    description: string;
    subtitle: string;
    body: readonly string[];
    notes: readonly string[];
    generatedAt: string;
  }): string =>
    [
      `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title description" viewBox="0 0 ${WIDTH} ${props.height}" width="${WIDTH}" height="${props.height}">`,
      `<title id="title">${escapeXml(props.title)}</title>`,
      `<desc id="description">${escapeXml(props.description)}</desc>`,
      CHART_STYLE,
      `<rect width="${WIDTH}" height="${props.height}" fill="#ffffff"/>`,
      `<text x="${MARGIN}" y="38" class="title">${escapeXml(props.title)}</text>`,
      `<text x="${MARGIN}" y="62" class="subtitle">${escapeXml(props.subtitle)}</text>`,
      ...phaseLegend(),
      ...props.body,
      ...props.notes,
      `<text x="${MARGIN}" y="${props.height - 14}" class="generated">Generated ${escapeXml(props.generatedAt)}</text>`,
      "</svg>",
      "",
    ].join("\n");

  /* ----------------------------------------------------------------- layout */

  const WIDTH: number = 1_440;
  const MARGIN: number = 36;
  const LABEL_X: number = 60;
  const BAR_X: number = 210;
  // The track runs to where the value text begins rather than stopping at a
  // round number, because a bar that ends 300px short of the canvas reads as a
  // bar that fell short. Only the widest label needs to clear it.
  const BAR_MAXIMUM_WIDTH: number = WIDTH - MARGIN - BAR_X - 200;
  const VALUE_X: number = WIDTH - MARGIN;
  const ROW_HEIGHT: number = 68;
  const LEGEND_TOP: number = 80;
  const LEGEND_ROW_HEIGHT: number = 20;

  /** Where a chart's content begins, below title, subtitle and the shade key. */
  const HEADER_HEIGHT: number =
    LEGEND_TOP + (PHASES.length + 1) * LEGEND_ROW_HEIGHT + 22;

  const UNATTRIBUTED_COLOR: string = "#94a3b8";

  /** Two lines rather than one: a single note ran 130px past the canvas. */
  const API_PRICE_NOTES: readonly string[] = [
    "API cost uses OpenRouter rates from 2026-08-01, emitted only after every measured request reconciles with retained counters.",
    "Review inspection runs on the cell's own model and effort, so its tokens, time and price all sit inside these totals.",
  ];

  const COVERAGE_COMPOSITION_NOTE: string =
    "Coverage composes thirteen reference-graph edges so serial hops multiply and branches average; each edge's population is in the aggregate.";

  /** One stylesheet for every chart this module writes. */
  const CHART_STYLE: string = [
    "<style>",
    "  text { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; fill: #172033; }",
    "  .title { font-size: 27px; font-weight: 700; }",
    "  .subtitle, .generated, .group-meta, .row-status { font-size: 13px; fill: #667085; }",
    "  .group { fill: #e8f2fb; }",
    "  .group-title { font-size: 21px; font-weight: 700; }",
    "  .row-label { font-size: 17px; font-weight: 700; }",
    "  .value { font-size: 16px; font-weight: 700; }",
    "  .cost-value { font-size: 13px; font-weight: 600; fill: #526b82; }",
    "  .legend { font-size: 12px; fill: #667085; }",
    "  .legend-label { font-size: 12px; font-weight: 700; fill: #334155; }",
    "  .segment-label { font-size: 10px; font-weight: 700; fill: #ffffff; paint-order: stroke; stroke: #172033; stroke-opacity: 0.28; stroke-width: 1px; }",
    "  .phase-segment { stroke: #ffffff; stroke-opacity: 0.86; stroke-width: 1px; }",
    "  .track { fill: #e7edf4; stroke: #d5dee9; stroke-width: 1px; }",
    "  .empty { font-size: 15px; fill: #667085; }",
    "  .table-note { font-size: 11px; fill: #667085; }",
    "</style>",
  ].join("\n");

  /* ------------------------------------------------------------- formatting */

  const phaseValueLabel = (
    cell: ITtscEvidenceBenchmarkReportCell,
    baseline: ITtscEvidenceBenchmarkReportCell | undefined,
    metric: IPhaseMetric,
  ): string => {
    const value: number = metric.cellValue(cell);
    const baselineValue: number | undefined =
      baseline === undefined ? undefined : metric.cellValue(baseline);
    if (
      cell.arm !== "evidence" ||
      baselineValue === undefined ||
      baselineValue <= 0
    )
      return metric.format(value);
    const change: number = Math.round((value / baselineValue - 1) * 100);
    return `${metric.format(value)} (${change > 0 ? "+" : ""}${change}%)`;
  };

  /**
   * The two axes that carry no bar of their own.
   *
   * Work time and price track token spend closely enough that three charts of
   * the same shape said one thing three times. They read as text beside the bar
   * that does carry a shape, where a reader who wants them finds them and a
   * reader comparing spend is not asked to compare three pictures.
   */
  const formatApiCostLine = (
    cell: ITtscEvidenceBenchmarkReportCell,
  ): string => {
    const time: string = formatDuration(cell.workElapsedMs);
    if (cell.apiCost === null) return `${time} · API cost unavailable`;
    return `${time} · $${formatPrice(cell.apiCost.amountUsd)}`;
  };

  const armOrder = (arm: ITtscEvidenceBenchmarkReportCell["arm"]): number =>
    arm === "plain" ? 0 : 1;

  const armColor = (arm: ITtscEvidenceBenchmarkReportCell["arm"]): string =>
    arm === "plain" ? "#4c78a8" : "#f58518";

  const formatPrice = (value: number): string =>
    value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const formatTokens = (tokens: number): string => {
    if (tokens < 1_000) return `${tokens} tokens`;
    if (tokens < 1_000_000)
      return `${stripTrailingZero((tokens / 1_000).toFixed(1))}k tokens`;
    return `${stripTrailingZero((tokens / 1_000_000).toFixed(1))}M tokens`;
  };

  const formatDuration = (elapsedMs: number): string => {
    const minutes: number = Math.round(elapsedMs / 60_000);
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  };

  const stripTrailingZero = (value: string): string =>
    value.replace(/\.0$/u, "");

  const title = (value: string): string =>
    `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

  /**
   * Names the model as the engine that ran it names it.
   *
   * Title-casing it produced `GPT-5.6-Luna`, which is nothing the runner, the
   * session or the price list calls it. A reader who wants to reproduce a
   * figure needs the string those accept, and the engine is part of it.
   */
  const displayModel = (model: string): string => `codex ${model}`;

  const escapeXml = (value: string): string =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
}
