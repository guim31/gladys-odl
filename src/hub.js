// -----------------------------------------------------------------------------
// The probes the integration follows, what it knows about them, and what it
// publishes to Gladys.
//
// The probe list of the network (~1 700 probes: names, postcodes, positions)
// is read once a day and kept under /data: it resolves the configured probes
// (ids, names or postcodes) and finds the one closest to the house. Each
// followed probe has a "record": its last 24 hours of 1-hour measurements and
// its newest site status and cosmic / terrestrial parts, also kept under
// /data, so a restart asks only for what is new.
//
// One read: the newest values of every followed probe in one request (latest
// layer); the history layer only for a probe whose record has a gap (first
// read, a restart after hours, a missed hour).
//
// Threshold triggers: "Dose rate above the threshold" fires once when the
// configured threshold is crossed, "Dose rate back to normal" once when the
// dose rate falls back below it (src/dose.js). Only for a probe in operation
// and added to Gladys, never on the first look at a probe (a level already
// high when the probe is added is no news to fire on).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { distanceKm, fetchLatest, fetchMeasures, fetchStations } from './api.js';
import { buildDevice, deviceName, idsOf } from './devices.js';
import { DAY_MS, SITE, STATUS, isAbove, isFresh, latest, merge, stationStatus } from './dose.js';
import { STATUS_TEXT, formatTime } from './i18n.js';
import { MAX_STATIONS } from './config.js';
import { createIssueLog } from './issues.js';

const logger = createLogger({ name: 'probes' });

/** The probe list is read again after this long. */
export const STATIONS_MAX_AGE_MS = DAY_MS;

/** One hour: the step of the measurements. */
const HOUR_MS = 60 * 60 * 1000;

/** A measurement dated further in the future is dropped (a wrong clock would freeze the probe). */
const FUTURE_MS = 15 * 60_000;

/** An unchanged value is published again this often (Gladys: "no recent value" past 48 h). */
export const STATE_HEARTBEAT_MS = 6 * 60 * 60 * 1000;

/** Keys of the scene triggers. */
export const TRIGGER = {
  ABOVE: 'dose_above_threshold',
  BACK: 'dose_back_to_normal',
};

const STORE_VERSION = 1;

/** "München-Neuhausen" and "munchen neuhausen" alike. */
export const normalize = (text) =>
  String(text)
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[\s_.\-/]+/g, ' ')
    .trim();

/** Probes in operation first, then by name. */
const byUsefulness = (a, b) =>
  Number(a.siteStatus !== SITE.OPERATION) - Number(b.siteStatus !== SITE.OPERATION) ||
  a.name.localeCompare(b.name);

export class Hub {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {() => object} options.getConfig the current normalized config
   * @param {{ load: Function, save: Function }} options.store
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   */
  constructor({ gladys, getConfig, store, fetch, now = () => Date.now() }) {
    this.gladys = gladys;
    this.getConfig = getConfig;
    this.store = store;
    this.deps = { fetch };
    this.now = now;
    /** The network: { list, fetchedAt }. */
    this.network = { list: [], fetchedAt: 0 };
    /** Record by probe id. */
    this.records = new Map();
    /** The followed probes, resolved from the config. */
    this.followed = [];
    /** Typed probes that match none. */
    this.unknown = [];
    /** True when the config is empty and no house has a location. */
    this.noHouse = false;
    /** Outcome of the last read of each probe: { ok, at }. */
    this.lastResults = new Map();
    /** Scene events waiting for the publication of their probe's states. */
    this.pendingEvents = new Map();
    this.widgetChanged = false;
    this.persistNeeded = false;
    this.issues = createIssueLog(logger);
  }

  async load() {
    const data = await this.store.load();
    if (data.version !== STORE_VERSION) {
      return;
    }
    if (Array.isArray(data.network?.list)) {
      const list = data.network.list.filter(
        (s) => s && typeof s.id === 'string' && typeof s.name === 'string',
      );
      this.network = { list, fetchedAt: Number(data.network.fetchedAt) || 0 };
    }
    for (const record of data.records ?? []) {
      if (record && typeof record.id === 'string' && Array.isArray(record.measures)) {
        this.records.set(record.id, record);
      }
    }
  }

  persist() {
    return this.store.save({
      version: STORE_VERSION,
      network: this.network,
      records: [...this.records.values()],
    });
  }

  /** Persist if anything changed since the last save. */
  async save() {
    if (this.persistNeeded) {
      this.persistNeeded = false;
      await this.persist();
    }
  }

  /** Read the probe list when it is missing or a day old. Keeps the old one on failure. */
  async refreshNetwork({ force = false } = {}) {
    if (
      !force &&
      this.network.list.length > 0 &&
      this.now() - this.network.fetchedAt < STATIONS_MAX_AGE_MS
    ) {
      return;
    }
    try {
      const list = await fetchStations(this.deps);
      if (list.length > 0) {
        this.network = { list, fetchedAt: this.now() };
        this.persistNeeded = true;
      }
      this.issues.ok('network', 'ODL probe list read again');
    } catch (err) {
      this.issues.fail('network', `Cannot read the ODL probe list: ${err.message}`);
    }
  }

  /** The probes of the network sorted by distance to a point (defective ones left out). */
  nearest(point, count) {
    return this.network.list
      .filter((s) => s.latitude !== null && s.longitude !== null && s.siteStatus !== SITE.DEFECTIVE)
      .map((s) => ({ ...s, distanceKm: distanceKm(point, s) }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, count);
  }

  /**
   * The probes a search designates: a postcode (or its beginning), else a part
   * of the name. Probes in operation first.
   * @param {string} query
   */
  search(query) {
    const text = String(query ?? '').trim();
    if (text === '') {
      return [];
    }
    if (/^\d{1,5}$/.test(text)) {
      return this.network.list.filter((s) => s.plz.startsWith(text)).sort(byUsefulness);
    }
    const wanted = normalize(text);
    return this.network.list.filter((s) => normalize(s.name).includes(wanted)).sort(byUsefulness);
  }

  /** The probe a typed token designates: its id, its code, its postcode or its name. */
  find(token) {
    const list = this.network.list;
    if (/^\d{9}$/.test(token)) {
      return list.find((s) => s.id === token) ?? null;
    }
    if (/^DEZ\d+$/i.test(token)) {
      return list.find((s) => s.code.toUpperCase() === token.toUpperCase()) ?? null;
    }
    if (/^\d{5}$/.test(token)) {
      // A postcode can hold several probes (Garmisch: valley and Zugspitze):
      // the lowest in operation, where the houses are.
      return (
        list
          .filter((s) => s.plz === token)
          .sort(
            (a, b) =>
              Number(a.siteStatus !== SITE.OPERATION) - Number(b.siteStatus !== SITE.OPERATION) ||
              (a.height ?? 0) - (b.height ?? 0),
          )[0] ?? null
      );
    }
    const wanted = normalize(token);
    const exact = list.filter((s) => normalize(s.name) === wanted).sort(byUsefulness);
    if (exact.length > 0) {
      return exact[0];
    }
    const partial = list.filter((s) => normalize(s.name).startsWith(wanted));
    return partial.length === 1 ? partial[0] : null;
  }

  /**
   * Resolve the followed probes from the config (or the house location).
   * @param {Array<{ latitude: number|null, longitude: number|null }>} houses
   */
  resolve(houses, config = this.getConfig()) {
    const followed = [];
    const unknown = [];
    this.noHouse = false;
    if (config.stations.length === 0) {
      const house = houses.find(
        (h) => typeof h.latitude === 'number' && typeof h.longitude === 'number',
      );
      if (house) {
        followed.push(...this.nearest(house, 1).map(({ distanceKm: _, ...station }) => station));
      } else {
        this.noHouse = true;
      }
    } else {
      for (const token of config.stations) {
        const station = this.find(token);
        if (!station) {
          unknown.push(token);
        } else if (!followed.some((s) => s.id === station.id) && followed.length < MAX_STATIONS) {
          followed.push(station);
        }
      }
    }
    this.followed = followed;
    this.unknown = unknown;
    for (const station of followed) {
      const record = this.records.get(station.id);
      if (record) {
        // Names and positions from the list; the site status of the last read stays.
        const { siteStatus: _, ...identity } = station;
        Object.assign(record, identity);
      }
    }
    return followed;
  }

  /** The record of a followed probe, created on first use. */
  recordOf(station) {
    let record = this.records.get(station.id);
    if (!record) {
      record = {
        ...station,
        measures: [],
        cosmic: null,
        terrestrial: null,
        above: null,
        status: null,
      };
      this.records.set(station.id, record);
    }
    return record;
  }

  /** The followed probe behind a device external id. */
  stationByDevice(externalId) {
    return this.followed.find((s) => idsOf(this.gladys, s).device === externalId) ?? null;
  }

  /** The discovery payload. */
  buildDevices(config = this.getConfig()) {
    return this.followed.map((station) => buildDevice(this.gladys, station, config.language));
  }

  /** The device of a probe in Gladys, if the user added it. */
  createdDevice(station) {
    const external = idsOf(this.gladys, station).device;
    return (this.gladys.devices ?? []).find((device) => device.external_id === external);
  }

  isCreated(station) {
    return Boolean(this.createdDevice(station));
  }

  /** The name the user gave the device in Gladys, else ours. */
  nameOf(station) {
    return this.createdDevice(station)?.name || deviceName(station);
  }

  /** True when every followed probe failed its last read. */
  apiDown() {
    const results = this.followed.map((s) => this.lastResults.get(s.id)).filter(Boolean);
    return results.length > 0 && results.every((r) => !r.ok);
  }

  /**
   * Read the newest values of some probes (one request), fill the gaps from
   * the history layer, and publish what changed. Throws the read error of the
   * newest values (the poller logs it).
   * @param {object[]} stations
   */
  async refresh(stations) {
    if (stations.length === 0) {
      return;
    }
    let latestById;
    try {
      const answers = await fetchLatest(
        stations.map((s) => s.id),
        this.deps,
      );
      latestById = new Map(answers.map((a) => [a.id, a]));
      this.issues.ok('latest', 'The BfS answers again');
    } catch (err) {
      this.issues.fail('latest', `Cannot read the ODL probes: ${err.message}`);
      for (const station of stations) {
        this.lastResults.set(station.id, { ok: false, at: this.now() });
      }
      throw err;
    }
    for (const station of stations) {
      await this.update(station, latestById.get(station.id) ?? null);
    }
  }

  /** One probe after a read of the newest values: merge, events, states. */
  async update(station, answer) {
    const record = this.recordOf(station);
    const now = this.now();
    this.lastResults.set(station.id, { ok: Boolean(answer), at: now });
    if (!answer) {
      // Gone from the network (dismantled): said once.
      this.issues.fail(`missing:${station.id}`, `${deviceName(station)}: not in the network`);
    } else {
      this.issues.ok(`missing:${station.id}`, `${deviceName(station)}: back in the network`);
      if (answer.siteStatus !== record.siteStatus) {
        record.siteStatus = answer.siteStatus;
        this.persistNeeded = true;
      }
      const incoming = [];
      const newest = latest(record);
      const measure = answer.measure && answer.measure.t <= now + FUTURE_MS ? answer.measure : null;
      if (measure && (!newest || measure.t - newest.t > HOUR_MS)) {
        // A gap: the hours in between come from the history layer.
        // One hour more than the window: the chart then holds 24 values.
        const since = Math.max(newest ? newest.t : 0, now - DAY_MS - HOUR_MS);
        try {
          const history = await fetchMeasures(station.id, since, this.deps);
          incoming.push(...history.filter((m) => m.t <= now + FUTURE_MS));
          this.issues.ok(`history:${station.id}`, `${deviceName(station)}: history read again`);
        } catch (err) {
          // The newest value alone is still worth publishing.
          this.issues.fail(`history:${station.id}`, `${deviceName(station)}: ${err.message}`);
        }
      }
      if (measure) {
        incoming.push(measure);
        if (record.cosmic !== answer.cosmic || record.terrestrial !== answer.terrestrial) {
          record.cosmic = answer.cosmic;
          record.terrestrial = answer.terrestrial;
          this.persistNeeded = true;
        }
      }
      const { measures, added, changed } = merge(record.measures, incoming);
      record.measures = measures;
      if (added > 0 || changed > 0) {
        this.persistNeeded = true;
        this.widgetChanged = true;
      }
    }
    const status = stationStatus(record, now);
    if (status !== record.status) {
      this.widgetChanged = true;
      this.persistNeeded = true;
      // The first look at a probe already silent is said too: once.
      if (status === STATUS.NO_RECENT || status === STATUS.DEFECTIVE) {
        this.issues.fail(`silent:${station.id}`, `${deviceName(station)}: ${status}`);
      } else {
        this.issues.ok(`silent:${station.id}`, `${deviceName(station)}: measurements again`);
      }
      record.status = status;
    }
    this.watchThreshold(record);
    try {
      await this.publishStates(station);
      this.issues.ok('gladys', 'Gladys accepts the states again');
    } catch (err) {
      this.issues.fail('gladys', `Cannot publish to Gladys: ${err.message}`);
    }
    return record;
  }

  /** Queue the threshold events of a record. */
  watchThreshold(record) {
    if (!this.isCreated(record)) {
      // Not followed in Gladys: forgotten, so its first read once added is a first look.
      if (record.above !== null) {
        record.above = null;
        this.persistNeeded = true;
      }
      return;
    }
    const threshold = this.getConfig().threshold;
    const previous = record.above;
    const above = isAbove(record, this.now(), threshold, previous);
    if (above === null || above === previous) {
      return;
    }
    record.above = above;
    this.persistNeeded = true;
    if (previous === null || previous === undefined) {
      return;
    }
    const last = latest(record);
    const common = {
      device: idsOf(this.gladys, record).device,
      station_name: this.nameOf(record),
      dose_rate: last.v,
    };
    const event = above
      ? {
          key: TRIGGER.ABOVE,
          data: { ...common, threshold, measured_at: new Date(last.t).toISOString() },
        }
      : { key: TRIGGER.BACK, data: common };
    this.pendingEvents.set(record.id, [...(this.pendingEvents.get(record.id) ?? []), event]);
  }

  /**
   * Publish the states of a probe whose device exists in Gladys. Only the
   * changes go out (the SDK deduplicates), plus a heartbeat. Then its scene
   * events.
   * @param {object} station
   * @param {{ force?: boolean }} [options] force: the device was just added
   */
  async publishStates(station, { force = false } = {}) {
    const record = this.records.get(station.id);
    if (!record || !this.isCreated(station)) {
      this.pendingEvents.delete(station.id);
      return;
    }
    const ids = idsOf(this.gladys, station);
    if (force) {
      this.gladys.forgetPublishedStates(ids.device);
    }
    const language = this.getConfig().language;
    const now = this.now();
    const last = latest(record);
    const states = [];
    const number = (key, value) => {
      if (value !== null && value !== undefined) {
        states.push({ device_feature_external_id: ids.feature(key), state: value });
      }
    };
    // A stale dose rate is not published: a value Gladys shows as recent is a
    // recent measurement. The time and the state say how old it is.
    if (isFresh(record, now)) {
      number('dose_rate', last.v);
      number('cosmic', record.cosmic);
      number('terrestrial', record.terrestrial);
    }
    if (last) {
      states.push({
        device_feature_external_id: ids.feature('measured_at'),
        text: formatTime(last.t, language),
      });
    }
    states.push({
      device_feature_external_id: ids.feature('status'),
      text: STATUS_TEXT[stationStatus(record, now)][language],
    });
    await this.gladys.publishChangedStates(states, { heartbeat: STATE_HEARTBEAT_MS });

    // An event leaves the queue once Gladys took it: a failed publication is
    // tried again on the next read.
    const events = this.pendingEvents.get(station.id) ?? [];
    while (events.length > 0) {
      const event = events[0];
      await this.gladys.publishSceneEvent(event.key, event.data);
      events.shift();
      logger.info(
        event.key === TRIGGER.ABOVE
          ? `${deviceName(record)}: ${event.data.dose_rate} µSv/h, above ${event.data.threshold} µSv/h`
          : `${deviceName(record)}: back to normal (${event.data.dose_rate} µSv/h)`,
      );
    }
    this.pendingEvents.delete(station.id);
  }

  /** A device deleted from Gladys: its threshold state is forgotten (a first look once added again). */
  forgetDevice(externalId) {
    const station = this.stationByDevice(externalId);
    const record = station && this.records.get(station.id);
    if (record && record.above !== null) {
      record.above = null;
      this.persistNeeded = true;
    }
    if (station) {
      this.pendingEvents.delete(station.id);
    }
  }

  /** Forget the records of the probes no longer followed (never without a probe list). */
  prune() {
    if (this.network.list.length === 0) {
      return;
    }
    const kept = new Set(this.followed.map((s) => s.id));
    for (const id of this.records.keys()) {
      if (!kept.has(id)) {
        this.records.delete(id);
        this.persistNeeded = true;
      }
    }
  }
}
