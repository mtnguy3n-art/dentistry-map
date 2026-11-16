"""QA helper for qa-web-inc2.mjs: reads a JSON list of strings on stdin, prints clean_website({'website': s}) for each."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'pipeline', 'work'))
from weblink import clean_website  # noqa: E402

vals = json.load(sys.stdin)
out = []
for v in vals:
    try:
        out.append(clean_website({'website': v}))
    except Exception as e:  # a crash is a finding, not a test failure of this helper
        out.append({'error': repr(e)})
json.dump(out, sys.stdout)
