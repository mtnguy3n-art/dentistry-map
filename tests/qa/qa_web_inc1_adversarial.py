"""QA iteration 2, increment 1: adversarial values for clean_website (WR1). Fake data only.
Run: .venv/bin/python tests/qa/qa_web_inc1_adversarial.py
Prints each value with the result; exits 1 if a value marked MUST_REFUSE is accepted
or a MUST_ACCEPT value is changed."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'pipeline', 'work'))
from weblink import clean_website

REFUSE = [
    'javascript:alert(1)', 'JAVASCRIPT:alert(1)', '  javascript:alert(1)', 'JaVaScRiPt:void(0)',
    'java\tscript:alert(1)', 'vbscript:msgbox', 'data:text/html,<script>alert(1)</script>',
    'mailto:info@fictive.ca', 'tel:+15145550000', 'ftp://fictive.ca', 'file:///etc/passwd',
    '//fictive.ca', '///fictive.ca', 'http:/fictive.ca', 'https:fictive.ca', 'http:\\\\fictive.ca',
    'https://fictive.ca\\@evil.com', 'https://good.ca@evil.com', 'https://user:pw@fictive.ca',
    'https://good.ca%40evil.com@x.ca', 'info@fictive.ca', 'fictive.ca@', 'Clinique Fictive',
    'fictive', 'https://fictive', 'https://', 'https:///fictive.ca', 'https://fictive.ca:',
    'https://fictive.ca:abc', 'https://fictive.ca:80:80', 'https://[::1]/', 'https://fictivé.ca',
    'https://fictive.ca /x', 'https://fic tive.ca', '', ' ', ';;;', 'localhost:8080',
    'https://' + 'a' * 495 + '.ca', 'a' * 492 + '.ca',
    'https://fictive.ca:²',          # superscript two: str.isdigit() is True
    'https://fictive.ca:99999',           # port out of range
    'https://.', 'https://..', 'https://-.-', 'https://a..ca', 'https://.ca',
    'https://fictive.ca\x00', 'https://fictive.ca/\x07bell',
]
ACCEPT = {
    'https://www.fictive.ca/fr/accueil': 'https://www.fictive.ca/fr/accueil',
    'www.fictive.ca': 'https://www.fictive.ca',
    'fictive.ca': 'https://fictive.ca',
    'HTTPS://Fictive.CA': 'HTTPS://Fictive.CA',
    'http://fictive.ca': 'http://fictive.ca',
    'fictive.ca:8080/a': 'https://fictive.ca:8080/a',
    'https://fictive.ca/#@x': 'https://fictive.ca/#@x',
    'https://www.facebook.com/fictive': 'https://www.facebook.com/fictive',
    ' https://fictive.ca ': 'https://fictive.ca',
    'https://192.0.2.1/': 'https://192.0.2.1/',
    'https://fictive.ca.': 'https://fictive.ca.',  # trailing dot is a valid fully qualified name
}
bad = 0
for v in REFUSE:
    r = clean_website({'website': v})
    flag = 'ok ' if r is None else 'ACCEPTED'
    if r is not None: bad += 1
    print(f'{flag:9} refuse {v[:60]!r} -> {r!r:.70}')
for v, want in ACCEPT.items():
    r = clean_website({'website': v})
    flag = 'ok ' if r == want else 'WRONG'
    if r != want: bad += 1
    print(f'{flag:9} accept {v!r} -> {r!r}')
# tag order and split
cases = [
    ({'website': 'mailto:a@fictive.ca', 'contact:website': 'fictive.ca'}, 'https://fictive.ca'),
    ({'website': 'fictive.ca;https://facebook.com/x'}, 'https://fictive.ca'),
    ({'website': 'bad;;  ;javascript:x;www.fictive.ca'}, 'https://www.fictive.ca'),
    ({'url': 'https://u.fictive.ca', 'website': 'https://w.fictive.ca'}, 'https://w.fictive.ca'),
    ({'url': 'info@fictive.ca'}, None),
    ({'website': None, 'url': 123}, None),
    ({}, None),
]
for tags, want in cases:
    r = clean_website(tags)
    flag = 'ok ' if r == want else 'WRONG'
    if r != want: bad += 1
    print(f'{flag:9} tags {tags} -> {r!r}')
print('problems:', bad)
sys.exit(1 if bad else 0)
