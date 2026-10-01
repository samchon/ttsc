// @ttsc-corpus-clean: nextjs/no-styled-jsx-in-document
// @ttsc-corpus-filename: src/pages/index.tsx
export default function Page() { return <style jsx>{"body { color: red; }"}</style>; }
