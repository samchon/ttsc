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

대충 TypeScript-Go 발표 뉴스 보여주는 이야기.

대충 Microsoft가 TypeScript compiler를 Go로 다시 만들고 있다는 이야기.

대충 TypeScript 7부터 이걸 기본 엔진으로 가져오려 한다는 이야기.

대충 `tsc`, editor, LSP가 10배쯤 빨라진다는 좋은 뉴스라는 이야기.

---

# 1.1. Bad News

대충 근데 transformer 사용자 입장에서는 다 좆되었다는 이야기.

대충 기존 transformer 생태계가 JavaScript TypeScript compiler 내부 hook에 기대고 있었다는 이야기.

대충 compiler가 Go로 바뀌면 그 hook에 patch 붙이던 방식이 그대로 안 통한다는 이야기.

대충 typia, nestia 같은 백엔드 TypeScript 도구가 이 문제를 정면으로 맞는다는 이야기.

---

# 1.2. Transformer

대충 transformer가 TypeScript 타입 정보를 읽어 코드를 자동 생성하거나 바꾸는 기술이라는 이야기.

대충 런타임 validation, serialization, SDK generation 같은 일을 컴파일 타임에 끝낸다는 이야기.

대충 typia와 nestia가 이 방식으로 백엔드 보일러플레이트를 없애왔다는 이야기.

---

# 1.2. Transformer

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

# 1.2. Transformer

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

# 1.2. Transformer

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

# 1.2. Transformer

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

# 1.2. Transformer

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

# 1.3. The Compatibility Gap

대충 기존 transformer 생태계는 JavaScript TypeScript compiler를 patch해서 살아왔다는 이야기.

대충 `ts-patch`가 compiler 내부 hook을 열어주고, `tsconfig.json`이 transformer를 꽂아주던 구조라는 이야기.

대충 TypeScript-Go는 compiler 내부가 Go라서 이 방식이 그대로 통하지 않는다는 이야기.

---

# 1.3. The Compatibility Gap

대충 TypeScript 7로 가면 사용자 코드가 문제가 아니라 빌드 파이프라인이 막힌다는 이야기.

대충 typia와 nestia API는 그대로 있어도, 뒤에서 코드를 만들어주던 engine이 사라진다는 이야기.

대충 "TypeScript가 빨라졌다"가 transformer 사용자에겐 "기존 생태계가 끊겼다"가 될 수 있다는 이야기.

---

# 2. TTSC

대충 그래서 TypeScript-Go 위에서 transformer 생태계를 다시 만들었다는 이야기.

대충 목표는 새 compiler로 갈아타도 typia와 nestia의 사용 경험이 유지되는 것이라는 이야기.

대충 `ttsc`, `ttsx`, `ttscserver`로 compiler, runtime, editor 쪽을 같이 잡는다는 이야기.

---

# 2.1. Transformer

대충 Go 기반 compiler AST와 Checker 위에서 동작하는 transformer plugin 생태계를 다시 만들었다는 이야기.

대충 `ts-patch install`이 아니라 `ttsc`가 plugin source를 빌드하고 캐시하고 실행한다는 이야기.

대충 `ttsc` 명령어로 컴파일하면 기존 transformer 사용자 경험을 TypeScript-Go 위로 가져온다는 이야기.

---

# 2.2. Runtime

대충 `ttsx src/index.ts`로 TypeScript entrypoint를 바로 실행할 수 있다는 이야기.

대충 `tsx`나 `ts-node`처럼 쓰지만 먼저 진짜 type-check를 한다는 이야기.

대충 TypeScript-Go 속도 덕분에 개발 runtime에서 type safety를 포기하지 않아도 된다는 이야기.

---

# 2.3. Linter

대충 linter도 transformer plugin처럼 compiler AST와 Checker 위에서 실행한다는 이야기.

대충 `ttsc` 명령어 한 방에 compile error와 lint violation을 같이 잡는다는 이야기.

대충 이미 compile하면서 만든 AST와 type information을 재사용하니 lint 비용이 0에 수렴한다는 이야기.

대충 VS Code급 프로젝트에서 ESLint 대비 800~900배 성능차를 보인다는 이야기.

---

# 3. TTSC Graph

대충 여기부터는 compiler 정보를 사람뿐 아니라 AI coding agent에게도 주겠다는 이야기.

대충 Claude Code나 Codex가 파일을 마구 읽는 대신 compiler graph를 질의하게 만든다는 이야기.

대충 transformer, linter 다음 단계로 codebase understanding을 compiler 기반으로 가져간다는 이야기.

---

# 3.1. Compiler-Aware Context

대충 exports, imports, symbol, references, call path 같은 정보를 AST 기반 graph로 제공한다는 이야기.

대충 grep은 문자열을 찾지만, graph는 코드 구조와 의미를 따라간다는 이야기.

대충 "이 함수 어디서 쓰임?" 같은 질문을 compiler가 아는 정보로 답하게 한다는 이야기.

---

# 3.2. For Coding Agents

대충 클로드 코드나 코덱스에게 "일단 파일 다 읽어"가 아니라 "이 symbol 주변만 봐"를 시킨다는 이야기.

대충 과도한 파일 리드와 잘못된 grep 탐색을 줄인다는 이야기.

대충 토큰 소모량이 100배쯤 줄어드는 방향의 이야기.

---

# 3.3. Compiler Platform

대충 TTSC는 `tsc` wrapper가 아니라 TypeScript-Go 기반 compiler platform이 되려 한다는 이야기.

대충 transformer, runtime, linter, graph가 전부 같은 compiler substrate 위에 있다는 이야기.

대충 백엔드 TypeScript 개발 도구가 다음 세대로 넘어가는 길을 보여준다는 이야기.

---

# Q & A

2026-06-26

Samchon
