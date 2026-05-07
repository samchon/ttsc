# ttsc 수정 로그

## 2026-05-07: `ttsx -r` package preload specifier 보존

전수 리뷰에서 `ttsx -r`가 `@scope/preload`, `plain-preload/register`, `tsconfig-paths/register` 같은 package specifier를 파일 경로로 오인하는 문제가 확인되었다.

수정 내용:

- `packages/ttsc/src/launcher/internal/runTtsx.ts`
  - `resolvePreload()`가 절대 경로와 명시적 상대 specifier만 `cwd` 기준으로 보정하도록 변경했다.
  - package specifier와 package subpath specifier는 Node의 `-r` 해석에 맡기도록 원문 그대로 전달한다.
  - 도움말 표기를 `<file>`에서 `<module>`로 바꿔 실제 동작과 맞췄다.

회귀 테스트:

- `tests/smoke/test/toolchain.test.cjs`
  - `ttsx keeps package preload specifiers unresolved` 추가.
  - `-r @scope/preload`와 `--require plain-preload/register`를 동시에 검증한다.

검증:

```bash
pnpm --filter ttsc build
node --test --test-reporter=spec tests/smoke/test/toolchain.test.cjs
pnpm --filter ttsc test
pnpm --dir tests/smoke start
pnpm test
```

결과:

- `toolchain.test.cjs`: 15개 통과
- 초기 집중 검증: `ttsc` package TypeScript 22개 및 Go 테스트 통과, smoke corpus 77개 통과
- 최종 통합 검증: `pnpm test` 통과

남은 관련 항목:

- 전수 리뷰에서 확인한 나머지 수정 가능 항목도 같은 날짜 후속 패치로 처리했다.

## 2026-05-07: 전수 리뷰 잔여 수정 가능 항목 처리

수정 내용:

- `ttsx` ESM rewrite
  - 전체 파일 regex rewrite를 제거했다.
  - static import, side-effect import, re-export `from`, dynamic `import()`의 string literal specifier만 scanner로 수정한다.
  - template literal의 원문 chunk는 보존하되 `${...}` expression 내부의 dynamic `import()`는 재귀적으로 스캔한다.
  - 일반 문자열, template literal, 주석, regex literal은 건드리지 않는다.
- utility plugin host
  - Go `flag` parser에 넘기기 전에 known host option만 남긴다.
  - unknown future optional flag와 그 단일 값은 무시한다.
- JS tsconfig 상속
  - inherited `rootDir`, `baseUrl`, `declarationDir`을 선언 tsconfig/jsconfig 기준 절대 경로로 정규화한다.
  - inherited relative `compilerOptions.plugins[].transform`은 해당 entry가 선언된 config 파일 기준으로 해석한다.
- source plugin cache
  - cache key에 local `ttsc` 및 shim overlay source hash를 포함한다.
- 문서
  - plugin publishing peer range 예시를 `^0.8.0`으로 맞췄다.
  - cache internals 문서에 overlay hash input을 반영했다.

회귀 테스트:

- `tests/smoke/test/toolchain.test.cjs`
  - `ttsx ESM rewrite leaves strings, templates, comments, and regex literals untouched`
- `tests/smoke/test/utility-plugins.test.cjs`
  - `utility plugins: shared host ignores future optional flags`
- `packages/ttsc/test/project.test.ts`
  - inherited relative path option origin
  - inherited relative plugin transform origin
- `packages/ttsc/test/source-build.test.ts`
  - overlay source change invalidates source plugin cache key

검증:

```bash
pnpm --filter ttsc build
node --test --test-reporter=spec tests/smoke/test/toolchain.test.cjs
node --test --test-reporter=spec tests/smoke/test/utility-plugins.test.cjs
cd packages/ttsc && node --test --test-reporter=spec --experimental-strip-types --experimental-specifier-resolution=node test/project.test.ts test/source-build.test.ts
pnpm test
```

결과:

- `toolchain.test.cjs`: 16개 통과
- `utility-plugins.test.cjs`: 11개 통과
- `project.test.ts` + `source-build.test.ts`: 11개 통과
- 최종 통합 검증: `pnpm test` 통과
- `ttsc` package test: 25개 통과
- smoke corpus: 79개 통과
- `tests/lint` corpus: 162개 통과
