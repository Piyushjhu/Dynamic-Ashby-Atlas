# Literature-only material clouds

Run from `Dynamic_Ashby`:

```sh
.venv/bin/python plot_literature_clouds.py
```

Run cells 1, 2 and 3 in `develop_global_ashby.py`, or `.venv/bin/python run_all_plots.py`, to refresh every view. The dedicated literature script refreshes only `outputs/literature_only/` and loads no Cu–Ti data. Edit `literature_clouds_config.json` for this version's appearance.

## Figures

The cloud and class-count figures have matching 300-dpi PNG and editable PDF exports in
`outputs/literature_only/`:

- `literature_material_clouds.png` / `.pdf`: all material clouds on one HEL–spall map,
  with a class-grouped key of exact material names and linked author/year citations.
- `literature_material_clouds_by_class.png` / `.pdf`: thirteen class panels with
  identical axes, material colours, original-record counts and individual reference keys.
- `literature_data_by_class.png` / `.pdf`: all 342 original evidence records by
  material class, split into verified pairs, other reported HEL/spall evidence,
  inferred-coordinate records, unresolved cases, reported zero and excluded records.
  The side columns give cloud coverage, material-cloud counts and papers with extracted data.

The two cloud figures have no data markers. Their class headings show
**cloud records / all extracted class records**, followed by the material-cloud count.
Each exact named material has one pooled cloud across
papers and tested conditions. Distinct class colours use blue (pure metals),
green (light alloys), orange (steels), violet (Ni superalloys), olive (W heavy
alloys), brown (Fe–Ni alloys), magenta (medium-entropy alloys), cyan
(high-entropy alloys), red (metallic glasses), gold (ceramics), charcoal
(polymers) and teal (fibre composites). Class hues and material shades remain
consistent between the two figures. The configured copper variants share a colour but keep
separate named clouds; polycarbonate variants follow the same rule. These colour
aliases do not merge materials or modify their recorded identities.

The current view contains **65 material clouds from 219 positive literature records**, spanning twelve classes, including Zr alloys (mauve). Thirteen panels include the unresolved fibre-composites class. There are 102 unsupported records with missing counterpart properties; twenty records are excluded from all figures, including eighteen alternative reductions of existing experiments. AD95 alumina's **0 GPa** spall stays zero in the common CSV and is noted separately from logarithmic axes. Grady (1995) ranges are grade-unspecified summaries with possible overlap; G13 and SN282 are abstract-level summaries.

The 219 cloud records comprise **85 visually verified same-shot pairs, 35 XML-reviewed same-shot pairs, 38 other records with reported HEL/spall properties, and 61 records with inferred coordinates**.
Together with 102 unresolved, twenty excluded and one zero-spall record, these
account for all 342 evidence records. The count chart includes the zero and
excluded cases for accounting only; they never contribute to a positive cloud.
Counts refer to extracted evidence records, not experiment totals. The 103
source-only rows in the dynamic common CSV have no dynamic record to count; static-only paper properties are available in ZAKI/ZAKI.csv and the website property download. Per-class
paper counts overlap when one paper covers several classes.

The common data/source export for all views is project-root `literature_data.csv`. The following per-view files audit geometry and completion.

## Interpretation

This is a schematic coverage view of the existing exploratory completion, with
the same donor, material-substitution and yield-model rules documented in
`README_EXPLORATORY_ASHBY.md`. No additional property estimates are introduced.
Solid outlines use reported properties; dashed outlines include matching or
substitution; dotted outlines include yield-based HEL. If a cloud has mixed
evidence, dotted takes precedence over dashed and solid. Record-level methods
remain in the exports.

Clouds enclose the independent HEL and spall bounds for each material. In log10
coordinates, each ellipse is centred on the bounding box and its half-widths
are expanded by sqrt(2) to enclose the box corners. This is a drawing rule, not
a fitted correlation, confidence region or measured scatter distribution.
Pooling across papers and conditions does not imply matched loading conditions.

For single values, lines or very narrow extents, a minimum full span of 0.075
decades is applied before the enclosing expansion. **Hatching identifies this
display padding.** Actual input bounds and rendered bounds are exported in
separate columns; no measurement width or midpoint observation is added.

Darker fill means more original extracted records for that material, scaled
against the largest material count in this view. It does not represent an
unextracted paper's experiment count, independent paired observations, a
cross-product of HEL/spall values or a probability density. Reused donors do not
create additional cloud members.

The literature-only verified-shot preview (`literature_shot_pairs.png` / `.pdf` / `.svg`) is also saved in this same folder.

The same run also refreshes static/dynamic comparison and UMAP/diffusion figures. See [the property-analysis guide](README_PROPERTY_ANALYSIS.md) for definitions, matched-data limits and numerical audit paths.

## Linked exports

The following supporting files are in `outputs/literature_only/audit/clouds/`. The one common data/source table remains project-root `literature_data.csv`.

- `cloud_summary.csv`: one row per cloud, actual and rendered property bounds,
  material/class, colour, opacity, record counts, methods, assumptions and paper URLs.
- `class_summary.csv`: all thirteen class totals, separated into the six evidence
  statuses, plus numbers of material clouds, named materials and contributing papers.
- `cloud_members.csv`: all 342 original literature records with original stresses,
  completed coordinate bounds, cloud IDs or unresolved/zero status and provenance.
- `cloud_sources.csv`: each cloud's contributing papers, linked citations, member
  record IDs and donor/model input URLs.
- `property_donor_links.csv`: exact donor records, materials, source links and
  conditions used by the existing completion rules.
- `hel_model_inputs.csv`: yield/elastic inputs, source links and model limitations.
- `run_manifest.json`: active settings, counts and input/code/output hashes.

Run the checks with `.venv/bin/python -m unittest discover -s tests -v`.
