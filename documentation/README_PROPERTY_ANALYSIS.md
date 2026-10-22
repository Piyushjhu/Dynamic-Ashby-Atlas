# Static and dynamic property analysis

The literature website includes **Static vs dynamic** and **Embeddings** pages.
Their data come from the reviewed experimental input in `ZAKI/ZAKI.csv` and
the original reported dynamic evidence in `literature_values.json`.
Private study measurements are excluded.

## Rebuild

From the project root, with the project virtual environment active:

```sh
python scripts/integrate_zaki.py
python plot_literature_clouds.py
python scripts/build_website.py
```

The first command imports reviewed dynamic observations and source metadata.
It is idempotent: rerunning it preserves record identities and does not append
the same measurements again. Static properties remain in the long-form ZAKI
input. The figure workflow also regenerates the property comparison and
embedding figures in `outputs/literature_only/`. Detailed numerical outputs
are in that folder's `audit/` subfolder. The generated site is in `_site/`.

For newly reviewed XML tables, update `scripts/zaki_reviewed.py`, run
`python scripts/audit_zaki.py` while the external SSD is mounted, then run the
commands above. The CSV and reviewed-source metadata are sufficient for
normal builds and GitHub Actions; the full-text XML corpus stays local.

## What can be compared

The classical axes are tensile yield strength in MPa and fracture toughness
in MPa√m. Static pairs require both properties in the same source-defined
material condition. They can summarize different test specimens from that
condition; they are not advertised as a single test. Heat treatments,
orientations and processing states remain distinct.

The expanded seed includes AISI 4340 heat-treatment conditions and
Ti–10V–2Fe–3Al LT/TL conditions with reported plane-strain toughness. Copper
DPD, QSC and coarse-grained conditions have experimentally derived provisional
`KQ`, displayed with that qualification. Their paper's estimated, constraint-
corrected `KIc` column is excluded from the measured input. Indentation
toughness and flexural strength have separate definitions and supporting views.
Hardness, compressive strength and Charpy energy are not substituted for yield
strength or plane-strain fracture toughness.

The dynamic axes are longitudinal HEL and spall strength in GPa. A class-level
comparison is a comparison of coverage, loading regimes and reported material
states. It does not establish a transformation between fracture toughness and
spall. No empirical static–dynamic conversion is fitted without matched
materials and conditions.

## Completing earlier gaps

The reassessment is recorded in `ZAKI/reports/gap_reassessment.json`. A static
yield value alone cannot supply missing spall strength. The conditional
isotropic elastic-yield relation `HEL = Y(1−ν)/(1−2ν)` also requires compatible
yield and elastic inputs, with their rates and specimen states retained.
The new static values do not establish a defensible additional HEL model for
the earlier incomplete dynamic materials. Unsupported coordinates stay missing.
Explicit measured-property donor scenarios retain their mismatches and inferred
status in the comparison map.

## Embeddings and interpretation

UMAP and diffusion maps are computed from complete cohorts with declared
features. Positive dimensional quantities use logarithms where specified,
followed by feature standardization. Missing properties are not zero-filled.
Correlated or algebraically derived elastic constants can overweight one
physical response; cohort definitions and discussion identify this dependence.

Feature-only maps exclude HEL and spall from the distance calculation; outcomes
can then color the resulting points. A separately labelled outcome-only map
visualizes HEL/spall coverage. Its geometry cannot explain parameter effects,
because the outcomes themselves define that geometry. Classes, publications
and experimental conditions can be confounded. Associations are exploratory
and do not establish causes or out-of-source predictive performance.

UMAP uses a fixed seed and one worker. Neighbor and seed sensitivity and
diffusion bandwidth sensitivity are reported with source concentration and
local-neighborhood diagnostics. An embedding's rotation, axis sign, apparent
gap or cluster area is not a physical property. Check the original property
axes and sources before drawing a material-design conclusion.

Methods: [McInnes, Healy and Melville, UMAP](https://arxiv.org/abs/1802.03426),
[Coifman and Lafon, diffusion maps](https://doi.org/10.1016/j.acha.2006.04.006),
and the [UMAP reproducibility documentation](https://umap-learn.readthedocs.io/en/latest/reproducibility.html).

## Review status and publication

ZAKI source cells and experimental methods were reviewed in full-text XML.
Same-shot identity can be known while visual PDF verification remains pending.
These observations are included with their XML review status; the original
visually verified pair layer keeps its stricter admission rule. Alternative
reductions remain linked to the original experiment and excluded as extra
independent observations.

The public property download uses an explicit field list: values, units,
material/state, experimental definitions, uncertainties and source locators.
Full-text excerpts, machine paths, raw composition extractions and the private
Cu–Ti study do not enter the public website.
