// -----------------------------------------------------------------------------
// A simulated network: the WFS of the BfS, answering with the real answers
// recorded in test/fixtures/api (15/11/2026, newest hour ending 10:00 UTC).
// Tests never touch the network.
//
// The measurements follow the clock: at `now`, the newest published hour ends
// 90 minutes before (rounded down to the hour), as on the real service, and
// the recorded series is moved by as many hours. The server parses the CQL
// filters the client sends, as the real one does.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../fixtures/${path}`, import.meta.url), 'utf8');

/** API fixture by name (test/fixtures/api/<name>.json). */
export const apiFixture = (name) => JSON.parse(read(`api/${name}.json`));

const HOUR = 60 * 60_000;

/** Probe ids of the fixtures. */
export const MUENCHEN = '091620001'; // München-Neuhausen, in operation, checked
export const FELDBERG = '083150371'; // Feldberg (Black Forest), in operation, not checked yet
export const REPPENSTEDT = '033550351'; // defective
export const BERNKASTEL = '072310081'; // test operation, no value

/** Recorded end of the newest hour. */
export const RECORDED_END = Date.parse('2026-11-15T10:00:00Z');

/** The end of the newest hour published at `now`. */
export const publishedEnd = (now) => Math.floor((now - 90 * 60_000) / HOUR) * HOUR;

const SERIES = {
  [MUENCHEN]: 'timeseries-muenchen-neuhausen',
  [FELDBERG]: 'timeseries-feldberg',
};

const iso = (t) => new Date(t).toISOString().replace('.000Z', 'Z');

/** A history feature with another end and value. */
export function hour(template, end, value, validated = 1) {
  return {
    ...template,
    properties: {
      ...template.properties,
      start_measure: iso(end - HOUR),
      end_measure: iso(end),
      value,
      validated,
    },
  };
}

/** The recorded history of a probe, moved so its newest hour ends at publishedEnd(now). */
export function recordedHistory(id, now) {
  const delta = publishedEnd(now) - RECORDED_END;
  return apiFixture(SERIES[id]).features.map((f) =>
    hour(
      f,
      Date.parse(f.properties.end_measure) + delta,
      f.properties.value,
      f.properties.validated,
    ),
  );
}

/**
 * The newest-values feature of a probe, matching its history at `now` (or the
 * recorded one, defective and test probes).
 * @param {string} id
 * @param {Array} [history] the history the probe answers
 */
export function latestOf(id, history) {
  const feature = apiFixture('latest').features.find((f) => f.properties.kenn === id);
  const last = history?.at(-1);
  if (!last) {
    return feature;
  }
  return {
    ...feature,
    properties: {
      ...feature.properties,
      start_measure: last.properties.start_measure,
      end_measure: last.properties.end_measure,
      value: last.properties.value,
      validated: last.properties.validated,
    },
  };
}

/** The recorded probes, answering at `now`. */
export const freshProbes = () => ({
  [MUENCHEN]: (now) => recordedHistory(MUENCHEN, now),
  [FELDBERG]: (now) => recordedHistory(FELDBERG, now),
  [REPPENSTEDT]: () => [],
  [BERNKASTEL]: () => [],
});

/**
 * @param {object} [options]
 * @param {unknown} [options.stations] the probe list answer, an Error, or { status }
 * @param {Record<string, Function | Array>} [options.probes] probe id → its history
 *   (features, or (now) => features); its newest values follow
 * @param {unknown} [options.latest] an Error or { status } to fail the newest values
 * @param {() => number} [options.now]
 */
export function createNetwork({
  stations = apiFixture('stations'),
  probes = freshProbes(),
  latest = null,
  history = null,
  now = () => Date.now(),
} = {}) {
  const calls = [];
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  const collection = (features) => json({ type: 'FeatureCollection', features });
  const failure = (value) => {
    if (value instanceof Error) {
      throw value;
    }
    if (value && typeof value === 'object' && value.xml) {
      // GeoServer's errors: XML with HTTP 200.
      return new Response('<?xml version="1.0"?><ows:ExceptionReport/>', { status: 200 });
    }
    return value && typeof value === 'object' && value.status && !value.type
      ? new Response('error', { status: value.status })
      : null;
  };
  const historyOf = (id) => {
    const route = network.probes[id];
    if (route === undefined) {
      return null;
    }
    return typeof route === 'function' ? route(now()) : route;
  };

  async function fetch(url, options = {}) {
    const href = new URL(String(url));
    calls.push({ url: String(url), headers: options.headers ?? {} });
    if (href.origin + href.pathname !== 'https://www.imis.bfs.de/ogc/opendata/ows') {
      throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
    }
    const q = href.searchParams;
    if (q.get('service') !== 'WFS' || q.get('outputFormat') !== 'application/json') {
      return new Response('<xml/>', { status: 200 });
    }
    const filter = q.get('CQL_FILTER') ?? '';
    if (q.get('typeName') === 'opendata:odlinfo_odl_1h_latest' && q.get('propertyName')) {
      return failure(network.stations) ?? json(network.stations);
    }
    if (q.get('typeName') === 'opendata:odlinfo_odl_1h_latest') {
      const failed = failure(network.latest);
      if (failed) {
        return failed;
      }
      const ids = [...filter.matchAll(/'(\d{9})'/g)].map((m) => m[1]);
      assert(/^kenn IN \('\d{9}'(,'\d{9}')*\)$/.test(filter), filter);
      const features = ids
        .map((id) => {
          const h = historyOf(id);
          return h === null ? null : latestOf(id, h);
        })
        .filter(Boolean);
      return collection(features);
    }
    if (q.get('typeName') === 'opendata:odlinfo_timeseries_odl_1h') {
      const failed = failure(network.history);
      if (failed) {
        return failed;
      }
      const match = filter.match(/^kenn='(\d{9})' AND end_measure > '([^']+)'$/);
      assert(match, filter);
      const since = Date.parse(match[2]);
      const features = (historyOf(match[1]) ?? []).filter(
        (f) => Date.parse(f.properties.end_measure) > since,
      );
      return collection(features);
    }
    return new Response('<xml/>', { status: 200 });
  }

  const network = {
    fetch,
    calls,
    stations,
    probes,
    latest,
    history,
    typeOf: (call) => {
      const q = new URL(call.url).searchParams;
      if (q.get('propertyName')) {
        return 'list';
      }
      return q.get('typeName').endsWith('timeseries_odl_1h') ? 'history' : 'latest';
    },
    /** Calls of one kind: list, latest, history. */
    callsOf: (kind) => calls.filter((c) => network.typeOf(c) === kind),
  };
  return network;
}

function assert(condition, text) {
  if (!condition) {
    throw new Error(`Unexpected filter: ${text}`);
  }
}
