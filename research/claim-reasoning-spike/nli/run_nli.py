#!/usr/bin/env python3
"""Spike-only NLI runner. Runs two lightweight models over the frozen dev pairs.

  MiniCheck-DeBERTa-v3-Large   (lytang, MIT)      -> P(supported) in [0,1]
  DeBERTa-v3-base-mnli-fever-anli (MoritzLaurer, MIT) -> entailment/neutral/contradiction

Usage:
  python nli/run_nli.py --devset dev-set.json --out artifacts/nli-output.json \
      [--models-dir ~/fc-agent/tools/nli-spike/hf-cache/hub]

Nothing leaves the machine; no paid API is used.
"""
import argparse, json, os, platform, resource, sys, time

def load_transformers():
    import torch
    from transformers import AutoTokenizer, AutoModelForSequenceClassification
    return torch, AutoTokenizer, AutoModelForSequenceClassification

def model_dir(models_dir, hf_name):
    return os.path.join(models_dir, 'models--'+hf_name.replace('/','--'), 'snapshots')

def resolve_snapshot(models_dir, hf_name):
    base = model_dir(models_dir, hf_name)
    snaps = sorted(os.listdir(base))
    if not snaps:
        raise SystemExit('no snapshot for '+hf_name)
    return os.path.join(base, snaps[-1])

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--devset', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--models-dir', default=os.path.expanduser('~/fc-agent/tools/nli-spike/hf-cache/hub'))
    ap.add_argument('--batch-size', type=int, default=8)
    args = ap.parse_args()

    torch, AutoTokenizer, AutoModelForSequenceClassification = load_transformers()
    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    dev = json.load(open(args.devset))
    pairs = dev['pairs']

    mc_path = resolve_snapshot(args.models_dir, 'lytang/MiniCheck-DeBERTa-v3-Large')
    mnli_path = resolve_snapshot(args.models_dir, 'MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli')

    t0 = time.time()
    mc_tok = AutoTokenizer.from_pretrained(mc_path)
    mc = AutoModelForSequenceClassification.from_pretrained(mc_path).to(device).eval()
    mnli_tok = AutoTokenizer.from_pretrained(mnli_path)
    mnli = AutoModelForSequenceClassification.from_pretrained(mnli_path).to(device).eval()
    load_seconds = time.time() - t0

    params = {
        'minicheck': sum(p.numel() for p in mc.parameters()),
        'mnli': sum(p.numel() for p in mnli.parameters()),
    }

    def mc_forward(texts, batch_size):
        out = []
        with torch.no_grad():
            for i in range(0, len(texts), batch_size):
                batch = texts[i:i+batch_size]
                enc = mc_tok(batch, truncation=True, max_length=1024, padding=True, return_tensors='pt').to(device)
                logits = mc(**enc).logits
                probs = torch.nn.functional.softmax(logits, dim=-1)[:, 1]
                out.extend([float(x) for x in probs.cpu()])
        return out

    def mnli_forward(premises, hypotheses, batch_size):
        out = []
        with torch.no_grad():
            for i in range(0, len(premises), batch_size):
                enc = mnli_tok(premises[i:i+batch_size], hypotheses[i:i+batch_size], truncation=True,
                               max_length=512, padding=True, return_tensors='pt').to(device)
                probs = torch.nn.functional.softmax(mnli(**enc).logits, dim=-1)
                out.extend([{'entailment': float(r[0]), 'neutral': float(r[1]), 'contradiction': float(r[2])}
                            for r in probs.cpu()])
        return out

    claims = [p['claim'] for p in pairs]
    evidences = [p['evidence'] for p in pairs]
    mc_texts = [e + mc_tok.eos_token + c for c, e in zip(claims, evidences)]

    # sequential pass: per-pair latency
    per_pair = {}
    for p, text, claim, evidence in zip(pairs, mc_texts, claims, evidences):
        start = time.perf_counter()
        p_mc = mc_forward([text], 1)[0]
        probs = mnli_forward([claim], [evidence], 1)[0]
        latency = (time.perf_counter() - start) * 1000
        per_pair[p['id']] = {'minicheck': p_mc, 'mnli': probs, 'latencyMs': latency}

    # batch pass: throughput and batch-vs-sequential consistency
    start = time.time()
    mc_support = mc_forward(mc_texts, args.batch_size)
    mnli_probs = mnli_forward(claims, evidences, args.batch_size)
    batch_seconds = time.time() - start
    mc_diff = max(abs(mc_support[i] - per_pair[p['id']]['minicheck']) for i, p in enumerate(pairs))
    mnli_diff = max(abs(mnli_probs[i][k] - per_pair[p['id']]['mnli'][k]) for i, p in enumerate(pairs) for k in ('entailment','neutral','contradiction'))

    lat = sorted(v['latencyMs'] for v in per_pair.values())
    peak_rss = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss  # bytes on macOS
    result = {
        'runner': 'nli/run_nli.py',
        'device': device,
        'python': platform.python_version(),
        'torch': torch.__version__,
        'batchSize': args.batch_size,
        'models': {
            'minicheck': {'hf': 'lytang/MiniCheck-DeBERTa-v3-Large', 'snapshot': os.path.basename(mc_path), 'params': params['minicheck']},
            'mnli': {'hf': 'MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli', 'snapshot': os.path.basename(mnli_path), 'params': params['mnli']},
        },
        'loadSeconds': load_seconds,
        'batchSeconds': batch_seconds,
        'batchThroughputPairsPerSecond': len(pairs) / batch_seconds,
        'batchVsSequentialMaxAbsDiff': {'minicheck': mc_diff, 'mnli': mnli_diff},
        'latencyMs': {'min': lat[0], 'median': lat[len(lat)//2], 'max': lat[-1]},
        'peakRssBytes': peak_rss,
        'pairs': per_pair,
    }
    json.dump(result, open(args.out, 'w'), indent=1)
    print(json.dumps({k: result[k] for k in ['device','loadSeconds','batchSeconds','batchThroughputPairsPerSecond','latencyMs','peakRssBytes']}))

if __name__ == '__main__':
    main()
