import os
from datetime import datetime
from ai_validator.models import Cluster, StatusEnum

class MarkdownReporter:
    """Generates clean, professional Markdown reports of cluster readiness."""

    @staticmethod
    def generate_report(cluster: Cluster, output_path: str = "artifacts/latest-report.md") -> str:
        """Constructs a Markdown report from a Cluster evaluation."""
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        md = []
        md.append(f"# AI Compute Readiness Assessment Report")
        md.append(f"**Cluster Identifier:** `{cluster.name}`  ")
        md.append(f"**Assessment Mode:** {cluster.metadata.get('execution_mode', 'Validation')}  ")
        md.append(f"**Timestamp:** {cluster.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}  ")
        md.append(f"**Tool Version:** v{cluster.tool_version}  \n")
        
        # Readiness Score Card
        md.append(f"## 📊 Evaluation Summary")
        md.append(f"| Metric | Value |")
        md.append(f"| :--- | :--- |")
        md.append(f"| **Overall Readiness Score** | **{cluster.overall_score}%** |")
        md.append(f"| **Class Status** | **{cluster.classification.upper()}** |")
        md.append(f"| **Total Nodes Assessed** | {len(cluster.nodes)} |")
        md.append(f"| **Critical Failures** | {cluster.metadata.get('critical_failure_count', 0)} |")
        md.append("")

        # Category scores
        md.append(f"### Category-level Breakdown")
        md.append(f"| Category | Average Score | Weight |")
        md.append(f"| :--- | :---: | :---: |")
        active_weights = cluster.metadata.get("active_weights", {})
        total_active_weight = cluster.metadata.get("total_active_weight", 1.0)
        category_averages = cluster.metadata.get("category_averages", {})
        for cat_id, weight in active_weights.items():
            name = cat_id.replace("_", " ").upper()
            avg = category_averages.get(cat_id, 0.0)
            rel_weight = (weight / total_active_weight) * 100
            md.append(f"| {name} | {avg:.1f}% | {rel_weight:.1f}% |")
        md.append("")

        # Critical Findings
        md.append(f"## ⚠️ Remediation & Recommendations")
        if cluster.recommendations:
            for rec in cluster.recommendations:
                md.append(f"- {rec}")
        else:
            md.append("- ✨ No immediate action items. Cluster is fully operational and healthy.")
        md.append("")

        # Node Inventory
        md.append(f"## 🖥️ Node Status Inventory")
        md.append(f"| Node Name | Aggregated Status |")
        md.append(f"| :--- | :--- |")
        for node in cluster.nodes:
            status_emoji = "🟢 PASS" if node.status == StatusEnum.PASS else "🟡 WARN" if node.status == StatusEnum.WARNING else "🔴 DEGRADED" if node.status == StatusEnum.FAIL else "⚪ UNAVAILABLE"
            md.append(f"| `{node.name}` | {status_emoji} |")
        md.append("")

        # Detailed Verification Table
        md.append(f"## 📋 Detailed Verification Records")
        for node in cluster.nodes:
            md.append(f"### Node: `{node.name}`")
            md.append(f"| Category | Check | Status | Summary |")
            md.append(f"| :--- | :--- | :--- | :--- |")
            for cat_id, cat in node.categories.items():
                for check in cat.checks:
                    status_str = "PASS" if check.status == StatusEnum.PASS else "WARN" if check.status == StatusEnum.WARNING else "FAIL" if check.status == StatusEnum.FAIL else "SKIP"
                    md.append(f"| {cat.name.upper()} | {check.title} | **{status_str}** | {check.summary} |")
            md.append("\n")

        # Ingested Benchmarks
        if cluster.benchmark_results:
            md.append(f"## 📊 Benchmark Ingestion Profile")
            md.append(f"| Benchmark Type | Performance Metrics | Status | Source File |")
            md.append(f"| :--- | :--- | :--- | :--- |")
            for b in cluster.benchmark_results:
                metrics_str = ", ".join(f"`{k}: {v}`" for k, v in b.metrics.items())
                status_str = "VALIDATED" if b.status == StatusEnum.PASS else "WARNING"
                md.append(f"| {b.benchmark_type} | {metrics_str} | **{status_str}** | `{b.file_path or 'Ingested'}` |")
            md.append("")

        # Score calculation notes
        md.append(f"---")
        md.append(f"**Score Transparency Statement:**  ")
        md.append(f"Category averages are aggregated from node checks. Fully unavailable categories are excluded, and weights are distributed proportionally. A single failing `CRITICAL` check restricts classification to 'Remediation Required' even with high overall numerical scores.")

        md_text = "\n".join(md)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md_text)
            
        return os.path.abspath(output_path)
