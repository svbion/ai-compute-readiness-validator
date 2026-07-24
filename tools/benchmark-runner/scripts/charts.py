#!/usr/bin/env python3
import json,os
from pathlib import Path
import matplotlib.pyplot as plt

def chart(labels,values,title,ylabel,path):
    fig,ax=plt.subplots(figsize=(10,6)); ax.bar(labels,values)
    ax.set_title(title); ax.set_ylabel(ylabel); ax.set_xlabel("NCCL collective")
    ax.tick_params(axis="x",rotation=35); fig.tight_layout(); fig.savefig(path,dpi=180); plt.close(fig)

def main():
    summary=Path(os.environ["SUMMARY_DIR"]); out=Path(os.environ["CHART_DIR"]); out.mkdir(parents=True,exist_ok=True)
    rows=json.loads((summary/"benchmark-summary.json").read_text()).get("collectives",[])
    labels=[r["test"].replace("_perf","") for r in rows]
    chart(labels,[float(r["average_bus_bandwidth_gbps"] or 0) for r in rows],
          "Average NCCL Bus Bandwidth by Collective","Bus bandwidth (GB/s)",out/"average-bus-bandwidth.png")
    chart(labels,[float(r["peak_bus_bandwidth_gbps"] or 0) for r in rows],
          "Peak Observed NCCL Bus Bandwidth by Collective","Bus bandwidth (GB/s)",out/"peak-bus-bandwidth.png")
    chart(labels,[float(r["duration_seconds"] or 0) for r in rows],
          "NCCL Collective Runtime","Duration (seconds)",out/"collective-duration.png")
if __name__=="__main__": main()
