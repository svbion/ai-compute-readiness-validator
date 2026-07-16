import os
from ai_validator.models import Cluster

class JsonReporter:
    """Exports structured validation results as serialized JSON."""

    @staticmethod
    def generate_report(cluster: Cluster, output_path: str = "artifacts/latest-results.json") -> str:
        """Serializes the Cluster model to JSON and writes it to disk."""
        # Create output directory if it doesn't exist
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        # Serialize model using Pydantic's built-in serializer
        json_data = cluster.model_dump_json(indent=2)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(json_data)
            
        return os.path.abspath(output_path)
