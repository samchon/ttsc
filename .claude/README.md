# ttsc 종합 리뷰 보고서

`@ttsc/station` 모노레포(v0.8.1)에 대한 문서·코드 종합 리뷰입니다. 4개 영역으로 나누어 병렬로 검토했습니다.

## 보고서 목차

1. [`docs.md`](./docs.md) — 문서/README/articles 정합성 검토
2. [`ttsc-core.md`](./ttsc-core.md) — `packages/ttsc` 핵심 패키지 (TS 런처 + Go 호스트) 코드 리뷰
3. [`utility-plugins.md`](./utility-plugins.md) — `@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip` 리뷰
4. [`lint-and-unplugin.md`](./lint-and-unplugin.md) — `@ttsc/lint`, `@ttsc/unplugin` 리뷰
5. [`SUMMARY.md`](./SUMMARY.md) — 전체 요약 / 우선순위 / 액션 아이템

## 등급 표기

- 🔴 **Critical** — 사실 오류, 보안, 동작 깨짐, 계약 위반
- 🟡 **Design** — API/일관성/에러 처리/테스트 부족
- 🟢 **Minor** — 데드 코드, 오타, 사소한 개선

검토 일자: 2026-05-07
