# ttsc 전수 리뷰 보고서

- 작성일: 2026-05-07
- 기준: 현재 체크아웃 전체
- 범위: `git ls-files` 기준 추적 파일 445개
- 제외: `node_modules`, 빌드 산출물, 기존 미추적 `.claude/`

이 보고서는 이전 커밋과의 비교가 아니라 현재 저장소 상태만 대상으로 한다. 코드, 문서, 테스트, 패키지 메타데이터, 로컬 빌드 산출 패키지 표면을 함께 검토했다.

## 1. 검토 범위

추적 파일 기준 주요 분포는 다음과 같다.

| 분류       | 파일 수 |
| ---------- | ------: |
| TypeScript |     204 |
| Go         |      74 |
| CommonJS   |      44 |
| Markdown   |      29 |
| JSON       |      44 |
| YAML       |       9 |

주요 검토 영역은 다음과 같다.

- `packages/ttsc`: 런처, JS API, Go native host, 드라이버, shim, source plugin builder
- `packages/lint`: `@ttsc/lint`와 native lint plugin
- `packages/banner`, `packages/paths`, `packages/strip`: first-party utility plugin
- `packages/unplugin`: unplugin adapter
- `packages/ttsc-*`: platform package metadata
- `tests/smoke`, `tests/projects`, `tests/lint`, `tests/go-transformer`, `tests/utility-plugins`
- `docs`, `articles`, root `README.md`, workspace scripts, CI workflow

## 2. 핵심 결론

현재 로컬 빌드와 테스트는 주요 축에서 통과한다. 전수 리뷰에서 확인된 수정 가능 항목은 2026-05-07 패치 묶음으로 모두 처리했다.

특히 다음 두 건은 런타임 동작을 실제로 깨뜨리거나 사용자 값을 변조한다.

1. `ttsx -r` preload 해석이 package subpath specifier를 파일 경로로 오인한다. 이 항목은 2026-05-07 패치로 수정 완료했다.
2. `ttsx` ESM specifier rewrite가 import 구문뿐 아니라 문자열과 template literal 내용까지 바꾼다. 이 항목은 2026-05-07 패치로 수정 완료했다.

그 외에 문서가 약속한 protocol tolerance와 first-party utility host 구현 불일치, JS tsconfig 상속 처리, source plugin cache key, publishing peer range 문서 드리프트도 같은 패치 묶음에서 닫았다.

## 3. 발견 사항

### P1. `ttsx -r`가 package/subpath preload specifier를 깨뜨린다

상태: 수정 완료.

증거:

- `packages/ttsc/src/launcher/internal/runTtsx.ts:157`
- `packages/ttsc/src/launcher/internal/runTtsx.ts:190`

`resolvePreload()`는 preload 값이 `path.sep`를 포함하면 `path.resolve(cwd, preload)`로 바꾼다. POSIX에서 `@scope/preload`, `tsconfig-paths/register` 같은 정상적인 package subpath specifier는 `/`를 포함하므로 파일 경로로 오인된다.

재현 결과:

```text
node packages/ttsc/lib/launcher/ttsx.js --cwd <temp-project> -r @scope/preload src/main.ts
PRELOAD_STATUS=1
Error: Cannot find module '<temp-project>/@scope/preload'
```

영향:

- scoped package preload가 실패한다.
- package subpath preload가 실패한다.
- `node -r`와 호환되어야 할 런처 계약이 깨진다.

권장 수정:

- 명시적 상대 경로(`./`, `../`)와 절대 경로만 파일 경로로 해석한다.
- package specifier와 package subpath specifier는 그대로 Node에 전달한다.
- smoke 또는 project-shaped regression으로 `-r @scope/preload`, `-r tsconfig-paths/register`를 추가한다.

적용 결과:

- `resolvePreload()`가 절대 경로와 명시적 상대 specifier만 `cwd` 기준으로 보정하도록 바뀌었다.
- `@scope/preload`, `plain-preload/register` 같은 package specifier는 Node에 원문 그대로 전달된다.
- `tests/smoke/test/toolchain.test.cjs`에 `ttsx keeps package preload specifiers unresolved` 회귀 테스트를 추가했다.
- 집중 검증 `node --test --test-reporter=spec tests/smoke/test/toolchain.test.cjs` 통과.

### P1. ESM rewrite가 사용자 문자열과 template literal까지 변조한다

상태: 수정 완료.

증거:

- `packages/ttsc/src/launcher/internal/runTtsx.ts:210`
- `packages/ttsc/src/launcher/internal/runTtsx.ts:224`

`rewriteEsmSpecifiers()`는 JS 출력 파일 전체 텍스트에 정규식을 적용한다. 그 결과 import 구문이 아닌 일반 문자열, template literal, 주석 안의 `from './x'`, `import('./x')`까지 `.js`가 붙는다.

재현 입력:

```ts
import "./helper";
console.log(`from './helper'`);
console.log(`import('./helper')`);
```

재현 결과:

```text
from './helper.js'
import('./helper.js')
```

캐시된 JS 출력도 다음처럼 변조되었다.

```js
import "./helper.js";
console.log(`from './helper.js'`);
console.log(`import('./helper.js')`);
```

영향:

- 사용자의 런타임 데이터가 조용히 바뀐다.
- import rewrite 기능을 켠 ESM 프로젝트에서 테스트가 통과해도 실제 문자열 값이 달라질 수 있다.

권장 수정:

- 파일 전체 정규식 치환을 제거한다.
- JS parser, lexer, 또는 TypeScript compiler의 module specifier 정보에 기반해 import/export/dynamic import specifier 노드만 수정한다.
- regression에는 일반 문자열, template literal, 주석, regex literal을 포함한다.

적용 결과:

- `rewriteEsmSpecifiers()`의 전체 파일 정규식 치환을 scanner 기반 rewrite로 교체했다.
- static import, side-effect import, re-export `from`, dynamic `import()`의 string literal specifier만 수정한다.
- template literal의 원문 chunk는 보존하고, `${...}` expression 내부의 dynamic `import()`는 재귀적으로 스캔한다.
- 일반 문자열, template literal, line/block comment, regex literal은 rewrite 대상에서 제외한다.
- `tests/smoke/test/toolchain.test.cjs`에 `ttsx ESM rewrite leaves strings, templates, comments, and regex literals untouched` 회귀 테스트를 추가했다.

### P2. utility plugin host가 문서상 protocol tolerance를 지키지 않는다

상태: 수정 완료.

증거:

- `docs/02-protocol.md:151`
- `docs/01-getting-started.md:296`
- `packages/ttsc/utility/host.go:109`

문서는 host가 모르는 optional flag를 무시해야 하며, future `ttsc` minor가 optional flag를 추가할 수 있다고 설명한다. 그러나 first-party utility host는 Go `flag.FlagSet.Parse(args)`를 직접 호출한다. Go `flag`는 알 수 없는 flag를 오류로 처리한다.

영향:

- future host optional flag 추가 시 `@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip` 같은 first-party utility plugin이 깨질 수 있다.
- `@ttsc/lint`에는 future optional flag ignore 테스트가 있으나 utility plugin 쪽에는 같은 보호가 없다.

권장 수정:

- utility host에도 unknown optional flag ignore 로직을 넣는다.
- `tests/utility-plugins`에 future optional flag regression을 추가한다.
- protocol 문서와 각 host 구현의 공통 parsing contract를 맞춘다.

적용 결과:

- `packages/ttsc/utility/host.go`에 known host option만 Go `flag` parser로 넘기는 필터를 추가했다.
- unknown future flag와 그 단일 값은 무시된다.
- `tests/smoke/test/utility-plugins.test.cjs`에 `utility plugins: shared host ignores future optional flags` 회귀 테스트를 추가했다.

### P2. JS tsconfig 상속 처리에서 상대 옵션의 선언 위치가 사라진다

상태: 수정 완료.

증거:

- `packages/ttsc/src/compiler/internal/project/readProjectConfig.ts:47`
- `packages/ttsc/src/compiler/internal/project/readProjectConfig.ts:76`
- `packages/ttsc/src/launcher/internal/prepareExecution.ts:83`

`readProjectConfig()`는 `extends`를 직접 따라가며 base와 own `compilerOptions`를 단순 병합한다. 이 과정에서 `outDir`만 선언 파일 기준 절대 경로로 보정하고, `rootDir`, `baseUrl`, relative plugin transform path 등 다른 상대 옵션은 원래 어느 tsconfig에서 선언되었는지 정보를 잃는다.

`prepareExecution()`은 `rootDir`을 `project.root` 기준으로 해석한다. 따라서 base config가 프로젝트 바깥에 있고 거기서 `rootDir`을 선언한 경우 런타임 source root와 emit layout이 틀어질 수 있다.

영향:

- `ttsx` 실행 대상 추론이 실제 TS/tsgo config 해석과 달라질 수 있다.
- monorepo/shared tsconfig 레이아웃에서 inherited `rootDir`, `baseUrl`, relative plugin path가 잘못 해석될 수 있다.

권장 수정:

- 상대 compiler option별 선언 origin을 보존한다.
- 가능하면 TS/tsgo의 parsed command line 결과를 단일 source of truth로 사용한다.
- `tests/projects`에 base config가 다른 디렉터리에 있는 inherited `rootDir`, `baseUrl`, relative plugin path fixture를 추가한다.

적용 결과:

- `readProjectConfig()`가 path-like compiler option의 선언 디렉터리를 보존하고 `rootDir`, `baseUrl`, `declarationDir`을 선언 파일 기준 절대 경로로 정규화한다.
- inherited `compilerOptions.plugins[]` entry별 선언 디렉터리를 `pluginBaseDirs`로 보존한다.
- `loadProjectPlugins()`는 inherited relative `transform` path를 해당 entry가 선언된 tsconfig/jsconfig 디렉터리 기준으로 해석한다.
- `packages/ttsc/test/project.test.ts`에 inherited path option과 inherited relative transform path 회귀 테스트를 추가했다.

### P2. source plugin cache key가 overlay dependency 변화를 반영하지 않는다

상태: 수정 완료.

증거:

- `packages/ttsc/src/plugin/internal/buildSourcePlugin.ts:57`
- `packages/ttsc/src/plugin/internal/buildSourcePlugin.ts:390`
- `docs/05-internals.md:20`

source plugin build는 scratch `go.work`에 overlay directory를 넣는다. 그러나 cache key는 `ttscVersion`, `tsgoVersion`, platform, entry, plugin source directory 내부 Go 파일만 해시한다. overlay로 연결되는 local driver, utility, shim 코드 변화는 같은 package version 아래에서 cache invalidation을 일으키지 않는다.

영향:

- published package에서는 version bump가 대부분 방어선이지만, local link, canary, 개발 중 workspace에서는 stale plugin binary가 남을 수 있다.
- native host/utility contract 수정 뒤 plugin binary가 최신 코드로 다시 빌드되지 않을 수 있다.

권장 수정:

- overlay directory를 쓰는 source build에서는 overlay source hash를 cache key에 포함한다.
- 또는 개발 overlay 사용 시 cache를 강제로 bypass/namespace 분리한다.
- `docs/05-internals.md`에는 실제 cache key와 local development caveat를 함께 적는다.

적용 결과:

- source plugin cache key가 local `ttsc` 및 shim overlay directory의 hashable source file까지 포함하도록 바뀌었다.
- `packages/ttsc/test/source-build.test.ts`에 overlay source 변경 시 cache key가 달라지는 회귀 테스트를 추가했다.
- `docs/05-internals.md`에 overlay hash가 cache key input임을 반영했다.

### P3. plugin publishing 문서의 peer range 예시가 현재 패키지와 불일치한다

상태: 수정 완료.

증거:

- root `package.json`: `0.8.1`
- `docs/06-publishing.md:14`
- `docs/06-publishing.md:46`
- `docs/01-getting-started.md:28`

publishing 문서는 `"ttsc": "^0.5.0"`을 예시로 들고, getting started는 `"ttsc": "^0.7.0"`을 예시로 든다. 현재 패키지는 `0.8.1`이다.

영향:

- plugin author가 오래된 peer range를 그대로 복사할 수 있다.
- 문서 간 버전 기준이 달라 plugin compatibility 안내가 흐려진다.

권장 수정:

- 현재 가이드 기준 예시는 `^0.8.0` 등 실제 검증 minor로 맞춘다.
- 더 안전하게는 “문서를 작성한 minor와 동일한 tested minor range를 선언하라”는 식으로 literal version 의존도를 낮춘다.

적용 결과:

- `docs/01-getting-started.md`와 `docs/06-publishing.md`의 peer dependency 예시를 `^0.8.0`으로 정리했다.

## 4. 통과한 검증

다음 명령은 현재 로컬 환경에서 통과했다.

```bash
pnpm test
pnpm --filter ttsc build
pnpm --filter ttsc test
pnpm --filter @ttsc/unplugin test
node scripts/test-go-transformer.cjs
node scripts/test-go-lint.cjs
node scripts/test-go-utility-plugins.cjs
pnpm --dir tests/smoke start
pnpm --dir tests/lint start
pnpm run build:current
git diff --check
```

결과 요약:

- `ttsc` package test: 25개 통과
- `@ttsc/unplugin` test: 20개 통과
- `tests/lint` corpus: 162개 통과
- smoke corpus: 79개 통과
- Go transformer/lint/utility plugin focused tests 통과
- current platform package build 및 package export target 존재 여부 확인 통과

추가로 build 후 패키지 표면을 검사했다.

```text
PACKAGE_SURFACE_MISSING=0
```

검사 대상은 workspace package의 `main`, `module`, `types`, `exports`, `bin` target이었다.

## 5. 남은 검증 공백

이번 리뷰와 후속 수정에서 로컬 전체 축은 실행했지만 다음은 수행하지 않았다.

- GitHub Actions 전체 OS/architecture matrix
- 실제 npm publish dry-run/provenance 검증
- 외부 downstream project의 전체 CI
- Windows path separator 환경의 `ttsx -r` 추가 재현
- GitHub Actions가 제공하는 원격 환경의 ESM rewrite 호환성 검증

## 6. 우선순위 제안

수정 가능 항목은 모두 처리했다.

1. 완료: `ttsx -r` package specifier 보존
2. 완료: ESM rewrite의 scanner 기반 교체
3. 완료: utility host unknown optional flag tolerance 추가
4. 완료: JS tsconfig inheritance origin 보존
5. 완료: source plugin cache key overlay 반영
6. 완료: 문서 peer range 예시 정리

남은 일은 로컬 코드 수정 항목이 아니라 GitHub Actions OS matrix, publish dry-run/provenance, 외부 downstream CI 같은 환경 검증이다.
