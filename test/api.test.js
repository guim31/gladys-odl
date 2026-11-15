import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  USER_AGENT,
  distanceKm,
  fetchLatest,
  fetchMeasures,
  fetchStations,
  parseLatest,
  parseMeasure,
  parseStation,
} from '../src/api.js';
import {
  BERNKASTEL,
  FELDBERG,
  MUENCHEN,
  REPPENSTEDT,
  apiFixture,
  createNetwork,
} from './helpers/network.js';

const NOW = Date.parse('2026-11-15T11:40:00Z');
const network = (options) => createNetwork({ now: () => NOW, ...options });

test('a recorded probe list: id, code, name, postcode, position, site status', async () => {
  const n = network();
  const stations = await fetchStations({ fetch: n.fetch });
  assert.equal(stations.length, apiFixture('stations').features.length);
  assert.deepEqual(
    stations.find((s) => s.id === MUENCHEN),
    {
      id: MUENCHEN,
      code: 'DEZ3476',
      name: 'München-Neuhausen',
      plz: '80637',
      latitude: 48.16,
      longitude: 11.54,
      height: 515,
      siteStatus: 1,
    },
  );
  assert.equal(stations.find((s) => s.id === REPPENSTEDT).siteStatus, 2);
  assert.equal(stations.find((s) => s.id === BERNKASTEL).siteStatus, 3);
  const query = new URL(n.calls[0].url).searchParams;
  assert.equal(query.get('typeName'), 'opendata:odlinfo_odl_1h_latest');
  assert.match(query.get('propertyName'), /kenn/);
  assert.equal(n.calls[0].headers['User-Agent'], USER_AGENT);
  assert.equal(parseStation({ properties: { kenn: '12', name: 'X' } }), null);
  assert.equal(parseStation({ properties: { kenn: '123456789', name: 'X' } }).latitude, null);
});

test('the newest values of several probes in one request: in operation, defective, test', async () => {
  const n = network();
  const answers = await fetchLatest([MUENCHEN, FELDBERG, REPPENSTEDT, BERNKASTEL], {
    fetch: n.fetch,
  });
  assert.equal(n.calls.length, 1);
  assert.equal(
    new URL(n.calls[0].url).searchParams.get('CQL_FILTER'),
    `kenn IN ('${MUENCHEN}','${FELDBERG}','${REPPENSTEDT}','${BERNKASTEL}')`,
  );
  const by = Object.fromEntries(answers.map((a) => [a.id, a]));
  assert.deepEqual(by[MUENCHEN].measure, {
    t: Date.parse('2026-11-15T10:00:00Z'),
    v: 0.107,
    checked: true,
  });
  assert.equal(by[MUENCHEN].cosmic, 0.049);
  assert.equal(by[MUENCHEN].terrestrial, 0.057);
  assert.equal(by[FELDBERG].measure.checked, false, 'validated: 2, not checked yet');
  assert.equal(by[REPPENSTEDT].measure, null);
  assert.equal(by[REPPENSTEDT].siteStatus, 2);
  assert.equal(by[BERNKASTEL].measure, null);
  // No probe id, no request; an id that is not 9 digits never reaches the filter.
  assert.deepEqual(await fetchLatest(["1' OR '1'='1"], { fetch: n.fetch }), []);
  assert.equal(n.calls.length, 1);
});

test('the recorded measurements of a probe', () => {
  const feature = apiFixture('timeseries-feldberg').features.at(-1);
  assert.deepEqual(parseMeasure(feature.properties), {
    t: Date.parse('2026-11-15T10:00:00Z'),
    v: 0.181,
    checked: false,
  });
  assert.equal(parseMeasure({ end_measure: null, value: 0.1 }), null);
  assert.equal(parseMeasure({ end_measure: '2026-11-15T10:00:00Z', value: null }), null);
  const defective = apiFixture('latest').features.find((f) => f.properties.kenn === REPPENSTEDT);
  assert.equal(parseLatest(defective).cosmic, null);
});

test('the history is asked by probe and date, and sorted', async () => {
  const n = network();
  const since = Date.parse('2026-11-15T06:00:00Z');
  const measures = await fetchMeasures(MUENCHEN, since, { fetch: n.fetch });
  assert.equal(measures.length, 4, '07:00, 08:00, 09:00, 10:00');
  assert.ok(measures.every((x, i) => i === 0 || x.t > measures[i - 1].t));
  const query = new URL(n.calls[0].url).searchParams;
  assert.equal(query.get('typeName'), 'opendata:odlinfo_timeseries_odl_1h');
  assert.equal(
    query.get('CQL_FILTER'),
    `kenn='${MUENCHEN}' AND end_measure > '2026-11-15T06:00:00Z'`,
  );
});

test('errors: HTTP status, network, GeoServer XML exception, unexpected document', async () => {
  const failing = network({ stations: { status: 503 } });
  await assert.rejects(fetchStations({ fetch: failing.fetch }), /HTTP 503/);
  const offline = async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
  };
  await assert.rejects(fetchStations({ fetch: offline }), /unreachable \(ECONNREFUSED\)/);
  const xml = network({ latest: { xml: true } });
  await assert.rejects(fetchLatest([MUENCHEN], { fetch: xml.fetch }), /not JSON/);
  const odd = async () => new Response('{"data":[]}', { status: 200 });
  await assert.rejects(fetchStations({ fetch: odd }), /unexpected document/);
});

test('distances', () => {
  const muenchen = { latitude: 48.137, longitude: 11.575 };
  const berlin = { latitude: 52.52, longitude: 13.405 };
  assert.ok(Math.abs(distanceKm(muenchen, berlin) - 504) < 5);
});
