# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- One device per probe of the ODL network of the German BfS: ambient gamma dose
  rate, cosmic and terrestrial parts (µSv/h), time of the measurement and state
  of the probe (checked, not checked yet, test operation, out of order, no
  recent measurement), read every 20 minutes from the open data service of the
  BfS, no account.
- The probe closest to the house by default, or up to 5 probes typed by id,
  name or postcode, and buttons listing the probes near a house or matching a
  postcode or a name.
- A configurable alert threshold (0.3 µSv/h by default), with the scene
  triggers "Dose rate above the threshold" and "Dose rate back to normal".
- Scene action "Get the dose rate of a probe", with a sentence ready for a
  notification.
- Dashboard widget "ODL dose rate": tiles, 24-hour curve, time, state and
  threshold.
- Feature names and texts in English, French, German and Spanish.
