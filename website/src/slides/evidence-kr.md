---
marp: true
theme: default
paginate: true
size: 16:9
title: "Evidence Graph (한국어)"
description: "명세 커버리지 누락을 컴파일 에러로 만들어, 코딩 에이전트가 의무를 건너뛰지 못하게 한다."
url: "https://ttsc.dev/slides/evidence-kr/"
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

## 컴파일 에러로 강제하는 100% 명세 커버리지

<span class="note">https://github.com/samchon/ttsc/tree/master/packages/evidence</span>

---

# TL;DR

<div class="tldr-layout">
<div class="opening-summary">

- **컴파일러 하네스, Evidence Graph**
  - Loop Engineering 불필요
  - `@evidence <target> <reason>`
  - `@evidenceReview <target> <reason>`
  - `@evidenceExclude <target> <reason>`
- **Spec Driven Development**
  - 사람은 요구사항만 쓰고 검토한다
  - 나머지는 AI가 100% 커버리지로 만든다
  - 프로그래밍과 문서/문학에 적용된다

</div>
<div class="benchmark-graphs">
<div class="opening-measure">
<div class="opening-measure-title">요구사항 커버리지</div>
<div class="opening-bar-row"><span>Plain</span><div class="opening-bar"><i class="coverage-plain"></i></div><strong>51.6%</strong></div>
<div class="opening-bar-row evidence"><span>Evidence</span><div class="opening-bar"><i class="coverage-evidence"></i></div><strong>100%</strong></div>
</div>
<div class="opening-measure">
<div class="opening-measure-title">토큰 사용량</div>
<div class="opening-bar-row"><span>Plain</span><div class="opening-bar"><i class="token-plain"></i></div><strong>5,449M</strong></div>
<div class="opening-bar-row evidence"><span>Evidence</span><div class="opening-bar"><i class="token-evidence"></i></div><strong>411M</strong></div>
</div>
<div class="benchmark-context">테이블 100개 이상 · 15만 줄 이상</div>
</div>
</div>

---

<!-- _class: meme -->

![명세를 다 지켰냐는 물음에, 사람은 설명하고 컴파일러는 빌드를 멈춘다](https://ttsc.dev/evidence/meme-coverage-kr.svg)

---

<!-- _class: meme -->

![규칙 문서를 다 읽었냐는 물음에, 사람은 다시 읽어주고 컴파일러는 파일마다 따로 묻는다](https://ttsc.dev/evidence/meme-checklist-kr.svg)

---

<!-- _class: divider -->

# 현재의 한계

<span class="note">우리가 결국 루프를 돌게 된 이유</span>

---

<!-- _class: stat-list -->

# 알겠다고 답하는 것과 지키는 것은 다르다

- 기본 조건에서 프런티어 모델 6종의 실제 절차 준수율은 **60건 중 0건**이었다
- 같은 실행에서 말로 답한 준수율은 **90% 이상**이었다
- 규칙 8개 조건에서는 개별 준수율이 약 41%여도 <strong>전부 지킨 응답은 5.7%</strong>였다
- 최상위 모델도 규칙 7개부터 전체 준수율이 **50% 아래**로 떨어졌다

<span class="note">도구 실행 로그와 결정론적 검사기로 측정했다 ([2605.01771](https://arxiv.org/abs/2605.01771)) ([2608.12426](https://arxiv.org/abs/2608.12426))</span>

---

<!-- _class: stat-list -->

# 명세가 쪼개지고 작업이 길어지면 나빠진다

- 명세를 약 60개 요청으로 나누면 일괄 전달보다 충실도가 낮았다: Claude Code **16/20**, Codex **14/20**
- 15개 에이전트 중 누구도 36개 반복 확장 문제를 끝까지 풀지 못했다. 최고 엄격 통과율은 <strong>14.8%</strong>였다
- 구조 침식은 실행 궤적의 <strong>77%</strong>, 장황성은 <strong>75.5%</strong>에서 증가했다
- 오픈소스 Python 저장소 473개보다 에이전트 코드는 **2.3배 장황하고 2배 더 침식**됐다

<span class="note">2026년 코딩 에이전트 벤치마크 두 편 ([2603.17104](https://arxiv.org/abs/2603.17104)) ([2603.24755](https://arxiv.org/abs/2603.24755))</span>

---

<!-- _class: loop-slide -->

# 그래서 Loop Engineering이 나왔다

- 다 했다는 말은 증거가 아니다 → **전부 다시 읽는다**
- 누락은 봐야만 드러난다 → **찾은 문제를 전부 고친다**
- 하나 고치면 다른 게 깨진다 → **처음으로 되돌아간다**
- 끝났다고 말해줄 게 없다 → **빈 회차가 나와야 멈춘다**

> Loop Until Dry라고도 한다. 현존 최선의 수단이고, 실제로 작동한다.

---

# ERP Loop Engineering

<div class="problem-measures">
<div>
<div class="problem-measure-title">요구사항 커버리지</div>
<div class="problem-bar"><div class="problem-coverage">51.6%</div></div>
</div>
<div>
<div class="problem-measure-title">시간 분포</div>
<div class="problem-bar"><div class="problem-build">10%</div><div class="problem-review">90%</div></div>
<div class="problem-legend"><span><i class="build"></i>최초 개발</span><span><i class="review"></i>검토 루프</span></div>
</div>
</div>

<div class="problem-spend">
<span><b>102시간</b>작업 시간</span>
<span><b>5,449M</b>토큰</span>
</div>

<div class="problem-context">ERP · 테이블 100개 이상 · 15만 줄 이상</div>

---

<!-- _class: divider -->

# Evidence Graph

<span class="note">명세 커버리지 누락이 컴파일 에러가 된다</span>

---

<!-- _class: architecture-slide -->

# 먼저 산출물을 계층으로 나눈다

<div class="document-graph">
<div class="architecture-node document-node idea">아이디어 노트</div>
<div class="architecture-foundations document-foundations">
<div class="architecture-node">요구사항</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">설계 명세</div>
</div>
<div class="architecture-node document-node implementation">구현</div>
<div class="architecture-node document-node test">테스트</div>
<div class="architecture-edge horizontal arrow-left document-edge requirements-idea"></div>
<div class="architecture-edge horizontal arrow-left document-edge implementation-foundations"></div>
<div class="architecture-edge vertical arrow-up document-edge test-implementation"></div>
<div class="architecture-edge horizontal arrow-left document-edge test-foundations"></div>
</div>

<p class="architecture-caption">각 화살표는 자신이 인용하는 근거를 가리킨다.</p>

---

# 관계는 규칙 하나로 선언한다

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

**컴포넌트는 설계 명세를 구현한다.**

---

# 하나의 문법이 네 가지 산출물을 다룬다

- **Markdown**: 파일, H1-H4 섹션
- **Prisma**: 데이터베이스 모델, 컬럼, 관계
- **TypeScript**: 타입, 함수, 프로퍼티
- **Swagger**: `paths` 아래의 각 오퍼레이션

---

# 코드가 명세를 인용한다

```tsx
/**
 * @evidence docs/specifications/discount.md#coupon-stacking
 *           Explains the stacking limit defined by this section.
 * @evidence POST:/orders/{orderId}/coupons
 *           Explains the rejection response from this endpoint.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

**`@evidence <target> <reason>`**: 이 코드가 무엇을 구현하며, 왜 그런지.

---

# 인용이 없으면 빌드가 멈춘다

```bash
$ npx ttsc
error TS16411: [evidence/graph]
  Missing acknowledgement for
  'docs/specifications/discount.md#coupon-stacking'
  (Markdown H2 'Coupon Stacking' at docs/specifications/discount.md:3)
```

- 요구사항 하나당 에러 하나 → **에러 목록이 곧 작업 목록**
- 타입 에러와 같은 빌드에서 함께 검사된다

---

# 100% 커버리지에도 거짓 인용이 섞인다

```ts
/**
 * @evidence docs/specifications/discount.md#coupon-stacking
 *           Explains the per-issuer limit.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

- 저렴한 모델은 **존재하지 않는 사실을 적기도 한다**
- 거짓 태그는 에러만 지울 뿐, **문제는 남긴다**

<span class="note">인용이 붙으면 거짓 주장을 86-88%로 탐지하고, 오탐은 0이다 ([2606.30689](https://arxiv.org/abs/2606.30689)).</span>

---

<!-- _class: cite-code -->

# 검토 대상은 인용의 진위뿐

```ts
/**
 * @evidence docs/specifications/discount.md#coupon-stacking
 *           Explains the per-issuer limit.
 * @evidenceReview docs/specifications/discount.md#coupon-stacking
 *                 #a1b2c3d4e5f6 Verified against policy section 3.
 */
export function CouponStackingNotice(props: IProps): JSX.Element;
```

- 검토는 **같은 선언과 같은 대상**끼리 대응한다
- 인용한 내용이 바뀌면 지문이 만료된다

<span class="note">Luna조차 한 번의 검토로 거짓 인용을 0으로 줄였다.</span>

---

<!-- _class: review-checklist -->

# 태그 목록이 곧 검토 체크리스트

| 검토 | Plain          | Evidence        |
| ---- | -------------- | --------------- |
| 대상 | 전부           | 인용의 진위     |
| 루프 | 매 회차 재시작 | 태그 목록만     |
| 누락 | 직접 찾는다    | 컴파일러가 보고 |

> **누락은 컴파일러가, 거짓은 리뷰가 잡는다.**

---

<!-- _class: divider -->

# 벤치마크

<span class="note">동일한 입력 · 엔진 · 모델 · 플러그인만 차이</span>

---

# 커버리지: 51.6–85.5% → 100%

| 과제 | Plain | Evidence |
| --- | --- | --- |
| todo | 85.5% <span class="track"><i class="w855"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| reddit | 80.3% <span class="track"><i class="w803"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| shopping | 63.1% <span class="track"><i class="w631"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |
| erp | 51.6% <span class="track"><i class="w516"></i></span> | 100% <span class="track on"><i class="w100"></i></span> |

Plain은 규모가 커질수록 커버리지가 떨어진다. **Evidence는 100%를 유지한다.**

---

# 토큰 사용량: 4.8–13.3배 절감

<div class="rows">
<div class="row"><span class="lbl">todo</span><span class="bars"><i class="p b159"></i><i class="e b17"></i></span><span class="val">866M → 92M</span></div>
<div class="row"><span class="lbl">reddit</span><span class="bars"><i class="p b216"></i><i class="e b45"></i></span><span class="val">1,179M → 245M</span></div>
<div class="row"><span class="lbl">shopping</span><span class="bars"><i class="p b278"></i><i class="e b50"></i></span><span class="val">1,516M → 271M</span></div>
<div class="row"><span class="lbl">erp</span><span class="bars"><i class="p b1000"></i><i class="e b75"></i></span><span class="val">5,449M → 411M</span></div>
</div>

<span class="kp">Plain</span>은 파랑, <span class="ke">Evidence</span>는 주황.

<span class="note">단계별 원본 차트: [https://ttsc.dev/docs/benchmark/evidence](https://ttsc.dev/docs/benchmark/evidence)</span>

---

# ERP: 커버리지 100% · $4.96 · 14시간

<div class="cards">
<div class="card"><b>13.3×</b>토큰 절감<br/><span class="note">5,449M → 411M</span></div>
<div class="card"><b>13.9×</b>비용 절감<br/><span class="note">$68.72 → $4.96</span></div>
<div class="card warm"><b>7.5×</b>시간 단축<br/><span class="note">102h → 14h</span></div>
</div>

---

# 검토 비중: 토큰의 90–95% → 15–41%

| 과제 | Plain | Evidence |
| --- | --- | --- |
| todo | <span class="split"><i class="d97"></i><i class="rev"></i></span> 검토 90% | <span class="split on"><i class="d720"></i><i class="rev"></i></span> 검토 28% |
| reddit | <span class="split"><i class="d54"></i><i class="rev"></i></span> 검토 95% | <span class="split on"><i class="d808"></i><i class="rev"></i></span> 검토 19% |
| shopping | <span class="split"><i class="d47"></i><i class="rev"></i></span> 검토 95% | <span class="split on"><i class="d586"></i><i class="rev"></i></span> 검토 41% |
| erp | <span class="split"><i class="d105"></i><i class="rev"></i></span> 검토 90% | <span class="split on"><i class="d846"></i><i class="rev"></i></span> 검토 15% |

<span class="note">진한 색은 개발, 옅은 색은 검토. 각 칸이 그 과제 토큰의 100%다.</span>

---

<!-- _class: divider -->

# Spec Driven Development

<span class="note">요구사항이 인계 지점이다.<br/>그 아래는 AI가 100% 커버리지로 전부 만든다.</span>

---

<!-- _class: architecture-slide -->

# 방법 A는 요구사항에서 시작한다

<div class="document-graph requirements-only">
<div class="architecture-foundations document-foundations">
<div class="architecture-node">요구사항</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">설계 명세</div>
</div>
<div class="architecture-node document-node implementation">구현</div>
<div class="architecture-node document-node test">테스트</div>
<div class="architecture-edge horizontal arrow-left document-edge implementation-foundations"></div>
<div class="architecture-edge vertical arrow-up document-edge test-implementation"></div>
<div class="architecture-edge horizontal arrow-left document-edge test-foundations"></div>
</div>

<p class="architecture-caption">요구사항이 원천 계층이다.</p>

---

# 방법 A: 요구사항은 사람이 쓴다

- 사람은 **`docs/requirements`를 직접 검토**한다
- 설계 명세, 구현, 테스트는 **전부 위임한다**

> 방금 본 네 과제 모두 이 방법을 썼다.

---

<!-- _class: architecture-slide -->

# 방법 B는 아이디어 노트에서 시작한다

<div class="document-graph">
<div class="architecture-node document-node idea">아이디어 노트</div>
<div class="architecture-foundations document-foundations">
<div class="architecture-node">요구사항</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">설계 명세</div>
</div>
<div class="architecture-node document-node implementation">구현</div>
<div class="architecture-node document-node test">테스트</div>
<div class="architecture-edge horizontal arrow-left document-edge requirements-idea"></div>
<div class="architecture-edge horizontal arrow-left document-edge implementation-foundations"></div>
<div class="architecture-edge vertical arrow-up document-edge test-implementation"></div>
<div class="architecture-edge horizontal arrow-left document-edge test-foundations"></div>
</div>

<p class="architecture-caption">아이디어 노트가 원천 계층이다.</p>

---

# 방법 B: 요구사항까지 위임한다

- 아이디어 노트를 **정리하지 않고 그대로 넘긴다**
- 요구사항 작성부터 **전부 위임한다**
- 아이디어 노트가 하나라도 누락되면 **즉시 빌드가 깨진다**

> 사람은 원천 계층 하나만 준다.<br/>그 아래는 그래프가 지킨다.

---

# 요구사항도 자신의 근거를 인용한다

```md
## Coupon stacking limit {#coupon-stacking}

<!-- @evidence docs/ideas/discount.md#discount-policy
     Carries over the per-issuer limit recorded in the idea notes. -->
```

- 아이디어 노트 커버리지가 비면 **요구사항 빌드가 깨진다**
- 아이디어 노트, 인터뷰, 사내 문서가 한 계층을 이룬다
- 인용은 주석이라 **렌더링된 문서는 깨끗하다**

---

<!-- _class: architecture-slide -->

# 백엔드는 이렇게 동작한다

<div class="backend-graph">
<div class="architecture-foundations">
<div class="architecture-node">요구사항</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">설계 명세</div>
</div>
<div class="architecture-node backend-node database">DB 스키마</div>
<div class="architecture-node backend-node operation">API 오퍼레이션</div>
<div class="architecture-node backend-node schema">API 스키마</div>
<div class="architecture-node backend-node test">테스트</div>
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

<p class="architecture-caption">백엔드 산출물은 요구사항과 설계 명세로 거슬러 올라간다.</p>

---

<!-- _class: architecture-slide -->

# 프론트엔드는 이렇게 동작한다

<div class="frontend-graph">
<div class="architecture-foundations">
<div class="architecture-node">요구사항</div>
<div class="architecture-edge vertical arrow-up specifications-requirements"></div>
<div class="architecture-node">설계 명세</div>
</div>
<div class="architecture-node frontend-node backend">백엔드</div>
<div class="architecture-node frontend-node hooks">Hooks</div>
<div class="architecture-node frontend-node screens">화면</div>
<div class="architecture-node frontend-node journeys">사용자 여정</div>
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

<p class="architecture-caption">프론트엔드 산출물은 문서와 백엔드로 거슬러 올라간다.</p>

---

# 방법 D: 원칙만 건넨다

- 기존 프로젝트라 **문서 계층 전체를 도입하기 어렵다**
- 요구사항과 설계 명세는 위임하지 않고 **직접 개발하고 싶다**
- 그래프 전체를 설계할 준비는 아직 안 됐다

> `docs/principles.md` 하나와 claim 하나로 시작한다.

---

# 모든 원칙을 반드시 준수한다

```md
## 하드코딩하지 마라 {#no-hardcoding}
입력과 모델에서 동작을 도출하고 특정 사례를 예외 처리하지 않는다.

## 몽키 패칭하지 마라 {#no-monkey-patching}
공개된 확장 지점을 쓰고 프로토타입이나 모듈 상태를 바꾸지 않는다.

## 보편적인 정석으로 구현하라 {#conventional-solution}
측정 없는 과최적화를 피하고 표준 자료구조와 명료한 알고리즘을 우선한다.

## 문제를 본질적으로 해결하라 {#fix-the-root-cause}
눈앞의 실패 사례만 우회하지 말고 원인을 추적해 같은 부류의 문제 전체를 해결한다.
```

---

# 모든 함수가 모든 원칙에 답한다

- 선택된 함수마다 **H2 원칙 전부**를 확인한다
- 각 답에는 원칙을 지킨 **방법과 이유**를 남긴다
- "해당 없음"으로 빠져나가지 못하게 할 수 있다
- 한 항목이라도 답이 없으면 **컴파일 에러**가 된다

> 원칙을 하나 추가하면 모든 함수에 새 의무가 즉시 생긴다.

---

# 모든 답은 어떻게 지켰는지 설명한다

```ts
/**
 * @evidence docs/principles.md#no-hardcoding
 *   등록된 핸들러로 조회표를 만들며 특정 사례를 분기하지 않는다.
 * @evidence docs/principles.md#no-monkey-patching
 *   공개 어댑터를 쓰며 프로토타입이나 모듈 상태를 바꾸지 않는다.
 * @evidence docs/principles.md#conventional-solution
 *   표준 Map과 선형 순회를 쓰며 추측성 인덱스나 캐시를 두지 않는다.
 * @evidence docs/principles.md#fix-the-root-cause
 *   핸들러 등록 단계에서 잘못된 이름을 차단해 조회 실패만 재시도하지 않는다.
 */
export function resolveHandler(name: string): Handler;
```

대상과 비어 있지 않은 이유가 모두 필요하다. 하나라도 빠지면 빌드가 깨진다.

---

<!-- _class: dark -->

# 요약

- 명세 커버리지 누락은 **컴파일 에러**가 된다
- 요구사항이 **인계 지점**이고, 원칙 목록만으로도 시작할 수 있다
- 커버리지가 **51.6–85.5%에서 100%로** 오른다
- 리뷰는 **증거의 진실성**을 본다

---

<!-- _class: divider -->

# 부록: 소설

<span class="note">원칙과 설정이 빌드 제약이 된다</span>

---

<!-- _class: stat-list -->

# 유창함은 작가성이 아니다

- **평탄화**: 못 쓴 글은 아닌데, 누구의 글도 아니다
- **갈등 소실**: 못되게 굴 인물이 다음 문단에서 사과한다
- **번역투**: 남의 문장 구조, 관계를 안 따르는 호칭

<span class="note">스튜디오 사례: 쿨한 성격은 죄다 은발, 장르 불문 똑같은 권선징악 엔딩.</span>

---

<!-- _class: stat-list -->

# 느낌이 아니라 측정된 실패다

- 학습이 주제와 감정과 문체를 고르게 깎는다
- 문예물이 **가장 많이** 잃는다
- 분량이 늘수록 모순이 **꾸준히** 늘어난다
- 사실 오류는 앞쪽(**15-30%**), 모순은 뒤쪽(**40-60%**)에 몰린다

<span class="note">Narrative Flattening ([2605.27878](https://arxiv.org/abs/2605.27878)) · ConStory-Bench ([사이트](https://picrew.github.io/constory-bench.github.io/))</span>

---

<!-- _class: stat-list -->

# 매끄러운 장면도 거짓일 수 있다

- **기억**: 인물이 알 리 없는 사실을 쓴다
- **창작**: 역사, 지리, 동기를 어긴다
- **모순**: 앞에서 정한 숫자, 연대, 성격을 뒤에서 뒤집는다
- **개고**: 앞선 수정으로 무효가 된 장면을 남긴다
- **망각**: 설정 350개 중 안 쓰인 게 뭔지 알 길이 없다

> 장편의 실패는 국소적이지 않고 전역적이다.

---

<!-- _class: stat-list -->

# 여기서는 루프가 오히려 해가 된다

- 회차마다 글이 **모델 자신의 평균**으로 끌려간다
- 문체와 유창함은 오르고, **정확도는 거의 안 움직인다**
- 목소리는 매번 평준화되고, **프롬프트로 못 막는다**

> 회차를 늘리면 윤이 날 뿐, 사실이 되지는 않는다.

<span class="note">2026년 개고 연구 두 편 ([2605.13368](https://arxiv.org/abs/2605.13368)) ([2604.22142](https://arxiv.org/abs/2604.22142))</span>

---

# 모든 계층이 앞선 원천을 전부 인용한다

<div class="narrative-graph">
<div class="narrative-group">
<div class="narrative-node principles">원칙</div>
<div class="narrative-edge settings-principles"></div>
<div class="narrative-node settings">설정</div>
</div>
<div class="narrative-node storylines">스토리라인</div>
<div class="narrative-node scenarios">시나리오</div>
<div class="narrative-node manuscripts">원고</div>
<div class="narrative-edge to-foundations scenarios-foundations"></div>
<div class="narrative-edge to-foundations storylines-foundations"></div>
<div class="narrative-edge storylines-scenarios"></div>
<div class="narrative-edge manuscripts-foundations"></div>
<div class="narrative-edge manuscripts-up"></div>
<div class="narrative-edge manuscripts-storylines"></div>
<div class="narrative-edge manuscripts-scenarios"></div>
</div>

---

# 간선마다 막는 이탈이 다르다

- 스토리라인, 시나리오, 원고 → 원칙: 문학적 목적
- 스토리라인, 시나리오, 원고 → 설정: 사실, 규칙, 지식
- 시나리오, 원고 → 스토리라인: 원인과 결과
- 원고 → 시나리오: 정확한 실행

---

# 왜 통하는가

- 제한된 컨텍스트 → 이 장면이 질 정확한 의무
- 그럴듯한 창작 → 명시적 계보와 검토
- 개고로 인한 이탈 → 영향받은 검토가 만료
- 잊힌 복선 → 100% 역방향 커버리지

**엄격한 연속성 안에서 누리는 창작의 자유.**

---

# 하나의 그래프로 모든 서사를

- **설정**: 역사, 세계 규칙, 인물
- **인과**: 복선, 동기, 결과
- **연속성**: 지식, 서사 궤적, 개고
- 역사 소설, 판타지, SF, 미스터리, 드라마
- **나폴레옹**: 원칙 25개, 설정 약속 350개, 장면 742개

---

<!-- _class: dark -->
<!-- _paginate: false -->

# 참고 자료: `@ttsc/evidence`

- https://github.com/samchon/ttsc
  - https://ttsc.dev/docs/evidence
  - https://ttsc.dev/docs/benchmark/evidence
- https://github.com/samchon/evidence-benchmark-results

---

<!-- _class: dark -->
<!-- _paginate: false -->

# 참고 자료: 코딩 에이전트

- 명세가 쪼개져 오면 충실도가 떨어진다 ([2603.17104](https://arxiv.org/abs/2603.17104))
- 장기 작업에서 에이전트가 자기 코드를 침식한다 ([2603.24755](https://arxiv.org/abs/2603.24755))
- 절차 지시에 동의한 뒤 우회한다 ([2605.01771](https://arxiv.org/abs/2605.01771))
- 인용이 있으면 지어낸 요구사항을 탐지할 수 있다 ([2606.30689](https://arxiv.org/abs/2606.30689))
- 명세가 일차 산출물이다 ([2602.00180](https://arxiv.org/abs/2602.00180))

---

<!-- _class: dark -->
<!-- _paginate: false -->

# 참고 자료: 장편 서사

- 사후 학습이 주제와 정서와 문체를 평탄화한다 ([2605.27878](https://arxiv.org/abs/2605.27878))
- 결말 예측으로 서사 긴장을 측정한다 ([2604.09854](https://arxiv.org/abs/2604.09854))
- 일관성 오류가 분량에 비례해 늘어난다 ([ConStory-Bench](https://picrew.github.io/constory-bench.github.io/))
- 개고는 문체를 올릴 뿐 정확도는 못 올린다 ([2605.13368](https://arxiv.org/abs/2605.13368))
- 리라이팅이 개인의 목소리를 평준화한다 ([2604.22142](https://arxiv.org/abs/2604.22142))
- 기계 번역에서의 한국어 경어 ([LREC 2026](https://lrec.elra.info/lrec2026-ws-iaai-03))

---

<!-- _class: divider -->
<!-- _paginate: false -->

# Q & A

<span class="note">Samchon<br/>https://ttsc.dev</span>
