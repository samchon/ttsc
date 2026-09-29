# Native Platform Boundaries

Apply to native filesystem access, path or file identity, process boundaries and types defining those boundaries. Pure calculations, ordinary options and browser virtual filesystems do not acquire this obligation from their package.

## OS-neutral implementation

Write OS-neutral code. Use supported abstractions that preserve the product contract across supported operating systems, and isolate necessary native differences behind an explicit platform boundary. An OS name is not evidence of a filesystem's case policy or capabilities.

Explain the platform assumptions relevant to this declaration, why the chosen abstraction is suitable, and any necessary native branch or limitation. For paths, distinguish native identity from URL or protocol spelling. For processes, explain the argument or executable boundary when it differs across platforms. Answer only the boundary the declaration serves; do not assert that a filesystem operation launches no process.

Native representations and capabilities vary while callers rely on one supported contract. The answer explains why the implementation preserves that boundary. OS test results remain development's responsibility; a passing run on one OS is not the acknowledgment.
