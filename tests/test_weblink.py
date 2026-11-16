"""Clinic website rules in the listings refresh (iteration 2, increment 1).

Run with: python3 -m unittest discover -s tests -p 'test_*.py'
The refresh tests at the bottom need shapely (use .venv/bin/python) and are skipped without it.
Fake clinics, fake websites and made-up listings only.
"""
import importlib.util, json, os, shutil, subprocess, sys, tempfile, unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'pipeline', 'work'))
from weblink import clean_website, web_counts, enough_listings  # noqa: E402


class CleanWebsite(unittest.TestCase):
    """WR1, examples from functional spec 2.2 (AC-13.1, AC-13.2, AC-13.4)."""

    def check(self, tags, want):
        self.assertEqual(clean_website(tags), want, tags)

    def test_spec_examples(self):
        self.check({'website': 'https://www.cliniquexyz.ca/fr/accueil'}, 'https://www.cliniquexyz.ca/fr/accueil')
        self.check({'website': 'www.cliniquexyz.ca'}, 'https://www.cliniquexyz.ca')
        self.check({'website': 'cliniquexyz.ca;https://facebook.com/xyz'}, 'https://cliniquexyz.ca')
        self.check({'website': 'mailto:info@xyz.ca', 'contact:website': 'xyz.ca'}, 'https://xyz.ca')
        self.check({'website': 'javascript:alert(1)'}, None)
        self.check({'url': 'info@xyz.ca'}, None)
        self.check({'website': 'Clinique XYZ'}, None)
        self.check({'website': 'https://good.ca@evil.com'}, None)
        self.check({'website': 'http://xyz.ca'}, 'http://xyz.ca')

    def test_tag_order(self):
        tags = {'url': 'https://third.ca', 'contact:website': 'https://second.ca', 'website': 'https://first.ca'}
        self.check(tags, 'https://first.ca')
        self.check({'url': 'https://third.ca', 'contact:website': 'https://second.ca'}, 'https://second.ca')
        self.check({'url': 'third.ca'}, 'https://third.ca')

    def test_first_valid_piece_wins(self):
        self.check({'website': 'tel:5555550100; ; https://macliniquefictive.ca'}, 'https://macliniquefictive.ca')
        self.check({'website': ' ;  '}, None)

    def test_trim_and_case(self):
        self.check({'website': '  HTTPS://WWW.CliniqueXYZ.ca/A  '}, 'HTTPS://WWW.CliniqueXYZ.ca/A')

    def test_other_schemes_refused(self):
        for v in ('javascript:void(0)', 'JavaScript:alert(1)', 'tel:+15555550100', 'ftp://xyz.ca',
                  '//xyz.ca', 'data:text/html,hi', 'mailto:info@xyz.ca'):
            self.check({'website': v}, None)

    def test_empty_and_missing(self):
        self.check({}, None)
        self.check({'website': ''}, None)
        self.check({'website': None}, None)

    def test_host_rules(self):
        self.check({'website': 'cliniquexyz'}, None)               # no dot
        self.check({'website': 'https://cliniquexyz/'}, None)
        self.check({'website': 'https://user:pass@xyz.ca/'}, None)  # user part
        self.check({'website': 'https://xyz.ca:8080/a'}, 'https://xyz.ca:8080/a')
        self.check({'website': 'xyz.ca:8080'}, 'https://xyz.ca:8080')
        self.check({'website': 'https://xyz.ca:abc/'}, None)
        self.check({'website': 'https://clinique-é.ca'}, None)      # accented host refused (design 2.8)
        self.check({'website': 'https://[::1]/'}, None)
        self.check({'website': 'https://good.ca\\@evil.com'}, None)  # backslash trick
        self.check({'website': 'https://xyz.ca/a@b'}, 'https://xyz.ca/a@b')  # @ in the path is fine

    def test_spaces_refused(self):
        self.check({'website': 'https://xyz.ca/a b'}, None)
        self.check({'website': 'https://xyz.ca/\tb'}, None)

    def test_length_limit(self):
        base = 'https://xyz.ca/'
        self.check({'website': base + 'a' * (500 - len(base))}, base + 'a' * (500 - len(base)))
        self.check({'website': base + 'a' * (501 - len(base))}, None)
        self.check({'website': 'xyz.ca/' + 'a' * 490}, None)        # 498 + "https://" is over 500

    def test_social_page_accepted(self):
        self.check({'website': 'https://m.facebook.com/fakeclinic'}, 'https://m.facebook.com/fakeclinic')


    def test_empty_host_parts_refused(self):
        """QA-W1: every dot-separated part of the host is a real label; one trailing dot may stay."""
        for v in ('https://.', 'https://..', 'https://-.-', 'https://a..ca', 'https://.ca', 'https://-xyz.ca',
                  'https://xyz-.ca', 'https://a.', 'xyz..ca'):
            self.check({'website': v}, None)
        self.check({'website': 'https://xyz.ca.'}, 'https://xyz.ca.')
        self.check({'website': 'https://ma-clinique.fictive.ca'}, 'https://ma-clinique.fictive.ca')

    def test_port_range_and_ascii(self):
        """QA-W2: port is ASCII digits, 1 to 65535."""
        for v in ('https://xyz.ca:\u00b2', 'https://xyz.ca:\u0663', 'https://xyz.ca:0', 'https://xyz.ca:65536',
                  'https://xyz.ca:99999', 'https://xyz.ca:', 'https://xyz.ca:-1'):
            self.check({'website': v}, None)
        self.check({'website': 'https://xyz.ca:65535/'}, 'https://xyz.ca:65535/')
        self.check({'website': 'https://xyz.ca:1'}, 'https://xyz.ca:1')

    def test_control_characters_refused(self):
        for v in ('https://xyz.ca/\x07bell', 'https://xyz.ca\x00', 'https://xyz.ca/\x7f'):
            self.check({'website': v}, None)

    def test_numeric_last_host_part(self):
        """QA-W3: same rule as the page: a host ending in a number is refused unless it is a plain IPv4 address."""
        for v in ('https://999.999.999.999', 'https://fictive.123', 'https://a.9', 'https://1.2.3', 'https://256.1.1.1',
                  'https://010.1.1.1', 'https://0x7f.1', 'https://a.0x7f'):
            self.check({'website': v}, None)
        for v in ('https://192.0.2.1/', 'https://0.0.0.0', 'https://123.fictive.ca'):
            self.check({'website': v}, v)

    def test_unicode_spaces_and_bom_refused(self):
        """QA-W3: U+0085, U+FEFF, U+00A0 and U+2028 refused inside a value, as in the page."""
        for v in ('https://xyz.ca/a\u0085b', 'https://xyz.ca/\ufeff', 'https://xyz.ca/a\u00a0b', 'https://xyz.ca/a\u2028b'):
            self.check({'website': v}, None)
        self.check({'website': 'https://xyz.ca/\u00e9'}, 'https://xyz.ca/\u00e9')


class Counts(unittest.TestCase):
    """WR9 (AC-14.2): counts for Canada and Québec (market ids starting with 24)."""

    def test_counts(self):
        rows = [dict(market_id='2466', web='https://a.ca'), dict(market_id='2423'),
                dict(market_id='3520', web='https://b.ca'), dict(market_id='2423', web='https://c.ca')]
        self.assertEqual(web_counts(rows), {'canada': 3, 'quebec': 2})
        self.assertEqual(web_counts([]), {'canada': 0, 'quebec': 0})


class ListingCheck(unittest.TestCase):
    """Design 2.4 (AC-14.3): at least 3,000 listings and at least 75 % of the current file."""

    def test_check(self):
        self.assertTrue(enough_listings(5714, 5714))
        self.assertTrue(enough_listings(4286, 5714))   # 75.01 %
        self.assertFalse(enough_listings(4285, 5714))  # 74.99 %
        self.assertFalse(enough_listings(2999, 1000))
        self.assertTrue(enough_listings(3000, 0))


def write(path, text):
    with open(path, 'w') as f:
        f.write(text)


def read(path):
    with open(path) as f:
        return f.read()


HAS_SHAPELY = importlib.util.find_spec('shapely') is not None
# Points inside Canadian municipalities (Montréal, Toronto, St. John's) used to place fake listings
SPOTS = [(45.55, -73.65), (43.70, -79.42), (51.04, -114.10)]  # Montréal, Toronto, Calgary


def fake_overpass(n, extra=()):
    els = []
    for i in range(n):
        la, lo = SPOTS[i % 3]
        j = i // 3  # small grid, about 3 km across, so every fake listing stays inside the town
        els.append(dict(type='node', id=i, lat=la + (j % 30) * 0.001, lon=lo + (j // 30) * 0.0003, tags={'name': f'Fake Dental {i}'}))
    return {'elements': els + list(extra)}


@unittest.skipUnless(HAS_SHAPELY, 'needs shapely: run with .venv/bin/python')
class RefreshDentists(unittest.TestCase):
    """refresh.py --dentists on a copy of the pipeline with a saved, fake Overpass answer."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='dm-web-')
        p = os.path.join(self.tmp, 'pipeline')
        os.makedirs(os.path.join(p, 'work'))
        os.makedirs(os.path.join(self.tmp, 'site', 'data'))
        shutil.copy(os.path.join(ROOT, 'pipeline', 'refresh.py'), p)
        for f in ('build_dentists.py', 'weblink.py'):
            shutil.copy(os.path.join(ROOT, 'pipeline', 'work', f), os.path.join(p, 'work'))
        os.symlink(os.path.join(ROOT, 'pipeline', 'geo'), os.path.join(p, 'geo'))
        self.data = os.path.join(self.tmp, 'site', 'data')
        self.last = os.path.join(p, 'last_release.txt')
        write(self.last, 'fake-release\n')
        write(os.path.join(self.data, 'meta.json'), '{"fake": true}')

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_refresh(self, overpass, old_count):
        write(os.path.join(self.data, 'dentists.json'), json.dumps([{'name': 'Old Fake', 'market_id': '2466'}] * old_count))
        saved = os.path.join(self.tmp, 'overpass.json')
        write(saved, json.dumps(overpass))
        r = subprocess.run([sys.executable, os.path.join(self.tmp, 'pipeline', 'refresh.py'), '--dentists', saved],
                           capture_output=True, text=True, timeout=300)
        rep = json.loads(read(os.path.join(self.tmp, 'pipeline', 'report.json')))
        return r, rep, json.loads(read(os.path.join(self.data, 'dentists.json')))

    def test_websites_duplicates_and_report(self):
        dup = [
            # kept listing has no website; its dropped duplicate (same name, about 10 m away) has one: WR3
            dict(type='node', id=90001, lat=45.6001, lon=-73.6001, tags={'name': 'Clinique Fictive Alpha'}),
            dict(type='node', id=90002, lat=45.6002, lon=-73.6002, tags={'name': 'Clinique Fictive Alpha', 'contact:website': 'alphafictive.ca'}),
            # kept listing's own website wins over the duplicate's
            dict(type='way', id=90003, center=dict(lat=45.6101, lon=-73.6101), tags={'name': 'Clinique Fictive Beta', 'website': 'https://betafictive.ca'}),
            dict(type='node', id=90004, lat=45.6102, lon=-73.6102, tags={'name': 'Clinique Fictive Beta', 'website': 'https://other.ca'}),
            dict(type='node', id=90005, lat=43.7, lon=-79.4, tags={'name': 'Fake Toronto Smile', 'url': 'javascript:alert(1)'}),
            dict(type='node', id=90006, lat=43.71, lon=-79.41, tags={'name': 'Fake Toronto Teeth', 'website': 'www.fakettoronto.ca'}),
        ]
        r, rep, rows = self.run_refresh(fake_overpass(3000, dup), 3200)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(len(rows), 3004)
        by = {x['name']: x for x in rows}
        self.assertEqual(by['Clinique Fictive Alpha']['web'], 'https://alphafictive.ca')
        self.assertEqual(by['Clinique Fictive Beta']['web'], 'https://betafictive.ca')
        self.assertNotIn('web', by['Fake Toronto Smile'])
        self.assertEqual(by['Fake Toronto Teeth']['web'], 'https://www.fakettoronto.ca')
        self.assertNotIn('web', by['Fake Dental 0'])  # no empty field when there is no website
        self.assertEqual(set(by['Fake Dental 0']), {'name', 'address', 'lat', 'lon', 'city_id', 'market_id'})
        self.assertEqual(rep['dentists'], 3004)
        self.assertEqual(rep['dentists_web'], {'canada': 3, 'quebec': 2})
        self.assertEqual(rep['failed'], [])
        # listings only: meta.json and last_release.txt untouched
        self.assertEqual(read(os.path.join(self.data, 'meta.json')), '{"fake": true}')
        self.assertEqual(read(self.last), 'fake-release\n')

    def test_refused_under_75_percent(self):
        r, rep, rows = self.run_refresh(fake_overpass(3100), 5000)
        self.assertEqual(r.returncode, 1)
        self.assertEqual(len(rows), 5000)  # current file kept
        self.assertTrue(rep['failed'] and '3100' in rep['failed'][0])

    def test_refused_under_3000(self):
        r, rep, rows = self.run_refresh(fake_overpass(2500), 2600)
        self.assertEqual(r.returncode, 1)
        self.assertEqual(len(rows), 2600)
        self.assertIn('only 2500 dentists', rep['failed'][0])


if __name__ == '__main__':
    unittest.main()
