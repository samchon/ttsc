// @ttsc-corpus-filename: src/app/page.tsx

"use client";

// expect: nextjs/no-async-client-component error
export default async function () {
  return null;
}
