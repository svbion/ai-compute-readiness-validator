#!/usr/bin/env python3
from __future__ import annotations
import html,json,os,re
from pathlib import Path

def read(path): return path.read_text(errors="replace") if path.exists() else ""
def extract(pattern,text,default="Unavailable"):
    m=re.search(pattern,text,re.I|re.M); return m.group(1).strip() if m else default
def fmt(v): return "N/A" if v is None else (f"{v:.2f}" if isinstance(v,float) else str(v))

def main():
    meta=Path(os.environ["META_DIR"]); summary=Path(os.environ["SUMMARY_DIR"])
    report=Path(os.environ["REPORT_DIR"]); run=Path(os.environ["RUN_DIR"])
    payload=json.loads((summary/"benchmark-summary.json").read_text())
    m=payload["run"]; rows=payload["collectives"]
    smi=read(meta/"nvidia-smi.txt"); nvcc=read(meta/"cuda-nvcc.txt")
    driver=extract(r"Driver Version:\s*([^\s]+)",smi)
    cuda_runtime=extract(r"CUDA Version:\s*([^\s]+)",smi)
    cuda_toolkit=extract(r"release\s+([0-9.]+)",nvcc)
    commit=read(meta/"nccl-tests-commit.txt").strip() or "Unavailable"
    topology=read(meta/"topo-m.txt").strip() or "Unavailable"
    overall="PASS" if rows and all(r["status"]=="PASS" for r in rows) else "FAIL"

    table="\n".join(
        f"| `{r['test']}` | {r['status']} | {r['duration_seconds']} | {fmt(r['out_of_bounds_values'])} | "
        f"{fmt(r['average_bus_bandwidth_gbps'])} | {fmt(r['peak_bus_bandwidth_gbps'])} |"
        for r in rows
    )
    observations=[
        "All requested NCCL collectives completed without a reported correctness failure."
        if overall=="PASS" else "One or more collectives failed or reported a correctness issue; inspect raw logs.",
        "The topology matrix reports at least one NVLink-connected GPU path."
        if "NV" in topology else "No NVLink token was detected; performance may be PCIe-path limited.",
        "Performance comparisons must account for GPU count, topology, software versions, and test parameters."
    ]
    results=f"""# {m.get('gpu_name','NVIDIA GPU')} NCCL Benchmark Report

## Executive summary

- **Overall status:** {overall}
- **Provider:** RunPod
- **Platform label:** `{m.get('platform_label','unknown')}`
- **GPU:** {m.get('gpu_name','Unknown')}
- **GPU count:** {m.get('benchmark_gpu_count','Unknown')}
- **Captured:** {m.get('captured_at_utc','Unknown')}
- **Run ID:** `{m.get('run_id',run.name)}`

## Software

- **NVIDIA driver:** {driver}
- **CUDA runtime reported by driver:** {cuda_runtime}
- **CUDA toolkit:** {cuda_toolkit}
- **nccl-tests commit:** `{commit}`

## Test configuration

- **Message sizes:** {m.get('begin_size','N/A')} through {m.get('end_size','N/A')}
- **Step factor:** {m.get('step_factor','N/A')}
- **Warmups:** {m.get('warmup_iterations','N/A')}
- **Measured iterations:** {m.get('iterations','N/A')}
- **Datatype:** {m.get('datatype','N/A')}

## Collective summary

| Collective | Status | Duration (s) | OOB | Avg busbw (GB/s) | Peak busbw (GB/s) |
|---|---:|---:|---:|---:|---:|
{table}

## Topology

```text
{topology}
```

```mermaid
{read(summary/'topology.mmd').strip()}
```

## Charts

![Average bus bandwidth](../charts/average-bus-bandwidth.png)

![Peak bus bandwidth](../charts/peak-bus-bandwidth.png)

![Collective duration](../charts/collective-duration.png)

## Observations

{chr(10).join("- "+x for x in observations)}

## Reproducibility

The evidence package includes raw benchmark output, software versions, GPU
inventory, topology, NCCL environment settings, the exact `nccl-tests` commit,
test parameters, and SHA-256 checksums.

## Limitations

- Single-node cloud measurement.
- Cloud topology may differ between rentals.
- Two-GPU and four-GPU results are not directly equivalent.
- `busbw` is a normalized NCCL metric interpreted per collective.
- This is not vendor-certified performance.
"""
    (summary/"RESULTS.md").write_text(results)

    (summary/"INTERVIEW_NOTES.md").write_text(f"""# Interview Notes: {m.get('gpu_name','NVIDIA GPU')}

## Thirty-second summary

I provisioned a {m.get('benchmark_gpu_count','multi')}-GPU
{m.get('gpu_name','NVIDIA GPU')} system on RunPod, captured the hardware and
software context, built NVIDIA `nccl-tests`, and validated seven collective
communication patterns. The overall run status was **{overall}**.

## Talking points

- Difference between algorithm bandwidth and normalized bus bandwidth.
- Why topology must accompany NCCL performance data.
- How NVLink, PCIe, NUMA, shared memory, sockets, and RDMA affect transport.
- Why driver, CUDA, NCCL, and commit versions matter.
- Why two-GPU and four-GPU results require caveats.

## Potential questions

1. How would you verify NCCL's selected transport?
2. What would you inspect after an AllReduce regression?
3. How would you compare A100, H200, and B200 fairly?
4. What additional tests would you add for multi-node validation?
5. How would you operationalize this as a qualification pipeline?
""")

    (summary/"RESUME_BULLETS.md").write_text(f"""# Resume Bullets

- Built a repeatable GPU validation pipeline that captured NVIDIA hardware,
  CUDA, driver, PCIe/NVLink topology, NUMA, RDMA, and NCCL metadata and produced
  publication-ready evidence packages with checksums.
- Benchmarked {m.get('benchmark_gpu_count','multiple')}×
  {m.get('gpu_name','NVIDIA GPU')} using NVIDIA `nccl-tests` across AllReduce,
  AllGather, ReduceScatter, Broadcast, Reduce, AllToAll, and SendRecv.
- Automated benchmark parsing, charts, Markdown/HTML reporting, Mermaid topology
  visualization, and interview-ready technical summaries.
""")

    body="".join(f"<tr><td>{html.escape(r['test'])}</td><td class='{r['status'].lower()}'>{r['status']}</td>"
                 f"<td>{r['duration_seconds']}</td><td>{fmt(r['out_of_bounds_values'])}</td>"
                 f"<td>{fmt(r['average_bus_bandwidth_gbps'])}</td><td>{fmt(r['peak_bus_bandwidth_gbps'])}</td></tr>"
                 for r in rows)
    page=f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(m.get('gpu_name','GPU'))} NCCL Benchmark</title>
<style>
:root{{color-scheme:dark;--bg:#0b0e11;--panel:#151a20;--text:#f4f7f8;--muted:#aeb7c0;--line:#34404c;--good:#7bdc8b;--bad:#ff8a8a}}
*{{box-sizing:border-box}}body{{margin:0;font:16px/1.55 system-ui;background:var(--bg);color:var(--text)}}
main{{width:min(1180px,calc(100% - 32px));margin:auto;padding:48px 0 72px}}h1{{font-size:clamp(2rem,5vw,4rem);line-height:1.05}}
.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}}.card{{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:20px}}
.card strong{{display:block;font-size:1.25rem;overflow-wrap:anywhere}}.card span,.note{{color:var(--muted)}}table{{width:100%;border-collapse:collapse;background:var(--panel)}}th,td{{padding:12px;border:1px solid var(--line);text-align:left}}.pass{{color:var(--good);font-weight:700}}.fail{{color:var(--bad);font-weight:700}}
pre{{overflow:auto;padding:18px;background:#080a0d;border:1px solid var(--line);border-radius:12px}}img{{max-width:100%;height:auto;border-radius:14px;background:white}}.table-wrap{{overflow-x:auto}}
</style></head><body><main>
<p class="note">GPU Benchmark Lab · RunPod Evidence Package</p><h1>{html.escape(m.get('gpu_name','NVIDIA GPU'))}</h1>
<section class="grid"><article class="card"><span>Status</span><strong>{overall}</strong></article>
<article class="card"><span>GPU count</span><strong>{html.escape(m.get('benchmark_gpu_count','N/A'))}</strong></article>
<article class="card"><span>Driver</span><strong>{html.escape(driver)}</strong></article>
<article class="card"><span>CUDA toolkit</span><strong>{html.escape(cuda_toolkit)}</strong></article></section>
<h2>Collective results</h2><div class="table-wrap"><table><thead><tr><th>Collective</th><th>Status</th><th>Duration</th><th>OOB</th><th>Avg busbw</th><th>Peak busbw</th></tr></thead><tbody>{body}</tbody></table></div>
<h2>Average bus bandwidth</h2><img src="../charts/average-bus-bandwidth.png" alt="Average bus bandwidth chart">
<h2>Peak bus bandwidth</h2><img src="../charts/peak-bus-bandwidth.png" alt="Peak bus bandwidth chart">
<h2>Topology</h2><pre>{html.escape(topology)}</pre>
<p class="note">Engineering validation artifact; not vendor-certified performance.</p>
</main></body></html>"""
    report.mkdir(parents=True,exist_ok=True)
    (report/"results.html").write_text(page)

if __name__=="__main__": main()
