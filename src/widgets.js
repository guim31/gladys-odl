// -----------------------------------------------------------------------------
// The "ODL dose rate" dashboard widget (Gladys 5.1+).
//
// Three tiles (dose rate, cosmic and terrestrial parts, in µSv/h: the unit
// Gladys lacks for a device-bound tile), the curve of the last 24 hours, and
// the time and state of the measurement. Chart and state rows each have a
// setting to hide them.
//
// The content is built from what the integration already read: showing the
// widget never calls the API. The core caches it per (settings, language,
// units), so the texts are localized in the language it asks for; the hub
// asks for a refresh when a new measurement arrives.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';
import { STATUS, isFresh, latest, stationStatus } from './dose.js';
import { STATUS_TEXT, TEXT, formatDose, formatTime } from './i18n.js';

export const WIDGET_KEY = 'probe_dose';

/** Seconds the core keeps a content: the probes are read every 20 minutes. */
const TTL_SECONDS = 600;

const UNIT = 'µSv/h';

const STATUS_COLOR = {
  [STATUS.CHECKED]: WIDGET_COLORS.SUCCESS,
  [STATUS.NOT_CHECKED]: WIDGET_COLORS.WARNING,
  [STATUS.TEST]: WIDGET_COLORS.WARNING,
  [STATUS.DEFECTIVE]: WIDGET_COLORS.DANGER,
  [STATUS.NO_RECENT]: WIDGET_COLORS.NEUTRAL,
};

/** Settings are booleans, or strings from older forms. */
const shown = (value) => value !== false && value !== 'false';

const message = (text) => ({ ttl_seconds: TTL_SECONDS, components: [{ type: 'text', text }] });

/**
 * The widget content.
 * @param {object} options
 * @param {import('./hub.js').Hub} options.hub
 * @param {number} options.threshold the alert threshold, µSv/h
 * @param {{ station?: string, show_chart?: boolean, show_status?: boolean }} [options.settings]
 * @param {string} [options.language]
 */
export function buildStationContent({ hub, threshold, settings = {}, language = 'en' }) {
  const lang = LANGUAGES.includes(language) ? language : 'en';
  const created = hub.followed.filter((s) => hub.isCreated(s));
  const station = settings.station ? hub.stationByDevice(settings.station) : created[0];
  if (!station) {
    return message((settings.station ? TEXT.unknownStation : TEXT.noStation)[lang]);
  }
  const record = hub.records.get(station.id);
  const last = latest(record);
  if (!last && record?.status !== STATUS.DEFECTIVE) {
    return message(TEXT.noReading[lang]);
  }
  const now = hub.now();
  const fresh = isFresh(record, now);
  const status = stationStatus(record, now);
  const doseColor = !fresh
    ? WIDGET_COLORS.NEUTRAL
    : last.v >= threshold
      ? WIDGET_COLORS.DANGER
      : WIDGET_COLORS.PRIMARY;
  // The core shows a number as is: rounded to the 3 decimals of the BfS.
  const tile = (label, value, color) => ({
    type: 'value',
    label: label[lang],
    value: value === null ? '—' : Math.round(value * 1000) / 1000,
    unit: value === null ? undefined : UNIT,
    ...(color ? { color } : {}),
  });

  const components = [
    { type: 'text', variant: 'heading', text: hub.nameOf(station).slice(0, 40) },
    tile(TEXT.doseTile, fresh ? last.v : null, doseColor),
    tile(TEXT.cosmicTile, fresh ? record.cosmic : null),
    tile(TEXT.terrestrialTile, fresh ? record.terrestrial : null),
  ];
  if (shown(settings.show_chart) && record.measures.length > 1) {
    components.push({
      type: 'chart',
      chart_type: 'line',
      title: TEXT.chartTitle[lang],
      unit: UNIT,
      series: [
        {
          name: TEXT.doseTile[lang],
          points: record.measures.map((m) => ({ t: new Date(m.t).toISOString(), v: m.v })),
        },
      ],
    });
  }
  if (shown(settings.show_status)) {
    const items = [];
    if (last) {
      items.push({ label: TEXT.measurement[lang], value: formatTime(last.t, lang), icon: 'clock' });
    }
    items.push(
      { label: TEXT.state[lang], value: STATUS_TEXT[status][lang], color: STATUS_COLOR[status] },
      {
        label: TEXT.threshold[lang],
        value: `${formatDose(threshold, lang)} ${UNIT}`,
        icon: 'bell',
      },
      { label: TEXT.source[lang], value: 'BfS — ODL', icon: 'info' },
    );
    components.push({ type: 'status', items });
  }
  return { ttl_seconds: TTL_SECONDS, components };
}
