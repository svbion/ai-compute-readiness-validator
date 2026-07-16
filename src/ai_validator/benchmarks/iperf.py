import re
from typing import Optional
from ai_validator.models import BenchmarkResult, StatusEnum

class IperfParser:
    """Parses iperf3 network throughput reports to find peak network bandwidth transfers."""

    @staticmethod
    def parse(file_path: str) -> BenchmarkResult:
        metrics = {}
        raw_snippet = ""
        status = StatusEnum.PASS

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            lines = content.split("\n")
            # Extract iperf3 summary lines (usually near the end)
            summary_lines = [l for l in lines if "receiver" in l or "sender" in l or "Mbits/sec" in l or "Gbits/sec" in l]
            if summary_lines:
                raw_snippet = "\n".join(summary_lines[-8:])
            else:
                raw_snippet = "\n".join(lines[-12:])

            # Parse bandwidth values (look for Gbits/sec or Mbits/sec)
            bandwidths = []
            for line in lines:
                # Look for format: [ ID] Interval           Transfer     Bitrate
                # Example: [  5]   0.00-10.00  sec  11.2 GBytes  9.60 Gbits/sec                  receiver
                match = re.search(r"sec\s+[\d\.]+\s+[GKM]Bytes\s+([\d\.]+)\s+([GMK])bits/sec", line)
                if match:
                    try:
                        bw_val = float(match.group(1))
                        unit = match.group(2).upper()
                        if unit == "M":
                            # Convert to Gbits/sec
                            bw_val = bw_val / 1000.0
                        elif unit == "K":
                            bw_val = bw_val / 1000000.0
                        bandwidths.append(bw_val)
                    except ValueError:
                        pass

            if bandwidths:
                peak_bw = max(bandwidths)
                metrics["peak_network_bandwidth_gbs"] = round(peak_bw, 3)
                if peak_bw < 9.0: # 10G link threshold warning
                    status = StatusEnum.WARNING
            else:
                metrics["info"] = "No standard iperf3 transfer metrics parsed"
                status = StatusEnum.WARNING

        except Exception as e:
            status = StatusEnum.UNKNOWN
            raw_snippet = f"Parsing error: {str(e)}"
            metrics["error"] = str(e)

        return BenchmarkResult(
            benchmark_type="iperf3 Network",
            file_path=file_path,
            metrics=metrics,
            raw_snippet=raw_snippet,
            status=status
        )
