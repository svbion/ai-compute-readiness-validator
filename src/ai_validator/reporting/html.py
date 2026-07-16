import os
from jinja2 import Environment, FileSystemLoader, select_autoescape
from ai_validator.models import Cluster

class HtmlReporter:
    """Generates standalone, highly polished HTML assessment reports."""

    @staticmethod
    def generate_report(cluster: Cluster, output_path: str = "artifacts/latest-report.html") -> str:
        """Loads the HTML Jinja2 template and renders the cluster assessment results."""
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        
        # Resolve template paths relative to this module
        current_dir = os.path.dirname(os.path.abspath(__file__))
        templates_dir = os.path.join(current_dir, "templates")
        
        env = Environment(
            loader=FileSystemLoader(templates_dir),
            autoescape=select_autoescape(["html", "xml"]),
            extensions=["jinja2.ext.do"]
        )
        
        # Load and render template
        template = env.get_template("report.html.j2")
        html_content = template.render(cluster=cluster)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html_content)
            
        return os.path.abspath(output_path)
