# `@ttsc/lint` & `@ttsc/unplugin` 리뷰

---

## `@ttsc/unplugin`

### 🔴 Critical

#### 1. `transform`이 모듈마다 컴파일러 재생성 → 전체 프로젝트 재변환
`packages/unplugin/src/core/transform.ts:35`. 매 호출마다 `new TtscCompiler({...}).transform()`. 결과의 `result.typescript` 맵에 모든 파일이 있는데도 매 파일마다 재계산 후 한 파일만 반환.
→ `effectiveTsconfig` 경로 + mtime 키로 LRU/Map 캐시. 또는 `configResolved` 시 1회 컴파일 + 콜백은 캐시 조회.

#### 2. 소스 트리에 temp tsconfig 작성
`core/transform.ts:144-167`. `path.join(directory, '.ttsc-unplugin-${pid}-${Date.now()}-${random}.json')`. (a) Vite chokidar의 무한 reload, (b) 프로세스 사망 시 leak (SIGINT 처리 없음), (c) 다중 동시 트랜스폼에서 race.
→ `os.tmpdir()` + `extends` 절대 경로. 또는 in-memory tsconfig API.

#### 3. diff 기반 source-map 재구성은 잘못된 매핑
`core/transform.ts:79-125`. tsgo가 정확한 source-map을 생성할 수 있는데도 `diff-match-patch-es`로 재추측. 토큰 이동(typia 코드 삽입 등) 시 매핑 깨짐.
→ `result.sourceMaps`가 있으면 그대로 반환, 없을 때만 fallback.

#### 4. `bun.ts:25-26` — `unplugin.raw(options, {} as UnpluginContextMeta)`
framework discriminator가 깨지고, `transform.call({} as never, ...)`로 `this` 컨텍스트 비움 → 미래 unplugin 코어 변경 시 silent 깨짐.
→ 구체 컨텍스트(`{ framework: "esbuild" }`) + warn/error 폴리필.

#### 5. `core/index.ts:25-28` — Vite alias만 캡처, 프레임워크 의존
Vite SSR 사전 평가, Rollup 단독, Webpack/Rspack에서 alias 미적용.
→ framework별 hook 분기 + transform 진입 시 unknown 가드.

#### 6. `core/index.ts:30-33` — `transformInclude` + `transform` 이중 필터링
unplugin v2에서 한 번이면 충분.

### 🟡 Design

#### 7. `rollup.config.mjs:18-32` — chunk 이름에 `node_modules` 포함 시 throw 메시지 부족

#### 8. `core/transform.ts:67-73` — `?__rslib_entry__` 하드코드
옵션화 또는 모든 query/fragment 무시.

#### 9. `core/transform.ts:269-272` — alias `find`가 RegExp이면 silently drop
Vite의 RegExp alias 흔함. string normalize 또는 1회 warn.

#### 10. `next.ts:17-26` — Next webpack hook idempotent 가드 부재
같은 plugin이 dev/build/server/edge에서 중복 unshift.
→ `config.plugins.find((p) => p?.name === "ttsc-unplugin")` 가드.

#### 11. `core/transform.ts:286-296` — 결과 키 매칭 fallback이 O(N)
캐시 도입 시 사라지나 그 전까지 normalized abs path Map 사용.

#### 12. `core/transform.ts:299-316` — `formatDiagnostics`가 severity 손실
모든 diagnostic을 한 줄씩 join하여 throw. `this.error`/`this.warn` 활용해야 번들러가 색/심볼/요약 표시.

#### 13. 어댑터 wrapper들이 framework-specific defaults를 잃음
vite/webpack/rollup/rspack/farm/rolldown 모두 1줄. enforce/위치 옵션 분기 지점 부재.

#### 14. `core/index.ts:20-22` — `enforce: "pre"` 고정
`enforce?: "pre" | "post"` 노출.

#### 15. Watch / incremental 무대응
`addWatchFile` 호출 없음. tsconfig/extends 변경 미반영.

### 🟢 Minor

#### 16. `crypto.randomUUID()`로 단순화 (`core/transform.ts:147-150`)

#### 17. `TtscTransformResult` 타입 별칭 미export

#### 18. `package.json:71` — 워크스페이스 외부에서 깨짐. 명시 필요.

#### 19. 동일 source/code일 때 source-map 미생성. 이전 plugin chain 끊김.

#### 20. `index.ts` vs `api.ts` export shape 통합 권장.

---

## `@ttsc/lint`

### 🔴 Critical

#### 1. `plugin/host.go:92-100` — `SingleThreaded: TSTrue` 고정
큰 프로젝트에서 typecheck 직렬 강제. tsconfig에서 명시 안 했으면 default(false).

#### 2. `plugin/engine.go:213-247` — 매 노드마다 `Context` 객체 alloc
파일당 수만 노드 × 룰 수 → GC 압력. shared traversal 장점 상쇄.
→ stack-friendly 값 타입 또는 룰 수만큼 미리 만들고 severity만 교체하는 pool.

#### 3. `plugin/engine.go:222-247` — 클로저 기반 walk
파일마다 새 클로저 alloc. `node.ForEachChild`에 매 호출 람다.
→ stack 기반 iterative DFS 또는 메서드 receiver.

#### 4. `plugin/compile.go:329-353` — ESLint 발견 시 native 룰 결과 *전부 폐기*
`runExternalESLintDiagnostics`가 `ran=true`면 `engine.Run` 호출 안 함. 같은 프로젝트의 inline `config: {...}` 효력 사라짐. **패키지 가치 제안과 정면 충돌**.
→ 둘 다 실행 후 합치거나, 디스커버리는 명시적 opt-in.

#### 5. `plugin/config.go:59-69` — `FindLintEntry` 순서 강제 근거 약함
`@ttsc/lint`는 자체 program으로 *원본* AST를 검사하므로 `[lint, typia]` 강제의 기술적 근거 모호. transform 단계와 별개일 수 있음.
→ check stage끼리만 강제, 또는 강제 사유 명시.

#### 6. `plugin/compile.go:122-158` — `RunTransform`이 마지막 JS만 캡처
declaration map / source map / 추가 chunk 무시. 정확한 파일명 매칭 + source map 동행.

#### 7. `plugin/config.go:773-832` (`loadTypeScriptConfigFile`) — 매 invocation마다 cold-start
mkdir tmp + symlink + ttsx spawn. lint config 거의 안 변하는데 매번.
→ `<temp>/<hash(location, mtime)>.json` 캐시.

### 🟡 Design

#### 8. `plugin/engine.go:147-158` — 외부 ESLint 동작 시 unknown 룰 silent
타이포 영영 미발견.
→ 항상 stderr로 알림.

#### 9. `plugin/compile.go:360-372` — `RuleCode` FNV-1a + 9000 base 충돌 가능
`init()` 시점 결정적 분배 또는 충돌 시 panic.

#### 10. `plugin/config.go:622-633` — `.cjs`도 ESM dynamic import
`module.exports = X`의 default semantic 차이로 `parseExternalRuleMap` 실패 가능.
→ `.cjs`는 `createRequire`.

#### 11. `plugin/config.go:1135-1209` — 자체 glob matcher
ESLint flat config의 negation/brace expansion 미지원. ESLint config 그대로 쓰는 경우 강제 ESLint runtime 또는 미지원 패턴 거절.

#### 12. `plugin/directives.go:118-136` — `suppresses`가 매 finding마다 events 선형 스캔
events sort 활용 + line group prefix-fold.

#### 13. `plugin/engine.go:213-247` — SourceFile-level 룰 분기 가독성
"root only" rule trait 신설.

#### 14. `plugin/eslint_runtime.go:186-188` — UTF-16 column `\r\n` 처리 어긋남

#### 15. `plugin/rules_problems.go:551-565` & `rules_loops.go:60-103` — 카운터 식별자만 처리, destructuring 무시. README 명시.

#### 16. `plugin/rules_problems.go:316-336` (`noPromiseExecutorReturn`) — 블록 본문 `return X` 미검사. ESLint 원본과 차이.

#### 17. `plugin/rules_problems.go:236-252` — `noClassAssign`/`noFuncAssign` 매번 SourceFile 재탐색 + shadow scope 무시.
→ 단일 pass + name → declKind 맵.

#### 18. `plugin/config.go:330-348` — 빈 `rules: {}` entry 추가로 `matchesFile` false positive

#### 19. `plugin/compile.go:297-324` (`filterKnownFlags`) — 알 수 없는 long flag silently drop. 타이포 silent.

#### 20. `plugin/host.go:92-97` — `UseSourceOfProjectReference: true` 고정
references 사용 프로젝트에서 비용 폭증. 옵션화.

### 🟢 Minor

#### 21. `plugin/main.go:23` — `version = "0.0.1"` vs npm 0.8.1

#### 22. `node.ForEachChild` `false` 반환 패턴 비표준. helper로 감싸기.

#### 23. `plugin/rules_var.go:38-86` (`preferConst`) — destructuring 항목 자체 walk 가능한데 빠짐

#### 24. `plugin/rules_problems.go:146-171` — `\\\[` 이스케이프 brace 미인식

#### 25. `plugin/config.go:55-69` — 동일 lint entry 두 번 미감지

#### 26. `plugin/eslint_runtime.go:191-246` — inline JS 별도 파일 + `embed.FS`로 분리

#### 27. `plugin/config.go:855-983` — JS/TS 직렬화 로직 중복 drift 위험

#### 28. `plugin/rules_strings.go:108-115` (`noOctal`) — `09` 같은 invalid octal 메시지 misleading

#### 29. `src/index.ts:8-16` — `_context` unused. 검증에 활용 가능.

#### 30. `src/structures/TtscLintSeverity.ts:8` — Go 측 `parseSeverity`가 `float64`로 받음 명시.
