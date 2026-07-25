#!/usr/bin/env python3
import os,re
from pathlib import Path

def main():
    meta=Path(os.environ["META_DIR"]); summary=Path(os.environ["SUMMARY_DIR"])
    path=meta/"topo-m.txt"; out=summary/"topology.mmd"
    if not path.exists():
        out.write_text("graph LR\n  A[Topology data unavailable]\n"); return
    rows=[line.split() for line in path.read_text(errors="replace").splitlines()
          if line.strip() and not line.startswith("$")]
    header=next((r for r in rows if r and r[0]=="GPU0"),[])
    cols=[x for x in header if re.fullmatch(r"GPU\d+",x)]
    gpurows=[r for r in rows if r and re.fullmatch(r"GPU\d+",r[0])]
    edges=set()
    for row in gpurows:
        for target,rel in zip(cols,row[1:1+len(cols)]):
            if row[0]!=target and rel!="X":
                a,b=sorted((row[0],target)); edges.add((a,b,rel))
    lines=["graph LR"]
    for r in gpurows: lines.append(f"  {r[0]}[{r[0]}]")
    for a,b,rel in sorted(edges): lines.append(f"  {a} ---|{rel}| {b}")
    lines.append('  LEGEND["NV# = NVLink; PIX/PXB/PHB/SYS = PCIe or CPU path"]')
    out.write_text("\n".join(lines)+"\n")
if __name__=="__main__": main()
