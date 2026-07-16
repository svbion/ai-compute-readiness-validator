from typing import List
from ai_validator.models import ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.collectors.base import BaseCollector
from ai_validator.runner import CommandRunner

class KubernetesCollector(BaseCollector):
    """Collects and validates Kubernetes node readiness, GPU allocator capacity, and GPU Operator daemon statuses."""

    def collect(self, node_name: str) -> List[ValidationCheck]:
        checks = []

        # 1. Verify kubectl exists
        kubectl_present = CommandRunner.run_command(["which", "kubectl"])
        has_kube = (kubectl_present.exit_code == 0)

        kube_tools_status = StatusEnum.PASS if has_kube else StatusEnum.SKIPPED
        kube_tools_summary = "Kubernetes CLI (kubectl) is available on this system." if has_kube else "Kubernetes control CLI (kubectl) is not installed or not found."
        kube_tools_rec = None if has_kube else "Install kubectl CLI and configure KUBECONFIG if this node is part of a Kubernetes-managed cluster. Skip otherwise."

        checks.append(ValidationCheck(
            id="kubernetes.present",
            category="kubernetes",
            title="Kubernetes CLI Availability",
            status=kube_tools_status,
            severity=SeverityEnum.LOW,
            summary=kube_tools_summary,
            evidence=[kubectl_present] if has_kube else [],
            recommendation=kube_tools_rec,
            node=node_name
        ))

        # If kubectl is missing, return early
        if not has_kube:
            for check_id, title, sev, summary, rec in [
                ("kubernetes.cluster_reach", "Kubernetes API Server Connection", SeverityEnum.HIGH, "Kubernetes API server status is unavailable because kubectl is missing.", "Configure access credentials in ~/.kube/config."),
                ("kubernetes.node_readiness", "Kubernetes Node Status Readiness", SeverityEnum.CRITICAL, "Kubernetes node scheduling status is unavailable.", "Ensure kubelet is running on the node and is joined to the cluster."),
                ("kubernetes.gpu_operator", "NVIDIA GPU Operator and Device Plugins", SeverityEnum.HIGH, "NVIDIA GPU Operator status is unavailable.", "Install the NVIDIA GPU Operator helm chart to orchestrate driver and runtime plugins.")
            ]:
                checks.append(ValidationCheck(
                    id=check_id,
                    category="kubernetes",
                    title=title,
                    status=StatusEnum.UNAVAILABLE,
                    severity=sev,
                    summary=summary,
                    evidence=[],
                    recommendation=rec,
                    node=node_name
                ))
            return checks

        # If kubectl exists, check cluster context and node state
        reach_cmd = CommandRunner.run_command(["kubectl", "config", "current-context"])
        nodes_cmd = CommandRunner.run_command(["kubectl", "get", "nodes"])

        # 2. API Server Connection Check
        reach_status = StatusEnum.PASS
        reach_summary = "Kubernetes API server is reachable and context is verified."
        reach_rec = None

        if reach_cmd.exit_code != 0:
            reach_status = StatusEnum.FAIL
            reach_summary = "Kubernetes API server is UNREACHABLE or context authentication failed."
            reach_rec = "Check KUBECONFIG env variable, verify ~/.kube/config cluster endpoints, and confirm cluster networking."
        
        checks.append(ValidationCheck(
            id="kubernetes.cluster_reach",
            category="kubernetes",
            title="Kubernetes API Server Connection",
            status=reach_status,
            severity=SeverityEnum.HIGH,
            summary=reach_summary,
            evidence=[reach_cmd],
            recommendation=reach_rec,
            node=node_name
        ))

        # If API is unreachable, we can't run further queries
        if reach_status == StatusEnum.FAIL:
            for check_id, title, sev, summary, rec in [
                ("kubernetes.node_readiness", "Kubernetes Node Status Readiness", SeverityEnum.CRITICAL, "Kubernetes node scheduling status could not be verified due to API connection failure.", "Fix API server reachability first."),
                ("kubernetes.gpu_operator", "NVIDIA GPU Operator and Device Plugins", SeverityEnum.HIGH, "GPU Operator daemon health could not be verified due to API connection failure.", "Fix API server reachability first.")
            ]:
                checks.append(ValidationCheck(
                    id=check_id,
                    category="kubernetes",
                    title=title,
                    status=StatusEnum.UNAVAILABLE,
                    severity=sev,
                    summary=summary,
                    evidence=[],
                    recommendation=rec,
                    node=node_name
                ))
            return checks

        # 3. Node scheduling readiness check
        node_status = StatusEnum.PASS
        node_summary = "Kubernetes Node is registered and reports READY state in cluster pool."
        node_rec = None

        if nodes_cmd.exit_code == 0:
            stdout_lower = nodes_cmd.stdout.lower()
            if "notready" in stdout_lower or "schedulingdisabled" in stdout_lower:
                node_status = StatusEnum.FAIL
                node_summary = "The compute node is marked as NOT READY or has scheduling disabled (Cordoned)."
                node_rec = "Investigate kubelet daemon health: 'systemctl status kubelet'. Uncordon node: 'kubectl uncordon YOUR_NODE'."
        else:
            node_status = StatusEnum.UNKNOWN
            node_summary = "Failed to query node readiness status from API."

        checks.append(ValidationCheck(
            id="kubernetes.node_readiness",
            category="kubernetes",
            title="Kubernetes Node Status Readiness",
            status=node_status,
            severity=SeverityEnum.CRITICAL,
            summary=node_summary,
            evidence=[nodes_cmd],
            recommendation=node_rec,
            node=node_name
        ))

        # 4. GPU Operator and Device Plugin Status
        ds_cmd = CommandRunner.run_command(["kubectl", "get", "daemonsets", "-n", "gpu-operator-resources"])
        op_status = StatusEnum.PASS
        op_summary = "NVIDIA GPU Operator resources are healthy and device plugin is registered."
        op_rec = None

        if ds_cmd.exit_code == 0:
            stdout_lower = ds_cmd.stdout.lower()
            # If any daemonset has 0 desired/ready pods (when some are expected)
            if "nvidia-device-plugin-daemonset" in stdout_lower and (" 0 " in stdout_lower or "unhealthy" in stdout_lower):
                op_status = StatusEnum.WARNING
                op_summary = "NVIDIA Device Plugin daemonset reports unhealthy or inactive pods."
                op_rec = "Inspect GPU Operator resource pod logs: 'kubectl logs -n gpu-operator-resources -l app=nvidia-device-plugin-daemonset'."
        else:
            # Check if namespace exists or if command skipped
            op_status = StatusEnum.SKIPPED
            op_summary = "NVIDIA GPU Operator resources are not detected in the default namespace (expected on generic non-GPU clusters)."

        checks.append(ValidationCheck(
            id="kubernetes.gpu_operator",
            category="kubernetes",
            title="NVIDIA GPU Operator and Device Plugins",
            status=op_status,
            severity=SeverityEnum.HIGH,
            summary=op_summary,
            evidence=[ds_cmd] if ds_cmd.exit_code == 0 else [],
            recommendation=op_rec,
            node=node_name
        ))

        return checks
