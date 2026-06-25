---
marp: true
theme: default
paginate: true
size: 4:3
title: "TTSC: Transformer Survival in the TypeScript 7 Era"
description: "TypeScript Backend Meetup, 2026-06-26"
footer: "TTSC | TypeScript Backend Meetup | 2026-06-26"
style: |
  section {
    font-family: "Inter", "Segoe UI", "Pretendard", sans-serif;
    color: #111827;
    padding: 72px 84px;
  }
  section.lead {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  h1 {
    color: #0f172a;
    font-size: 58px;
  }
  h2 {
    color: #0f172a;
    font-size: 44px;
  }
  h3 {
    color: #2563eb;
    font-size: 32px;
  }
  strong {
    color: #2563eb;
  }
  code {
    font-family: "Cascadia Code", monospace;
  }
  table {
    font-size: 24px;
  }
  blockquote {
    border-left: 8px solid #2563eb;
    color: #1f2937;
    font-size: 34px;
    padding-left: 28px;
  }
  section.split h1 {
    margin-bottom: 28px;
  }
  section.split .cols {
    align-items: stretch;
    display: grid;
    gap: 36px;
    grid-template-columns: 0.95fr 1.05fr;
  }
  section.split .cols.equal {
    grid-template-columns: 1fr 1fr;
  }
  section.split .col {
    min-width: 0;
  }
  section.split .panel,
  section.split .code-card,
  section.split .diagram {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 22px;
  }
  section.split .label {
    color: #2563eb;
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 14px;
    text-transform: uppercase;
  }
  section.split .caption {
    color: #475569;
    font-size: 24px;
    margin-top: 16px;
  }
  section.split pre {
    background: #0f172a;
    border-radius: 8px;
    color: #e5e7eb;
    font-size: 20px;
    line-height: 1.35;
    margin: 0;
    padding: 18px;
  }
  section.split .node,
  section.split .hub,
  section.split .metric {
    background: #ffffff;
    border: 1px solid #94a3b8;
    border-radius: 8px;
    padding: 14px 18px;
  }
  section.split .node {
    font-size: 24px;
    font-weight: 700;
    text-align: center;
  }
  section.split .arrow {
    color: #64748b;
    font-size: 28px;
    font-weight: 800;
    margin: 10px 0;
    text-align: center;
  }
  section.split .flow-grid {
    display: grid;
    gap: 12px;
  }
  section.split .hub {
    border-color: #2563eb;
    color: #0f172a;
    font-size: 28px;
    font-weight: 800;
    margin: 16px 0;
    text-align: center;
  }
  section.split .spokes {
    display: grid;
    gap: 12px;
    grid-template-columns: 1fr 1fr;
  }
  section.split .mini {
    color: #334155;
    font-size: 22px;
  }
  section.split .metric {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
    justify-content: center;
    min-height: 280px;
  }
  section.split .metric strong {
    color: #16a34a;
    font-size: 96px;
    line-height: 1;
  }
  section.split .bar {
    align-items: center;
    display: grid;
    gap: 12px;
    grid-template-columns: 110px 1fr 110px;
    margin: 12px 0;
  }
  section.split .bar-fill {
    background: #2563eb;
    border-radius: 8px;
    height: 18px;
  }
  section.split .bar-fill.green {
    background: #16a34a;
  }
---

<!-- _class: lead -->

# TTSC

### TypeScript-Go ToolChain

Samchon

2026-06-26

---

# Preface

![](https://ttsc.dev/og.jpg)

---

# 1. TypeScript-Go

- 1.1. Good News
- 1.2. Bad News
- 1.3. Transformer
- 1.4. Compatibility Gap

---

# 1.1. Good News

대충 Microsoft가 TypeScript compiler를 Go로 다시 만들고 있다는 이야기.

대충 TypeScript 7부터 이걸 기본 엔진으로 가져오려 한다는 이야기.

대충 `tsc`, editor, LSP가 10배쯤 빨라진다는 좋은 뉴스라는 이야기.

---

# 1.2. Bad News

대충 근데 transformer 사용자 입장에서는 다 좆되었다는 이야기.

대충 기존 transformer 생태계가 JavaScript TypeScript compiler 내부 hook에 기대고 있었다는 이야기.

대충 compiler가 Go로 바뀌면 그 hook에 patch 붙이던 방식이 그대로 안 통한다는 이야기.

대충 typia, nestia 같은 백엔드 TypeScript 도구가 이 문제를 정면으로 맞는다는 이야기.

---

# 1.3. Transformer

대충 transformer가 TypeScript 타입 정보를 읽어 코드를 자동 생성하거나 바꾸는 기술이라는 이야기.

대충 런타임 validation, serialization, SDK generation 같은 일을 컴파일 타임에 끝낸다는 이야기.

대충 typia와 nestia가 이 방식으로 백엔드 보일러플레이트를 없애왔다는 이야기.

---

# 1.3. Transformer

### typia validation generator

### Generic function call with `IMember` type

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
typia.createIs<IMember>();
```

---

# 1.3. Transformer

### Becomes transformed JS code

```javascript
import * as _b from "typia/lib/internal/_isFormatEmail";
import * as _a from "typia/lib/internal/_isFormatUuid";
import * as _c from "typia/lib/internal/_isTypeUint32";

(() => {
  const _io0 = (input) =>
    "string" === typeof input.id &&
    _a._isFormatUuid(input.id) &&
    "string" === typeof input.email &&
    _b._isFormatEmail(input.email) &&
    "number" === typeof input.age &&
    _c._isTypeUint32(input.age) &&
    19 < input.age &&
    input.age <= 100;
  return (input) => "object" === typeof input && null !== input && _io0(input);
})();
```

---

# 1.3. Transformer

### nestia route generator

```typescript
import { TypedBody, TypedRoute } from "@nestia/core";
import { Controller } from "@nestjs/common";

@Controller()
export class ShoppingSaleController {
  @TypedRoute.Post()
  public async create(
    @TypedBody() body: IShoppingSale.ICreate
  ): Promise<IShoppingSale> { ... }
}
```

---

# 1.4. Compatibility Gap

대충 기존 transformer는 TypeScript compiler를 patch해서 들어갔다는 이야기.

대충 JavaScript compiler에서는 억지로라도 hook을 만들 수 있었다는 이야기.

대충 Go compiler로 넘어가면 그 방식이 그대로 이어지지 않는다는 이야기.

---

# 1.4. Compatibility Gap

### Required "ts-patch"

```json
{
  "scripts": {
    "prepare": "ts-patch install"
  },
  "devDependencies": {
    "ts-patch": "^3.2.1"
  }
}
```

---

# 1.4. Compatibility Gap

### Required tsconfig.json configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "plugins": [
      { "transform": "typia/lib/transform" },
      { "transform": "@nestia/core/lib/transform" },
      { "transform": "@nestia/sdk/lib/transform" },
    ]
  }
}
```

---

# 1.4. Compatibility Gap

대충 typia와 nestia API는 그대로 있어도, 뒤에서 코드를 만들어주던 engine이 사라진다는 이야기.

대충 "TypeScript가 빨라졌다"가 transformer 사용자에겐 "기존 생태계가 끊겼다"가 될 수 있다는 이야기.

대충 그래서 TypeScript-Go 위에서 transformer 생태계를 다시 만들어야 한다는 이야기.

---

# 2. TTSC

- 2.1. Compiler
- 2.2. Transformer
- 2.3. Runtime
- 2.4. Language Server

---

# 2.1. Compiler

대충 `ttsc`는 TypeScript-Go 기반 compiler CLI라는 이야기.

대충 `tsc`처럼 build, check, watch를 하되 plugin host까지 같이 가진다는 이야기.

대충 TypeScript-Go를 그냥 빠른 compiler가 아니라 확장 가능한 compiler platform으로 쓰겠다는 이야기.

---

# 2.2. Transformer

대충 Go 기반 compiler AST와 Checker 위에서 동작하는 transformer plugin 생태계를 다시 만들었다는 이야기.

대충 `ts-patch install`이 아니라 `ttsc`가 plugin source를 빌드하고 캐시하고 실행한다는 이야기.

대충 `ttsc` 명령어로 컴파일하면 기존 transformer 사용자 경험을 TypeScript-Go 위로 가져온다는 이야기.

---

# 2.3. Runtime

대충 `ttsx src/index.ts`로 TypeScript entrypoint를 바로 실행할 수 있다는 이야기.

대충 `tsx`나 `ts-node`처럼 쓰지만 먼저 진짜 type-check를 한다는 이야기.

대충 TypeScript-Go 속도 덕분에 개발 runtime에서 type safety를 포기하지 않아도 된다는 이야기.

---

# 2.4. Language Server

대충 `ttscserver`로 editor와 compiler plugin을 연결한다는 이야기.

대충 LSP 위에서 plugin diagnostics, code actions, commands를 editor까지 올린다는 이야기.

대충 compiler plugin 생태계가 CLI에서 끝나지 않고 VS Code 경험까지 이어진다는 이야기.

---

# 3. TTSC Linter

- 3.1. Why Lint Again
- 3.2. Compiler-Aware Rules
- 3.3. Zero-Cost Linting
- 3.4. VS Code Benchmark

---

# 3.1. Why Lint Again

대충 이미 ESLint가 있는데 왜 또 linter를 만들었냐는 이야기.

대충 TypeScript rule은 결국 AST와 type information이 필요한데, compiler가 이미 그걸 만들고 있다는 이야기.

대충 같은 정보를 두 번 계산하는 게 낭비라는 이야기.

---

# 3.2. Compiler-Aware Rules

대충 linter도 transformer plugin처럼 compiler AST와 Checker 위에서 실행한다는 이야기.

대충 `ttsc` 명령어 한 방에 compile error와 lint violation을 같이 잡는다는 이야기.

대충 third-party rule도 compiler-aware하게 만들 수 있다는 이야기.

---

# 3.3. Zero-Cost Linting

대충 이미 compile하면서 만든 AST와 type information을 재사용하니 lint 비용이 0에 수렴한다는 이야기.

대충 compile과 lint가 따로 도는 게 아니라 같은 pass 위에 올라간다는 이야기.

대충 그래서 큰 프로젝트일수록 차이가 커진다는 이야기.

---

# 3.4. VS Code Benchmark

대충 VS Code급 프로젝트에서 ESLint 대비 800~900배 성능차를 보인다는 이야기.

대충 Microsoft가 TypeScript-Go 성능 기준으로 썼던 VS Code fixture를 같이 기준으로 삼는다는 이야기.

대충 benchmark 숫자를 통해 "빠르다"가 아니라 "다시 돌릴 필요가 없다"를 보여준다는 이야기.

---

# 4. TTSC Graph

- 4.1. Why grep Fails
- 4.2. Compiler-Aware Context
- 4.3. For Coding Agents
- 4.4. Token Economy

---

# 4.1. Why grep Fails

대충 grep은 문자열을 찾지만 코드 의미를 모른다는 이야기.

대충 export 이름, import alias, symbol reference, call path는 문자열 검색만으로 틀리기 쉽다는 이야기.

대충 agent가 grep만 믿으면 필요 없는 파일을 많이 읽고도 핵심을 놓친다는 이야기.

---

# 4.2. Compiler-Aware Context

대충 exports, imports, symbol, references, call path 같은 정보를 AST 기반 graph로 제공한다는 이야기.

대충 grep은 문자열을 찾지만, graph는 코드 구조와 의미를 따라간다는 이야기.

대충 "이 함수 어디서 쓰임?" 같은 질문을 compiler가 아는 정보로 답하게 한다는 이야기.

---

# 4.3. For Coding Agents

대충 클로드 코드나 코덱스에게 "일단 파일 다 읽어"가 아니라 "이 symbol 주변만 봐"를 시킨다는 이야기.

대충 과도한 파일 리드와 잘못된 grep 탐색을 줄인다는 이야기.

대충 agent가 compiler graph를 먼저 보고 필요한 파일만 읽게 만든다는 이야기.

---

# 4.4. Token Economy

대충 과도한 파일 리드를 줄이면 토큰 소모량이 100배쯤 줄어드는 방향의 이야기.

대충 더 적은 context로 더 정확한 수정 지점을 찾게 한다는 이야기.

대충 TTSC가 compiler platform에서 AI coding substrate까지 확장된다는 이야기.

---

# Q & A

2026-06-26

Samchon
