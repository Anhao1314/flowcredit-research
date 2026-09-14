# Claim Revision Proposal v0.12

Accepted Evidence + existing Claim + at most three relevant revision summaries → impact proposal → deterministic validation → independent pending human review. No authoritative Claim/Revision/Evidence/Admission writer is exposed. An accepted Proposal review means reviewed recommendation only; there is no apply operation.

Use existing external agent dependencies, no new packages. Runtime files, raw HTML, SQLite, logs and sessions stay outside this repository. All v0.1–v0.11.3 code and benchmark artifacts remain frozen.

```sh
node --test research/claim-revision-test/*.test.js
node research/claim-revision/cli.js dev
# After required repository/offline gates PASS, register once:
node research/claim-revision/cli.js register
# Start existing local Ollama only after registration, cloud disabled:
OLLAMA_NO_CLOUD=1 OLLAMA_MODELS=~/fc-agent/ollama-models ~/fc-agent/tools/ollama/ollama serve
# Separate terminal; one locked run only:
caffeinate -i node research/claim-revision/cli.js locked --opt-in
# Stop Ollama afterward.
```

Register cannot replace a phase gate. Prompt/schema/model/code/old repository hashes, development and held-out set are frozen. Development fixtures never call real inference. Locked set uses independent synthetic language/values, balanced six impacts and explicit conflicts/period updates/correction; evaluator labels are never supplied to the model. This is a narrow synthetic reasoning benchmark, not certification of arbitrary financial reasoning or authenticated human review.

Resume skips completed cases. Per-case model response and receipts checkpoint independently of Proposal persistence. An in-flight/failed call without a completed response blocks automatic retry; it must be investigated, not silently counted as a new run. Completed locked runs return saved results with zero new calls. No acquisition, ranking, embedding, selector, cloud or larger-model run occurs. Synthetic fixture seeding uses frozen parsers, lexical Candidate creation and explicit system_test Admission; this is offline fixture construction, not a retrieval benchmark or human acceptance.

Only `audit` time mode is supported: system ingestion, review recording/acceptance and public availability (when known) must precede asOf. Replay is explicitly rejected; observed period is never substituted for knowledge availability. New superseded Evidence rejects; replaced historic references are context only. Existing imports without an accepted Admission record do not qualify. Maximum four new items, two existing support and two counter items; other history is not automatically fetched into the model context.

Model input contains C1/R1/E1… aliases and a small whitelist of Claim/Evidence facts. Output uses exact case-sensitive aliases, finite impact/reason/status/direction enums and exact contiguous source quotes with supports/counters/context/unclear relationships. Software renders reasonSummary from these quotes; it does not admit unrestricted new factual prose. Exact quoting proves attribution, not arbitrary semantic entailment. The evaluator separately checks adjudicated relationships and impacts.

Review example (local trusted human action; no authentication claim):

```js
import {readOnlyMemory} from './reader.js';
import {ProposalStore} from './store.js';
import {digest} from '../src/identity.js';
const reader = readOnlyMemory('/absolute/external/memory.sqlite');
const store = new ProposalStore('/absolute/external/proposals.sqlite', {reader});
try {
  const proposal = store.get('CRP-EXACT_ID');
  const review = store.review(proposal.proposalId, {
    decision: 'rejected', reviewerType: 'human', reviewerId: 'LOCAL_REVIEWER',
    reason: 'Evidence does not establish the suggested impact.',
    expectedProposalHash: digest(proposal)
  });
  // Review is retained; no Claim is changed.
} finally { store.close(); reader.close(); }
```

A new review requires the latest previousReviewId. Reject remains journaled with proposal/reason/reviewer; stale proposals cannot be accepted but may be rejected. No force-overwrite or delete. Independent Proposal database cannot open a Memory database as a Proposal store, and repository/symlink paths reject. Trusted local filesystem access is the capability boundary; no adversarial multi-user security certification is claimed.
