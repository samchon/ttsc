# 문서 리뷰 (`docs/`, `articles/`, `README.md`)

검토 대상: `README.md`, `AGENTS.md`, `docs/01~10`, `articles/lint.md`, 각 패키지의 `README.md`.

---

## 🔴 Critical (사실 오류 / 동작하지 않을 코드)

### 1. `docs/01-getting-started.md:30` — peerDep 버전 불일치
`peerDependencies`에 `"ttsc": "^0.7.0"`으로 적혀 있으나 현 패키지 버전은 `0.8.1`. 가이드대로 따르면 새로 발행된 플러그인이 0.7.x만 호환된다고 잘못 표시됨.
→ `^0.8.0` 또는 발행 시점 안정 minor로 통일.

### 2. `docs/06-publishing.md:16, 50` — peerDep 버전 불일치(2)
`peerDependencies: { "ttsc": "^0.5.0" }` 두 군데. 현 버전(0.8.1)과 어긋나며 위 #1과도 비일관.

### 3. `docs/03-tsgo.md:391` — 정의되지 않은 `clamp(...)` 호출
`stringLiteralRange` 예제에서 정의되지 않은 `clamp` 함수를 호출. 그대로 복사해도 컴파일 안 됨.
→ `clamp` 정의 포함 또는 `min/max` 인라인.

### 4. `docs/03-tsgo.md:91` — `shimscanner` 임포트 누락
`loadProgram` 예제 뒤(287, 307, 314행 근방)에서 `shimscanner.SkipTrivia`, `GetECMALineAndByteOffsetOfPosition`, `GetTokenPosOfNode`를 사용하나 임포트 가이드 없음.
→ `shimscanner "github.com/microsoft/typescript-go/shim/scanner"` 명시.

### 5. `docs/03-tsgo.md:573` — `shimparser`/`shimcore` 임포트 누락
`parseJS` 예제. 별칭 표에도 없음.
→ `shimparser`, `shimcore` 임포트 표/문장 추가.

### 6. `docs/01-getting-started.md:255-279` — `removeDebuggers` nil 가드 누락 안내
`node.StatementList()` 결과를 그대로 넘기는 형태인데 nil-safe 패턴 안내 누락. 코드 자체는 nil-safe하나 학습자 혼란 우려.

---

## 🟡 Inconsistencies (문서 간 / 문서-코드 간)

### 7. `AGENTS.md:14` — 디렉터리 vs npm 패키지명 혼동
`packages/ttsc-*`로 표기. 실제 디렉터리는 하이픈, npm 패키지는 `@ttsc/linux-x64` 형식.
→ "디렉터리: `packages/ttsc-{os}-{arch}/` / npm: `@ttsc/{os}-{arch}`" 병기.

### 8. `AGENTS.md:13` — `unplugin` 누락
utility plugins만 묶고 `packages/unplugin`은 빠짐.

### 9. `docs/02-protocol.md:33-41` — `binary` 필드 의미 미기재
`ITtscPluginFactoryContext.ts`에는 명시되어 있음. 한두 줄 설명 보강.

### 10. `docs/02-protocol.md:67-73` — `defineTtscPlugin` 헬퍼 미언급
`ITtscPlugin.ts:59`에 export됨. 타입 추론 예제로 함께 소개.

### 11. `docs/05-internals.md:42-44` — 캐시 경로 fallback 표기 오류
실제 우선순위(`buildSourcePlugin.ts:317-321`): (1) cacheDir 옵션, (2) `TTSC_CACHE_DIR/plugins`, (3) `<project>/node_modules/.ttsc/plugins`. 문서의 `<project>/.ttsc/plugins`는 코드에 없음.

### 12. `docs/03-tsgo.md:147` — driver vs raw shim 패턴 미구분
`defer release()` vs `defer prog.Close()`. 두 패턴 차이 명시 안내 필요.

### 13. `docs/04-local-dev.md:29-48` — `go.work`의 `./node_modules/ttsc` 필요 여부 모호
shim-only 플러그인은 root use 라인 불필요. 사용자 메모리(source-plugin-go-workspace.md)와의 차이 부기.

### 14. `docs/02-protocol.md:148-160` vs `docs/01-getting-started.md:122-124`
`version`/`-v`/`--version` 세 형태가 must인지 권장인지 모호.

### 15. `docs/07-testing.md:68` — 내부 path 직접 require
`require.resolve("ttsc/lib/launcher/ttsc.js")`는 동작하나 내부 경로. `ttsc/package.json` + `bin.ttsc` 또는 `npx ttsc` 권장.

### 16. `packages/unplugin/README.md:254-264` — Rolldown 엔트리포인트 누락
본문은 Rolldown 섹션을 가지며 `package.json` exports에도 등록됨. 목록에 `@ttsc/unplugin/rolldown` 추가.

### 17. `packages/unplugin/README.md:270-279` — 예시 부적절
`compilerOptions: { baseUrl: "." }`만 보여줌. 실 사용 예는 `plugins` overlay.

### 18. `packages/unplugin/README.md:220-225` — 우선순위 설명 부족
`plugins: false`가 (2),(3) 모두 무시한다는 점 명시.

### 19. `docs/10-reference-plugins.md:18-25` — 트리 표시 부족
`packages/lint/src`는 `index.ts` 외에 `config.ts`, `structures/`도 포함.

### 20. `docs/08-recipes.md:88` — transform 플러그인은 `build`+`transform` 둘 다 구현
이 사실이 흐려져 있음.

---

## 🟢 Improvements (오타 / 명확성 / 보충)

### 21. `README.md:189` & `packages/ttsc/README.md:189` — Ecosystem 섹션 정리
"PRs welcome"의 의미를 명확히, 카테고리 보강.

### 22. `articles/lint.md:172, 268` — "about 20x" 반복
같은 문장이 3번 등장. 결론에서는 다른 표현 권장.

### 23. `articles/lint.md:165` — "2x" 추정 단순화
"최대 2x"로 약화 권장.

### 24. `docs/05-internals.md:35` & `docs/09-pitfalls.md:155` — `ttsc clean` 옵션 표 미제공
`--cache-dir`, `--all` 등 옵션 안내.

### 25. `docs/09-pitfalls.md:128` — `plugin.exe` 경고 시나리오 부기
`TTSC_CACHE_DIR` 직접 inspect 시 등 구체 시나리오 명시.

### 26. `docs/06-publishing.md:88-89` — pitfalls cross-link 추가

### 27. `docs/03-tsgo.md:54-65` — Useful shim modules 표 누락 항목
`tspath`, `vfs`, `vfs/osvfs`, `vfs/cachedvfs` 추가.

### 28. `docs/02-protocol.md:34-41` — `tsconfig`가 absolute path임을 명시
`ITtscPluginFactoryContext.ts:55-59` docstring 참조.

### 29. `docs/06-publishing.md:61-69` — 0.x SemVer 규칙 한 줄

### 30. `packages/lint/README.md:243` — `tests/lint/cases/*.ts` 표기
일부는 디렉터리. "파일 또는 서브디렉터리"로 수정.

### 31. `docs/02-protocol.md:218-227` — `--plugins-json` 예시
ordered array 의미 전달 위해 2개 이상 entry 예시.

### 32. `articles/lint.md:31` — ESLint 버전 가정 명시
v9+ flat config에서 quoted glob 차이.

### 33. `docs/04-local-dev.md:88` — `go.work.sum` 무시 정책 단서

### 34. `docs/10-reference-plugins.md:271-281` — 02-protocol > Composition cross-link

### 35. `docs/01-getting-started.md:32` — Node 18 사유 일원화

### 36. `docs/README.md:97-100` — "Requirements" 섹션 위치 조정

### 37. `docs/05-internals.md:55` — `npx ttsc clean` cross-link

### 38. `docs/08-recipes.md:5` — driver 헬퍼 정책 명시
"공개 helper(`driver`)는 internal로 취급"이라는 부연 또는 inline pattern 권장 사유.
