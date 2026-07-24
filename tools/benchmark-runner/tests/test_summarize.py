import importlib.util
import tempfile
import unittest
from pathlib import Path

path=Path(__file__).resolve().parents[1]/"scripts"/"summarize.py"
spec=importlib.util.spec_from_file_location("summarize",path)
module=importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(module)

SAMPLE="""# header
8 2 float sum -1 9.50 0.00 0.00 0 9.50 0.00 0.00 0
1024 256 float sum -1 5.00 0.20 0.30 0 5.00 0.20 0.30 0
# Out of bounds values : 0 OK
# Avg bus bandwidth : 0.15
"""

class Tests(unittest.TestCase):
    def test_parse_env(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"x.env"; p.write_text("a=1\nb=two\n")
            self.assertEqual(module.parse_env(p),{"a":"1","b":"two"})
    def test_parse_output(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/"x.txt"; p.write_text(SAMPLE)
            r=module.parse_output(p)
            self.assertEqual(r["out_of_bounds_values"],0)
            self.assertAlmostEqual(r["average_bus_bandwidth_gbps"],0.15)
            self.assertAlmostEqual(r["peak_bus_bandwidth_gbps"],0.30)

if __name__=="__main__": unittest.main()
