"use client";

import TtscWebsiteBenchmarkEvidenceCoverage from "../../components/benchmark/evidence/TtscWebsiteBenchmarkEvidenceCoverage";
import TtscWebsiteLandingFadeIn from "./TtscWebsiteLandingFadeIn";
import TtscWebsiteLandingSectionEyebrow from "./TtscWebsiteLandingSectionEyebrow";

const COMMENT = "text-blue-400";

/**
 * The three kinds a tag can name: a document section, an API operation and a
 * TypeScript symbol.
 *
 * Every reason is a placeholder. A real one states why this declaration answers
 * for that unit, in the author's own words, and a specimen short enough for a
 * landing card would read as the sort of filler the rule exists to refuse.
 */
const TARGETS = [
  "docs/discount.md#coupon-stacking",
  "POST:/orders/{orderId}/coupons",
  "{@link hooks.useCouponStacking}",
] as const;

/** Column the placeholder reasons align on, one space past the widest target. */
const REASON_COLUMN = Math.max(...TARGETS.map((target) => target.length)) + 1;

/** The same three targets, as the build reports them before anyone cites one. */
const UNCITED = [
  "'docs/discount.md#coupon-stacking'",
  "'POST:/orders/{orderId}/coupons'",
  "'useCouponStacking'",
] as const;

const CARD =
  "overflow-hidden rounded-2xl border border-[#235a97] bg-[#102a43] shadow-[0_24px_60px_rgba(35,90,151,0.22)]";

/**
 * Code type size, small enough that the widest line clears the card.
 *
 * The pre is a scroll container, so an overflowing line scrolls in place rather
 * than widening its grid track, and the headline column beside it keeps the
 * width the layout gives it.
 */
const PRE =
  "overflow-x-auto p-4 font-mono text-[12px] leading-[1.65] text-blue-50 md:px-5";

function CardChrome({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#3f6f99] bg-[#173f66] px-4 py-2">
      <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
      <span className="ml-3 font-mono text-[11px] text-blue-200">{label}</span>
    </div>
  );
}

export default function TtscWebsiteLandingEvidenceGraph() {
  return (
    <section className="relative overflow-hidden bg-white px-6 py-24 md:py-32">
      <div className="relative mx-auto max-w-6xl">
        <TtscWebsiteLandingFadeIn>
          <TtscWebsiteLandingSectionEyebrow label="Requirement coverage" />
          <div className="grid gap-10 lg:grid-cols-[1.14fr_0.86fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-[#102a43] md:text-5xl">
                Your spec, as a compile error no agent can skip.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#526b82]">
                <code className="font-mono font-semibold text-[#235a97]">
                  @ttsc/evidence
                </code>{" "}
                fails the build once per obligation, because one reference never
                covers another.{" "}
                <code className="font-mono font-semibold text-[#235a97]">
                  @evidence &lt;target&gt; &lt;reason&gt;
                </code>{" "}
                closes one, by naming a unit of the spec and why this
                declaration answers for it.
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-[#526b82]">
                An AI coding agent has to clear those errors to finish. Coverage
                reaches 100% on its own, as the residue of the ones it closed.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/docs/setup/evidence"
                  className="rounded-full bg-[#235a97] px-6 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(35,90,151,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1c4a7e]"
                >
                  Wire one claim
                </a>
                <a
                  href="/docs/evidence"
                  className="rounded-full border border-[#9fc7eb] bg-white px-6 py-3 text-sm font-semibold text-[#235a97] transition-colors hover:border-[#3178c6] hover:bg-[#eef6ff]"
                >
                  Read the guide
                </a>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className={CARD}>
                <CardChrome label="CouponStackingNotice.tsx" />
                <pre className={PRE}>
                  <div className={COMMENT}>/**</div>
                  {TARGETS.map((target) => (
                    <div key={target}>
                      <span className={COMMENT}> * </span>
                      <span className="text-emerald-300">@evidence </span>
                      <span className="text-amber-300">
                        {target.padEnd(REASON_COLUMN)}
                      </span>
                      <span className="text-blue-100">&lt;reason...&gt;</span>
                    </div>
                  ))}
                  <div className={COMMENT}> */</div>
                  <div>
                    <span className="text-sky-300">export function </span>
                    CouponStackingNotice(props: IProps)
                  </div>
                </pre>
              </div>

              <div className={CARD}>
                <CardChrome label="$ npx ttsc" />
                <pre className={PRE}>
                  {UNCITED.map((target) => (
                    <div key={target}>
                      <div>
                        <span className="text-red-300">error </span>
                        <span className="text-sky-300">TS16411</span>
                        <span>
                          : [evidence/graph] Missing acknowledgement for
                        </span>
                      </div>
                      <div className="text-amber-300">
                        {"  "}
                        {target}
                      </div>
                    </div>
                  ))}
                  {"\n"}
                  <div className="text-blue-300">Found 3 errors.</div>
                </pre>
              </div>
            </div>
          </div>
        </TtscWebsiteLandingFadeIn>

        <TtscWebsiteLandingFadeIn delay={120}>
          <div className="mt-12">
            <TtscWebsiteBenchmarkEvidenceCoverage
              className=""
              expandable={false}
            />
            <p className="mt-3 font-mono text-xs text-[#60778e]">
              codex gpt-5.6-luna, four subjects. Thirteen edges and token spend:{" "}
              <a
                href="/docs/benchmark/evidence"
                className="text-[#235a97] underline-offset-2 hover:underline"
              >
                full benchmark
              </a>
              .
            </p>
          </div>
        </TtscWebsiteLandingFadeIn>
      </div>
    </section>
  );
}
