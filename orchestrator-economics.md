# Orchestrator Economics: Anatomy of a 62:1 Ratio

This repo was built by a warboss-horde session: an expensive orchestrator model
(claude-fable-5) decided what to build, and cheap doer models (haiku/sonnet)
built it. The bet is correctness-per-dollar. The result was correct — 27/27
tests, 9 doer dispatches all green against frozen contracts, 1.13 tries-per-green —
but the spend split was **$34.19 orchestrator : $0.55 doers (~62:1 by cost,
~70:1 by tokens)**. This document reconstructs, from the session transcript,
where those tokens actually went — so the next session can attack the ratio
instead of just admiring it.

## The shape of the spend

Orchestrator usage (deduped by API message id, reconciled against `/cost`):

| metric | value |
|---|---|
| API calls | 138 (124 of them tool calls) |
| output tokens | 113K (0.5% of total) |
| cache-read tokens | 24.6M (**97% of total**) |
| cache-write tokens | 546K |
| avg cache-read per call | **178K tokens** |

Doer band, for contrast: 9 dispatches, ~320K tokens total, 1–7 tool calls each.

The first structural fact: **output is not the cost. Replay is.** The
orchestrator's context (system prompt + skills + the whole growing
conversation) is re-read on *every* API call. Cost ≈ `calls × context size`,
and both factors were maximal: many calls (138), fat context (~178K average,
growing monotonically — nothing was ever shed). A doer inverts both factors:
few calls, tiny fresh context. That inversion *is* the horde bet — but it only
applied to a sliver of the session.

## Where the calls went (by user turn)

| phase | calls | out | cache-read | delegated? |
|---|---:|---:|---:|---|
| 1. Build the repo (`/delegate`) | 43 | 62K | 3.9M | **yes — all 9 dispatches live here** |
| 2. "Can you see the scenes?" (snapshot tool) | 8 | 8K | 1.0M | no |
| 3. Black-canvas bug (browser debug + IIFE fix) | 14 | 8K | 2.0M | no |
| 4–7. GitHub Pages deploy saga | 27 | 9K | 4.2M | no |
| 8. Publish cost dashboard | 12 | 4K | 2.2M | no |
| 9. "Why is fable $0?" (pricing fix) | 12 | 6K | 4.2M | no |
| 10. Reconcile with `/cost` (meter forensics + fix) | 13 | 12K | 5.3M | no |

Two readings jump out:

1. **Only phase 1 was delegated at all.** Phases 2–10 — 95 calls, ~84% of all
   cache-read tokens — ran entirely on the top rung. Each of those phases was
   tool-call-dense, mostly-mechanical ops work (poll a deploy, run a script,
   patch a JSON file, take a screenshot) executed in the most expensive
   context in the system. The doctrine covers *build* work; it has no reflex
   for *ops* work, so ops defaulted to the orchestrator by omission, not by
   decision.

2. **Even the delegated phase cost 43 orchestrator calls against 9 dispatches.**
   Some of that is the legitimate, non-delegable decide band: cutting slices,
   authoring contracts, writing the membrane tests (62K output tokens — the
   real "decide" artifact). But the judge loop is the hidden multiplier: the
   doer has no Bash, so every verify cycle (run tests → read failure → fix or
   re-dispatch) is an orchestrator tool call replaying full context. Judging
   is cheap thinking but expensive replaying.

## Root causes, ranked

1. **Context replay dominates, and the orchestrator never sheds context.**
   97% of tokens are cache reads of an ever-growing transcript. Every one-line
   `git status` costs ~178K read tokens by the end of the session.
2. **The doer can't verify, so the orchestrator must.** No Bash on the doer
   rung means the membrane (test runs, screenshots, deploy checks) executes in
   the fat context. The check itself is interpretation-free — exactly the kind
   of work that should run in a cheap, thin context.
3. **Ops/follow-up work has no delegation path.** After the build, six user
   asks were handled solo. Deploy babysitting, forensic scripting, and file
   plumbing are low-entropy — cheapest-rung work by the doctrine's own rule —
   but the playbook only triggers on "build" tasks.
4. **Many small tool calls instead of few big ones.** 124 tool-call rounds.
   Each one-liner shell command or single-file edit is a full replay. Batching
   independent calls and writing scripts (one call) instead of command
   sequences (five calls) directly divides the dominant term.
5. **Contract cost is real but small.** Authoring dense contracts + tests was
   ~62K output tokens — a bargain: it's what made 9/9 dispatches land in
   round 1. The decide band earned its cost; the replay band didn't.

## Levers, in order of expected impact

1. **Give the verify loop its own thin context.** A "runner" rung with Bash
   (or a doer allowed to run the frozen check) turns each judge cycle from a
   178K-token replay into a ~5K-token dispatch. Applied to this session, that
   alone likely halves the orchestrator band.
2. **Delegate ops phases.** Deploy watching, screenshot capture, ledger
   patching, dashboard regeneration — decided, mechanical, falsifiable.
   Route them to the cheap rung like any other slice; the orchestrator's job
   is choosing the check, not running it 27 times.
3. **Fewer, fatter calls.** Prefer one script over N commands; batch
   independent tool calls in one round. Target: orchestrator calls
   proportional to *decisions*, not *actions*.
4. **Context hygiene.** Keep artifacts in files, not in conversation; avoid
   pulling large outputs into the parent transcript; compact between phases.
   The multiplier on every future call is the context you keep today.
5. **Measure the ratio per phase, not per session.** The ledger already
   captures both bands; annotating dispatches with a phase/task field would
   make the board show decide:do per phase — turning this document's manual
   archaeology into a standing metric. A healthy target for build phases is
   probably ~10:1; for ops phases it should approach 1:1.

## The honest caveat

The 62:1 is a *shadow-cost* ratio (API-equivalent pricing, mostly $1/MTok
cache reads on a subscription). And the orchestrator band bought things the
doer band structurally can't: the slice design, the contracts that made cheap
models reliable, the frozen tests, three rounds of physics debugging, a
browser-only bug diagnosis, a deploy rescue, and the metering forensics that
made this document's numbers true. The goal isn't 1:1 — it's making sure every
expensive token is spent *deciding*, and the current shape shows most of them
were spent *replaying context around mechanical actions*. That's the fixable
part.

---
*Numbers: session transcript of 2026-07-02/03, deduped by message id,
reconciled against Claude Code `/cost`. Ledger: `.warboss-horde/ledger.jsonl`;
live board: [dashboard.html](dashboard.html).*
