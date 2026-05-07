# Utility Plugins 리뷰 (`@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip`)

## 아키텍처 관찰

세 패키지는 모두 **얇은 위임 셸**. 각 `plugin/main.go`는 `version`, `check`(no-op), `build → utility.RunBuild`, `transform → utility.RunTransform`만 라우팅하고 모든 실질 로직이 `packages/ttsc/utility/host.go`에 모여 있음. `plugin/banner.go`, `plugin/paths.go`, `plugin/strip.go`는 빈 주석 파일.

> 사용자 메모리(plugin native binary contract): 각 플러그인은 `check`/`build`/`transform`을 자체 구현해야 하며 `check`도 tsgo를 대체해야 함.

---

## 공통 (세 플러그인 모두 해당)

### 🔴 Critical

#### 1. 세 바이너리 모두 `check`가 무조건 `return 0` (no-op)
`packages/banner/plugin/main.go:30-31`, `packages/paths/plugin/main.go:30-31`, `packages/strip/plugin/main.go:30-31`. 플러그인 native binary contract 위반. `lint`는 `RunCheck`가 별도 존재.
→ `utility`에 `RunCheck` 추가 (`prog.Diagnostics()` 검사 + 비-제로 종료).

#### 2. `loadUtilityProgram` 실패 시 `prog.Close()` 누락
`utility/host.go:177-180`. 진단이 있으면 `prog`를 닫지 않고 `false` 리턴. 호출자도 `defer prog.Close()`에 도달 못 함 → 타입체커 풀 누수.

### 🟡 Design

#### 3. `flag.Parse` 사용으로 미지의 플래그 시 즉시 실패
`utility/host.go:109-150`. `lint`는 `filterKnownFlags`로 무시. 호스트가 새 플래그 추가 시 utility 플러그인은 죽음.

#### 4. `RunTransform`의 `--file` 미지원
`utility/host.go:86-107`. lint와 호출 패턴 비일관.

#### 5. `utility.RunBuild` 종료 코드 누락
`utility/host.go:76-78`. emit 진단이 있어도 항상 `return 0`.
→ `if driver.CountErrors(eDiags) > 0 { return 2 }`.

#### 6. `prog.Diagnostics()` 결과를 무조건 에러 처리
`utility/host.go:177-180`. 경고/제안 분류 안 함.

### 🟢 Minor

#### 7. 종료 코드 라벨링 비일관 (lint와 비교)

#### 8. `check` no-op 정책 README 미명시

#### 9. `const version = "0.0.1"` 하드코딩 vs package.json `0.8.1`

#### 10. 빈 `plugin/banner.go`, `plugin/paths.go`, `plugin/strip.go`
npm tarball을 부풀리고 오해 유발.

---

## `@ttsc/banner`

### 🔴 Critical

#### 11. shebang 라인 보존 누락
`utility/host.go:236-246` (`makeSourcePreambleWriteFile`), `utility/host.go:336-378` (`sourcePreambleFS.ReadFile`). 두 경로 모두 shebang(`#!/usr/bin/env node`)을 배너 *뒤*로 밀어냄. CLI 진입 파일의 실행이 깨짐.
→ `text`가 `#!`로 시작하면 첫 줄을 분리한 뒤 `shebang + "\n" + preamble + rest`.

#### 12. BOM 처리 부재
`driver/program.go:341-347`. 입출력 BOM 일관성 깨질 수 있음.
→ `strings.HasPrefix(contents, "﻿")` 분기.

### 🟡 Design

#### 13. 입력+출력 양쪽에 동시 주입 → 이중 삽입 위험
`sourcePreambleFS.ReadFile`이 입력 .ts에 prepend하면 컴파일러가 leading 코멘트로 emit하여 출력에 이미 포함됨. 그 위에서 `makeSourcePreambleWriteFile`이 정확히 동일 문자열 검사로만 가드 → 공백·줄바꿈 차이로 검출 실패 가능.
→ 한 채널만 사용 (`sourcePreambleFS`만 충분, 출력 prepender 제거).

#### 14. `removeComments: true`일 때 .d.ts 정책 모호

#### 15. `sanitizeJSDocLine`이 `*/`만 치환
`/**/`, `*/` 변형 미가드.

#### 16. 다중 `@ttsc/banner` 엔트리 단순 concat
명시적 분리자 또는 단일 엔트리 강제.

### 🟢 Minor

#### 17. JSDoc 라인 정렬 미세 비일관 (`utility/host.go:308-315`)

#### 18. README가 `.d.ts` 동작 명세 누락

#### 19. 소스맵 오프셋 IDE 동작 명시 필요

---

## `@ttsc/paths`

### 🔴 Critical

#### 20. AST 노드 in-place 변경의 안전성 미검증
`utility/host.go:378-382`. `lit.AsStringLiteral().Text = rewritten`. 노드의 텍스트 위치(`Loc`)와 부모 source의 `text` 슬라이스는 그대로. 두 번 emit 시 결과 차이 가능.
→ 단위 테스트로 실제 .js 결과 검증.

#### 21. 디렉터리(인덱스) 매핑 미지원
`utility/host.go:458-472`. `"@/foo": ["src/foo"]` (디렉터리, `index.ts` 매칭) 처리 안 됨.
→ `candidate/index.{ts,tsx,...}`도 시도.

#### 22. `outDir` 미설정 시 silent 실패
`utility/host.go:475-478`. specifier가 그대로 남고 진단도 없음.
→ 진단 발행 또는 README 강한 경고.

### 🟡 Design

#### 23. 동적 `import("@/foo")`에서 식별자/템플릿 인자 미처리
정책상 옳을 수 있으나 README 미명시.

#### 24. `baseUrl` 처리 모호
`utility/host.go:342-343`은 `GetPathsBasePath`만 사용. 모노레포 회귀 테스트 필요.

#### 25. 다중 타깃 우선순위 문서화 부족
첫 매칭 사용. d.ts 전용 stub과 충돌 가능.

#### 26. `commonSourceDir` 자체 추정
`utility/host.go:510-526`. 단일 파일 프로젝트에서 비결정적. tsgo 헬퍼 위임 권장.

#### 27. `patternRank`가 와일드카드 길이만 고려
TypeScript는 prefix 토큰 수도 고려.

### 🟢 Minor

#### 28. `stripKnownSourceExtension` 대소문자 처리 주석 보강

#### 29. project references 외부 패키지 specifier 미변경 케이스 README 명시

---

## `@ttsc/strip`

### 🔴 Critical

#### 30. statement-level 외 호출 미처리
`utility/host.go:622-636`. `KindExpressionStatement`만 검사. `const x = console.log(...)` 같은 표현식 위치는 그대로 남음.
→ README 경고 또는 정책 확장.

#### 31. `filterStatements` 백킹 배열 공유
`utility/host.go:594-607`. `out := list.Nodes[:0]`. AST가 공유하는 백킹 배열을 in-place 재작성 → 다른 참조에서 변경 누설.
→ `out := make([]*shimast.Node, 0, len(list.Nodes))`.

#### 32. 단일-statement body 미처리
`if (cond) console.log("x");` 같은 중괄호 없는 분기는 `StatementList`가 nil → 호출 그대로 emit.
→ if/for/while의 `Statement` 슬롯 처리.

### 🟡 Design

#### 33. 패키지 이름이 type stripping을 연상시킴
README 더 강한 디스클레이머.

#### 34. `assert.*` 와일드카드는 최소 1단계 깊이
`utility/host.go:667-676`. README 명시.

#### 35. `new console.log()` 미처리 명시 필요

#### 36. Optional chaining `console?.log()` 누락
`dottedName` (`utility/host.go:686-703`)이 `KindPropertyAccessExpression`만 처리.

#### 37. 호출 인자 부수효과 무시
`console.log(loadConfig())`에서 `loadConfig()`도 사라짐. README 명시.

### 🟢 Minor

#### 38. `equalStringSlices` → `slices.Equal` 표준 라이브러리

#### 39. ESM `import { equal } from "node:assert"` 매칭 안 됨 안내

---

## lint 대비 일관성 갭 요약

| 항목 | lint | banner/paths/strip |
|---|---|---|
| `check` 구현 | 진단 + 비-제로 종료 | **no-op** |
| 미지의 플래그 | `filterKnownFlags`로 무시 | `flag.Parse`로 즉시 실패 |
| 첫 플러그인 위치 강제 | `FindLintEntry`가 `i != 0`이면 거부 | 없음 |
| 종료 코드 의미 | `2`/`3` 일관 | 일부 경로에서 `0` |
| Resource cleanup | `defer prog.close()` 일관 | 실패 경로 누수 |

---

## 권장 수정 순서

1. (Critical) 세 main.go의 `check` 구현 — `utility.RunCheck` 추가
2. (Critical) `loadUtilityProgram` 실패 경로 `prog.Close()`
3. (Critical) `banner` shebang/BOM 보존
4. (Critical) `strip` 단일-statement body + 슬라이스 안전화
5. (Critical) `paths` 디렉터리 인덱스 매핑
6. (Design) `filterKnownFlags`/단일 파일 transform/`RunBuild` 종료 코드 통합
7. (Design) 다중 banner 엔트리 처리 + AST in-place 변경 단위 테스트
