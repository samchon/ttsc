// @ttsc-corpus-filename: src/pages/_document.tsx

export default function Document() {
  return (
    <>
      // expect: nextjs/no-styled-jsx-in-document error
      <style jsx>{`body { color: red; }`}</style>
    </>
  );
}
