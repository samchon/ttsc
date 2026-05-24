# Agent A Knowledge

Scope: failed ttsx check cleanup.

Findings: project-check failure path should reuse the best-effort cleanup helper
instead of direct `rmSync`.

Proposal accepted: route failed-check cleanup through the helper.
