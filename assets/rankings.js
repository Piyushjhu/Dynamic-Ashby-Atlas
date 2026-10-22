/* Precomputed class-ranking audit. This renderer never fits a browser model. */
(() => {
  'use strict';
  const root = document.querySelector('#ranking-section');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const $$ = selector => [...root.querySelectorAll(selector)];
  const list = value => Array.isArray(value) ? value : [];
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
  const fmt = value => numeric(value) ? new Intl.NumberFormat('en', {maximumFractionDigits:3}).format(value) : 'Unavailable';
  const pct = value => numeric(value) ? `${Math.round(value * 100)}%` : 'Unavailable';
  const rank = value => numeric(value) ? `#${fmt(value)}` : 'Not ranked';
  const range = (values, probability = false) => list(values).length === 2 && values.every(numeric) ? `${probability ? pct(values[0]) : fmt(values[0])}–${probability ? pct(values[1]) : fmt(values[1])}` : 'Unavailable';
  const color = value => /^#[0-9a-f]{6}$/i.test(String(value)) ? value : '#737b84';
  const safeURL = value => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  };
  const link = (url, label, title = '') => safeURL(url) ? `<a href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer"${title ? ` title="${esc(title)}"` : ''}>${esc(label)} ↗</a>` : `<span>${esc(label)}</span>`;
  const rankInk = value => {
    const hex = color(value).slice(1), channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return channels.reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0) > .179 ? '#1d1d1f' : '#ffffff';
  };
  const swatch = value => `<span class="swatch" style="--color:${color(value)}" aria-hidden="true"></span>`;
  const NS = 'http://www.w3.org/2000/svg';
  let data, scenario, variant, selectedClass = null, selectedPair = null, regime = 'dynamic', weight = .5;
  const classes = () => list(variant?.classes);
  const byClass = name => classes().find(row => row.class === name);
  const scenarioVariants = () => list(scenario?.variants);
  const isSelected = name => name === selectedClass || Boolean(selectedPair && [selectedPair.a, selectedPair.b].includes(name));
  const hasSelection = () => Boolean(selectedClass || selectedPair);
  const term = (loading, axis) => loading === 'static' ? (axis === 'strength' ? 'Yield strength' : 'Fracture toughness') : (axis === 'strength' ? 'HEL' : 'Spall strength');
  const support = (row, loading, axis) => row?.[`${loading}Support`]?.[axis] || {};
  const definition = (label, value) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const statusText = value => String(value || 'unavailable').replaceAll('_', ' ');

  function sourceMarkup(source, loading) {
    const materials = list(source.materials), ids = list(source.recordIds);
    return `<article class="ranking-source">${link(source.url, source.citation || source.title || 'Source paper', source.title)}<p>${esc(term(loading, source.axis))}${ids.length ? ` · ${ids.length} supporting record${ids.length === 1 ? '' : 's'}` : ''}</p>${materials.length ? `<details><summary>Source materials (${materials.length})</summary><ul>${materials.map(material => `<li>${esc(material)}</li>`).join('')}</ul></details>` : ''}${ids.length ? `<details><summary>Evidence record IDs</summary><p>${esc(ids.join(', '))}</p></details>` : ''}</article>`;
  }

  function regimeDetails(row, loading) {
    const a = support(row, loading, 'strength'), b = support(row, loading, 'resistance');
    const sources = list(row.sources).filter(source => source.regime === loading);
    const rankValue = row[`${loading}Rank`], interval = row[`${loading}Range`];
    const summary = axis => {
      const item = support(row, loading, axis);
      return `${fmt(item.records)} values · ${fmt(item.papers)} papers`;
    };
    return `<section class="ranking-evidence-panel"><h4>${loading === 'static' ? 'Static evidence' : 'Dynamic evidence'}</h4><dl class="diagnostic-list">${definition('Class rank', rank(rankValue))}${definition('Source-resampling rank range', range(interval))}${definition('Class score', fmt(row[`${loading}Score`]))}${definition(term(loading, 'strength'), summary('strength'))}${definition(`${term(loading, 'strength')} median`, numeric(a.median) ? `${fmt(a.median)} ${a.unit || ''}` : 'Unavailable')}${definition(term(loading, 'resistance'), summary('resistance'))}${definition(`${term(loading, 'resistance')} median`, numeric(b.median) ? `${fmt(b.median)} ${b.unit || ''}` : 'Unavailable')}</dl><div class="ranking-paper-list">${sources.length ? sources.map(source => sourceMarkup(source, loading)).join('') : '<p class="ranking-empty">No source support is available in this scenario.</p>'}</div></section>`;
  }

  function showSelection() {
    const host = $('#ranking-selection');
    if (selectedPair) {
      const pair = selectedPair, a = byClass(pair.a), b = byClass(pair.b);
      const axisText = values => list(values).length === 2 ? `${pct(values[0])} strength · ${pct(values[1])} toughness / spall` : 'Unavailable';
      const pairStats = loading => `<section class="ranking-evidence-panel"><h4>${loading === 'static' ? 'Static ordering' : 'Dynamic ordering'}</h4><dl class="diagnostic-list">${definition('Fitted weighted-axis preference', pct(pair[`${loading}Probability`]))}${definition('Source-resampling preference range', range(pair[`${loading}Range`], true))}${definition('Empirical comparison', pct(pair[`${loading}Empirical`]))}${definition('Per-axis comparison', axisText(pair[`${loading}Axes`]))}${definition('Joint preference bounds', range(pair[`${loading}DominanceBounds`], true))}</dl></section>`;
      const pairSource = row => row ? `<section class="ranking-evidence-panel"><h4>${swatch(row.color)} ${esc(row.class)}</h4><button type="button" class="quiet-button" data-ranking-class="${esc(row.class)}">Inspect class support →</button><div class="ranking-paper-list">${list(row.sources).map(source => sourceMarkup(source, source.regime)).join('')}</div></section>` : '';
      host.innerHTML = `<div class="analysis-selection-heading"><div><p class="eyebrow">Pairwise class ordering · ${esc(statusText(pair.label))}</p><h3>${esc(pair.a)} × ${esc(pair.b)}</h3></div></div><p class="ranking-evidence-note">The row class is ${esc(pair.a)}; the column class is ${esc(pair.b)}. The fitted score is a weighted-axis preference, not a probability of winning on both axes or of one specimen outperforming another. Each marginal preference counts a tie as one half. The joint preference bounds describe random tie-broken preferences on both axes under unknown coupling; they are not strict both-axis dominance probabilities.</p><div class="ranking-evidence-grid">${pairStats('static')}${pairStats('dynamic')}</div><p class="ranking-evidence-note">A supported reversal is an ordering result within the model's reported source-resampling criteria. It does not establish a change in the same material between static and dynamic tests.</p><div class="ranking-evidence-grid ranking-pair-sources">${pairSource(a)}${pairSource(b)}</div>`;
      return;
    }
    const row = byClass(selectedClass);
    if (!row) {
      host.innerHTML = '<p>Select a class or a matrix cell to inspect the supporting papers, exact material populations and uncertainty.</p>';
      return;
    }
    host.innerHTML = `<div class="analysis-selection-heading"><div><p class="eyebrow">Class summary · independent material populations</p><h3>${swatch(row.color)}${esc(row.class)}</h3></div><span class="detail-badge">${row.weakEvidence ? 'Limited source support' : 'Inspect source support'}</span></div><p class="ranking-evidence-note">The two regimes can contain different materials, processing states and test conditions within this class. Counts below refer to property inputs and papers, not a matched set of specimens. An unavailable stability range can mean that too few independent papers support between-paper resampling.</p><div class="ranking-evidence-grid">${regimeDetails(row, 'static')}${regimeDetails(row, 'dynamic')}</div>`;
  }

  function classList() {
    $('#ranking-class-list').innerHTML = classes().length ? classes().map(row => {
      const regimeCard = loading => {
        const a = support(row, loading, 'strength'), b = support(row, loading, 'resistance');
        return `<span>${loading === 'static' ? 'Static' : 'Dynamic'}<strong>${esc(rank(row[`${loading}Rank`]))}</strong><small>Stability range ${esc(range(row[`${loading}Range`]))}<br>${esc(fmt(a.records))} / ${esc(fmt(b.records))} values<br>${esc(fmt(a.papers))} / ${esc(fmt(b.papers))} papers${row.weakEvidence ? '<br>Limited support' : ''}</small></span>`;
      };
      return `<button type="button" class="ranking-class-button" data-ranking-class="${esc(row.class)}" aria-pressed="${isSelected(row.class)}"><span class="ranking-class-name">${swatch(row.color)}${esc(row.class)}</span><span class="ranking-class-ranks">${regimeCard('static')}${regimeCard('dynamic')}</span></button>`;
    }).join('') : '<p class="ranking-empty">No material classes satisfy the evidence requirements for this scenario.</p>';
  }

  function chart() {
    const host = $('#ranking-slope-chart'), rows = classes();
    const width = Math.max(280, host.clientWidth || 600), height = Math.max(350, rows.length * 48 + 100);
    const left = width < 420 ? Math.min(115, width * .35) : Math.min(170, width * .30);
    const right = width - left, top = 54, bottom = height - 48;
    const maxRank = Math.max(rows.length, 2, ...rows.flatMap(row => [row.staticRank, row.dynamicRank, ...list(row.staticRange), ...list(row.dynamicRange)]).filter(numeric));
    const y = value => top + (value - 1) / (maxRank - 1) * (bottom - top);
    const shortened = name => { const limit = width < 420 ? 16 : 24; return name.length > limit ? `${name.slice(0, limit - 1)}…` : name; };
    let svg = `<svg xmlns="${NS}" viewBox="0 0 ${width} ${height}" aria-label="Static and dynamic class ranks under ${weight * 100}% strength-axis weight. Rank one is highest." role="group"><text x="${left}" y="19" text-anchor="middle" class="ranking-chart-axis">Static rank</text><text x="${right}" y="19" text-anchor="middle" class="ranking-chart-axis">Dynamic rank</text>`;
    if (!rows.length) {
      svg += `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="ranking-chart-empty">Insufficient evidence for this scenario</text></svg>`;
      host.innerHTML = svg;
      return;
    }
    for (let position = 1; position <= Math.ceil(maxRank); position++) svg += `<line x1="${left}" x2="${right}" y1="${y(position)}" y2="${y(position)}" class="ranking-chart-grid"/>`;
    svg += `<line x1="${left}" x2="${left}" y1="${top - 10}" y2="${bottom + 10}" stroke="#c8c8d0"/><line x1="${right}" x2="${right}" y1="${top - 10}" y2="${bottom + 10}" stroke="#c8c8d0"/>`;
    const ordered = [...rows].sort((a, b) => Number(isSelected(a.class)) - Number(isSelected(b.class)));
    for (const row of ordered) {
      const a = row.staticRank, b = row.dynamicRank, shade = color(row.color), active = isSelected(row.class);
      if (!numeric(a) && !numeric(b)) continue;
      const title = `${row.class}. Static ${rank(a)}, interval ${range(row.staticRange)}. Dynamic ${rank(b)}, interval ${range(row.dynamicRange)}.${row.weakEvidence ? ' Limited source support.' : ''}`;
      svg += `<g class="ranking-chart-class${hasSelection() && !active ? ' is-muted' : ''}" data-ranking-class="${esc(row.class)}" tabindex="0" role="button" aria-pressed="${active}" aria-label="${esc(title)}"><title>${esc(title)}</title>`;
      if (numeric(a) && numeric(b)) svg += `<path d="M${left} ${y(a)}L${right} ${y(b)}" class="ranking-chart-line" stroke="${shade}"${row.weakEvidence ? ' stroke-dasharray="4 4"' : ''}/>`;
      for (const [loading, xPosition, value, labelPosition, anchor] of [['static', left, a, left - 15, 'end'], ['dynamic', right, b, right + 15, 'start']]) {
        if (!numeric(value)) continue;
        const interval = list(row[`${loading}Range`]);
        if (interval.length === 2 && interval.every(numeric)) svg += `<line x1="${xPosition}" x2="${xPosition}" y1="${y(interval[0])}" y2="${y(interval[1])}" stroke="${shade}" class="ranking-chart-range"/>`;
        svg += `<circle cx="${xPosition}" cy="${y(value)}" r="9" fill="${shade}" class="ranking-chart-dot"/><text x="${xPosition}" y="${y(value) + 3}" text-anchor="middle" class="ranking-chart-rank" style="fill:${rankInk(shade)}">${esc(fmt(value))}</text><text x="${labelPosition}" y="${y(value) + 3}" text-anchor="${anchor}" class="ranking-chart-label">${esc(shortened(row.class))}</text>`;
      }
      svg += '</g>';
    }
    svg += `<text x="${width / 2}" y="${height - 10}" text-anchor="middle" class="ranking-chart-axis">Rank 1 = highest under this preference</text></svg>`;
    host.innerHTML = svg;
  }

  function pairFor(a, b) {
    const direct = list(variant?.pairs).find(pair => pair.a === a && pair.b === b);
    if (direct) return direct;
    const reverse = list(variant?.pairs).find(pair => pair.a === b && pair.b === a);
    if (!reverse) return null;
    const invert = value => numeric(value) ? 1 - value : null;
    const invertRange = values => list(values).length === 2 && values.every(numeric) ? [1 - values[1], 1 - values[0]] : null;
    const staticAxes = list(reverse.staticAxes).map(invert), dynamicAxes = list(reverse.dynamicAxes).map(invert);
    // Reverse joint preference is not the complement of joint preference:
    // axes may trade off. These marginals include half credit for ties.
    const dominance = axes => axes.length === 2 && axes.every(numeric) ? [Math.min(1, Math.max(0, axes[0] + axes[1] - 1)), Math.max(0, Math.min(1, ...axes))] : null;
    return {...reverse, a, b, staticProbability:invert(reverse.staticProbability), dynamicProbability:invert(reverse.dynamicProbability), staticEmpirical:invert(reverse.staticEmpirical), dynamicEmpirical:invert(reverse.dynamicEmpirical), staticAxes, dynamicAxes, staticRange:invertRange(reverse.staticRange), dynamicRange:invertRange(reverse.dynamicRange), staticDominanceBounds:dominance(staticAxes), dynamicDominanceBounds:dominance(dynamicAxes)};
  }

  function cellColor(value) {
    if (!numeric(value)) return '#efeff2';
    const target = value >= .5 ? [142, 186, 201] : [229, 190, 152], origin = [245, 245, 247], distance = Math.min(1, Math.abs(value - .5) * 2);
    return `rgb(${origin.map((channel, index) => Math.round(channel + (target[index] - channel) * distance)).join(',')})`;
  }

  function matrix() {
    const rows = classes(), host = $('#ranking-win-matrix');
    $$('[data-ranking-regime]').forEach(button => button.setAttribute('aria-pressed', button.dataset.rankingRegime === regime));
    if (!rows.length) { host.innerHTML = '<p class="ranking-empty">No pairwise comparisons are available.</p>'; return; }
    const first = rows.length > 1 ? '0:1' : '';
    let html = `<table class="ranking-matrix"><caption>${regime === 'static' ? 'Static' : 'Dynamic'} fitted probability that the row class outranks the column class. C01–C${String(rows.length).padStart(2, '0')} identify the same classes in row order. Tab into the matrix; use arrow keys to move and Enter or Space to inspect a comparison.</caption><thead><tr><th scope="col">Row class ↓ / column →</th>${rows.map((row, index) => `<th scope="col"><abbr title="${esc(row.class)}">C${String(index + 1).padStart(2, '0')}</abbr></th>`).join('')}</tr></thead><tbody>`;
    rows.forEach((row, i) => {
      html += `<tr><th scope="row"><span class="ranking-matrix-code">C${String(i + 1).padStart(2, '0')}</span> ${esc(row.class)}</th>`;
      rows.forEach((other, j) => {
        if (i === j) { html += '<td class="ranking-diagonal" aria-label="Same class">—</td>'; return; }
        const pair = pairFor(row.class, other.class), value = pair?.[`${regime}Probability`];
        const selected = selectedPair?.a === row.class && selectedPair?.b === other.class;
        html += `<td><button type="button" data-ranking-cell="${i}:${j}" data-ranking-a="${esc(row.class)}" data-ranking-b="${esc(other.class)}" style="--cell:${cellColor(value)}" tabindex="${`${i}:${j}` === first ? '0' : '-1'}" aria-pressed="${selected}" aria-label="${esc(`${regime === 'static' ? 'Static' : 'Dynamic'}: ${row.class} outranks ${other.class}: ${pct(value)}. ${pair ? statusText(pair.label) : 'Comparison unavailable'}.`)}"${!pair ? ' disabled' : ''}>${numeric(value) ? pct(value) : '—'}</button></td>`;
      });
      html += '</tr>';
    });
    host.innerHTML = html + '</tbody></table>';
    const enabled = [...host.querySelectorAll('button:not(:disabled)')];
    if (enabled.length && !enabled.some(button => button.tabIndex === 0)) enabled[0].tabIndex = 0;
  }

  function diagnostics() {
    const validation = variant?.validation || {}, bootstrap = variant?.bootstrap || {}, agreement = variant?.agreement || {};
    const metric = value => numeric(value) ? fmt(value) : 'Unavailable';
    const modelRows = list(validation.models).map(model => `${definition(`${model.name || 'Model'} · Brier`, metric(model.brier))}${definition(`${model.name || 'Model'} · log loss`, metric(model.logLoss))}`).join('');
    $('#ranking-diagnostics-note').textContent = validation.note || 'Validation is reported only where the held-out evidence permits comparison. Missing diagnostics do not certify reliability.';
    $('#ranking-diagnostics').innerHTML = `<section class="ranking-diagnostic-group"><h4>Held-out source comparisons</h4><dl class="diagnostic-list">${definition('Status', statusText(validation.status))}${definition('Evaluable folds / folds', `${fmt(validation.evaluableFolds)} / ${fmt(validation.folds)}`)}${definition('Held-out coverage', pct(validation.coverage))}${definition('Test comparisons', fmt(validation.testComparisons))}</dl>${modelRows ? `<dl class="diagnostic-list ranking-model-metrics">${modelRows}</dl><p>Brier score and log loss assess held-out comparison probabilities; lower is better. These are not property-prediction errors.</p>` : '<p>No model score is reported where the held-out comparison cannot be evaluated.</p>'}</section><section class="ranking-diagnostic-group"><h4>Ordering & resampling</h4><dl class="diagnostic-list">${definition('Classes in agreement calculation', fmt(agreement.classes))}${definition('Spearman rank correlation', metric(agreement.spearman))}${definition('Kendall rank correlation', metric(agreement.kendall))}${definition('Agreement stability range', range(agreement.bootstrapRange))}${definition('Yield ↔ HEL · axis Kendall', metric(agreement.strengthAxes?.kendall))}${definition('Toughness ↔ spall · axis Kendall', metric(agreement.resistanceAxes?.kendall))}${definition('Complete resamples / attempts', `${fmt(bootstrap.completeReplicates)} / ${fmt(bootstrap.attempts)}`)}</dl><p>${esc(bootstrap.note || data.method?.bootstrapNote || 'Incomplete resamples remain excluded from uncertainty summaries.')}</p></section>`;
  }

  function findings() {
    const rows = list(variant?.findings);
    $('#ranking-findings').innerHTML = rows.length ? rows.map(finding => `<article><h4>${esc(finding.title)}</h4><p>${esc(finding.text)}</p></article>`).join('') : '<p class="ranking-empty">This scenario has insufficient evidence for a computed class-ordering discussion. The method requirements and missing inputs remain visible below.</p>';
  }

  function methods() {
    const method = data.method || {};
    const comparison = data.materialComparison || {};
    const summary = data.summary || {};
    const missing = list(scenario?.excluded);
    $('#ranking-methods-content').innerHTML = `<article><h3>${esc(method.title || 'Preference-based class comparison')}</h3><p>${esc(method.description || 'All ranks and probabilities are precomputed from the reviewed source corpus.')}</p></article><article><h3>What a probability means</h3><p>${esc(method.probabilityMeaning || 'A fitted comparison probability is conditional on the selected model, weights and evidence. It is not a probability of specimen performance.')}</p></article><article><h3>What stability ranges show</h3><p>${esc(method.bootstrapNote || 'Rank ranges describe source-resampling stability under the stated procedure, not confidence intervals, physical scatter or measured cloud covariance.')}</p></article><article><h3>Cross-regime material overlap</h3><p>${esc(comparison.note || 'Class summaries can describe different materials and conditions in the two regimes.')}${numeric(summary.sharedMeasuredSpecimens) ? ` Shared measured specimens: ${esc(fmt(summary.sharedMeasuredSpecimens))}.` : ''}</p></article><article class="ranking-limitations"><h3>Limits of this comparison</h3>${list(method.limitations).map(text => `<p>${esc(text)}</p>`).join('') || '<p>Interpret rankings alongside source counts, method qualifications, weights and held-out coverage.</p>'}</article>${missing.length ? `<article><h3>Classes outside this scenario</h3>${missing.map(item => `<p><strong>${esc(item.class)}:</strong> ${esc(item.reason)}</p>`).join('')}</article>` : ''}${list(data.references).length ? `<article><h3>Methods & references</h3><div class="ranking-paper-list">${data.references.map(reference => link(reference.url, reference.title)).join('')}</div></article>` : ''}`;
  }

  function render() {
    variant = scenarioVariants().find(item => numeric(item.strengthWeight) && Math.abs(item.strengthWeight - weight) < 1e-8);
    $$('[data-ranking-weight]').forEach(button => button.setAttribute('aria-pressed', Number(button.dataset.rankingWeight) === weight));
    if (!byClass(selectedClass)) selectedClass = null;
    if (selectedPair) selectedPair = pairFor(selectedPair.a, selectedPair.b);
    const computed = variant?.status === 'computed';
    const rows = classes(), limited = rows.filter(row => row.weakEvidence).length;
    $('#ranking-content').hidden = false;
    $('#ranking-status').innerHTML = computed ? `<strong>${rows.length} classes under an explicit preference.</strong><p>Class summaries use independent source populations. ${limited ? `${limited} class${limited === 1 ? ' has' : 'es have'} limited source support. ` : ''}Source-resampling stability ranges and held-out coverage help show how much of this ordering is supported. Select a class or pair to inspect the inputs.</p>` : '<strong>Insufficient data for this scenario.</strong><p>The requested method family and evidence requirements do not support a computed comparison. Missing ranks and diagnostics remain unavailable; try another evidence scenario.</p>';
    $('#ranking-preference').textContent = `${weight * 100}% yield / HEL · ${(1 - weight) * 100}% toughness / spall`;
    $('#ranking-scenario-note').textContent = scenario?.note || '';
    $('#ranking-class-count').textContent = `${rows.length} classes · ${list(variant?.pairs).length} pair comparisons`;
    $('#ranking-interval-note').textContent = 'Counts show strength-axis / toughness-or-spall inputs and the papers supporting each axis. Stability ranges describe source-resampling sensitivity, not confidence intervals or specimen variability. With a single supporting paper, between-paper stability is unknown.';
    $('#ranking-matrix-note').textContent = data.method?.probabilityMeaning || 'Each cell is the precomputed fitted probability that the row class outranks the column class under the chosen weights. A result near 50% gives little ordering preference.';
    chart(); classList(); findings(); matrix(); showSelection(); diagnostics(); methods();
  }

  function selectClass(name, restoreFocus = false, origin = '') {
    if (!byClass(name)) return;
    selectedClass = name; selectedPair = null;
    chart(); classList(); matrix(); showSelection();
    if (restoreFocus) {
      const container = origin === 'chart' ? $('#ranking-slope-chart') : $('#ranking-class-list');
      [...container.querySelectorAll('[data-ranking-class]')].find(element => element.dataset.rankingClass === name)?.focus({preventScroll:true});
    }
  }

  root.addEventListener('click', event => {
    const weightButton = event.target.closest('[data-ranking-weight]');
    if (weightButton) { weight = Number(weightButton.dataset.rankingWeight); render(); return; }
    const regimeButton = event.target.closest('[data-ranking-regime]');
    if (regimeButton) { regime = regimeButton.dataset.rankingRegime; matrix(); return; }
    const cell = event.target.closest('[data-ranking-cell]');
    if (cell) {
      selectedPair = pairFor(cell.dataset.rankingA, cell.dataset.rankingB); selectedClass = null;
      chart(); classList(); showSelection();
      $$('#ranking-win-matrix button').forEach(button => { button.setAttribute('aria-pressed', button === cell); button.tabIndex = button === cell ? 0 : -1; });
      return;
    }
    const classButton = event.target.closest('[data-ranking-class]');
    if (classButton) selectClass(classButton.dataset.rankingClass, event.detail === 0, classButton.closest('svg') ? 'chart' : 'list');
  });
  root.addEventListener('keydown', event => {
    const item = event.target.closest('.ranking-chart-class');
    if (item && ['Enter', ' '].includes(event.key)) { event.preventDefault(); selectClass(item.dataset.rankingClass, true, 'chart'); return; }
    const cell = event.target.closest('[data-ranking-cell]');
    if (!cell || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let [row, column] = cell.dataset.rankingCell.split(':').map(Number);
    const length = classes().length, direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    if (event.key === 'Home') column = 0;
    else if (event.key === 'End') column = length - 1;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') row += direction;
    else column += direction;
    row = Math.max(0, Math.min(length - 1, row)); column = Math.max(0, Math.min(length - 1, column));
    if (row === column) {
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') row += direction;
      else column += event.key === 'End' ? -1 : direction;
    }
    const next = $(`[data-ranking-cell="${row}:${column}"]:not(:disabled)`);
    if (next) { $$('#ranking-win-matrix button').forEach(button => button.tabIndex = -1); next.tabIndex = 0; next.focus(); }
  });
  $('#ranking-scenario').addEventListener('change', event => {
    scenario = list(data.scenarios).find(item => item.id === event.target.value);
    selectedClass = null; selectedPair = null; render();
  });
  $('#ranking-export').addEventListener('click', () => {
    const chart = $('#ranking-slope-chart svg');
    if (!chart) return;
    const svg = chart.cloneNode(true), style = document.createElementNS(NS, 'style');
    style.textContent = 'text{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}.ranking-chart-grid{stroke:#dcdce2;stroke-width:1;stroke-dasharray:3 5}.ranking-chart-axis{fill:#6e6e73;font-size:11px}.ranking-chart-line{fill:none;stroke-width:2;opacity:.65}.ranking-chart-label{font-size:10px;fill:#1d1d1f;font-weight:500}.ranking-chart-dot{stroke:white;stroke-width:1.5}.ranking-chart-range{stroke-width:7;stroke-linecap:round;opacity:.18}.ranking-chart-rank{font-size:9px;fill:white;font-weight:600}.ranking-chart-class.is-muted{opacity:.22}.ranking-chart-empty{fill:#6e6e73;font-size:13px}';
    svg.prepend(style);
    const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type:'image/svg+xml'}));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `class-ranks-${scenario.id}-strength-${weight}.svg`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  let resizeQueued = false;
  new ResizeObserver(() => {
    if (!variant || resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; chart(); });
  }).observe($('#ranking-slope-chart'));

  async function load() {
    try {
      const response = await fetch('data/rankings.json');
      if (!response.ok) throw new Error('Ranking audit unavailable');
      data = await response.json();
      if (data.schemaVersion !== 1 || !list(data.scenarios).length) throw new Error('Ranking audit has no compatible scenarios');
      const selector = $('#ranking-scenario');
      selector.innerHTML = data.scenarios.map(item => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('');
      scenario = data.scenarios.find(item => /strict/.test(item.id) && /notch/.test(item.id) && /tensile/.test(item.id)) || data.scenarios[0];
      selector.value = scenario.id; selector.disabled = false;
      $$('[data-ranking-weight]').forEach(button => button.disabled = false);
      render();
      document.documentElement.dataset.rankingsReady = 'true';
    } catch {
      document.documentElement.dataset.rankingsReady = 'error';
      $('#ranking-status').innerHTML = '<strong>The ranking audit is unavailable.</strong><p>The source-linked material maps above remain available. Rebuild the website data to generate the class-ranking analysis.</p><p class="ranking-error-action"><button type="button" class="quiet-button" id="ranking-retry">Try loading again →</button></p>';
      $('#ranking-retry').addEventListener('click', load, {once:true});
    }
  }
  load();
})();
