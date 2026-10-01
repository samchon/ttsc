// @ttsc-corpus-filename: src/pages/index.tsx

export default function Page() {
  // expect: nextjs/no-head-element error
  return <head />;
}
