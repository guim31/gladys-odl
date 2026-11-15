# BfS ODL for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration that brings the **ambient gamma dose rate** of the
**ODL network** of the German Federal Office for Radiation Protection (Bundesamt für Strahlenschutz, BfS) into Gladys:
about 1,700 probes across Germany, one value per hour.

## What it does

- One device per followed probe: dose rate, cosmic and terrestrial parts (µSv/h), time of the measurement, and state
  of the probe (checked, not checked yet, test operation, out of order, no recent measurement).
- The probe closest to your house by default, or up to 5 probes typed by id, name or postcode; two buttons list the
  probes near a house or those of a postcode or name.
- A configurable alert threshold (0.3 µSv/h by default, explained in the docs), with the scene triggers **Dose rate
  above the threshold** and **Dose rate back to normal**, and a scene action **Get the dose rate of a probe**.
- A dashboard widget with the values and the 24-hour curve.
- English, French, German and Spanish.

**Not an official alert system.** Natural levels vary (rain can add up to 0.1 µSv/h for a few hours). In an
emergency, follow the instructions of the authorities.

The same integration for France: [Téléray](https://github.com/guim31/gladys-teleray) (ASNR network).

## Requirements

- Gladys Assistant 5.3.0 or later, with Internet access.
- The location of a house in Gladys (Settings → Houses), or the id, name or postcode of a probe.

## Installation

In Gladys: **Integrations → Install from GitHub**, address `https://github.com/guim31/gladys-odl`. Then open the
integration, leave **Probes** empty (closest probe) or type probe ids, names or postcodes, and add the probe from the
**Discovery** tab. User documentation: [English](docs/en.md), [français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md).

## Respect of the service

The integration reads the open [data interface](https://odlinfo.bfs.de/ODL/DE/service/datenschnittstelle/datenschnittstelle_node.html)
of the BfS (a public OGC Web Feature Service, no account, no key), within its terms of use: the probe list once a
day, then every 20 minutes one small request for the newest values of all the followed probes, and a short history
request only when a probe has a gap. It names itself in the `User-Agent`. Data: **Bundesamt für Strahlenschutz
(BfS)**, free of charge, cited as the source.

## Limits

- One value per hour, published 60 to 90 minutes after its hour.
- 5 probes at most. Gladys has no radiation unit: the unit is in the feature names.
- Safecast measurements are not included (a possible follow-up).
- Tested against the real BfS service and its recorded answers (15/11/2026), without a Gladys instance: feedback
  welcome.

## Development

```bash
npm install
npm test                 # node --test, never touches the network
npm run lint
npm run format:check
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the pitfalls of the Gladys core. Versions and releases are made
by the Release workflow.

## Credits

- Measurements: [ODL network](https://odlinfo.bfs.de) of the [Bundesamt für Strahlenschutz](https://www.bfs.de).
- Cover: the BfS logo (© Bundesamt für Strahlenschutz), from
  [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bundesamt_f%C3%BCr_Strahlenschutz_Logo.svg).
- Started from the official [integration template](https://github.com/GladysAssistant/integration-template-js) and
  [SDK](https://github.com/GladysAssistant/integration-sdk-js) of Gladys Assistant.

This integration is not affiliated with, nor endorsed by, the BfS.

## License

[Apache-2.0](LICENSE)
