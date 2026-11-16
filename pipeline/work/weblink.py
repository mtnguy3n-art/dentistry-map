"""Clinic website rules for the listings refresh (functional spec, iteration 2, WR1, WR9).

Standard library only, so it can be unit-tested without the geo libraries.
"""
import re

TAGS = ('website', 'contact:website', 'url')
MAX_LEN = 500
_OTHER_SCHEME = re.compile(r'^[a-z][a-z0-9+-]*:', re.I)  # javascript:, mailto:, tel:, ftp:, ...
_LABEL = re.compile(r'^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?$')  # one dot-separated part of a host name
# QA-W3: a last part that is a number (all digits, or "0x" hex) makes browsers read the host as an IPv4 address;
# only a plain dotted IPv4 address is then kept (_ipv4)
_NUMERIC = re.compile(r'^([0-9]+|0x[0-9a-f]*)$', re.I)
# QA-W3: one explicit list, identical in site/assets/web.js (safeUrl): space and control characters (C0, DEL,
# C1 incl. U+0085), Unicode spaces, U+FEFF and backslash
_BAD_CHAR = re.compile('[\x00-\x20\x7f-\xa0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff\\\\]')


def host_ok(host):
    """Dotted host of letters, digits and "-" only, with no empty part (QA-W1); one trailing dot may stay."""
    if host.endswith('.'):
        host = host[:-1]
    labels = host.split('.')
    return len(labels) > 1 and all(_LABEL.match(x) for x in labels) and (not _NUMERIC.match(labels[-1]) or _ipv4(labels))


def _ipv4(labels):
    """QA-W3: only a plain dotted IPv4 address (four numbers 0 to 255, no leading zero) may end in a number."""
    return len(labels) == 4 and all(re.match(r'^(0|[1-9][0-9]{0,2})$', x) and int(x) < 256 for x in labels)


def port_ok(port):
    """ASCII digits only, 1 to 65535 (QA-W2: str.isdigit() alone accepts "²")."""
    return port.isascii() and port.isdigit() and 0 < int(port) < 65536


def _clean_piece(s):
    s = s.strip()
    if not s or _BAD_CHAR.search(s):  # spaces, control characters, U+FEFF, backslash (QA-W3)
        return None
    at, slash = s.find('@'), s.find('/')
    if at >= 0 and (slash < 0 or at < slash):  # an e-mail address
        return None
    low = s.lower()
    if low.startswith(('http://', 'https://')):
        url = s
    elif low.startswith('//') or _OTHER_SCHEME.match(s):
        return None
    else:
        url = 'https://' + s
    if len(url) > MAX_LEN:
        return None
    rest = url.split('://', 1)[1]
    netloc = re.split(r'[/?#]', rest, maxsplit=1)[0]
    if '@' in netloc:  # user name or password part
        return None
    host, sep, port = netloc.partition(':')
    if sep and not port_ok(port):
        return None
    if not host_ok(host):
        return None
    return url


def clean_website(tags):
    """WR1: first usable website from the OpenStreetMap tags, or None."""
    for k in TAGS:
        for piece in str(tags.get(k) or '').split(';'):
            url = _clean_piece(piece)
            if url:
                return url
    return None


def web_counts(rows):
    """WR9: listings with a website, Canada and Québec (market ids starting with 24)."""
    w = [r for r in rows if r.get('web')]
    return {'canada': len(w), 'quebec': sum(str(r.get('market_id', '')).startswith('24') for r in w)}


def enough_listings(new_count, old_count, minimum=3000, share=0.75):
    """Design 2.4: refuse a download with fewer than 3,000 listings or under 75 % of the current file."""
    return new_count >= minimum and new_count >= share * old_count
