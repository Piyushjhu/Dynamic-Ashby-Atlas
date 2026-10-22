# Extraction and plot-admission protocol

## Stress definitions

HEL is the longitudinal stress at the elastic precursor under uniaxial strain. It is distinct from hydrostatic pressure, von Mises yield stress, and a precursor velocity. Spall strength is the dynamic tensile failure stress inferred using the source's wave analysis. It is distinct from quasistatic tensile strength, indentation hardness and fracture toughness.

Record each author's formula, wave speed and waveform correction before pooling studies. For a conventional free surface, HEL is commonly inferred as 0.5*rho0*cL*u_HEL. A sample/window interface requires the appropriate impedance treatment. A conventional ductile-metal pullback estimate uses a bulk wave speed, with any waveform correction retained. Composite delamination and brittle failure need their own source definitions.

## Record levels

- `shot_pair`: HEL and spall occupy the same experimentally identified table row. Requires positive values, a shot ID, source locator and visual table verification. Eligible for the present preview.
- `compiled_summary`: a property table combines HEL and spall, but common-shot provenance is unresolved.
- `study_summary`: an abstract or discussion gives means, ranges or material-state values. Same publication and same material are insufficient to claim a shot pair.
- `independent_summary`: metrics come from different loading regimes, or a maximum is combined with a HEL. Keep them as independent evidence.
- `single_metric`: one metric is absent or unresolved. Missing HEL is represented by null, including Ni with no discernible precursor.
- `reported_zero_summary`: source reports loss of tensile resistance. Keep the outcome and loading regime; do not replace zero with an arbitrary small number for logarithmic plotting.

Both source verification and pairing level matter. A precisely printed abstract value can still have unresolved pairing.

Where a visually verified experimental table has no author shot code, an assigned
source-table row tag may identify that actual experiment. Record its assigned
origin explicitly; a table of independent material summaries does not qualify.
Preserve flagged transcriptions and alternate-probe readings in the common CSV,
but exclude held records from every figure and from property-donor selection.

## Data rules

1. Use one row per shot, material-state summary or censored outcome. Store source ID and an exact table/page/figure locator.
2. Convert stresses to GPa, lengths to mm, rates to s^-1. Retain source units and conversion rationale in notes when ambiguous. Temperatures are initially C.
3. Preserve composition basis: wt% versus at%. Record target composition separately from flyer composition.
4. Store peak longitudinal stress, tensile strain-rate definition, target/flyer thickness, pulse duration, loading direction, temperature, grain size, processing state and damage state when available. Unknown values remain null.
5. Approximate study-wide conditions belong in notes; do not assign an exact shock stress or strain rate to each shot without source evidence.
6. Never combine independent minimum/maximum values into an empirical joint cloud. A range is not an uncertainty interval.
7. Missing uncertainty is null. Reported ± terms keep their source definition until identified as standard deviation, standard error, confidence interval or instrument uncertainty. Do not feed an undefined ± term into the existing normalized uncertainty columns.
8. Keep simulation-only results and hydrocode inputs outside the experimental layer. A paper containing both experiments and MD does not make its MD strengths experimental.
9. For digitization, save figure/page, calibration points, source resolution, extracted coordinates and estimated digitization uncertainty. Digitize stress directly when possible. Converting a waveform requires the relevant equation, acoustic parameters and correction terms.
10. Preserve unit conflicts. In S15, the LT37 figure reads 44.3 MPa while prose says GPa. The seed uses the figure label (0.0443 GPa) and records the discrepancy.

## Relationship to existing plotting code

`multi_heat_treatment_ashby.py` expects shot-level `HEL_GPa` and `Spall_Strength_GPa`, uses HEL/spall validity flags if present, and needs `HT_Label`. Its grouping assumes Cu–Ti R families or Ti percentage. Its observed envelopes use shot covariance.

The research registry deliberately retains the compatible strength names but is not directly passed to that function. Extend grouping to explicit `Material_ID`, `Material_Class`, `Material_State` and `Source_Type` before integration. A literature heat treatment should not be represented as a Cu–Ti composition family.

`multi_heat_treatment_marginal_ashby.py` displays separate metric distributions for nine Cu–Ti aging/composition groups; it also requires generalization. Independent literature marginals must remain distinguishable from measured joint scatter.

For the expanded map, show individual verified literature points first. Form envelopes only when enough paired data exist within a scientifically defensible material/state/condition group. Show compilation values and independent marginals in a separately labeled reference layer. Zero outcomes, lower bounds and unresolved HEL belong in an audit or dedicated panel.

The all-data comparison view currently draws clouds only for local Cu–Ti data;
literature is represented by points, summaries, reported ranges and metric strips.
Optional source/material literature clouds can be enabled in the configuration.
These enclose verified shot pairs across the heat treatments,
grain structures and temperatures reported within one source and named material.
Label them as study-condition envelopes rather than matched-state properties.
Keep different named alloy compositions and sources separate. Scalar summaries,
independent metrics and reported ranges do not enter these clouds. Fill opacity
uses a shared paired-measurement-count scale; it is not probability or confidence.

The global Cu–Ti comparison pools composition families into three heat treatments
(Sol, PA and OA). The audit retains the original nine composition/aging groups.
Cu–Ti is drawn only as closed 1σ sample-covariance regions: principal-axis
semi-widths are one sample standard deviation, with Mahalanobis radius 1.
On log axes, calculate centers and covariance in log10(GPa) and map the curves
back to GPa. These are data-dispersion regions, not uncertainty of the mean or
confidence intervals. Individual Cu–Ti markers are suppressed; every admitted
measurement remains in the audit and contributes to its heat-treatment region.
When enabled, literature clouds use full enclosing ellipses with the maximum observed
Mahalanobis radius, with no rectangular clipping. Their boundaries can extend
beyond measured extrema and are not inferred physical property limits. Exact
literature materials and author/year citations appear in the figure key; an
unresolved alloy grade stays explicitly unreported.

## Explicitly exploratory property-completion version

The user-requested alternate comparison is implemented separately in
`plot_exploratory_ashby.py` and `exploratory_ashby_config.json`, with outputs in
`outputs/CuTi/`. Its completion rules are an explicit
exploratory exception to the empirical-cloud admission rules above, not a
change to the raw registry, measured-pair audit or existing figures.

Retain original reported stresses and pairing flags. Add separately named plot
bounds and method/provenance fields. Prefer reported coordinates, then exact
recorded state matches, explicitly configured cross-paper matches and
material-state/composition substitutes, then applicable yield-based HEL models.
Donors must be active original records; never cascade inferred coordinates.
Record both exact materials, both source URLs/locators and all condition
mismatches. Unreported conditions do not establish equivalence. Missing spall
cannot be supplied by the yield-to-HEL equation. Preserve numerical zeros and
unresolved no-spall controls separately.

Only real same-shot literature scatter may determine empirical covariance.
Independent or completed property extents use closed coverage boxes, lines or
points without fabricated width, correlation, midpoint observations or sample
counts. Count unique original records; retain donor/support counts separately.
Cu–Ti still uses only Sol / PA / OA 1σ regions. An isotropic, pressure-insensitive
uniaxial-strain model gives longitudinal `HEL=Y*(1-nu)/(1-2*nu)`; label this as
estimated and preserve the yield rate/state, elastic inputs and limitations.
Quasistatic yield is not measured shock yield; no unrecorded rate/pressure
correction is permitted. See `README_EXPLORATORY_ASHBY.md` for the exact input
sources, assumptions and unresolved materials.

## Literature-only cloud view

The separately requested literature-only cloud view is a schematic display
exception to the no-width coverage rule above. It pools exact named materials
across literature conditions and uses log-space ellipses enclosing independent
property bounds. Hatched minimum display widths and rendered extrema are kept
separate from measured input extents. No covariance, measurement, pairing or
additional completion is inferred from the shape. Cu–Ti is excluded, and
unsupported records remain unresolved. See `README_LITERATURE_CLOUDS.md`.

## Local data import

Inspect result CSV headers and the parameter/material files. Identify what each row means: a shot result, sample summary, repeated postprocessing output or stale test output. Compare timestamps/configuration and choose one authoritative result for each shot. Match HEL/spall by shot ID and target material, preserving validity flags and uncertainties.

Folder names such as `Al_on_Cu` or `flyer_Cu` describe an assembly and do not independently identify the target. Preview outputs in this repository are candidates, not confirmed authoritative experimental data.

