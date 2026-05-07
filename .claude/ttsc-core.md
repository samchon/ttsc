# `packages/ttsc` 코드 리뷰

총평: JS 런처 + Go 네이티브 호스트 + 플러그인 사이드카 구조는 깔끔하나, 두 사이드 간 프로토콜 일관성, 자식 프로세스 처리, 빌드의 동시성/보안에서 위험 지점 존재.

---

## 🔴 Critical (버그·보안·계약 위반)

### 1. hardlink 통한 원본 파일 변조 위험
`src/launcher/internal/runTtsx.ts:181-189`. `prepareExecution`이 PID 기반 캐시 디렉터리 안에 `fs.linkSync`로 hardlink를 만든 뒤, ESM일 때 `rewriteEsmSpecifiers`가 같은 inode를 `fs.writeFileSync`로 덮어씀 → 원본 출력물 변조 위험.
→ JS 출력에는 `fs.copyFileSync` 강제 또는 `unlink → write` 순서.

### 2. PID 기반 캐시 디렉터리 누수
`src/launcher/internal/prepareExecution.ts:14-46`. `PROCESS_CACHE_KEY = String(process.pid)`로 만든 디렉터리를 정상 종료 시 정리하지 않음. PID 재활용 위험.
→ `exit`/`SIGINT`/`SIGTERM` 후크에서 정리 + nonce 추가.

### 3. 다중 transform 플러그인 첫 항목만 호출
`src/compiler/internal/runBuild.ts:163-175`, `transformProjectInMemory.ts:121-150`. 동일 binary면 첫 플러그인만 실행되고 나머지는 사이드카 내부 처리 가정. 계약 미문서화.
→ dispatch invariant 명시 또는 검증.

### 4. check 플러그인 실패 시 diagnostics 누락
`src/compiler/internal/runBuild.ts:332-358` (`runNativeCheckPlugins`), `transformProjectInMemory.ts:152-189`. 실패 시 stdout/stderr만 누적, `diagnostics: []` 그대로.
→ 실패 결과에 대해 `parseCompilerDiagnostics` 호출.

### 5. Windows 줄바꿈 보존 일관성
`src/compiler/internal/runBuild.ts:496-499` (`stripEmittedFileLines`). 현재 동작은 OK이나 `normalizeFailedDiagnostics`와의 상호작용에서 stdout이 빈 문자열이 되는 케이스 명시 필요.

### 6. `cmd/ttsc/build.go:73-76` — `prog == nil` 가드 부재
`LoadProgram`이 `(nil, diags, nil)`을 리턴하는 코너 케이스에서 `defer prog.Close()` panic 가능.
→ defer 등록 전 nil 체크 또는 receiver-nil-safe `Close()`.

### 7. `driver/program.go:209-215` — `Close()` nil receiver panic
`if p == nil { return nil }` 가드 추가.

### 8. `driver/rewrite.go:198-211` — source ↔ output 매칭 부정확
suffix 세그먼트 비교로만 매칭. 모노레포에서 `pkg-a/src/index.ts` vs `pkg-b/dist/index.js` 오매칭 가능.
→ outDir/rootDir 정보를 `RewriteSet`에 저장.

### 9. `driver/rewrite.go:330-338` — `matchParen` 토큰화 한계
정규식 리터럴, 라인/블록 주석 미인식. escape 처리 미흡으로 unmatched quote 시 paren counting 깨짐.
→ regex literal 인식 + escape 안전 처리.

### 10. `cmd/ttsc/main.go:61-64` — `check --emit` 모순
`check`가 `--emit`을 거부하는 게 명시적.

### 11. `src/compiler/internal/compileProjectInMemory.ts:34-44` — `TTSC_BINARY` 검증 부족
`resolveBinary.ts:9-11`이 absolute path만 검사. 존재/실행권한 미확인.
→ `fs.statSync` + executable 비트 검증.

### 12. `src/plugin/internal/buildSourcePlugin.ts:195-219` — `go build` 인자 주입 위험
`source = "-foo"` 같은 값이 플래그로 해석됨.
→ `["build", "-o", binaryName, "--", entry]`로 호출.

### 13. `cmd/ttsc/api_compile.go:54-69` — driver invariants 일관성
`(nil prog) → (err != nil) || (len(diags) > 0)` 명시.

---

## 🟡 Design (API smell·에러 처리·테스트 부재)

### 14. `src/TtscCompiler.ts:198-208` — destructive op 가드 부족
`removeExistingDirectories`가 `cacheDir = /` 같은 입력을 검증 안 함.

### 15. `src/compiler/internal/buildNativeCompiler.ts:36-43` — 함수 이름 오해
`readGoModuleVersion`이 go.mod 전체 텍스트 리턴 → `readGoModuleFingerprint` 등으로 rename.

### 16. `src/compiler/internal/runBuild.ts:560-586` — diagnostic line parsing 한계
multi-line 메시지 들여쓰기 손실, 콜론 메시지 깨짐 가능. 가능하면 구조화된 채널 사용.

### 17. `src/launcher/internal/runTtsc.ts:421-499` — watch 누락 디렉터리 / 핸들 누수
새로 생긴 디렉터리 미감지, EMFILE 위험. chokidar 권장.

### 18. `src/launcher/internal/runTtsc.ts:441` — watch 핸들 누수 모니터링

### 19. `src/compiler/internal/runBuild.ts:506-525` — `normalizeFailedDiagnostics` 비일관
분기마다 stdout/stderr 위치가 다름. 단일 정책으로 통일.

### 20. `src/compiler/internal/runSingleFileEmit.ts:11-65` — 단일 파일 emit이 전체 빌드
큰 모노레포에서 비효율. per-file emit lane 검토.

### 21. `driver/program.go:382-391` — `SourceFiles` 필터링
`lib.*.d.ts`까지 포함될 수 있음. 사용자-source vs lib 구분 옵션.

### 22. `cmd/ttsc/main.go:61-64` — args 구성 방식 임시방편
옵션 파서 통일 권장.

### 23. `utility/host.go:55-83` — verbose/quiet 처리 비일관
`RunBuild`/`RunTransform` 분기 다름. 의도라면 주석.

### 24. `utility/host.go:589-606` — `filterStatements` in-place
`list.Nodes[:0]`으로 백킹 배열 공유. 새 슬라이스 사용 또는 의도 문서화.

### 25. `src/plugin/internal/loadProjectPlugins.ts:95` — `require()` ESM 미지원
ESM-only 플러그인 로드 실패. 명확한 에러 메시지.

### 26. 테스트 부재 — `driver/rewrite.go`
`applyRewrites`/`spliceCall`/`matchParen` 단위 테스트 없음.

### 27. 테스트 부재 — `utility/host.go`
`pathsRewriter.rewrite`/`stripRewriter.apply` 픽스처 테스트 필요.

### 28. 테스트 부재 — `runTtsx.ts`
`rewriteEsmSpecifiers`/`withResolvableExtension` 정규식 한계 케이스.

### 29. `src/compiler/internal/transformProjectInMemory.ts:118-119` — 폴백 동작 미문서화
transformer 부재 시 native host 단순 매핑. docstring 명시.

### 30. `src/compiler/internal/runBuild.ts:38-78` — `viaNode` 정규식이 `.ts` 포함
`ts` 바이너리 자리에 source path 잘못 들어가면 silent로 node 시도.

---

## 🟢 Minor (데드 코드·일관성)

### 31. `cmd/ttsc/main.go:97-113` — `appendUnique` 호출처 없음. 데드 코드.

### 32. `src/launcher/internal/runTtsx.ts:157-166` — `resolvePreload` 중복 검사
`path.isAbsolute` + `startsWith(".")`로 단순화.

### 33. `driver/rewrite.go:79-96` — `EmitAllRaw` vs `EmitAll` 시그니처 차이 docstring 보강.

### 34. `src/compiler/internal/buildNativeCompiler.ts:38-42` — #15 중복.

### 35. `cmd/ttsc/api_compile.go:122-142` — `category` 하드코딩
`SeverityError`/`SeverityWarning` 두 종만 분기. 외부 API의 4종과 격차.

### 36. `src/launcher/internal/runTtsx.ts:210-245` — 정규식 패턴 보강
`export ... from`, template literal specifier 명시 처리.

### 37. `src/compiler/internal/runBuild.ts:401-454` & `transformProjectInMemory.ts:227-280` — 중복 헬퍼
`assertCompilerHostCompatibility`/`isFirstPartyUtilityTransformPlugin`/`readNearestPackageManifest` 등 추출.

### 38. `src/launcher/internal/runTtsc.ts:482` — 매직 넘버 `60`
상수+주석.

### 39. `src/compiler/internal/runBuild.ts:425` — first-party 화이트리스트가 manifest `name`만 신뢰
보안 측면 약함. 명시.

### 40. `cmd/platform/main.go` ↔ `cmd/ttsc/main.go:193-208` — `demoArrow` 100% 중복
internal 패키지로 추출.
