import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

// The frozen demo baselines live in assets/js/state.js and are documented in AGENTS.md.
// They were previously protected only by source comments; this test executes the real
// browser files in a stubbed window so any drift fails CI instead of shipping silently.

const FRONTEND = new URL("../../assets/js/", import.meta.url);

async function frontend() {
  const context = {
    console, setTimeout, clearTimeout,
    requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout,
    Date, JSON, Math, Number, String, Object, Array, Set, Map, isFinite, parseInt, parseFloat,
    crypto: { randomUUID: () => "frontend-baseline" }
  };
  context.window = context;
  context.window.window = context.window;
  vm.createContext(context);
  for (const name of ["data.js", "state.js"]) {
    const source = await readFile(new URL(name, FRONTEND), "utf8");
    vm.runInContext(source, context, { filename: name });
  }
  return expression => JSON.parse(JSON.stringify(vm.runInContext(expression, context)));
}

const evaluate = await frontend();

test("frozen subject baselines match the documented demo values", () => {
  const metrics = evaluate(`(function () {
    const App = window.App, output = {};
    for (const key of Object.keys(SUBJECTS)) {
      const data = SUBJECTS[key], cci = App.fn.cci(data);
      output[key] = {
        cci, pd: App.fn.pd(cci).toFixed(1),
        validNT_M: App.fn.validNT_M(data), efficiency: App.fn.efficiency(data),
        scu: App.fn.scuOf(data), credit: App.fn.creditLine(data), vetoed: App.fn.vetoed(data),
        deviationPct: App.fn.deviation(data).pct, deviationAlert: App.fn.deviation(data).alert
      };
    }
    return output;
  })()`);

  assert.deepEqual(metrics, {
    healthy: { cci: 795, pd: "2.3", validNT_M: 90.2, efficiency: 22857, scu: 3570, credit: 20000, vetoed: false, deviationPct: 3, deviationAlert: false },
    watch: { cci: 668, pd: "9.2", validNT_M: 42.1, efficiency: 33750, scu: 992, credit: 6000, vetoed: false, deviationPct: 9, deviationAlert: false },
    sybil: { cci: 320, pd: "85.0", validNT_M: 36.7, efficiency: 514286, scu: 86.1, credit: 0, vetoed: true, deviationPct: 186, deviationAlert: true }
  });
});

test("local proof leaves stay deterministic, subject-scoped and tamper evident", () => {
  const proof = evaluate(`(function () {
    const App = window.App;
    const leavesFor = key => App.fn.sourceCards(SUBJECTS[key]).map(card => App.fn.leafDigest(card, SUBJECTS[key]));
    const first = App.fn.merkleBuild(leavesFor("healthy"), 1.9e12, 7);
    const nextNonce = App.fn.merkleBuild(leavesFor("healthy"), 1.9e12, 8);
    const otherSubject = App.fn.merkleBuild(leavesFor("sybil"), 1.9e12, 7);
    const paths = first.levels[0].map((leaf, index) => App.fn.verifyProof(leaf, App.fn.merkleProof(first.levels, index).path, first.root));
    return {
      leafCount: first.levels[0].length,
      rootPrefixed: first.root.startsWith("0x"),
      rootDiffersByNonce: first.root !== nextNonce.root,
      rootDiffersBySubject: first.root !== otherSubject.root,
      allPathsVerify: paths.every(Boolean),
      tamperedLeafRejected: App.fn.verifyProof("deadbeef", App.fn.merkleProof(first.levels, 1).path, first.root) === false
    };
  })()`);

  assert.deepEqual(proof, {
    leafCount: 4, rootPrefixed: true, rootDiffersByNonce: true,
    rootDiffersBySubject: true, allPathsVerify: true, tamperedLeafRejected: true
  });
});

test("stress frames keep the documented shock, de-risk and recovery pacing", () => {
  const frames = evaluate(`(function () {
    const App = window.App, frames = App.fn.stressFrames;
    return {
      liquidationHf: frames.liquidationHf,
      idle: frames.idle,
      phases: frames.phases.map(phase => ({ key: phase.key, hf: phase.hf, credit: phase.credit })),
      nodes: frames.nodes.slice(),
      flyingIsIdle: App.fn.stressFlying()
    };
  })()`);

  assert.equal(frames.liquidationHf, 1);
  assert.deepEqual(frames.idle, { hf: 1.85, credit: 20000 });
  assert.deepEqual(frames.phases, [
    { key: "shock", hf: 1.05, credit: 20000 },
    { key: "derisk", hf: 1.05, credit: 12000 },
    { key: "notify", hf: 1.05, credit: 12000 },
    { key: "partial", hf: 1.05, credit: 12000 },
    { key: "recover", hf: 1.35, credit: 18000 }
  ]);
  assert.deepEqual(frames.nodes, ["De-risk", "Notify", "Partial Liquidation", "HF Recovered"]);
  assert.equal(frames.flyingIsIdle, false);
});
