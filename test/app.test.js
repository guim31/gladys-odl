// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and the recorded
// answers of the BfS WFS (15/11/2026).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { START, createAll, createWorld, deviceId, featureId } from './helpers/world.js';
import {
  BERNKASTEL,
  FELDBERG,
  MUENCHEN,
  REPPENSTEDT,
  hour,
  publishedEnd,
  recordedHistory,
} from './helpers/network.js';
import { MemoryStore } from '../src/store.js';
import { PERIOD_MS } from '../src/poller.js';

const MIN = 60_000;
const HOUR = 60 * MIN;

/** The München answers as recorded at START, plus extra hours once published. */
function muenchenWith(extra) {
  return (now) => {
    const base = recordedHistory(MUENCHEN, START);
    const template = base.at(-1);
    return [
      ...base,
      ...extra
        .filter((e) => e.end <= publishedEnd(now))
        .map((e) => hour(template, e.end, e.v, e.validated ?? 1)),
    ];
  };
}

test('without configuration, the probe closest to the house is followed', async () => {
  const w = await createWorld();
  const devices = w.gladys.fake.discoveredDevices;
  assert.equal(devices.length, 1);
  assert.equal(devices[0].name, 'München-Neuhausen (ODL)');
  assert.equal(devices[0].external_id, deviceId(w.gladys, MUENCHEN));
  assert.equal(devices[0].should_poll, false);
  assert.deepEqual(devices[0].params, [
    { name: 'probe_id', value: MUENCHEN },
    { name: 'probe_code', value: 'DEZ3476' },
    { name: 'postcode', value: '80637' },
  ]);
  assert.equal(devices[0].features[0].name, 'Débit de dose (µSv/h)');
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
  // Not added to Gladys yet: nothing read but the probe list.
  assert.deepEqual(
    w.network.calls.map((c) => w.network.typeOf(c)),
    ['list'],
  );
});

test('a probe added to Gladys gets its states at once, with its 24 hours of history', async () => {
  const w = await createWorld();
  await createAll(w);
  const state = (key) => w.gladys.fake.lastState(featureId(w.gladys, MUENCHEN, key));
  assert.equal(state('dose_rate'), 0.107);
  assert.equal(state('cosmic'), 0.049);
  assert.equal(state('terrestrial'), 0.057);
  assert.equal(state('status'), 'Mesure contrôlée');
  assert.match(String(state('measured_at')), /^15\/11 \d\d:00$/);
  assert.ok(w.gladys.fake.widgetRefreshes.includes('probe_dose'));
  assert.equal(w.network.callsOf('latest').length, 1);
  assert.equal(w.network.callsOf('history').length, 1, 'the first look fills the 24 hours');
  assert.equal(w.hub.records.get(MUENCHEN).measures.length, 24);
});

test('the container reads by itself every 20 minutes; the history only for a gap', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const w = await createWorld({ timers: true });
  await createAll(w);
  const tick = async () => {
    w.advance(PERIOD_MS);
    t.mock.timers.tick(PERIOD_MS);
    for (let i = 0; i < 4; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  await tick(); // 12:00: same hour published
  assert.equal(w.network.callsOf('latest').length, 2, 'read by the timer, no onPoll');
  await tick(); // 12:20
  await tick(); // 12:40: 11:00 published (the next hour of the series)
  assert.equal(w.network.callsOf('latest').length, 4);
  assert.equal(w.network.callsOf('history').length, 1, 'one new hour: no history request');
  const measures = w.hub.records.get(MUENCHEN).measures;
  assert.equal(measures.at(-1).t, Date.parse('2026-11-15T11:00:00Z'));
  assert.equal(measures.length, 24, 'the window stays 24 hours');
  w.app.stop();
});

test('a restart after hours asks the history only after the saved measurements', async () => {
  const store = new MemoryStore();
  const w = await createWorld({ store });
  await createAll(w);
  const saved = store.data.records[0].measures;
  assert.equal(saved.length, 24);

  const again = await createWorld({ store, devices: w.gladys.devices });
  again.advance(3 * HOUR);
  await again.app.poller.cycle();
  const call = again.network.callsOf('history')[0];
  assert.match(
    new URL(call.url).searchParams.get('CQL_FILTER'),
    new RegExp(`end_measure > '${new Date(saved.at(-1).t).toISOString().replace('.000', '')}'`),
  );
  assert.equal(again.network.callsOf('list').length, 0, 'the probe list is a day old at most');
});

test('probes typed by id, postcode and name; unknown ones are said in the status', async () => {
  const w = await createWorld({
    config: { stations: '083150371; 82467, munchen neuhausen, Nirgendwo, 99999' },
  });
  assert.deepEqual(
    w.hub.followed.map((s) => s.name),
    ['Feldberg', 'Garmisch-Partenkirchen', 'München-Neuhausen'],
    'a postcode gives its lowest probe in operation (not the Zugspitze)',
  );
  assert.equal(w.gladys.fake.connectionStatus.connected, false);
  assert.match(w.gladys.fake.connectionStatus.message.de, /Unbekannte Sonden: Nirgendwo, 99999/);
});

test('no probe typed and no located house: the status says how to fix it', async () => {
  const w = await createWorld({ houses: [] });
  assert.equal(w.gladys.fake.discoveredDevices.length, 0);
  assert.match(w.gladys.fake.connectionStatus.message.en, /Settings → Houses/);
});

test('the BfS down at the first start: the status says it, and the next cycle recovers', async () => {
  const w = await createWorld({ network: { stations: { status: 503 } } });
  assert.equal(w.gladys.fake.connectionStatus.connected, false);
  assert.match(w.gladys.fake.connectionStatus.message.fr, /Le BfS ne répond pas/);
  w.network.stations = (await import('./helpers/network.js')).apiFixture('stations');
  w.advance(PERIOD_MS);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
  assert.equal(w.gladys.fake.discoveredDevices.length, 1);
});

test('the newest values unreachable: the status says it; the history failing alone does not hide them', async () => {
  const w = await createWorld({ network: { history: { status: 500 } } });
  await createAll(w);
  assert.equal(w.gladys.fake.lastState(featureId(w.gladys, MUENCHEN, 'dose_rate')), 0.107);
  assert.equal(w.hub.records.get(MUENCHEN).measures.length, 1);
  w.network.latest = new TypeError('fetch failed');
  w.advance(PERIOD_MS);
  await w.app.poller.cycle();
  assert.match(w.gladys.fake.connectionStatus.message.en, /The BfS does not answer/);
  w.network.latest = null;
  w.network.history = null;
  w.advance(PERIOD_MS);
  await w.app.poller.cycle();
  assert.deepEqual(w.gladys.fake.connectionStatus, { connected: true });
});

test('the states of a probe: not checked yet, defective, test operation', async () => {
  const ids = `${FELDBERG}, ${REPPENSTEDT}, ${BERNKASTEL}`;
  const w = await createWorld({ config: { stations: ids, language: 'en' } });
  await createAll(w);
  const state = (id, key) => w.gladys.fake.lastState(featureId(w.gladys, id, key));
  assert.equal(state(FELDBERG, 'status'), 'Not checked yet');
  assert.equal(state(FELDBERG, 'dose_rate'), 0.181);
  assert.equal(state(REPPENSTEDT, 'status'), 'Probe out of order');
  assert.equal(state(REPPENSTEDT, 'dose_rate'), undefined);
  assert.equal(state(REPPENSTEDT, 'measured_at'), undefined);
  // In test operation without value: no recent measurement.
  assert.equal(state(BERNKASTEL, 'status'), 'No recent measurement');
  const before = w.network.callsOf('latest').length;
  w.advance(PERIOD_MS);
  await w.app.poller.cycle();
  assert.equal(w.network.callsOf('latest').length, before + 1, 'the three probes in one request');
});

test('a silent probe: the dose rate is not republished, the state says it', async () => {
  const w = await createWorld({ network: { probes: { [MUENCHEN]: muenchenWith([]) } } });
  await createAll(w);
  w.advance(5 * HOUR);
  await w.app.poller.cycle();
  const status = featureId(w.gladys, MUENCHEN, 'status');
  assert.equal(w.gladys.fake.lastState(status), 'Pas de mesure récente');
  const scene = await w.gladys.fake.sceneAction('get_dose_rate', {
    station: deviceId(w.gladys, MUENCHEN),
  });
  assert.equal(scene.data.outputs?.dose_rate ?? scene.data.dose_rate, undefined);
});

test('above the threshold: once when crossed, then back to normal', async () => {
  const at = (hours) => Date.parse('2026-11-15T10:00:00Z') + hours * HOUR;
  const extra = [
    { end: at(1), v: 0.32 }, // above 0.3
    { end: at(2), v: 0.35 }, // still above: nothing new
    { end: at(3), v: 0.29 }, // within the hysteresis: still above
    { end: at(4), v: 0.11 }, // back to normal
  ];
  const w = await createWorld({ network: { probes: { [MUENCHEN]: muenchenWith(extra) } } });
  await createAll(w);
  assert.deepEqual(w.gladys.fake.sceneEvents, [], 'no event on the first look');
  const events = () => w.gladys.fake.sceneEvents.map((e) => e.key);
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(events(), ['dose_above_threshold']);
  const event = w.gladys.fake.sceneEvents[0].data;
  assert.equal(event.device, deviceId(w.gladys, MUENCHEN));
  assert.equal(event.station_name, 'München-Neuhausen (ODL)');
  assert.equal(event.dose_rate, 0.32);
  assert.equal(event.threshold, 0.3);
  assert.equal(event.measured_at, new Date(at(1)).toISOString());
  for (let i = 0; i < 2; i += 1) {
    w.advance(HOUR);
    await w.app.poller.cycle();
  }
  assert.equal(events().length, 1, 'no event while it stays above');
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(events(), ['dose_above_threshold', 'dose_back_to_normal']);
});

test('the threshold comes from the configuration', async () => {
  const extra = [{ end: Date.parse('2026-11-15T11:00:00Z'), v: 0.25 }];
  const w = await createWorld({
    config: { threshold: '0.2' },
    network: { probes: { [MUENCHEN]: muenchenWith(extra) } },
  });
  await createAll(w);
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.deepEqual(
    w.gladys.fake.sceneEvents.map((e) => [e.key, e.data.threshold]),
    [['dose_above_threshold', 0.2]],
  );
});

test('the widget: tiles, 24 h curve, time, state and threshold; each optional block can be hidden', async () => {
  const w = await createWorld();
  const empty = await w.gladys.fake.widgetGet('probe_dose', { language: 'en' });
  assert.match(empty.data.content.components[0].text, /Add an ODL probe/);
  await createAll(w);
  const ack = await w.gladys.fake.widgetGet('probe_dose', { language: 'fr', settings: {} });
  const { content } = ack.data;
  assert.doesNotThrow(() => validateWidgetContent(content));
  assert.deepEqual(
    content.components.map((c) => c.type),
    ['text', 'value', 'value', 'value', 'chart', 'status'],
  );
  assert.equal(content.components[1].value, 0.107);
  assert.equal(content.components[1].unit, 'µSv/h');
  assert.equal(content.components[4].series[0].points.length, 24);
  const items = content.components[5].items.map((i) => i.value);
  assert.deepEqual(items.slice(1), ['Mesure contrôlée', '0,300 µSv/h', 'BfS — ODL']);

  const bare = await w.gladys.fake.widgetGet('probe_dose', {
    language: 'de',
    settings: { station: deviceId(w.gladys, MUENCHEN), show_chart: false, show_status: false },
  });
  assert.deepEqual(
    bare.data.content.components.map((c) => c.type),
    ['text', 'value', 'value', 'value'],
  );
  assert.equal(bare.data.content.components[2].label, 'Kosmisch');
});

test('the widget of a defective probe stays valid', async () => {
  const w = await createWorld({ config: { stations: REPPENSTEDT } });
  await createAll(w);
  const ack = await w.gladys.fake.widgetGet('probe_dose', { language: 'es', settings: {} });
  assert.doesNotThrow(() => validateWidgetContent(ack.data.content));
  const status = ack.data.content.components.at(-1).items.map((i) => i.value);
  assert.equal(status[0], 'Sonda fuera de servicio');
});

test('the scene action gives the last measurement and a sentence', async () => {
  const w = await createWorld();
  await createAll(w);
  const ack = await w.gladys.fake.sceneAction('get_dose_rate', {
    station: deviceId(w.gladys, MUENCHEN),
  });
  assert.equal(ack.success, true, ack.error);
  const out = ack.data.outputs ?? ack.data;
  assert.equal(out.dose_rate, 0.107);
  assert.equal(out.cosmic, 0.049);
  assert.equal(out.terrestrial, 0.057);
  assert.equal(out.status, 'checked');
  assert.equal(out.measured_at, '2026-11-15T10:00:00.000Z');
  assert.match(
    out.summary,
    /^München-Neuhausen \(ODL\) : 0,107 µSv\/h \(15\/11 \d\d:00\), cosmique 0,049, terrestre 0,057\. Mesure contrôlée\.$/,
  );
  const unknown = await w.gladys.fake.sceneAction('get_dose_rate', { station: 'nope' });
  assert.equal(unknown.success, false);
});

test('the nearby search lists the closest probes with their id', async () => {
  const w = await createWorld();
  const ack = await w.gladys.fake.action('find_nearby', {});
  assert.equal(ack.success, true, ack.error);
  const message = ack.data.message ?? ack.data;
  assert.match(message.fr, /Sondes les plus proches de Maison/);
  assert.match(message.fr, /• 091620001 — München-Neuhausen \(80637\), 0,5 km/);
  assert.doesNotMatch(message.fr, /Reppenstedt/);
  const none = await createWorld({ houses: [] });
  const failed = await none.gladys.fake.action('find_nearby', {});
  assert.equal(failed.success, false);
  assert.match(failed.error, /Settings → Houses/);
});

test('the search by postcode or name', async () => {
  const w = await createWorld();
  const run = async (query) => {
    const ack = await w.gladys.fake.action('search', { query });
    return ack.success ? (ack.data.message ?? ack.data) : ack;
  };
  const plz = await run('824');
  assert.match(plz.en, /091801171 — Garmisch-Partenkirchen \(82467\)/);
  assert.match(plz.en, /Zugspitzgipfel/);
  const name = await run('münchen');
  assert.equal((name.de.match(/^• /gm) ?? []).length, 5, '4 in München, and Garching b. München');
  const defective = await run('Reppenstedt');
  assert.match(defective.fr, /033550351 — Reppenstedt OT Südergellersen \(21391\) ✕/);
  const many = await run('8');
  assert.match(many.fr, /… \+\d+/);
  assert.match((await run('Atlantis')).fr, /Aucune sonde ne correspond à « Atlantis »/);
  const empty = await w.gladys.fake.action('search', {});
  assert.equal(empty.success, false);
});

test('a measurement checked afterwards is updated', async () => {
  const end = Date.parse('2026-11-15T11:00:00Z');
  const validated = { value: 2 };
  const w = await createWorld({
    network: {
      probes: {
        [MUENCHEN]: (now) => muenchenWith([{ end, v: 0.11, validated: validated.value }])(now),
      },
    },
  });
  await createAll(w);
  const status = featureId(w.gladys, MUENCHEN, 'status');
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.lastState(status), 'Pas encore contrôlée');
  validated.value = 1;
  w.advance(PERIOD_MS);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.lastState(status), 'Mesure contrôlée');
});

test('a device deleted then added again: a first look, no stale event', async () => {
  const extra = [
    { end: Date.parse('2026-11-15T11:00:00Z'), v: 0.4 },
    { end: Date.parse('2026-11-15T12:00:00Z'), v: 0.1 },
  ];
  const w = await createWorld({ network: { probes: { [MUENCHEN]: muenchenWith(extra) } } });
  await createAll(w);
  w.advance(HOUR);
  await w.app.poller.cycle();
  assert.equal(w.gladys.fake.sceneEvents.length, 1);
  const device = w.gladys.devices[0];
  await w.gladys.fake.deviceDeleted(device);
  w.advance(HOUR);
  await w.app.poller.cycle();
  await w.gladys.fake.deviceCreated(w.gladys.fake.discoveredDevices[0]);
  assert.equal(w.gladys.fake.sceneEvents.length, 1, 'no "back to normal" for a probe re-added');
});
