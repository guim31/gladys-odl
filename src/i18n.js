// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of Gladys (en, fr,
// de, es). German says "du", Spanish "usted" (Guilhem's choice for all his
// integrations). The names (BfS, ODL, the probe names) are not translated.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';
import { STATUS } from './dose.js';

/** Feature names (fixed when a device is added to Gladys). No µSv/h unit in Gladys: it is in the name. */
export const NAMES = {
  en: {
    dose_rate: 'Dose rate (µSv/h)',
    cosmic: 'Cosmic part (µSv/h)',
    terrestrial: 'Terrestrial part (µSv/h)',
    measured_at: 'Measurement time',
    status: 'Probe state',
  },
  fr: {
    dose_rate: 'Débit de dose (µSv/h)',
    cosmic: 'Part cosmique (µSv/h)',
    terrestrial: 'Part terrestre (µSv/h)',
    measured_at: 'Heure de la mesure',
    status: 'État de la sonde',
  },
  de: {
    dose_rate: 'Ortsdosisleistung (µSv/h)',
    cosmic: 'Kosmischer Anteil (µSv/h)',
    terrestrial: 'Terrestrischer Anteil (µSv/h)',
    measured_at: 'Messzeit',
    status: 'Zustand der Sonde',
  },
  es: {
    dose_rate: 'Tasa de dosis (µSv/h)',
    cosmic: 'Parte cósmica (µSv/h)',
    terrestrial: 'Parte terrestre (µSv/h)',
    measured_at: 'Hora de la medición',
    status: 'Estado de la sonda',
  },
};

/** The state of a probe, as a text feature and in the widget. */
export const STATUS_TEXT = {
  [STATUS.CHECKED]: {
    en: 'Measurement checked',
    fr: 'Mesure contrôlée',
    de: 'Messwert geprüft',
    es: 'Medición comprobada',
  },
  [STATUS.NOT_CHECKED]: {
    en: 'Not checked yet',
    fr: 'Pas encore contrôlée',
    de: 'Noch ungeprüft',
    es: 'Aún no comprobada',
  },
  [STATUS.TEST]: {
    en: 'Test operation',
    fr: 'Sonde en test',
    de: 'Testbetrieb',
    es: 'Sonda en pruebas',
  },
  [STATUS.DEFECTIVE]: {
    en: 'Probe out of order',
    fr: 'Sonde hors service',
    de: 'Sonde defekt',
    es: 'Sonda fuera de servicio',
  },
  [STATUS.NO_RECENT]: {
    en: 'No recent measurement',
    fr: 'Pas de mesure récente',
    de: 'Keine aktuelle Messung',
    es: 'Sin medición reciente',
  },
};

export const TEXT = {
  notConfigured: {
    en: 'No probe: set the location of a house (Settings → Houses) or type a probe in the configuration.',
    fr: 'Aucune sonde : renseignez la position d’une maison (Paramètres → Maisons) ou saisissez une sonde dans la configuration.',
    de: 'Keine Sonde: Lege den Standort eines Hauses fest (Einstellungen → Häuser) oder gib eine Sonde in der Konfiguration ein.',
    es: 'Ninguna sonda: indique la ubicación de una casa (Ajustes → Casas) o escriba una sonda en la configuración.',
  },
  apiUnreachable: {
    en: 'The BfS does not answer: the measurements are read again in 20 minutes.',
    fr: 'Le BfS ne répond pas : les mesures seront relues dans 20 minutes.',
    de: 'Das BfS antwortet nicht: Die Messwerte werden in 20 Minuten erneut gelesen.',
    es: 'La BfS no responde: las mediciones se volverán a leer dentro de 20 minutos.',
  },
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: 'L’initialisation a échoué, consultez les journaux de l’intégration.',
    de: 'Die Initialisierung ist fehlgeschlagen, sieh in den Protokollen der Integration nach.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  noHouse: {
    en: 'No house with a location: set it in Settings → Houses.',
    fr: 'Aucune maison située : renseignez sa position dans Paramètres → Maisons.',
    de: 'Kein Haus mit Standort: Lege ihn unter Einstellungen → Häuser fest.',
    es: 'Ninguna casa con ubicación: indíquela en Ajustes → Casas.',
  },
  emptyQuery: {
    en: 'Type a postcode or a part of a probe name.',
    fr: 'Saisissez un code postal ou une partie du nom d’une sonde.',
    de: 'Gib eine Postleitzahl oder einen Teil des Sondennamens ein.',
    es: 'Escriba un código postal o una parte del nombre de una sonda.',
  },
  noStation: {
    en: 'Add an ODL probe in Integrations → BfS ODL → Discovery.',
    fr: 'Ajoutez une sonde ODL dans Intégrations → BfS ODL → Découverte.',
    de: 'Füge eine ODL-Sonde unter Integrationen → BfS ODL → Erkennung hinzu.',
    es: 'Añada una sonda ODL en Integraciones → BfS ODL → Descubrimiento.',
  },
  unknownStation: {
    en: 'This probe is not followed any more.',
    fr: 'Cette sonde n’est plus suivie.',
    de: 'Diese Sonde wird nicht mehr verfolgt.',
    es: 'Esta sonda ya no se sigue.',
  },
  noReading: {
    en: 'No measurement read yet for this probe.',
    fr: 'Aucune mesure encore lue pour cette sonde.',
    de: 'Für diese Sonde wurde noch keine Messung gelesen.',
    es: 'Todavía no se ha leído ninguna medición de esta sonda.',
  },
  doseTile: { en: 'Dose rate', fr: 'Débit de dose', de: 'Dosisleistung', es: 'Tasa de dosis' },
  cosmicTile: { en: 'Cosmic', fr: 'Cosmique', de: 'Kosmisch', es: 'Cósmica' },
  terrestrialTile: { en: 'Terrestrial', fr: 'Terrestre', de: 'Terrestrisch', es: 'Terrestre' },
  chartTitle: {
    en: 'Last 24 hours',
    fr: '24 dernières heures',
    de: 'Letzte 24 Stunden',
    es: 'Últimas 24 horas',
  },
  measurement: { en: 'Measurement', fr: 'Mesure', de: 'Messung', es: 'Medición' },
  state: { en: 'State', fr: 'État', de: 'Zustand', es: 'Estado' },
  threshold: { en: 'Alert threshold', fr: 'Seuil d’alerte', de: 'Alarmschwelle', es: 'Umbral' },
  source: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Fuente' },
};

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

/** A time in the zone of Gladys (TZ), e.g. "15/11 11:00". */
export function formatTime(t, lang) {
  return new Intl.DateTimeFormat(LOCALES[lang] ?? LOCALES.en, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(t));
}

/** A number in the conventions of a language. */
export function formatNumber(value, lang, decimals = 0) {
  return new Intl.NumberFormat(LOCALES[lang] ?? LOCALES.en, {
    maximumFractionDigits: decimals,
  }).format(value);
}

/** A dose rate, 3 decimals as the BfS gives it: "0,107". */
export const formatDose = (value, lang) =>
  value === null || value === undefined
    ? '?'
    : new Intl.NumberFormat(LOCALES[lang] ?? LOCALES.en, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }).format(value);

const each = (build) => Object.fromEntries(LANGUAGES.map((lang) => [lang, build(lang)]));

/** One probe in a list: "091620001 — München-Neuhausen (80637)". */
const line = (s, extra = '') =>
  `• ${s.id} — ${s.name}${s.plz ? ` (${s.plz})` : ''}${extra}${s.defective ? ' ✕' : ''}`;

export const MESSAGES = {
  /** Some typed probes match none of the network. */
  unknownStations: (tokens) =>
    each((lang) => {
      const list = tokens.join(', ');
      return {
        en: `Unknown probes: ${list}. Use the "Search for probes" button.`,
        fr: `Sondes inconnues : ${list}. Utilisez le bouton « Chercher des sondes ».`,
        de: `Unbekannte Sonden: ${list}. Nutze den Button „Sonden suchen“.`,
        es: `Sondas desconocidas: ${list}. Use el botón «Buscar sondas».`,
      }[lang];
    }),

  /** Result of the nearby search. */
  nearby: ({ house, stations }) =>
    each((lang) => {
      const km = (value) => `${formatNumber(value, lang, value < 10 ? 1 : 0)} km`;
      const lines = stations.map((s) => line(s, `, ${km(s.distanceKm)}`));
      const head = {
        en: `Probes closest to ${house} (id — name):`,
        fr: `Sondes les plus proches de ${house} (identifiant — nom) :`,
        de: `Sonden am nächsten zu ${house} (Kennung — Name):`,
        es: `Sondas más cercanas a ${house} (identificador — nombre):`,
      }[lang];
      return [head, ...lines, TAIL[lang]].join('\n');
    }),

  /** Result of the search by postcode or name. */
  found: ({ query, stations, more }) =>
    each((lang) => {
      if (stations.length === 0) {
        return {
          en: `No probe matches "${query}".`,
          fr: `Aucune sonde ne correspond à « ${query} ».`,
          de: `Keine Sonde passt zu „${query}“.`,
          es: `Ninguna sonda corresponde a «${query}».`,
        }[lang];
      }
      const head = {
        en: `Probes matching "${query}" (id — name):`,
        fr: `Sondes correspondant à « ${query} » (identifiant — nom) :`,
        de: `Sonden zu „${query}“ (Kennung — Name):`,
        es: `Sondas que corresponden a «${query}» (identificador — nombre):`,
      }[lang];
      const rest = more > 0 ? [`… +${more}`] : [];
      return [head, ...stations.map((s) => line(s)), ...rest, TAIL[lang]].join('\n');
    }),

  /** Sentence of the scene action. */
  summary: ({ name, dose, cosmic, terrestrial, time, status }) =>
    each((lang) => {
      const d = (v) => formatDose(v, lang);
      const at = time === null ? '' : ` (${formatTime(time, lang)})`;
      const state = STATUS_TEXT[status][lang];
      const parts =
        cosmic === null || terrestrial === null
          ? ''
          : {
              en: `, cosmic ${d(cosmic)}, terrestrial ${d(terrestrial)}`,
              fr: `, cosmique ${d(cosmic)}, terrestre ${d(terrestrial)}`,
              de: `, kosmisch ${d(cosmic)}, terrestrisch ${d(terrestrial)}`,
              es: `, cósmica ${d(cosmic)}, terrestre ${d(terrestrial)}`,
            }[lang];
      return `${name}${lang === 'fr' ? ' :' : ':'} ${d(dose)} µSv/h${at}${parts}. ${state}.`;
    }),

  /** A thrown error: the core shows it as is, so every language is joined. */
  thrown: (text) => LANGUAGES.map((lang) => text[lang]).join(' / '),
};

const TAIL = {
  en: 'Type an id, a name or a postcode in "Probes", or leave it empty for the closest one. ✕: out of order.',
  fr: 'Saisissez un identifiant, un nom ou un code postal dans « Sondes », ou laissez vide pour la plus proche. ✕ : hors service.',
  de: 'Gib eine Kennung, einen Namen oder eine PLZ unter „Sonden“ ein, oder lass es leer für die nächste. ✕: defekt.',
  es: 'Escriba un identificador, un nombre o un código postal en «Sondas», o déjelo vacío para la más cercana. ✕: fuera de servicio.',
};
