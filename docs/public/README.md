# FlowCredit — public documentation

FlowCredit is the auditable belief-memory layer for investment research: it remembers what a team believes, why it believes it, and what new evidence should change.

This directory is the short public surface. Normative technical truth stays in [`docs/contracts`](../contracts) and [`docs/adr`](../adr); engineering provenance is kept separately from the normative documents.

## Product overview

- **Problem.** Research teams store documents but rarely preserve belief state. Reconstructing why a team believed something at a point in time is harder than finding another file.
- **Shape.** Claims are versioned beliefs. Evidence is source-grounded and admitted through an explicit review boundary. Relations connect new evidence to an existing claim; humans decide whether the belief changes.
- **Principle.** AI proposes, humans retain research authority. No silent evidence admission, no silent Claim mutation, no rewritten history.
- **Stage.** Research engineering alpha — an architecture-validated prototype that runs locally. It is not production software and this repository does not deploy.

## Architecture

[`architecture.md`](architecture.md) describes the end-to-end flow — source → grounding → evidence admission → accepted evidence → claim / revision → relation → human review → research memory — with the status of each layer.

## Current status

[`status.md`](status.md) is the single source of public-facing maturity truth: implemented, frozen, research validated, current, planned, legacy and not claimed.

## Frozen contracts

| Contract | Question it answers |
| --- | --- |
| [Core Proposition Contract v1](../contracts/core-proposition-v1.md) | What was asserted? |
| [Qualifier Contract v1](../contracts/qualifier-v1.md) | Under what context? |
| [Grounding Contract v1](../contracts/grounding-v1.md) | Where is the source support? |
| [ADR-0.12.1 — Claim Relation Semantics](../adr/ADR-0.12.1-relation-semantics.md) | What does a relation between evidence and a claim mean? |

Each document states its own status, parents and revision history. Field Provenance — how a structured value was produced — is the next contract and is not yet frozen.

## Engineering design history

Detailed engineering design logs are retained separately from the normative contracts. They record how each contract was produced; they are not normative.

Where a design log and a frozen contract disagree, the contract wins.
