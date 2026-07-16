from abc import ABC, abstractmethod
from typing import List
from ai_validator.models import ValidationCheck

class BaseCollector(ABC):
    """Abstract base class for all validation collectors."""

    @abstractmethod
    def collect(self, node_name: str) -> List[ValidationCheck]:
        """
        Runs read-only diagnostic commands on the local machine
        and evaluates results to return list of structured validation checks.
        """
        pass
