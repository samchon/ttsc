---
marp: true
theme: default
paginate: true
size: 4:3
title: "TTSC: From Transformer Crisis to TypeScript-Go Toolchain"
description: "TypeScript Backend Meetup, 2026-06-26"
footer: "https://ttsc.dev | 2026-06-26"
style: |
  section {
    background: #f7fbff;
    box-shadow: inset 0 8px 0 #3178c6;
    font-family: "Inter", "Segoe UI", "Pretendard", sans-serif;
    color: #0f172a;
    overflow: hidden;
    padding: 68px 78px;
    position: relative;
  }
  section.lead {
    background: #3178c6;
    box-shadow: none;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  section.lead::before {
    bottom: -42px;
    color: rgba(255, 255, 255, 0.1);
    content: "TS";
    font-size: 230px;
    font-weight: 900;
    letter-spacing: 0;
    line-height: 0.8;
    position: absolute;
    right: 28px;
  }
  section.lead h1,
  section.lead h2,
  section.lead h3,
  section.lead p,
  section.lead li {
    color: #ffffff;
    position: relative;
  }
  section footer {
    color: rgba(49, 120, 198, 0.78);
  }
  section.lead footer,
  section.lead::after {
    color: rgba(255, 255, 255, 0.86) !important;
  }
  h1 {
    color: #102a43;
    font-size: 54px;
    letter-spacing: 0;
    margin-bottom: 28px;
  }
  h2 {
    color: #102a43;
    font-size: 42px;
  }
  h3 {
    color: #3178c6;
    font-size: 30px;
  }
  p,
  li {
    font-size: 28px;
    line-height: 1.34;
  }
  ul ul,
  ol ul {
    margin-top: 4px;
  }
  ul ul li,
  ol ul li {
    color: #334155;
    font-size: 23px;
    line-height: 1.25;
  }
  strong {
    color: #3178c6;
  }
  code {
    font-family: "Cascadia Code", monospace;
  }
  pre {
    background: #111827;
    border: 1px solid #334155;
    border-radius: 8px;
    color: #e5e7eb;
    margin: 0;
    overflow: visible;
    padding: 18px;
  }
  pre code {
    background: transparent;
    color: #e5e7eb;
    font-size: inherit;
    padding: 0;
  }
  pre code.hljs {
    background: transparent;
    color: #e5e7eb;
    overflow: visible;
    padding: 0;
  }
  pre .hljs-keyword,
  pre .hljs-built_in,
  pre .hljs-selector-tag {
    color: #c084fc !important;
  }
  pre .hljs-string,
  pre .hljs-regexp {
    color: #86efac !important;
  }
  pre .hljs-title,
  pre .hljs-title.class_,
  pre .hljs-title.function_ {
    color: #93c5fd !important;
  }
  pre .hljs-attr,
  pre .hljs-property,
  pre .hljs-attribute {
    color: #facc15 !important;
  }
  pre .hljs-number,
  pre .hljs-literal {
    color: #fb923c !important;
  }
  pre .hljs-type,
  pre .hljs-symbol {
    color: #67e8f9 !important;
  }
  pre .hljs-comment {
    color: #94a3b8 !important;
    font-style: italic;
  }
  pre .hljs-meta {
    color: #f472b6 !important;
  }
  table {
    font-size: 24px;
  }
  th {
    background: #dbeafe;
    color: #102a43;
  }
  td,
  th {
    border-color: #93c5fd !important;
  }
  blockquote {
    border-left: 8px solid #3178c6;
    color: #1f2937;
    font-size: 32px;
    padding-left: 28px;
  }
  section.split {
    column-gap: 28px;
    display: grid;
    grid-template-columns: 0.64fr 1.36fr;
    grid-template-rows: auto minmax(0, 1fr);
    padding: 56px 58px;
  }
  section.split h1 {
    font-size: 46px;
    grid-column: 1 / -1;
    margin-bottom: 22px;
  }
  section.split > ul {
    align-self: start;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    grid-column: 1;
    margin: 0;
    padding: 18px 20px 18px 36px;
  }
  section.split > ul > li {
    font-size: 23px;
    line-height: 1.24;
  }
  section.split > ul li li {
    font-size: 19px;
    line-height: 1.2;
  }
  section.split .caption {
    color: #475569;
    font-size: 22px;
    margin-top: 12px;
  }
  section.code-split {
    column-gap: 28px;
    display: grid;
    grid-template-columns: 0.58fr 1.42fr;
    grid-template-rows: auto minmax(0, 1fr);
    padding: 48px 56px;
  }
  section.code-split h1 {
    font-size: 44px;
    grid-column: 1 / -1;
    margin-bottom: 18px;
  }
  section.code-split > ul {
    align-self: start;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    grid-column: 1;
    margin: 0;
    padding: 16px 18px 16px 34px;
  }
  section.code-split > ul > li {
    font-size: 21px;
    line-height: 1.22;
  }
  section.code-split > ul li li {
    font-size: 17px;
    line-height: 1.18;
  }
  section.code-split > pre {
    align-self: start;
    grid-column: 2;
    min-width: 0;
  }
  section.code-split pre {
    font-size: 20px;
    line-height: 1.26;
    padding: 14px;
  }
  section.benchmark {
    column-gap: 30px;
    display: grid;
    grid-template-columns: 0.7fr 1.3fr;
    grid-template-rows: auto minmax(0, 1fr);
    padding: 56px 58px;
  }
  section.benchmark h1 {
    font-size: 46px;
    grid-column: 1 / -1;
    margin-bottom: 22px;
  }
  section.benchmark > ul {
    align-self: start;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    grid-column: 1;
    margin: 0;
    padding: 18px 20px 18px 36px;
  }
  section.benchmark > ul > li {
    font-size: 23px;
    line-height: 1.24;
  }
  section.benchmark > ul li li {
    font-size: 19px;
    line-height: 1.2;
  }
  section.benchmark .benchmarks {
    display: grid;
    gap: 12px;
    grid-column: 2;
  }
  section.benchmark .bench-card {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 14px;
  }
  section.benchmark .bench-title {
    color: #2563eb;
    font-size: 22px;
    font-weight: 800;
    margin-bottom: 10px;
  }
  section.benchmark .bench-row {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 150px minmax(0, 1fr) 104px;
    margin-top: 7px;
  }
  section.benchmark .bench-name {
    color: #334155;
    font-size: 17px;
    font-weight: 700;
    white-space: nowrap;
  }
  section.benchmark .bench-value {
    color: #0f172a;
    font-size: 21px;
    font-weight: 900;
    line-height: 1;
    text-align: right;
    white-space: nowrap;
  }
  section.benchmark .bench-track {
    background: #e2e8f0;
    border-radius: 999px;
    height: 22px;
    overflow: hidden;
  }
  section.benchmark .bench-fill {
    background: #2563eb;
    border-radius: 999px;
    height: 100%;
  }
  section.benchmark .bench-fill.base {
    background: #94a3b8;
  }
  section.benchmark .w-base {
    width: 8%;
  }
  section.benchmark .w-10 {
    width: 36%;
  }
  section.benchmark .w-30 {
    width: 48%;
  }
  section.benchmark .w-200 {
    width: 64%;
  }
  section.benchmark .w-20000 {
    width: 100%;
  }
  section.benchmark .bench-note {
    color: #64748b;
    font-size: 17px;
    margin-top: 10px;
  }
  section.cards > ul {
    display: grid;
    gap: 18px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    list-style: none;
    margin: 0;
    padding: 0;
  }
  section.cards > ul > li {
    background: #ffffff;
    border: 1px solid #93c5fd;
    border-left: 8px solid #3178c6;
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(49, 120, 198, 0.12);
    color: #102a43;
    font-size: 26px;
    font-weight: 800;
    line-height: 1.15;
    padding: 18px 20px;
  }
  section.cards > ul > li > ul {
    list-style: disc;
    margin-top: 12px;
    padding-left: 24px;
  }
  section.cards > ul > li li {
    color: #334155;
    font-size: 20px;
    font-weight: 500;
    line-height: 1.25;
  }
  section.cards.three > ul {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  section.cards.three > ul > li {
    font-size: 23px;
    padding: 16px 18px;
  }
  section.cards.three > ul > li li {
    font-size: 18px;
  }
  section.cards.choice > ul > li:last-child {
    background: #3178c6;
    border-color: #1d4ed8;
    color: #ffffff;
  }
  section.cards.choice > ul > li:last-child li,
  section.cards.choice > ul > li:last-child strong {
    color: #dbeafe;
  }
  section.compare table {
    background: #ffffff;
    border: 1px solid #93c5fd;
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(49, 120, 198, 0.12);
    display: table;
    font-size: 23px;
    overflow: hidden;
    width: 100%;
  }
  section.compare td,
  section.compare th {
    padding: 16px 18px;
    vertical-align: top;
  }
  section.compare td:nth-child(2),
  section.compare th:nth-child(2) {
    background: #eff6ff;
  }
  section.metric table {
    background: #ffffff;
    border: 1px solid #93c5fd;
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(49, 120, 198, 0.12);
    display: table;
    font-size: 28px;
    overflow: hidden;
    width: 100%;
  }
  section.metric td,
  section.metric th {
    padding: 18px 22px;
  }
  section.metric strong {
    display: block;
    font-size: 64px;
    line-height: 1;
    margin-top: 28px;
    text-align: center;
  }
  section.flow > ul {
    align-items: stretch;
    display: grid;
    gap: 16px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    list-style: none;
    margin: 0;
    padding: 0;
  }
  section.flow > ul > li {
    background: #ffffff;
    border: 1px solid #93c5fd;
    border-radius: 8px;
    box-shadow: 0 12px 28px rgba(49, 120, 198, 0.12);
    color: #102a43;
    font-size: 24px;
    font-weight: 800;
    line-height: 1.15;
    min-height: 220px;
    padding: 18px;
    position: relative;
  }
  section.flow > ul > li:not(:last-child)::after {
    color: #3178c6;
    content: ">";
    font-size: 34px;
    font-weight: 900;
    position: absolute;
    right: -19px;
    top: 88px;
  }
  section.flow > ul > li > ul {
    margin-top: 12px;
    padding-left: 22px;
  }
  section.flow > ul > li li {
    color: #334155;
    font-size: 19px;
    font-weight: 500;
    line-height: 1.25;
  }
  section.blueprint {
    background: #0f172a;
    box-shadow: inset 0 8px 0 #3178c6;
    color: #e5f0ff;
  }
  section.blueprint h1,
  section.blueprint h2,
  section.blueprint h3,
  section.blueprint li,
  section.blueprint p {
    color: #e5f0ff;
  }
  section.blueprint strong {
    color: #93c5fd;
  }
  section.blueprint > ul > li {
    background: #102a43;
    border-color: #3178c6;
    color: #ffffff;
  }
  section.blueprint > ul > li li {
    color: #dbeafe;
  }
---

<!-- _class: lead -->

# TTSC

### From Transformer Crisis to TypeScript-Go Toolchain

TypeScript Backend Meetup

Samchon, 2026-06-26

---

![TTSC logo](https://ttsc.dev/og.jpg)

- https://ttsc.dev
- https://github.com/samchon/ttsc

---

# TL;DR

- typia and nestia
  - pure TypeScript input
  - generated runtime/tooling output
- TypeScript-Go
  - faster compiler
  - missing JavaScript patch point
- TTSC
  - transformer host
  - compiler-state toolchain

---

# Index

1. typia and nestia
2. TypeScript-Go Shock
3. TTSC: Transformer Survival
4. TTSC: Toolchain Opportunity

---

<!-- _class: lead -->

# 1. typia and nestia

- Show the code
- Show the output
- Then name the engine

---

<!-- _class: code-split -->

# 1.1. typia Source

- User writes
  - TS type
  - tags
  - generic call
- No duplicate
  - no schema
  - no decorator
  - no DTO class

```typescript
import typia, { tags } from "typia";

interface IMember {
  id: string & tags.Format<"uuid">;
  email: string & tags.Format<"email">;
  age: number &
    tags.Type<"uint32"> &
    tags.ExclusiveMinimum<19> &
    tags.Maximum<100>;
}

const isMember =
  typia.createIs<IMember>();
```

---

<!-- _class: code-split -->

# 1.1. typia Output

- Compiler emits
  - UUID check
  - email check
  - uint32 check
  - range check
- Erased type
  - JS
  - no interpreter

```javascript
const isMember = (input) =>
  "object" === typeof input &&
  null !== input &&
  "string" === typeof input.id &&
  _isFormatUuid(input.id) &&
  "string" === typeof input.email &&
  _isFormatEmail(input.email) &&
  "number" === typeof input.age &&
  _isTypeUint32(input.age) &&
  19 < input.age &&
  input.age <= 100;
```

---

<!-- _class: benchmark -->

# 1.1. typia Impact

- Runtime validation
  - **20,000x**
  - `class-validator`
  - detailed failure paths
- JSON serialization
  - **200x**
  - `class-transformer`
  - type-specialized stringifier
- Same source
  - TypeScript type
  - JSDoc
  - tags

<div class="benchmarks">
  <div class="bench-card">
    <div class="bench-title">Runtime validation</div>
    <div class="bench-row">
      <div class="bench-name">class-validator</div>
      <div class="bench-track"><div class="bench-fill base w-base"></div></div>
      <div class="bench-value">1x</div>
    </div>
    <div class="bench-row">
      <div class="bench-name">typia</div>
      <div class="bench-track"><div class="bench-fill w-20000"></div></div>
      <div class="bench-value">20,000x</div>
    </div>
  </div>
  <div class="bench-card">
    <div class="bench-title">JSON serialization</div>
    <div class="bench-row">
      <div class="bench-name">class-transformer</div>
      <div class="bench-track"><div class="bench-fill base w-base"></div></div>
      <div class="bench-value">1x</div>
    </div>
    <div class="bench-row">
      <div class="bench-name">typia</div>
      <div class="bench-track"><div class="bench-fill w-200"></div></div>
      <div class="bench-value">200x</div>
    </div>
  </div>
  <div class="bench-note">Log-scaled visual, comparison target = 1x.</div>
</div>

---

<!-- _class: code-split -->

# 1.2. nestia Source

- Backend code
  - path
  - method
  - parameter
  - body type
  - return
- Contract source
  - controller

```typescript
@Controller("bbs/:section/articles")
export class BbsArticlesController {
  @TypedRoute.Post()
  public async create(
    @TypedParam("section") section: string,
    @TypedBody() input: IBbsArticle.ICreate,
  ): Promise<IBbsArticle> {
    return this.service.create(section, input);
  }
}
```

---

<!-- _class: code-split -->

# 1.2. nestia Output

- Generated SDK
  - typed fetch
  - DTO
  - checks
- Backend
  - no interface copy
  - FE API

```typescript
const article: IBbsArticle =
  await api.functional.bbs.articles.create(
    connection,
    "general",
    {
      title: "Hello World",
      body: "My first article",
    } satisfies IBbsArticle.ICreate,
  );
```

---

<!-- _class: benchmark -->

# 1.2. nestia Impact

- Server performance
  - **10x+** total path
  - **30x** Fastify path
  - validation **20,000x**
  - serialization **200x**
- SDK generation
  - typed fetch functions
  - DTO structures
  - npm distribution
- Tooling
  - OpenAPI
  - mockup simulator
  - E2E test functions
  - Swagger editor

<div class="benchmarks">
  <div class="bench-card">
    <div class="bench-title">Server path</div>
    <div class="bench-row">
      <div class="bench-name">NestJS base</div>
      <div class="bench-track"><div class="bench-fill base w-base"></div></div>
      <div class="bench-value">1x</div>
    </div>
    <div class="bench-row">
      <div class="bench-name">nestia</div>
      <div class="bench-track"><div class="bench-fill w-10"></div></div>
      <div class="bench-value">10x+</div>
    </div>
  </div>
  <div class="bench-card">
    <div class="bench-title">Validation</div>
    <div class="bench-row">
      <div class="bench-name">class-validator</div>
      <div class="bench-track"><div class="bench-fill base w-base"></div></div>
      <div class="bench-value">1x</div>
    </div>
    <div class="bench-row">
      <div class="bench-name">typia core</div>
      <div class="bench-track"><div class="bench-fill w-20000"></div></div>
      <div class="bench-value">20,000x</div>
    </div>
  </div>
  <div class="bench-card">
    <div class="bench-title">Serialization</div>
    <div class="bench-row">
      <div class="bench-name">class-transformer</div>
      <div class="bench-track"><div class="bench-fill base w-base"></div></div>
      <div class="bench-value">1x</div>
    </div>
    <div class="bench-row">
      <div class="bench-name">typia core</div>
      <div class="bench-track"><div class="bench-fill w-200"></div></div>
      <div class="bench-value">200x</div>
    </div>
  </div>
</div>

---

# 1.3. What You Just Saw

- typia
  - TypeScript type
  - runtime validator
  - JSON serializer
  - LLM schema
- nestia
  - NestJS controller
  - runtime boundary
  - client SDK
  - OpenAPI document
- Same shape
  - compiler analysis
  - generated artifacts

---

# 1.3. The Common Engine

- Input
  - TypeScript source
  - types
  - decorators
  - JSDoc
- Compiler facts
  - AST
  - Checker
  - symbols
  - diagnostics
- Output
  - JavaScript
  - schemas
  - SDK
  - OpenAPI

---

# 1.4. Now: Transformer

- Transformer
  - compile-time code generation
  - from TypeScript compiler facts
- Reads
  - source file
  - AST
  - Checker
- Rewrites
  - JavaScript emit
  - diagnostics
  - generated artifacts

---

# 1.4. Hidden Dependency

- Public API
  - still TypeScript
  - still npm package
  - still framework-friendly
- Private engine
  - JavaScript compiler process
  - transformer host
  - emit pipeline
- Key split
  - language compatibility
  - plugin compatibility

---

<!-- _class: lead -->

# 2. TypeScript-Go Shock

- Native compiler arrives
- Faster is good
- Patch point dies
- My projects are at risk

---

<!-- _class: cards -->

# 2.1. Native Compiler

- TypeScript 7.0 RC
  - JavaScript compiler to Go compiler
  - native compiler and language service
- Performance
  - shared-memory parallelism
  - about **10x** faster than TypeScript 6.0
- User story
  - same language
  - faster loop

---

<!-- _class: cards -->

# 2.1. Backend Upside

- Daily compiler cost
  - monorepo type check
  - watch mode
  - editor startup
  - CI feedback
- Result
  - shorter local loop
  - shorter review loop
  - shorter release loop

---

<!-- _class: cards three -->

# 2.2. Old Assumption

- Old compiler
  - JavaScript package
  - JavaScript process
  - JavaScript objects
- Old transformers
  - JavaScript modules
  - compiler API access
  - emit hook access
- Old strategy
  - patch TypeScript

---

<!-- _class: cards -->

# 2.2. Patch Model

- `ttypescript`
  - custom compiler wrapper
- `ts-patch`
  - mutate installed TypeScript
- `tsconfig.plugins`
  - transformer module path
- Works because
  - compiler is JavaScript
  - transformer is JavaScript

---

# 2.3. Old Setup

```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "typia/lib/transform" },
      { "transform": "@nestia/core/lib/transform" },
      { "transform": "@nestia/sdk/lib/transform" }
    ]
  }
}
```

---

<!-- _class: compare -->

# 2.3. Broken Assumption

| Old world | TypeScript-Go world |
| --- | --- |
| compiler: JavaScript process | compiler: Go process |
| transformer: JavaScript module | transformer: JavaScript ecosystem |
| hook: patchable | hook: missing |
| language OK | transformer host broken |

---

<!-- _class: cards three -->

# 2.4. Project Risk

- typia risk
  - erased types unseen
  - validators not generated
  - serializers not generated
- nestia risk
  - controllers not extracted
  - SDK not generated
  - OpenAPI not generated
- Business risk
  - public APIs survive
  - engine disappears

---

<!-- _class: cards choice -->

# 2.4. Options

- Wait
  - upstream plugin model
  - unknown timeline
- Retreat
  - runtime schemas
  - weaker compiler magic
- Drop features
  - no transformer path
  - no generated boundary
- Build
  - new host
  - TypeScript-Go base

---

<!-- _class: lead -->

# 3. TTSC: Transformer Survival

- Compiler front door
- Plugin host
- Transformer lifecycle
- Runtime and editor path

---

<!-- _class: cards -->

# 3.1. Compiler Front Door

```bash
npx ttsc
npx ttsc --noEmit
npx ttsc --watch
```

- Familiar command shape
  - build
  - check
  - watch
- New responsibility
  - own project load
  - host transformers
  - route compiler facts

---

<!-- _class: cards -->

# 3.1. Not a Bypass

- Keep TypeScript-Go
  - native compiler base
  - semantic analysis
  - diagnostics
- Add missing layer
  - transformer host
  - plugin execution path
  - emit integration
- Goal
  - survive on the new compiler

---

<!-- _class: compare -->

# 3.2. Old Host vs TTSC Host

| Old | TTSC |
| --- | --- |
| Patch TypeScript install | Explicit compiler front door |
| JS compiler process | TypeScript-Go base |
| JS transformer loaded directly | Plugin host bridge |
| Build-time only | Build, runtime, editor |

---

<!-- _class: flow -->

# 3.2. Plugin Host

- Project owner
  - load project once
  - keep Program state
- Plugin package
  - discovered
  - built
  - cached
- Bridge
  - TypeScript-Go facts
  - transformer execution
  - emit output

---

<!-- _class: flow -->

# 3.3. Transformer Lifecycle

- Input
  - source files
  - declarations
  - compiler options
- Compiler facts
  - AST
  - Checker
  - diagnostics
- Output
  - generated JavaScript
  - rewritten emit
  - plugin diagnostics

---

<!-- _class: cards three -->

# 3.3. User API Stays

- typia user
  - `typia.createIs<T>()`
  - no runtime schema
- nestia user
  - `@TypedRoute`
  - generated SDK
- Internal shift
  - old patch removed
  - TTSC host added

---

<!-- _class: cards -->

# 3.4. Runtime Path

```bash
npx ttsx src/index.ts
```

- `tsx` convenience
  - direct TypeScript execution
- Type safety
  - real check
  - plugin-aware path
- Avoid
  - transpile-only blind spot

---

<!-- _class: cards -->

# 3.4. Editor Path

- `ttscserver`
  - plugin diagnostics
  - code actions
  - plugin commands
- VS Code path
  - project view
  - early feedback
- Goal
  - CI confirms
  - editor discovers

---

<!-- _class: cards -->

# 3.4. Whole Loop

- Build
  - `ttsc`
  - transformer emit
- Runtime
  - `ttsx`
  - checked execution
- Editor
  - `ttscserver`
  - plugin diagnostics
- One toolchain
  - not one wrapper

---

<!-- _class: lead -->

# 4. TTSC: Toolchain Opportunity

- One Program and Checker
- Linter without rebuild
- Graph instead of grep
- Patch to toolchain

---

<!-- _class: cards three -->

# 4.1. Compiler State

- Already loaded
  - Program
  - AST
  - Checker
  - diagnostics
- Expensive to rebuild
  - parse
  - module graph
  - type services
- Reusable by tools
  - transformers
  - linter
  - graph

---

<!-- _class: flow -->

# 4.1. Core Contract

- Load once
  - project
  - options
  - dependencies
- Analyze once
  - semantic graph
  - diagnostics
  - type relations
- Reuse many times
  - emit
  - lint
  - graph

---

<!-- _class: cards -->

# 4.2. Linter Without Rebuild

```bash
npx tsc --noEmit
npx eslint .
```

- Legacy cost
  - compiler pass
  - linter pass
  - second type world
- TTSC lint
  - same Program
  - same Checker
  - same diagnostics stream

---

<!-- _class: metric -->

# 4.2. VS Code Benchmark

Lint pass comparison:

| Tool         |       Time |
| ------------ | ---------: |
| ESLint       |  66,700 ms |
| `@ttsc/lint` |      74 ms |

**901.4x**

---

<!-- _class: compare -->

# 4.3. Graph Instead of Grep

| Grep-first agent | Compiler-first agent |
| --- | --- |
| search text | resolve symbol |
| open file | follow references |
| follow import | inspect diagnostics |
| repeat | open selected source |

---

<!-- _class: metric -->

# 4.3. Token Economy

TypeORM benchmark cell:

| Metric     |  Baseline |   Graph |
| ---------- | --------: | ------: |
| tokens     | 1,357,346 | 148,231 |
| file reads |        16 |       0 |
| tool calls |        38 |       1 |

**9.2x fewer tokens**

---

<!-- _class: flow -->

# 4.4. From Patch to Toolchain

- Started as survival
  - keep typia alive
  - keep nestia alive
  - keep transformers alive
- Became infrastructure
  - compiler front door
  - plugin host
  - shared compiler state
- Opened new tools
  - lint
  - graph

---

<!-- _class: cards -->

# 4.4. TTSC Surface

- Compiler
  - `ttsc`
- Runtime
  - `ttsx`
- Editor
  - `ttscserver`
- Reuse
  - `@ttsc/lint`
  - `@ttsc/graph`

---

<!-- _class: cards -->

# Closing

- TypeScript-Go
  - faster compiler
  - new runtime substrate
- Transformers
  - old patch point gone
  - host required
- TTSC
  - transformer survival
  - compiler-state toolchain
- Outcome
  - user API stays TypeScript
  - backend tooling moves forward

---

# Q&A

TypeScript Backend Meetup

2026-06-26

Samchon
