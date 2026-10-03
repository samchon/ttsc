"use client";

// Positive: `async` body on a React Client Component.
// expect: nextjs/no-async-client-component error
export default async function Page() {
  return <div>hi</div>;
}

// Negative: synchronous Client Component.
export function Other() {
  return <div>hi</div>;
}

JSON.stringify({ Page, Other });
