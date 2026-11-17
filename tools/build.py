#!/usr/bin/env python3
"""Builds index.html from src/: the page template, the course data, English glosses, interface text and the app code.

Run from the repository root:  python3 tools/build.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'

template = (SRC / 'template.html').read_text(encoding='utf-8')
data = '\n'.join((SRC / name).read_text(encoding='utf-8').rstrip() for name in ['data.js', 'words-en.js', 'i18n.js'])
legacy = json.dumps(json.loads((SRC / 'legacy-v1.json').read_text(encoding='utf-8')), ensure_ascii=False, separators=(',', ':'))
app = (SRC / 'app.js').read_text(encoding='utf-8').rstrip()

scripts = (
    '<script>\n' + data + '\n'
    '// Frozen word order of the first release (progress was keyed "topic:index" then). Used once, to carry old progress over. Never edit.\n'
    'window.TANGO_LEGACY_V1 = ' + legacy + ';\n</script>\n\n'
    '<script>\n' + app + '\n</script>'
)
marker = '<!-- BUILD:SCRIPTS (tools/build.py puts the course data and the app code here) -->'
assert template.count(marker) == 1, 'build marker missing in src/template.html'
out = template.replace(marker, scripts)
(ROOT / 'index.html').write_text(out, encoding='utf-8')
print(f'index.html built: {len(out.encode("utf-8")) // 1024} KB')
