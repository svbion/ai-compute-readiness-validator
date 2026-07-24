#!/usr/bin/env python3
from __future__ import annotations
import csv, json, os, re
from pathlib import Path
from typing import Any

def parse_env(path: Path) -> dict[str, str]:
    out={}
    if path.exists():
        for line in path.read_text(errors="replace").splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k,v=line.split("=",1); out[k.strip()]=v.strip()
    return out

def parse_output(path: Path) -> dict[str, Any]:
    text=path.read_text(errors="replace")
    m=re.search(r"#\s*Avg bus bandwidth\s*:\s*([0-9.]+)",text,re.I)
    avg=float(m.group(1)) if m else None
    m=re.search(r"#\s*Out of bounds values\s*:\s*(\d+)",text,re.I)
    oob=int(m.group(1)) if m else None
    peak=None; peak_size=None; samples=[]
    for line in text.splitlines():
        parts=line.strip().split()
        if not parts or line.lstrip().startswith("#") or len(parts)<8 or not parts[0].isdigit():
            continue
        size=int(parts[0]); candidates=[]
        for idx in (7,11):
            if idx < len(parts):
                try: candidates.append(float(parts[idx]))
                except ValueError: pass
        if candidates:
            local=max(candidates); samples.append({"bytes":size,"bus_bandwidth_gbps":local})
            if peak is None or local>peak: peak,peak_size=local,size
    return {"average_bus_bandwidth_gbps":avg,"peak_bus_bandwidth_gbps":peak,
            "peak_at_bytes":peak_size,"out_of_bounds_values":oob,"samples":samples}

def main():
    raw=Path(os.environ["RAW_DIR"]); meta=Path(os.environ["META_DIR"])
    summary=Path(os.environ["SUMMARY_DIR"]); summary.mkdir(parents=True,exist_ok=True)
    rows=[]
    for output in sorted(raw.glob("*_perf.txt")):
        test=output.stem; runmeta=parse_env(raw/f"{test}.meta.env"); parsed=parse_output(output)
        code=int(runmeta.get("exit_code","-1"))
        rows.append({"test":test,"status":"PASS" if code==0 and parsed["out_of_bounds_values"] in (0,None) else "FAIL",
                     "exit_code":code,"duration_seconds":int(runmeta.get("duration_seconds","0")),
                     **parsed,"raw_output":output.name})
    payload={"run":parse_env(meta/"run-manifest.env"),"collectives":rows}
    (summary/"benchmark-summary.json").write_text(json.dumps(payload,indent=2)+"\n")
    fields=["test","status","exit_code","duration_seconds","out_of_bounds_values",
            "average_bus_bandwidth_gbps","peak_bus_bandwidth_gbps","peak_at_bytes","raw_output"]
    with (summary/"benchmark-summary.csv").open("w",newline="") as f:
        w=csv.DictWriter(f,fieldnames=fields); w.writeheader()
        for row in rows: w.writerow({k:row.get(k) for k in fields})
    print(f"Summarized {len(rows)} collectives.")

if __name__=="__main__": main()
