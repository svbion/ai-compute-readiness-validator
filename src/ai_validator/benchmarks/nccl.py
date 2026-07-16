import re
from typing import Optional
from ai_validator.models import BenchmarkResult, StatusEnum

class NcclParser:
    """Parses standard NCCL Test log files to extract peak bandwidth and error metrics."""

    @staticmethod
    def parse(file_path: str) -> BenchmarkResult:
        metrics = {}
        raw_snippet = ""
        status = StatusEnum.PASS

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            # Extract a snippet around the results table
            lines = content.split("\n")
            table_lines = [l for l in lines if re.search(r"\d+\s+\d+\s+float\s+", l) or "busbw" in l]
            if table_lines:
                raw_snippet = "\n".join(table_lines[-10:])
            else:
                raw_snippet = "\n".join(lines[-15:])

            # Parse peak bus bandwidth (busbw)
            # Example: 1073741824  268435456  float sum  13341  80.49 140.85    0 ...
            # Look for floats in lines
            bus_bandwidths = []
            for line in lines:
                parts = line.strip().split()
                # A valid data line usually has at least 8 elements, and 'float' or 'half' in the middle
                if len(parts) >= 8 and parts[2] in ("float", "half", "char", "double"):
                    try:
                        # Bus bandwidth is usually the 7th column (index 6 or 7 depending on in-place/out-of-place)
                        # Let's find the max float value in the columns
                        float_parts = []
                        for p in parts:
                            try:
                                float_parts.append(float(p))
                            except ValueError:
                                pass
                        if len(float_parts) >= 4:
                            # Standard busbw is near the end before errors count (which is 0)
                            bus_bandwidths.append(float_parts[-2])
                    except (IndexError, ValueError):
                        pass

            if bus_bandwidths:
                peak_bw = max(bus_bandwidths)
                metrics["peak_bus_bandwidth_gbs"] = peak_bw
                # Let's set status based on an enterprise threshold (e.g. 120 GB/s is healthy for NDR, 50 GB/s for HDR)
                metrics["status_threshold_gbs"] = 120.0
                if peak_bw < 80.0:
                    status = StatusEnum.WARNING
            else:
                metrics["info"] = "No standard data rows parsed"
                status = StatusEnum.WARNING

        except Exception as e:
            status = StatusEnum.UNKNOWN
            raw_snippet = f"Parsing error: {str(e)}"
            metrics["error"] = str(e)

        return BenchmarkResult(
            benchmark_type="NCCL AllReduce",
            file_path=file_path,
            metrics=metrics,
            raw_snippet=raw_snippet,
            status=status
        )
