# Dynamic Ashby — Literature Atlas

**[Open the interactive website →](https://piyushjhu.github.io/Dynamic-Ashby-Atlas/)**

[Explore the map](https://piyushjhu.github.io/Dynamic-Ashby-Atlas/explore.html) · [Static vs dynamic](https://piyushjhu.github.io/Dynamic-Ashby-Atlas/static-dynamic.html) · [Source library](https://piyushjhu.github.io/Dynamic-Ashby-Atlas/sources.html)

Interactive spall strength versus Hugoniot elastic limit, with linked literature sources, evidence provenance and workflow documentation.

## What this public repository contains

This is the published website repository. Sharing its link gives visitors access to the website and its public files:

- Website pages, styles, browser JavaScript and visual assets.
- Published literature records, source links and data used by the interactive plots.
- Website guides explaining the displayed evidence and its limitations.

The research Python code, private experimental study data and figures, raw paper corpus, API credentials and private configuration are not included. The research repository remains private; sharing this repository does not grant access to it.

The website and its downloads are publicly accessible. Browser JavaScript and published datasets can be inspected or downloaded. Only authenticated repository administrators can manage connected sources.

## Published data

Download the literature ledger from `data/literature.csv`, the reviewed property export from `data/experimental-properties.csv`, or the machine-readable map from `data/catalogue.json`. Opt-in connected experiments are a separate layer in `data/connected-experiments.json`; their records are never counted as literature. The site is rebuilt automatically when its reviewed public inputs change.
