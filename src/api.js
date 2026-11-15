// -----------------------------------------------------------------------------
// Client of the open WFS of the BfS (German Federal Office for Radiation
// Protection), no account, no key: https://www.imis.bfs.de/ogc/opendata/ows
//
// Two layers, read as GeoJSON (outputFormat=application/json):
//
//   opendata:odlinfo_odl_1h_latest
//       one feature per probe of the ODL network (~1 700): kenn (the 9-digit
//       probe id), id (DEZxxxx), plz (postcode), name, site_status (1 in
//       operation, 2 defective, 3 test operation), height_above_sea, and its
//       newest 1-hour measurement: end_measure, value, value_cosmic,
//       value_terrestrial (µSv/h), validated (1 checked, 2 not checked yet).
//       A defective probe carries null measurement fields.
//   opendata:odlinfo_timeseries_odl_1h
//       the 1-hour measurements of the last days (end_measure, value,
//       validated), filtered here by probe and date.
//
// Filters are CQL (`CQL_FILTER`). GeoServer answers its errors as an XML
// ExceptionReport with HTTP 200: "not JSON" is an error too.
//
// Load: the probe list (~470 kB with only the needed properties) once a day;
// every 20 minutes, one request for the newest values of the followed probes
// (a few kB), and a short history request only when a probe has a gap. Data
// © Bundesamt für Strahlenschutz, free of charge, source cited.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const WFS_URL = 'https://www.imis.bfs.de/ogc/opendata/ows';
const TIMEOUT_MS = 30_000;

export const LAYER = {
  LATEST: 'opendata:odlinfo_odl_1h_latest',
  TIMESERIES: 'opendata:odlinfo_timeseries_odl_1h',
};

/** Properties of the probe list (the daily read): no measurement. */
const LIST_PROPERTIES = 'kenn,id,plz,name,site_status,height_above_sea,geom';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** Identifies the integration to the operators. */
export const USER_AGENT = `gladys-odl/${version} (+https://github.com/guim31/gladys-odl)`;

/** An error of the API (status 0: network). */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** A probe id as the network writes it: 9 digits. */
export const isKenn = (value) => typeof value === 'string' && /^\d{9}$/.test(value);

/**
 * GET features of a layer.
 * @param {Record<string, string>} params typeName, CQL_FILTER, propertyName...
 * @param {{ fetch?: typeof fetch }} [deps]
 * @returns {Promise<any[]>} the features
 */
async function getFeatures(params, { fetch = globalThis.fetch } = {}) {
  const query = new URLSearchParams({
    service: 'WFS',
    version: '1.1.0',
    request: 'GetFeature',
    outputFormat: 'application/json',
    ...params,
  });
  let response;
  try {
    response = await fetch(`${WFS_URL}?${query}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err.name === 'TimeoutError' ? 'timeout' : (err.cause?.code ?? err.message);
    throw new ApiError(`BfS unreachable (${reason})`, 0);
  }
  if (!response.ok) {
    throw new ApiError(`BfS answered HTTP ${response.status}`, response.status);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    // GeoServer's ExceptionReport (a bad filter, an unknown layer) is XML.
    throw new ApiError('BfS answered something that is not JSON', response.status);
  }
  if (!body || !Array.isArray(body.features)) {
    throw new ApiError('BfS answered an unexpected document', response.status);
  }
  return body.features;
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * A probe of the network, or null when it lacks what the integration needs.
 * @param {any} feature
 */
export function parseStation(feature) {
  const p = feature?.properties ?? {};
  if (!isKenn(p.kenn) || typeof p.name !== 'string' || p.name.trim() === '') {
    return null;
  }
  const point = feature?.geometry?.coordinates;
  return {
    id: p.kenn,
    code: typeof p.id === 'string' ? p.id : '',
    name: p.name.trim(),
    plz: typeof p.plz === 'string' ? p.plz : '',
    latitude: finite(point?.[1]),
    longitude: finite(point?.[0]),
    height: finite(p.height_above_sea),
    siteStatus: Number.isInteger(p.site_status) ? p.site_status : null,
  };
}

/**
 * A 1-hour measurement, or null when it carries no dose rate.
 * @param {any} properties
 * @returns {{ t: number, v: number, checked: boolean } | null}
 */
export function parseMeasure(properties) {
  const t = Date.parse(properties?.end_measure ?? '');
  const v = finite(properties?.value);
  if (!Number.isFinite(t) || v === null || v < 0) {
    return null;
  }
  return { t, v, checked: properties.validated === 1 };
}

/**
 * The newest state of a probe (latest layer).
 * @param {any} feature
 * @returns {{ id: string, siteStatus: number|null, measure: object|null, cosmic: number|null, terrestrial: number|null } | null}
 */
export function parseLatest(feature) {
  const station = parseStation(feature);
  if (!station) {
    return null;
  }
  const p = feature.properties;
  const measure = parseMeasure(p);
  return {
    ...station,
    measure,
    cosmic: measure ? finite(p.value_cosmic) : null,
    terrestrial: measure ? finite(p.value_terrestrial) : null,
  };
}

/** Every probe of the network (positions, names, postcodes; no measurement). */
export async function fetchStations(deps) {
  const features = await getFeatures(
    { typeName: LAYER.LATEST, propertyName: LIST_PROPERTIES },
    deps,
  );
  return features.map(parseStation).filter(Boolean);
}

/**
 * The newest state of some probes, in one request.
 * @param {string[]} ids probe ids (kenn), validated: they go into the filter
 */
export async function fetchLatest(ids, deps) {
  const valid = ids.filter(isKenn);
  if (valid.length === 0) {
    return [];
  }
  const features = await getFeatures(
    {
      typeName: LAYER.LATEST,
      CQL_FILTER: `kenn IN (${valid.map((id) => `'${id}'`).join(',')})`,
    },
    deps,
  );
  return features.map(parseLatest).filter(Boolean);
}

/**
 * The measurements of one probe that end after a date, oldest first.
 * @param {string} id probe id (kenn)
 * @param {number} since epoch ms
 */
export async function fetchMeasures(id, since, deps) {
  if (!isKenn(id)) {
    return [];
  }
  const after = new Date(since).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const features = await getFeatures(
    {
      typeName: LAYER.TIMESERIES,
      CQL_FILTER: `kenn='${id}' AND end_measure > '${after}'`,
      sortBy: 'end_measure',
    },
    deps,
  );
  return features
    .map((f) => parseMeasure(f?.properties))
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);
}

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
