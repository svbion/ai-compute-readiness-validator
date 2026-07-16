from typing import List, Dict, Tuple
from ai_validator.models import Cluster, Node, ValidationCategory, ValidationCheck, StatusEnum, SeverityEnum
from ai_validator.config import DEFAULT_WEIGHTS, SCORE_READY, SCORE_WARN, SCORE_REMEDIATE

class ScoringEngine:
    """Calculates weighted, normalized cluster readiness scores and handles status overrides."""

    @staticmethod
    def calculate_check_credit(check: ValidationCheck) -> float:
        """Determines scoring credit for a single check status."""
        if check.status == StatusEnum.PASS:
            return 1.0
        elif check.status == StatusEnum.WARNING:
            return 0.5
        elif check.status == StatusEnum.FAIL:
            return 0.0
        # skipped, unavailable, unknown receive no credit but don't count towards the denominator
        return 0.0

    @classmethod
    def calculate_category_score(cls, category: ValidationCategory) -> Tuple[float, bool]:
        """
        Calculates score (0.0 - 100.0) for a category based on its checks.
        Returns (score, is_available).
        A category is available if it contains at least one scorable check
        (pass, warning, or fail).
        """
        scorable_checks = [
            c for c in category.checks 
            if c.status in (StatusEnum.PASS, StatusEnum.WARNING, StatusEnum.FAIL)
        ]
        
        if not scorable_checks:
            return 0.0, False

        total_credit = sum(cls.calculate_check_credit(c) for c in scorable_checks)
        score = (total_credit / len(scorable_checks)) * 100.0
        return round(score, 2), True

    @classmethod
    def score_node(cls, node: Node) -> Node:
        """Computes score for each category on a specific node."""
        for cat_id, category in node.categories.items():
            score, is_available = cls.calculate_category_score(category)
            category.score = score
            # Aggregated status of category
            if not is_available:
                # If all checks are unavailable, category status is unavailable
                has_skipped = any(c.status == StatusEnum.SKIPPED for c in category.checks)
                category.score = 0.0
            node.categories[cat_id] = category
        
        # Aggregate Node-level status
        # If any check fails, node has warnings/failures
        all_checks = []
        for cat in node.categories.values():
            all_checks.extend(cat.checks)
            
        has_fail = any(c.status == StatusEnum.FAIL for c in all_checks)
        has_warn = any(c.status == StatusEnum.WARNING for c in all_checks)
        has_pass = any(c.status == StatusEnum.PASS for c in all_checks)
        
        if has_fail:
            node.status = StatusEnum.FAIL
        elif has_warn:
            node.status = StatusEnum.WARNING
        elif has_pass:
            node.status = StatusEnum.PASS
        else:
            node.status = StatusEnum.UNAVAILABLE

        return node

    @classmethod
    def evaluate_cluster(cls, cluster: Cluster) -> Cluster:
        """
        Computes the overall score for the cluster.
        Handles proportional weight redistribution for unavailable categories,
        aggregates recommendations, and overrides classifications for critical failures.
        """
        if not cluster.nodes:
            cluster.overall_score = 0.0
            cluster.classification = "Not ready"
            return cluster

        # Ensure all nodes are individually scored
        for i, node in enumerate(cluster.nodes):
            cluster.nodes[i] = cls.score_node(node)

        # Let's compute average category score across all nodes
        category_scores: Dict[str, List[float]] = {}
        category_availability: Dict[str, bool] = {}
        
        # Initialize
        for cat_id in DEFAULT_WEIGHTS.keys():
            category_scores[cat_id] = []
            category_availability[cat_id] = False

        for node in cluster.nodes:
            for cat_id, category in node.categories.items():
                scorable_checks = [
                    c for c in category.checks 
                    if c.status in (StatusEnum.PASS, StatusEnum.WARNING, StatusEnum.FAIL)
                ]
                if scorable_checks:
                    category_scores[cat_id].append(category.score)
                    category_availability[cat_id] = True

        # Calculate final available weights and category averages
        active_weights: Dict[str, float] = {}
        average_category_scores: Dict[str, float] = {}
        total_active_weight = 0.0

        for cat_id, weight in DEFAULT_WEIGHTS.items():
            if category_availability[cat_id]:
                active_weights[cat_id] = weight
                total_active_weight += weight
                # average of node scores for this category
                scores = category_scores[cat_id]
                average_category_scores[cat_id] = sum(scores) / len(scores)

        # Calculate overall weighted score
        if total_active_weight > 0.0:
            weighted_sum = 0.0
            for cat_id, weight in active_weights.items():
                normalized_weight = weight / total_active_weight
                weighted_sum += average_category_scores[cat_id] * normalized_weight
            cluster.overall_score = round(weighted_sum, 2)
        else:
            cluster.overall_score = 0.0

        # Gather critical failure information
        all_checks: List[ValidationCheck] = []
        for node in cluster.nodes:
            for cat in node.categories.values():
                all_checks.extend(cat.checks)

        critical_failures = [
            c for c in all_checks 
            if c.status == StatusEnum.FAIL and c.severity == SeverityEnum.CRITICAL
        ]
        
        # Determine classification
        if cluster.overall_score >= SCORE_READY:
            cluster.classification = "Ready"
        elif cluster.overall_score >= SCORE_WARN:
            cluster.classification = "Ready with warnings"
        elif cluster.overall_score >= SCORE_REMEDIATE:
            cluster.classification = "Remediation required"
        else:
            cluster.classification = "Not ready"

        # Apply Critical Failure Override
        if critical_failures and cluster.classification in ("Ready", "Ready with warnings"):
            cluster.classification = "Remediation required"

        # Consolidated de-duplicated recommendations from warn/fail checks
        recommendations = []
        for check in all_checks:
            if check.status in (StatusEnum.FAIL, StatusEnum.WARNING) and check.recommendation:
                rec_text = f"[{check.node}] {check.recommendation}"
                if rec_text not in recommendations:
                    recommendations.append(rec_text)
                    
        cluster.recommendations = recommendations
        
        # Save active weights mapping in metadata for transparent explanation
        cluster.metadata["active_weights"] = active_weights
        cluster.metadata["total_active_weight"] = total_active_weight
        cluster.metadata["category_averages"] = average_category_scores
        cluster.metadata["critical_failure_count"] = len(critical_failures)

        return cluster
