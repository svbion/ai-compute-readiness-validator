import re
import json
from typing import Optional
from ai_validator.models import BenchmarkResult, StatusEnum

class FioParser:
    """Parses Flexible I/O (fio) execution outputs (JSON or standard text formats) to extract storage bandwidth and IOPS."""

    @staticmethod
    def parse(file_path: str) -> BenchmarkResult:
        metrics = {}
        raw_snippet = ""
        status = StatusEnum.PASS

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            raw_snippet = content[:800] # First 800 chars of result for context

            # Try JSON parsing first
            try:
                data = json.loads(content)
                if "jobs" in data and len(data["jobs"]) > 0:
                    job = data["jobs"][0]
                    read_iops = job.get("read", {}).get("iops", 0)
                    write_iops = job.get("write", {}).get("iops", 0)
                    read_bw = job.get("read", {}).get("bw", 0) / 1024.0 # KB to MB
                    write_bw = job.get("write", {}).get("bw", 0) / 1024.0 # KB to MB
                    
                    metrics["read_iops"] = read_iops
                    metrics["write_iops"] = write_iops
                    metrics["read_bw_mbs"] = round(read_bw, 2)
                    metrics["write_bw_mbs"] = round(write_bw, 2)
                    
                    return BenchmarkResult(
                        benchmark_type="fio Storage IO",
                        file_path=file_path,
                        metrics=metrics,
                        raw_snippet=content[:1000],
                        status=status
                    )
            except json.JSONDecodeError:
                # Fallback to text parsing
                pass

            # Text Parser fallback
            lines = content.split("\n")
            read_iops = 0
            write_iops = 0
            read_bw_mbs = 0.0
            write_bw_mbs = 0.0

            # Look for lines like:
            #  read: IOPS=12.5k, BW=50.2MiB/s (52.6MB/s)(200MiB/10000ms)
            for line in lines:
                if "read:" in line and "iops=" in line:
                    iops_match = re.search(r"iops=([\d\.]+k?)", line, re.IGNORECASE)
                    bw_match = re.search(r"bw=([\d\.]+m?i?b/s)", line, re.IGNORECASE)
                    if iops_match:
                        val = iops_match.group(1).lower()
                        read_iops = float(val.replace("k", "")) * 1000 if "k" in val else float(val)
                    if bw_match:
                        # parse mib/s
                        val = bw_match.group(1).lower()
                        read_bw_mbs = float(val.replace("mib/s", "").replace("mb/s", "").replace("m", ""))
                elif "write:" in line and "iops=" in line:
                    iops_match = re.search(r"iops=([\d\.]+k?)", line, re.IGNORECASE)
                    bw_match = re.search(r"bw=([\d\.]+m?i?b/s)", line, re.IGNORECASE)
                    if iops_match:
                        val = iops_match.group(1).lower()
                        write_iops = float(val.replace("k", "")) * 1000 if "k" in val else float(val)
                    if bw_match:
                        val = bw_match.group(1).lower()
                        write_bw_mbs = float(val.replace("mib/s", "").replace("mb/s", "").replace("m", ""))

            metrics["read_iops"] = int(read_iops)
            metrics["write_iops"] = int(write_iops)
            metrics["read_bw_mbs"] = read_bw_mbs
            metrics["write_bw_mbs"] = write_bw_mbs

            if read_bw_mbs == 0.0 and write_bw_mbs == 0.0:
                metrics["info"] = "Could not parse non-zero read/write rates"
                status = StatusEnum.WARNING

        except Exception as e:
            status = StatusEnum.UNKNOWN
            raw_snippet = f"Parsing error: {str(e)}"
            metrics["error"] = str(e)

        return BenchmarkResult(
            benchmark_type="fio Storage IO",
            file_path=file_path,
            metrics=metrics,
            raw_snippet=raw_snippet,
            status=status
        )
