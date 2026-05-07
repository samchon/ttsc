# 종합 요약 / 우선순위 / 액션 아이템

`@ttsc/station` v0.8.1 리뷰 종합. 4개 영역 합쳐 **Critical 41건, Design 50건, Minor 38건**.

---

## 🚨 Top 10 즉시 수정 항목

| # | 위치 | 영향 | 분류 |
|---|---|---|---|
| 1 | `runTtsx.ts:181-189` — hardlink로 원본 출력물 변조 | 사용자 데이터 손상 | core |
| 2 | `prepareExecution.ts:14-46` — PID 기반 캐시 누수 | 디스크/이름 충돌 | core |
| 3 | `core/transform.ts:35` — unplugin이 모듈마다 전체 프로젝트 재컴파일 | 빌드 시간 N²-ish | unplugin |
| 4 | `core/transform.ts:144-167` — 소스 트리에 temp tsconfig 작성 | watcher 무한 reload + race | unplugin |
| 5 | `compile.go:329-353` — lint가 ESLint 발견 시 native 룰 결과 폐기 | 패키지 가치 제안과 충돌 | lint |
| 6 | `utility/host.go:236-246` — banner가 shebang을 첫 바이트가 아니게 만듦 | CLI 진입 파일 실행 깨짐 | banner |
| 7 | `utility/host.go:594-607` — strip의 `filterStatements` 백킹 배열 공유 | AST 다른 참조에서 깨짐 | strip |
| 8 | utility 3종 `check`가 무조건 `return 0` | tsgo 대체 contract 위반 | utility |
| 9 | `buildSourcePlugin.ts:195-219` — `go build` 인자 주입 | 임의 플래그 주입 | core |
| 10 | `core/transform.ts:79-125` — diff 기반 source-map 부정확 | 디버깅 매핑 silent 깨짐 | unplugin |

---

## 영역별 통계

| 영역 | 🔴 Critical | 🟡 Design | 🟢 Minor | 합계 |
|---|---:|---:|---:|---:|
| 문서 | 6 | 14 | 18 | 38 |
| ttsc-core | 13 | 17 | 10 | 40 |
| utility plugins | 12 | 15 | 13 | 40 |
| lint + unplugin | 13 | 21 | 16 | 50 |
| **합계** | **44** | **67** | **57** | **168** |

---

## 권장 수정 순서

### 1차 (계약·데이터 안전)
- utility 3종 `check` 구현 (`utility.RunCheck` 추가)
- `loadUtilityProgram` 실패 경로 `prog.Close()`
- banner shebang/BOM 보존
- strip 단일-statement body + 슬라이스 안전화
- paths 디렉터리 index 매핑
- `runTtsx.ts` hardlink → copy
- `prepareExecution.ts` 정상 종료 시 정리 + nonce
- `go build` 인자 `--` 추가
- `TTSC_BINARY` 존재/실행권 검증

### 2차 (성능·정확성)
- unplugin transform 결과 캐시 (LRU + tsconfig 키)
- unplugin temp tsconfig를 `os.tmpdir()`로
- unplugin source-map: `result.sourceMaps` 우선
- lint Context/walk allocation 줄이기 (pool + iterative DFS)
- lint `loadTypeScriptConfigFile` 캐시
- lint native + ESLint 결과 합치기 (또는 opt-in)
- driver/rewrite source ↔ output 매칭에 outDir/rootDir 사용
- driver/rewrite `matchParen` regex literal/escape 처리

### 3차 (문서·일관성)
- peerDep 버전 통일 (`docs/01`, `docs/06`)
- `docs/03-tsgo.md` 임포트 + `clamp` 정의 보강
- unplugin README Rolldown entrypoint 추가
- `AGENTS.md` 디렉터리/npm 명 병기
- 캐시 경로 fallback 정정 (`docs/05`)
- shim 표 모듈 추가 (`docs/03`)
- 각 plugin README의 `check` no-op 정책 명시 또는 (1차 작업으로) 제거

### 4차 (코드 품질)
- 중복 헬퍼 추출 (`runBuild.ts`/`transformProjectInMemory.ts`)
- `cmd/ttsc/main.go`의 `appendUnique` 데드 코드 제거
- `cmd/platform/main.go` ↔ `cmd/ttsc/main.go` `demoArrow` 중복 제거
- 각 utility plugin의 빈 `plugin/<name>.go` 삭제
- `version = "0.0.1"` 하드코딩 정리
- 테스트 픽스처 추가 (rewrite, host.go의 paths/strip rewriter, `rewriteEsmSpecifiers`)

---

## 참고 노트

- 사용자 메모리 **plugin native binary contract** 위반: utility 3종은 `check`를 자체 구현해야 한다. 현재 no-op이므로 우선 수정 대상.
- 사용자 메모리 **source-plugin go workspace gotcha**와 `docs/04-local-dev.md`의 `go.work` 안내가 일부 어긋남. shim-only 플러그인은 root use 라인 불필요함을 부기.
- 검토 시점: 2026-05-07. 모든 라인 번호는 그 시점의 master(HEAD: 66be756) 기준.

---

## 보고서 구성

- [`docs.md`](./docs.md) — 38건
- [`ttsc-core.md`](./ttsc-core.md) — 40건
- [`utility-plugins.md`](./utility-plugins.md) — 40건
- [`lint-and-unplugin.md`](./lint-and-unplugin.md) — 50건
