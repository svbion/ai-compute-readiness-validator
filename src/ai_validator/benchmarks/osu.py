import re
from typing import Optional
from ai_validator.models import BenchmarkResult, StatusEnum

class OsuParser:
    """Parses OSU (Ohio State University) MPI Micro-Benchmarks for latency or bandwidth transfer logs."""

    @staticmethod
    def parse(file_path: str) -> BenchmarkResult:
        metrics = {}
        raw_snippet = ""
        status = StatusEnum.PASS

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            lines = content.split("\n")
            # Filter non-comment lines
            data_lines = [l.strip() for l in lines if l.strip() and not l.strip().startswith("#")]
            if data_lines:
                raw_snippet = "\n".join(lines[:20]) # Heading + first few rows
            else:
                raw_snippet = "\n".join(lines[-15:])

            # Parse size vs value rows (e.g. size bandwidth or size latency)
            latencies = []
            bandwidths = []
            is_bandwidth = "bandwidth" in content.lower()
            is_latency = "latency" in content.lower()

            for line in data_lines:
                parts = line.split()
                if len(parts) == 2:
                    try:
                        size = int(parts[0])
                        val = float(parts[1])
                        if is_latency:
                            # 1st data element is size, 2nd is latency in us (lower is better)
                            latencies.append((size, val))
                        elif is_bandwidth:
                            # 2nd is bandwidth in MB/s (higher is better)
                            bandwidths.append((size, val))
                        else:
                            # default guess based on values: if first row is around 1us, it's latency
                            if size == 1 or size == 2 or size == 4:
                                if val < 20.0:
                                    latencies.append((size, val))
                                else:
                                    bandwidths.append((size, val))
                    except ValueError:
                        pass

            if latencies:
                min_lat = min(l[1] for l in latencies)
                metrics["min_latency_us"] = min_lat
                # 1us is excellent for InfiniBand, >5us is suspicious
                if min_lat > 5.0:
                    status = StatusEnum.WARNING
            elif bandwidths:
                max_bw = max(b[1] for b in bandwidths)
                metrics["peak_bandwidth_mbs"] = max_bw
                if max_bw < 10000.0: # warning if below 10GB/s
                    status = StatusEnum.WARNING
            else:
                metrics["info"] = "No standard OSU data rows parsed"
                status = StatusEnum.WARNING

        except Exception as e:
            status = StatusEnum.UNKNOWN
            raw_snippet = f"Parsing error: {str(e)}"
            metrics["error"] = str(e)

        return BenchmarkResult(
            benchmark_type="OSU MPI Interconnect",
            file_path=file_path,
            metrics=metrics,
            raw_snippet=raw_snippet,
            status=status
        )
