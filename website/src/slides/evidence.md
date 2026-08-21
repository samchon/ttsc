---
marp: true
theme: default
paginate: true
size: 16:9
title: "Evidence Graph"
description: "Enforce 100% specification coverage through compile errors so coding agents cannot skip obligations."
url: "https://ttsc.dev/slides/evidence/"
image: "https://ttsc.dev/og-evidence.png"
style: |
  section {
    font-family: "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif;
    font-size: 32px;
    line-height: 1.6;
    padding: 60px 70px;
    background: #ffffff;
    color: #14161a;
  }
  h1 {
    font-size: 50px;
    color: #0f1115;
    border-bottom: 4px solid #14284b;
    padding-bottom: 14px;
    margin-bottom: 34px;
  }
  ul, ol { margin-top: 10px; }
  li { margin-bottom: 22px; }
  strong { color: #14284b; }
  code { font-family: "D2Coding", "Consolas", "Menlo", monospace; }
  pre { font-size: 26px; line-height: 1.5; border-radius: 10px; }
  table { font-size: 30px; width: 100%; }
  th { background: #14284b; color: #ffffff; }
  td, th { padding: 14px 18px; }
  blockquote {
    border-left: 8px solid #ffb020;
    background: #fff8e8;
    color: #2b3038;
    padding: 18px 26px;
    font-size: 32px;
  }
  footer { color: #9aa4b2; font-size: 17px; }
  footer a { color: #9aa4b2; text-decoration: none; }
  section::after { color: #9aa4b2; font-size: 17px; }
  a { color: #1a5fb4; }
  a:hover { color: #0d3d7a; }

  /* Dark slides */
  section.dark {
    background: #0f1115;
    color: #f4f5f7;
    justify-content: center;
  }
  section.dark h1 { color: #ffffff; border-bottom: none; font-size: 60px; }
  section.dark h2 { color: #8ab4ff; font-size: 34px; font-weight: 600; }
  section.dark strong { color: #ffd479; }
  section.dark li { color: #f4f5f7; }
  section.dark code { background: #262b36; color: #ffd479; }
  section.dark .note { color: #a7b0be; }
  section.dark a { color: #8ab4ff; }
  section.divider {
    background: #14284b;
    color: #ffffff;
    justify-content: center;
    text-align: center;
  }
  section.divider h1 { color: #ffffff; border-bottom: none; font-size: 72px; }
  section.divider p { color: #b9c9e6; font-size: 40px; }
  section.divider .note { color: #b9c9e6; font-size: 40px; }
  section.loop-slide ul { margin-top: 32px; }
  section.loop-slide li { margin-bottom: 18px; font-size: 40px; }

  /* Opening summary */
  .tldr-layout {
    display: grid;
    grid-template-columns: 60fr 40fr;
    gap: 32px;
    align-items: center;
    margin-top: 24px;
  }
  .opening-summary {
    font-size: 34px;
    line-height: 1.35;
  }
  .opening-summary ul { margin: 0; padding-left: 1.1em; }
  .opening-summary li { margin-bottom: 10px; }
  .opening-summary ul ul { margin: 6px 0 12px; font-size: 28px; line-height: 1.3; }
  .opening-summary ul ul li { margin-bottom: 4px; }
  .benchmark-graphs { display: flex; flex-direction: column; gap: 18px; }
  .opening-measure { padding: 16px; background: #f3f6fb; border-radius: 12px; }
  .opening-measure-title { margin-bottom: 12px; font-size: 30px; font-weight: 700; }
  .opening-bar-row {
    display: grid;
    grid-template-columns: 108px 1fr 92px;
    gap: 8px;
    align-items: center;
    margin-top: 10px;
    font-size: 26px;
  }
  .opening-bar-row span { white-space: nowrap; }
  .opening-bar-row strong { text-align: right; white-space: nowrap; }
  .opening-bar { height: 22px; overflow: hidden; background: #e2e7ef; border-radius: 11px; }
  .opening-bar i { display: block; height: 100%; background: #4a76b8; border-radius: 10px; }
  .opening-bar-row.evidence .opening-bar i { background: #f08a24; }
  .opening-bar i.coverage-plain { width: 51.6%; }
  .opening-bar i.coverage-evidence { width: 100%; }
  .opening-bar i.token-plain { width: 100%; }
  .opening-bar i.token-evidence { width: 7.5%; }
  .benchmark-context { color: #5b6674; font-size: 28px; text-align: center; }
  .note { font-size: 28px; color: #5b6674; }

  /* Cumulative narrative references */
  .narrative-graph { position: relative; height: 410px; margin-top: -12px; }
  .narrative-group {
    position: absolute;
    left: 0;
    top: 10px;
    width: 32%;
    height: 270px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    box-sizing: border-box;
    padding: 12px;
    border: 3px solid #f08a24;
    border-radius: 14px;
  }
  .narrative-node {
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: 84px;
    background: #f3f6fb;
    border: 3px solid #4a76b8;
    border-radius: 10px;
    color: #14284b;
    font-size: 32px;
    font-weight: 700;
  }
  .narrative-group .narrative-node { flex: none; width: 100%; border-color: #f08a24; }
  .narrative-node.scenarios,
  .narrative-node.storylines,
  .narrative-node.manuscripts { position: absolute; width: 25%; }
  .narrative-node.scenarios { left: 41%; top: 181px; }
  .narrative-node.storylines { left: 41%; top: 25px; }
  .narrative-node.manuscripts { left: 72%; top: 316px; }
  .narrative-edge {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    color: #4a76b8;
  }
  .narrative-edge.to-foundations {
    left: 32%;
    width: 9%;
    border-top: 3px solid currentColor;
  }
  .narrative-edge.to-foundations::after,
  .narrative-edge.manuscripts-scenarios::after,
  .narrative-edge.manuscripts-storylines::after {
    content: "";
    position: absolute;
    top: -8px;
    left: -1px;
    border-top: 7px solid transparent;
    border-right: 12px solid currentColor;
    border-bottom: 7px solid transparent;
  }
  .narrative-edge.scenarios-foundations { top: 223px; }
  .narrative-edge.storylines-foundations { top: 67px; }
  .narrative-edge.storylines-scenarios {
    left: 53.5%;
    top: 109px;
    height: 72px;
    border-left: 3px solid currentColor;
  }
  .narrative-edge.manuscripts-foundations::after {
    content: "";
    position: absolute;
    top: -1px;
    left: -8px;
    border-right: 7px solid transparent;
    border-bottom: 12px solid currentColor;
    border-left: 7px solid transparent;
  }
  .narrative-edge.storylines-scenarios::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: -8px;
    border-top: 12px solid currentColor;
    border-right: 7px solid transparent;
    border-left: 7px solid transparent;
  }
  .narrative-edge.settings-principles {
    position: relative;
    left: auto;
    top: auto;
    flex: none;
    align-self: center;
    width: 0;
    height: 72px;
    color: #f08a24;
    border-left: 3px solid currentColor;
  }
  .narrative-edge.settings-principles::after {
    content: "";
    position: absolute;
    top: -1px;
    left: -8px;
    border-right: 7px solid transparent;
    border-bottom: 12px solid currentColor;
    border-left: 7px solid transparent;
  }
  .narrative-edge.manuscripts-scenarios {
    left: 66%;
    top: 223px;
    width: 18.5%;
    border-top: 3px solid currentColor;
  }
  .narrative-edge.manuscripts-storylines {
    left: 66%;
    top: 67px;
    width: 18.5%;
    border-top: 3px solid currentColor;
  }
  .narrative-edge.manuscripts-up {
    left: 84.5%;
    top: 67px;
    height: 249px;
    border-left: 3px solid currentColor;
  }
  .narrative-edge.manuscripts-foundations {
    left: 16%;
    top: 280px;
    width: 56%;
    height: 78px;
    border-bottom: 3px solid currentColor;
    border-left: 3px solid currentColor;
  }

  /* Application evidence circuits */
  section.architecture-slide h1 { margin-bottom: 0; }
  .architecture-caption {
    margin: 12px 0 0;
    color: #5b6674;
    font-size: 28px;
    line-height: 1.3;
    text-align: center;
    white-space: nowrap;
  }
  .backend-graph + .architecture-caption,
  .frontend-graph + .architecture-caption { font-size: 32px; }
  .architecture-node {
    position: absolute;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    height: 72px;
    background: #f3f6fb;
    border: 3px solid #4a76b8;
    border-radius: 10px;
    color: #14284b;
    font-size: 30px;
    font-weight: 700;
  }
  .architecture-edge {
    position: absolute;
    z-index: 1;
    box-sizing: border-box;
    color: #4a76b8;
  }
  .architecture-edge.horizontal { border-top: 3px solid currentColor; }
  .architecture-edge.vertical { border-left: 3px solid currentColor; }
  .architecture-edge.arrow-left::after {
    content: "";
    position: absolute;
    top: -8px;
    left: -1px;
    border-top: 7px solid transparent;
    border-right: 12px solid currentColor;
    border-bottom: 7px solid transparent;
  }
  .architecture-edge.arrow-up::after {
    content: "";
    position: absolute;
    top: -1px;
    left: -8px;
    border-right: 7px solid transparent;
    border-bottom: 12px solid currentColor;
    border-left: 7px solid transparent;
  }
  .architecture-edge.arrow-down::after {
    content: "";
    position: absolute;
    bottom: -1px;
    left: -8px;
    border-top: 12px solid currentColor;
    border-right: 7px solid transparent;
    border-left: 7px solid transparent;
  }

  .document-graph { position: relative; height: 305px; margin-top: 60px; }
  .backend-graph,
  .frontend-graph { position: relative; height: 365px; margin-top: 45px; }
  .architecture-foundations {
    position: absolute;
    left: 0;
    top: 20px;
    width: 31%;
    height: 264px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    padding: 12px;
    border: 3px solid #f08a24;
    border-radius: 14px;
  }
  .architecture-foundations .architecture-node {
    position: relative;
    flex: none;
    width: 100%;
    background: #fff8e8;
    border-color: #f08a24;
  }
  .architecture-foundations .specifications-requirements {
    position: relative;
    left: auto;
    top: auto;
    flex: none;
    align-self: center;
    width: 0;
    height: 90px;
    color: #f08a24;
    border-left: 3px solid currentColor;
  }
  .document-foundations { left: 30%; }
  .document-node.idea { left: 0; top: 35px; width: 22%; }
  .document-node.implementation { left: 70%; top: 35px; width: 22%; }
  .document-node.test { left: 70%; top: 197px; width: 22%; }
  .document-edge.requirements-idea { left: 22%; top: 71px; width: 9.3%; }
  .document-edge.implementation-foundations { left: 61%; top: 71px; width: 9%; }
  .document-edge.test-implementation { left: 81%; top: 107px; height: 90px; }
  .document-edge.test-foundations { left: 61%; top: 233px; width: 9%; }
  .document-graph.requirements-only .document-foundations { left: 12%; }
  .document-graph.requirements-only .document-node.implementation { left: 66%; }
  .document-graph.requirements-only .document-node.test { left: 66%; }
  .document-graph.requirements-only .document-edge.implementation-foundations { left: 43%; width: 23%; }
  .document-graph.requirements-only .document-edge.test-implementation { left: 77%; }
  .document-graph.requirements-only .document-edge.test-foundations { left: 43%; width: 23%; }
  .backend-graph .architecture-foundations,
  .frontend-graph .architecture-foundations { top: 55px; }
  .backend-node.database { left: 40%; top: 70px; width: 22%; }
  .backend-node.operation { left: 40%; top: 232px; width: 22%; }
  .backend-node.schema { left: 70%; top: 70px; width: 22%; }
  .backend-node.test { left: 70%; top: 232px; width: 22%; }
  .backend-edge.database-foundations { left: 31%; top: 106px; width: 9%; }
  .backend-edge.operation-foundations { left: 31%; top: 268px; width: 9%; }
  .backend-edge.operation-database { left: 51%; top: 142px; height: 90px; }
  .backend-edge.schema-database { left: 62%; top: 106px; width: 8%; }
  .backend-edge.test-operation { left: 62%; top: 268px; width: 8%; }
  .architecture-edge.outer-top-source { left: 81%; top: 15px; height: 55px; }
  .architecture-edge.outer-top-horizontal { left: 15.5%; top: 15px; width: 65.5%; }
  .architecture-edge.outer-top-target { left: 15.5%; top: 15px; height: 40px; }
  .architecture-edge.outer-bottom-source { left: 81%; top: 304px; height: 55px; }
  .architecture-edge.outer-bottom-horizontal { left: 15.5%; top: 359px; width: 65.5%; }
  .architecture-edge.outer-bottom-target { left: 15.5%; top: 319px; height: 40px; }

  .frontend-node.backend {
    left: 40%;
    top: 70px;
    width: 22%;
    background: #14284b;
    border: 4px solid #14284b;
    box-shadow: inset 0 0 0 4px #8ab4ff;
    color: #ffffff;
  }
  .frontend-node.hooks { left: 40%; top: 232px; width: 22%; }
  .frontend-node.journeys { left: 70%; top: 70px; width: 22%; }
  .frontend-node.screens { left: 70%; top: 232px; width: 22%; }
  .frontend-edge.backend-foundations { left: 31%; top: 106px; width: 9%; }
  .frontend-edge.hooks-backend { left: 51%; top: 142px; height: 90px; }
  .frontend-edge.screens-hooks { left: 62%; top: 268px; width: 8%; }
  .frontend-edge.journeys-screens { left: 81%; top: 142px; height: 90px; }

  /* Cards */
  .cards { display: flex; gap: 22px; margin-top: 20px; }
  .card {
    flex: 1;
    background: #f3f6fb;
    border-top: 7px solid #4a76b8;
    border-radius: 10px;
    padding: 22px 24px;
    font-size: 30px;
    line-height: 1.5;
  }
  .card b { display: block; font-size: 40px; color: #14284b; margin-bottom: 8px; }
  .card .note { font-size: 28px; }
  .card.warm { border-top-color: #f08a24; }
  .card.warm b { color: #b35c00; }

  /* Review checklist */
  section.review-checklist table {
    display: table;
    width: 100%;
    max-width: none;
    margin-right: 0;
    margin-left: 0;
    table-layout: fixed;
    border-collapse: separate;
    border-spacing: 0 10px;
    font-size: 29px;
  }
  section.review-checklist th,
  section.review-checklist td {
    box-sizing: border-box;
    padding: 14px 20px;
    border: 0;
    white-space: nowrap;
  }
  section.review-checklist th:first-child,
  section.review-checklist td:first-child { width: 33.333%; }
  section.review-checklist th:nth-child(2),
  section.review-checklist td:nth-child(2) { width: 33.333%; }
  section.review-checklist th:nth-child(3),
  section.review-checklist td:nth-child(3) { width: 33.334%; }
  section.review-checklist th {
    background: #14284b;
    color: #ffffff;
    font-weight: 700;
  }
  section.review-checklist th:first-child { border-radius: 10px 0 0 10px; }
  section.review-checklist th:last-child { border-radius: 0 10px 10px 0; }
  section.review-checklist td {
    color: #14161a;
    font-weight: 400;
  }
  section.review-checklist td:first-child {
    border-radius: 10px 0 0 10px;
  }
  section.review-checklist td:last-child {
    border-radius: 0 10px 10px 0;
  }
  section.review-checklist td:first-child { background: #eef2f7; }
  section.review-checklist td:nth-child(2) { background: #dce8f6; }
  section.review-checklist td:nth-child(3) { background: #c5d9f0; }
  .problem-measures { display: flex; flex-direction: column; gap: 12px; width: 94%; margin: 4px auto 0; }
  .problem-measure-title { margin-bottom: 8px; font-size: 32px; font-weight: 700; }
  .problem-bar {
    display: flex;
    width: 100%;
    height: 70px;
    overflow: hidden;
    background: #e2e7ef;
    border-radius: 14px;
  }
  .problem-bar div { display: flex; align-items: center; justify-content: center; font-weight: 800; }
  .problem-coverage { width: 51.6%; background: #4a76b8; color: #ffffff; font-size: 38px; }
  .problem-build { width: 10%; background: #14284b; color: #ffffff; font-size: 28px; }
  .problem-review { width: 90%; background: #9bb4d2; color: #14284b; font-size: 38px; }
  .problem-legend { display: flex; justify-content: center; gap: 54px; margin-top: 6px; font-size: 28px; }
  .problem-legend i { display: inline-block; width: 20px; height: 20px; margin-right: 8px; border-radius: 4px; }
  .problem-legend .build { background: #14284b; }
  .problem-legend .review { background: #9bb4d2; }
  .problem-spend {
    display: flex;
    justify-content: center;
    gap: 60px;
    margin-top: 14px;
    color: #5b6674;
    font-size: 28px;
  }
  .problem-spend b { margin-right: 8px; color: #14284b; font-size: 34px; }
  .problem-context { margin-top: 10px; color: #5b6674; font-size: 28px; text-align: center; }

  /* Bars */
  .track {
    display: inline-block; width: 240px; height: 20px;
    background: #e6eaf0; border-radius: 10px; overflow: hidden;
    vertical-align: middle; margin-left: 14px;
  }
  .track i { display: block; height: 100%; background: #4a76b8; }
  .track.on i { background: #f08a24; }
  .track i.w855 { width: 85.5%; }
  .track i.w803 { width: 80.3%; }
  .track i.w631 { width: 63.1%; }
  .track i.w516 { width: 51.6%; }
  .track i.w100 { width: 100%; }

  /* Development and review split bars */
  .split {
    display: inline-flex; width: 210px; height: 20px;
    border-radius: 10px; overflow: hidden;
    vertical-align: middle; margin-right: 12px;
  }
  .split i { display: block; height: 100%; background: #14284b; }
  .split i.rev { flex: 1; background: #c3d3ea; }
  .split.on i { background: #b35c00; }
  .split.on i.rev { background: #ffd6a5; }
  .d97 { width: 9.7%; }
  .d54 { width: 5.4%; }
  .d47 { width: 4.7%; }
  .d105 { width: 10.5%; }
  .d720 { width: 72%; }
  .d808 { width: 80.8%; }
  .d586 { width: 58.6%; }
  .d846 { width: 84.6%; }

  /* Token bars by subject */
  .rows { margin-top: 26px; }
  .row { display: flex; align-items: center; margin-bottom: 20px; }
  .row .lbl { width: 150px; font-size: 30px; }
  .row .bars { flex: 1; }
  .row .bars i { display: block; height: 18px; border-radius: 9px; margin: 4px 0; }
  .row .bars i.p { background: #4a76b8; }
  .row .bars i.e { background: #f08a24; }
  .row .val { width: 230px; text-align: right; font-size: 28px; color: #5b6674; }
  .b159 { width: 15.9%; }
  .b17 { width: 1.7%; }
  .b216 { width: 21.6%; }
  .b45 { width: 4.5%; }
  .b278 { width: 27.8%; }
  .b50 { width: 5%; }
  .b1000 { width: 100%; }
  .b75 { width: 7.5%; }
  .kp { color: #4a76b8; font-weight: 700; }
  .ke { color: #b35c00; font-weight: 700; }

  /* Meme slides */
  section.meme {
    padding: 24px;
    text-align: center;
  }
  section.meme p { margin: 0; }
  section.meme img {
    display: block;
    box-sizing: border-box;
    width: 672px;
    height: 672px;
    margin: 0 auto;
    border: 2px solid #e6eaf0;
    border-radius: 12px;
  }

  /* Citation code blocks */
  section.cite-code pre { font-size: 23px; }

  /* Evidence-backed lists */
  section.stat-list li { font-size: 36px; margin-bottom: 14px; }
  section.stat-list blockquote { font-size: 30px; }
---

<!-- _class: dark -->
<!-- _paginate: false -->

# Evidence Graph

## 100% specification coverage with compile errors

<span class="note">https://github.com/samchon/ttsc/tree/master/packages/evidence</span>

---

# TL;DR

<div class="tldr-layout">
<div class="opening-summary">

- **Evidence Graph, a compiler harness**
  - No Loop Engineering required
  - `@evidence <target> <reason>`
  - `@evidenceReview <target> <reason>`
  - `@evidenceExclude <target> <reason>`
- **Spec Driven Development**
  - Write and review only the requirements
  - AI builds everything with 100% coverage
  - Applies to programming, documents, and literature

</div>
<div class="benchmark-graphs">
<div class="opening-measure">
<div class="opening-measure-title">Requirement coverage</div>
<div class="opening-bar-row"><span>Plain</span><div class="opening-bar"><i class="coverage-plain"></i></div><strong>51.6%</strong></div>
<div class="opening-bar-row evidence"><span>Evidence</span><div class="opening-bar"><i class="coverage-evidence"></i></div><strong>100%</strong></div>
</div>
<div class="opening-measure">
<div class="opening-measure-title">Token usage</div>
<div class="opening-bar-row"><span>Plain</span><div class="opening-bar"><i class="token-plain"></i></div><strong>5,449M</strong></div>
<div class="opening-bar-row evidence"><span>Evidence</span><div class="opening-bar"><i class="token-evidence"></i></div><strong>411M</strong></div>
</div>
<div class="benchmark-context">100+ tables · 150K+ LoC</div>
</div>
</div>

---

<!-- _class: meme -->

![Asked whether every requirement was met, a human explains while the compiler stops the build](https://ttsc.dev/evidence/meme-coverage.svg)

---

<!-- _class: meme -->

![Asked whether the rule document was read, a human reads it out again while the compiler asks at every file](https://ttsc.dev/evidence/meme-checklist.svg)

---

<!-- _class: divider -->

# Current Limitations

<span class="note">Why we all ended up looping</span>

---

<!-- _class: stat-list -->

# Saying yes is not doing it

- Six frontier models: **0/60** actual process compliance under default framing
- Verbal compliance in the same runs exceeded **90%**
- At 8 constraints: about 41% passed individually, only **5.7% passed all eight**
- The strongest model fell below **50%** whole-response success at 7 constraints

<span class="note">Measured with tool logs and deterministic verifiers ([2605.01771](https://arxiv.org/abs/2605.01771)) ([2608.12426](https://arxiv.org/abs/2608.12426))</span>

---

<!-- _class: stat-list -->

# Split specs and long runs both degrade

- Split across about 60 requests, single-shot was more faithful on **16/20** papers for Claude Code and **14/20** for Codex
- Of 15 agents on 36 iterative problems, none finished one end-to-end; best strict rate: **14.8%**
- Structural erosion rose in <strong>77%</strong> of trajectories; verbosity in **75.5%**
- Versus 473 open-source Python repositories: **2.3× more verbose, 2× more eroded**

<span class="note">Two 2026 coding-agent benchmarks ([2603.17104](https://arxiv.org/abs/2603.17104)) ([2603.24755](https://arxiv.org/abs/2603.24755))</span>

---

<!-- _class: loop-slide -->

# So we built Loop Engineering

- A claim of done proves nothing → **read it all again**
- Omissions show only when you look → **fix every finding**
- One fix breaks another → **restart from the top**
- Nothing else says done → **stop after an empty round**

> Also called Loop Until Dry. It is the state of the art, and it works.

---

# ERP Loop Engineering

<div class="problem-measures">
<div>
<div class="problem-measure-title">Requirement coverage</div>
<div class="problem-bar"><div class="problem-coverage">51.6%</div></div>
</div>
<div>
<div class="problem-measure-title">Time distribution</div>
<div class="problem-bar"><div class="problem-build">10%</div><div class="problem-review">90%</div></div>
<div class="problem-legend"><span><i class="build"></i>Initial development</span><span><i class="review"></i>Review loops</span></div>
</div>
</div>

<div class="problem-spend">
<span><b>102h</b>work time</span>
<span><b>5,449M</b>tokens</span>
</div>

<div class="problem-context">ERP · 100+ tables · 150K+ LoC</div>

---

<!-- _class: divider -->

# Evidence Graph

<span class="note">Missing specification coverage becomes a compile error</span>

---

<!-- _class: architecture-slide -->

# First, divide the artifacts into layers

<div class="document-graph">
<div class="architecture-node document-node idea">Idea notes</div>
<div class="architecture-foundations document-foundations">
<div class="architecture-node">Requirements</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">Specifications</div>
</div>
<div class="architecture-node document-node implementation">Implementation</div>
<div class="architecture-node document-node test">Test</div>
<div class="architecture-edge horizontal arrow-left document-edge requirements-idea"></div>
<div class="architecture-edge horizontal arrow-left document-edge implementation-foundations"></div>
<div class="architecture-edge vertical arrow-up document-edge test-implementation"></div>
<div class="architecture-edge horizontal arrow-left document-edge test-foundations"></div>
</div>

<p class="architecture-caption">Each arrow points to the evidence it cites.</p>

---

# One rule declares the relationship

```ts
type: "typescript",
files: ["src/components/**/*.tsx"], // sources
symbol: "function",
reference: {
  type: "markdown",
  files: ["docs/specifications/*.md"], // targets
  symbol: ["h2", "h3"],
},
```

**Components implement specifications.**

---

# One grammar covers four artifact types

- **Markdown**: file, H1-H4 section
- **Prisma**: database model, columns, relation
- **TypeScript**: type, function, property
- **Swagger**: each operation under `paths`

---

# Code cites the specification

```tsx
/**
 * @evidence docs/specifications/discount.md#coupon-stacking
 *           Explains the stacking limit defined by this section.
 * @evidence POST:/orders/{orderId}/coupons
 *           Explains the rejection response from this endpoint.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

**`@evidence <target> <reason>`**: what this code implements, and why.

---

# Without a citation, the build stops

```bash
$ npx ttsc
error TS16411: [evidence/graph]
  Missing acknowledgement for
  'docs/specifications/discount.md#coupon-stacking'
  (Markdown H2 'Coupon Stacking' at docs/specifications/discount.md:3)
```

- One error per requirement → **the error list is the task list**
- It runs alongside type errors in the same build

---

# 100% coverage can include false citations

```ts
/**
 * @evidence docs/specifications/discount.md#coupon-stacking
 *           Explains the per-issuer limit.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

- Inexpensive models **sometimes write facts that do not exist**
- A false tag removes the error, **not the problem**

<span class="note">Citations make the false claim detectable: 86-88%, no false positives ([2606.30689](https://arxiv.org/abs/2606.30689)).</span>

---

<!-- _class: cite-code -->

# Review only citation truth

```ts
/**
 * @evidence docs/specifications/discount.md#coupon-stacking
 *           Explains the per-issuer limit.
 * @evidenceReview docs/specifications/discount.md#coupon-stacking
 *                 #a1b2c3d4e5f6 Verified against policy section 3.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

- Reviews match the **same declaration and target**
- The fingerprint expires when the cited content changes

<span class="note">Even Luna reduced false citations to zero in one review pass.</span>

---

<!-- _class: review-checklist -->

# The tag list is the review checklist

| Review    | Plain               | Evidence              |
| --------- | ------------------- | --------------------- |
| Target    | Everything          | Citation truth        |
| Loop      | Restart every round | Follow the tag list   |
| Omissions | Search manually     | Compiler reports them |

> **The compiler catches omissions. Review catches falsehoods.**

---

<!-- _class: divider -->

# Benchmark

<span class="note">Same inputs · engine · model · Plugin only</span>

---

# Coverage: 51.6–85.5% → 100%

| Subject | Plain | Evidence |
| --- | --- | --- |
| todo | 85.5% <span class="track"><i class="w855"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| reddit | 80.3% <span class="track"><i class="w803"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| shopping | 63.1% <span class="track"><i class="w631"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| erp | 51.6% <span class="track"><i class="w516"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |

Plain coverage falls with scope. **Evidence remains at 100%.**

---

# Token usage: 4.8–13.3× lower

<div class="rows">
<div class="row"><span class="lbl">todo</span><span class="bars"><i class="p b159"></i><i class="e b17"></i></span><span class="val">866M → 92M</span></div>
<div class="row"><span class="lbl">reddit</span><span class="bars"><i class="p b216"></i><i class="e b45"></i></span><span class="val">1,179M → 245M</span></div>
<div class="row"><span class="lbl">shopping</span><span class="bars"><i class="p b278"></i><i class="e b50"></i></span><span class="val">1,516M → 271M</span></div>
<div class="row"><span class="lbl">erp</span><span class="bars"><i class="p b1000"></i><i class="e b75"></i></span><span class="val">5,449M → 411M</span></div>
</div>

<span class="kp">Plain</span> in blue. <span class="ke">Evidence</span> in orange.

<span class="note">Original charts by phase: [https://ttsc.dev/docs/benchmark/evidence](https://ttsc.dev/docs/benchmark/evidence)</span>

---

# ERP: 100% coverage · $4.96 · 14h

<div class="cards">
<div class="card"><b>13.3×</b>fewer tokens<br/><span class="note">5,449M → 411M</span></div>
<div class="card"><b>13.9×</b>lower cost<br/><span class="note">$68.72 → $4.96</span></div>
<div class="card warm"><b>7.5×</b>less time<br/><span class="note">102h → 14h</span></div>
</div>

---

# Review: 90–95% → 15–41% of tokens

| Subject | Plain | Evidence |
| --- | --- | --- |
| todo | <span class="split"><i class="d97"></i><i class="rev"></i></span> Review 90% | <span class="split on"><i class="d720"></i><i class="rev"></i></span> Review 28% |
| reddit | <span class="split"><i class="d54"></i><i class="rev"></i></span> Review 95% | <span class="split on"><i class="d808"></i><i class="rev"></i></span> Review 19% |
| shopping | <span class="split"><i class="d47"></i><i class="rev"></i></span> Review 95% | <span class="split on"><i class="d586"></i><i class="rev"></i></span> Review 41% |
| erp | <span class="split"><i class="d105"></i><i class="rev"></i></span> Review 90% | <span class="split on"><i class="d846"></i><i class="rev"></i></span> Review 15% |

<span class="note">Dark is development. Light is review. Each cell represents 100% of its tokens.</span>

---

<!-- _class: divider -->

# Spec Driven Development

<span class="note">Requirements are the handoff.<br/>AI builds everything below them with 100% coverage.</span>

---

<!-- _class: architecture-slide -->

# Method A starts from requirements

<div class="document-graph requirements-only">
<div class="architecture-foundations document-foundations">
<div class="architecture-node">Requirements</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">Specifications</div>
</div>
<div class="architecture-node document-node implementation">Implementation</div>
<div class="architecture-node document-node test">Test</div>
<div class="architecture-edge horizontal arrow-left document-edge implementation-foundations"></div>
<div class="architecture-edge vertical arrow-up document-edge test-implementation"></div>
<div class="architecture-edge horizontal arrow-left document-edge test-foundations"></div>
</div>

<p class="architecture-caption">Requirements are the source layer.</p>

---

# Method A: Humans write the requirements

- Humans **review `docs/requirements` directly**
- Specifications, implementation, and tests are **fully delegated**

> The four subjects you just saw all used this method.

---

<!-- _class: architecture-slide -->

# Method B starts from idea notes

<div class="document-graph">
<div class="architecture-node document-node idea">Idea notes</div>
<div class="architecture-foundations document-foundations">
<div class="architecture-node">Requirements</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">Specifications</div>
</div>
<div class="architecture-node document-node implementation">Implementation</div>
<div class="architecture-node document-node test">Test</div>
<div class="architecture-edge horizontal arrow-left document-edge requirements-idea"></div>
<div class="architecture-edge horizontal arrow-left document-edge implementation-foundations"></div>
<div class="architecture-edge vertical arrow-up document-edge test-implementation"></div>
<div class="architecture-edge horizontal arrow-left document-edge test-foundations"></div>
</div>

<p class="architecture-caption">Idea notes are the source layer.</p>

---

# Method B: Delegate the requirements, too

- Hand over idea notes **as-is, without organizing them**
- **Delegate everything**, starting with writing the requirements
- If anything in the idea notes is omitted, **the build breaks immediately**

> Humans provide one source layer.<br/>The graph protects everything below it.

---

# Even requirements cite their evidence

```md
## Coupon stacking limit {#coupon-stacking}

<!-- @evidence docs/ideas/discount.md#discount-policy
     Carries over the per-issuer limit recorded in the idea notes. -->
```

- Missing idea-note coverage **breaks the requirements build**
- Idea notes, interviews, and internal documents share one layer
- Citations are comments, so **the rendered document stays clean**

---

<!-- _class: architecture-slide -->

# The backend works like this

<div class="backend-graph">
<div class="architecture-foundations">
<div class="architecture-node">Requirements</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">Specifications</div>
</div>
<div class="architecture-node backend-node database">DB schema</div>
<div class="architecture-node backend-node operation">API operation</div>
<div class="architecture-node backend-node schema">API schema</div>
<div class="architecture-node backend-node test">Test</div>
<div class="architecture-edge horizontal arrow-left backend-edge database-foundations"></div>
<div class="architecture-edge horizontal arrow-left backend-edge operation-foundations"></div>
<div class="architecture-edge vertical arrow-up backend-edge operation-database"></div>
<div class="architecture-edge horizontal arrow-left backend-edge schema-database"></div>
<div class="architecture-edge horizontal arrow-left backend-edge test-operation"></div>
<div class="architecture-edge vertical outer-top-source"></div>
<div class="architecture-edge horizontal outer-top-horizontal"></div>
<div class="architecture-edge vertical arrow-down outer-top-target"></div>
<div class="architecture-edge vertical outer-bottom-source"></div>
<div class="architecture-edge horizontal outer-bottom-horizontal"></div>
<div class="architecture-edge vertical arrow-up outer-bottom-target"></div>
</div>

<p class="architecture-caption">Backend artifacts trace back to Requirements and Specifications.</p>

---

<!-- _class: architecture-slide -->

# The frontend works like this

<div class="frontend-graph">
<div class="architecture-foundations">
<div class="architecture-node">Requirements</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">Specifications</div>
</div>
<div class="architecture-node frontend-node backend">Backend</div>
<div class="architecture-node frontend-node hooks">Hooks</div>
<div class="architecture-node frontend-node screens">Screens</div>
<div class="architecture-node frontend-node journeys">Journeys</div>
<div class="architecture-edge horizontal arrow-left frontend-edge backend-foundations"></div>
<div class="architecture-edge vertical arrow-up frontend-edge hooks-backend"></div>
<div class="architecture-edge horizontal arrow-left frontend-edge screens-hooks"></div>
<div class="architecture-edge vertical arrow-down frontend-edge journeys-screens"></div>
<div class="architecture-edge vertical outer-top-source"></div>
<div class="architecture-edge horizontal outer-top-horizontal"></div>
<div class="architecture-edge vertical arrow-down outer-top-target"></div>
<div class="architecture-edge vertical outer-bottom-source"></div>
<div class="architecture-edge horizontal outer-bottom-horizontal"></div>
<div class="architecture-edge vertical arrow-up outer-bottom-target"></div>
</div>

<p class="architecture-caption">Frontend delivery traces back to the documents and Backend.</p>

---

# Method D: Hand over principles only

- The project already exists, so **a full document hierarchy is hard to introduce**
- You want to **develop directly** instead of delegating requirements and specifications
- You are not ready to design the whole graph yet

> Start with one `docs/principles.md` and one claim.

---

# Every principle must be followed

```md
## Do not hardcode {#no-hardcoding}
Derive behavior from inputs and models. Never special-case a fixture.

## Do not monkey patch {#no-monkey-patching}
Use public extension points. Never replace prototypes or module state.

## Use the conventional solution {#conventional-solution}
Avoid unmeasured optimization. Prefer standard structures and clear algorithms.

## Fix the root cause {#fix-the-root-cause}
Do not route around one visible failure. Trace the cause and solve the whole class.
```

---

# Every function answers every rule

- Each selected function checks **every H2 rule**
- Every answer records **how and why** the rule was followed
- "Not applicable" can be closed as an escape hatch
- One missing answer becomes **a compile error**

> Add one rule, and every function immediately gains one obligation.

---

# Every answer explains how

```ts
/**
 * @evidence docs/principles.md#no-hardcoding
 *   Builds the lookup from registered handlers, with no case-specific branch.
 * @evidence docs/principles.md#no-monkey-patching
 *   Uses the public adapter without replacing prototypes or module state.
 * @evidence docs/principles.md#conventional-solution
 *   Uses a standard Map and linear pass, with no speculative index or cache.
 * @evidence docs/principles.md#fix-the-root-cause
 *   Rejects invalid names at registration instead of retrying failed lookups.
 */
export function resolveHandler(name: string): Handler;
```

Both the target and a non-empty reason are required. Miss one and the build breaks.

---

<!-- _class: dark -->

# Summary

- Missing specification coverage becomes **a compile error**
- Requirements are **the handoff**, and a principles list is enough to start
- Coverage rises from **51.6–85.5% to 100%**
- Review checks **the truth of the evidence**

---

<!-- _class: divider -->

# Appendix: Stories

<span class="note">Principles and settings become build constraints</span>

---

<!-- _class: stat-list -->

# Fluency is not authorship

- **Flattening**: competent prose that no one could have signed
- **Softened conflict**: the antagonist apologizes a paragraph later
- **Translationese**: borrowed syntax, misplaced honorifics

<span class="note">Studio case: every cool character got silver hair, every genre got the same moral ending.</span>

---

<!-- _class: stat-list -->

# The failure is measured, not just felt

- Training smooths out theme, emotion, and voice
- Literary fiction loses **the most**
- Contradictions grow **steadily** with length
- Facts slip early (**15-30%**), contradictions late (**40-60%**)

<span class="note">Narrative Flattening ([2605.27878](https://arxiv.org/abs/2605.27878)) · ConStory-Bench ([site](https://picrew.github.io/constory-bench.github.io/))</span>

---

<!-- _class: stat-list -->

# A fluent scene can still be false

- **Memory**: uses facts the character never learned
- **Invention**: breaks history, geography, or motive
- **Contradiction**: negates a number, a date, or a trait set earlier
- **Revision**: keeps scenes invalidated by an earlier edit
- **Amnesia**: 350 settings, and no way to tell which went unused

> Long-form failure is global, not local.

---

<!-- _class: stat-list -->

# Here the loop makes it worse

- Every pass pulls the text toward **the model's own average**
- Style and fluency rise, **accuracy barely moves**
- Voice normalizes each time, and **prompts cannot stop it**

> More rounds buy polish, not truth.

<span class="note">Two 2026 revision studies ([2605.13368](https://arxiv.org/abs/2605.13368)) ([2604.22142](https://arxiv.org/abs/2604.22142))</span>

---

# Every layer cites all prior sources

<div class="narrative-graph">
<div class="narrative-group">
<div class="narrative-node principles">Principles</div>
<div class="narrative-edge settings-principles"></div>
<div class="narrative-node settings">Settings</div>
</div>
<div class="narrative-node storylines">Storylines</div>
<div class="narrative-node scenarios">Scenarios</div>
<div class="narrative-node manuscripts">Manuscripts</div>
<div class="narrative-edge to-foundations scenarios-foundations"></div>
<div class="narrative-edge to-foundations storylines-foundations"></div>
<div class="narrative-edge storylines-scenarios"></div>
<div class="narrative-edge manuscripts-foundations"></div>
<div class="narrative-edge manuscripts-up"></div>
<div class="narrative-edge manuscripts-storylines"></div>
<div class="narrative-edge manuscripts-scenarios"></div>
</div>

---

# Each edge blocks a different drift

- Storylines, Scenarios, Manuscripts → Principles: literary purpose
- Storylines, Scenarios, Manuscripts → Settings: facts, rules, knowledge
- Scenarios, Manuscripts → Storylines: causes and consequences
- Manuscripts → Scenarios: exact execution

---

# Why it works

- Limited context → exact obligations for this scene
- Plausible invention → explicit lineage and review
- Revision drift → affected reviews expire
- Forgotten promise → 100% reverse coverage

**Creative freedom inside hard continuity.**

---

# One graph, any narrative

- **Settings**: history, world rules, character
- **Causality**: clues, motives, consequences
- **Continuity**: knowledge, arcs, revisions
- Historical fiction, fantasy, science fiction, mystery, drama
- **Napoleon**: 25 principles, 350 setting commitments, 742 scenes

---

<!-- _class: dark -->
<!-- _paginate: false -->

# References: `@ttsc/evidence`

- https://github.com/samchon/ttsc
  - https://ttsc.dev/docs/evidence
  - https://ttsc.dev/docs/benchmark/evidence
- https://github.com/samchon/evidence-benchmark-results

---

<!-- _class: dark -->
<!-- _paginate: false -->

# References: Coding Agents

- Faithfulness drops when the spec arrives in pieces ([2603.17104](https://arxiv.org/abs/2603.17104))
- Agents erode their own code over long horizons ([2603.24755](https://arxiv.org/abs/2603.24755))
- Process instructions agreed to, then bypassed ([2605.01771](https://arxiv.org/abs/2605.01771))
- Citations make hallucinated requirements detectable ([2606.30689](https://arxiv.org/abs/2606.30689))
- Specifications as the primary artifact ([2602.00180](https://arxiv.org/abs/2602.00180))

---

<!-- _class: dark -->
<!-- _paginate: false -->

# References: Long-form Narrative

- Post-training flattens theme, affect, and style ([2605.27878](https://arxiv.org/abs/2605.27878))
- Narrative tension measured by forecasting ([2604.09854](https://arxiv.org/abs/2604.09854))
- Consistency bugs scale with story length ([ConStory-Bench](https://picrew.github.io/constory-bench.github.io/))
- Revision improves style, not accuracy ([2605.13368](https://arxiv.org/abs/2605.13368))
- Rewriting normalizes personal voice ([2604.22142](https://arxiv.org/abs/2604.22142))
- Korean honorifics in automatic translation ([LREC 2026](https://lrec.elra.info/lrec2026-ws-iaai-03))

---

<!-- _class: divider -->
<!-- _paginate: false -->

# Q & A

<span class="note">Samchon<br/>https://ttsc.dev</span>
