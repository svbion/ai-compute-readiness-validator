from ai_validator.models import Cluster
from ai_validator.scoring import ScoringEngine
from ai_validator.demo.scenarios import get_healthy_scenario, get_degraded_scenario

class DemoGenerator:
    """Orchestrates mock data scenarios for platform validation demonstrations."""

    @staticmethod
    def get_scenario(scenario_name: str) -> Cluster:
        """Retrieves and scores a mock cluster according to the specified scenario name."""
        name = scenario_name.strip().lower()
        if name == "healthy":
            cluster = get_healthy_scenario()
        elif name == "degraded":
            cluster = get_degraded_scenario()
        else:
            raise ValueError(f"Unknown demonstration scenario: '{scenario_name}'. Supported values are 'healthy' or 'degraded'.")
            
        # Score the cluster using the transparent scoring logic
        scored_cluster = ScoringEngine.evaluate_cluster(cluster)
        return scored_cluster
