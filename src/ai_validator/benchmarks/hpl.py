import re
from typing import Optional
from ai_validator.models import BenchmarkResult, StatusEnum

class HplParser:
    """Parses High Performance Linpack (HPL) benchmarks to extract GFLOPS or TFLOPS metrics."""

    @staticmethod
    def parse(file_path: str) -> BenchmarkResult:
        metrics = {}
        raw_snippet = ""
        status = StatusEnum.PASS

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            lines = content.split("\n")
            # Extract HPL outcome lines
            hpl_lines = [l for l in lines if "WR" in l or "GFlops" in l or "GFLOPS" in l]
            if hpl_lines:
                raw_snippet = "\n".join(hpl_lines[-10:])
            else:
                raw_snippet = "\n".join(lines[-15:])

            # Search for GFLOPS in lines
            gflops_vals = []
            for line in lines:
                # Look for lines with scientific notation or decimal float at the end (the GFLOPS column)
                # WR11R2C4      143360   288     4     8            1543.20          1.2754e+03
                match = re.search(r"WR\w+\s+\d+\s+\d+\s+\d+\s+\d+\s+[\d\.]+\s+([\d\.e\+\-]+)", line)
                if match:
                    try:
                        gflops_vals.append(float(match.group(1)))
                    except ValueError:
                        pass

            if gflops_vals:
                peak_gflops = max(gflops_vals)
                metrics["peak_gflops"] = peak_gflops
                metrics["peak_tflops"] = round(peak_gflops / 1000.0, 3)
                if peak_gflops < 500.0: # threshold warning
                    status = StatusEnum.WARNING
            else:
                # Fallback search for a float at the end of a line with "GFlops" or "GFLOPS"
                fallback_match = re.findall(r"([\d\.\+e]+)\s*G?Flops", content, re.IGNORECASE)
                if fallback_match:
                    try:
                        peak_gflops = float(fallback_match[-1])
                        metrics["peak_gflops"] = peak_gflops
                        metrics["peak_tflops"] = round(peak_gflops / 1000.0, 3)
                    except ValueError:
                        metrics["info"] = "Found GFlops label, but could not parse number"
                        status = StatusEnum.WARNING
                else:
                    metrics["info"] = "No standard HPL performance rows parsed"
                    status = StatusEnum.WARNING

        except Exception as e:
            status = StatusEnum.UNKNOWN
            raw_snippet = f"Parsing error: {str(e)}"
            metrics["error"] = str(e)

        return BenchmarkResult(
            benchmark_type="HPL Linpack",
            file_path=file_path,
            metrics=metrics,
            raw_snippet=raw_snippet,
            status=status
        )
