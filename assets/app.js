import {AshbyPlot, esc, fmt, range, methodName, filteredClouds} from './plot.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const safeUrl = value => {try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const external = (url,label,cls='') => safeUrl(url)?`<a class="${cls}" href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
const split = value => [...new Set(String(value||'').split(';').map(v=>v.trim()).filter(Boolean))];
const swatch = color => `<i class="swatch" style="--color:${/^#[0-9a-f]{6}$/i.test(color)?color:'#6e6e73'}" aria-hidden="true"></i>`;
let data,sourceMap,recordMap;
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');setTimeout(()=>el.classList.remove('visible'),2600);}
function property(value,lo,hi){return Number.isFinite(value)?fmt(value):range(lo,hi);}
function recordMetrics(r,plot=false){return `<div class="property-grid"><div><small>${plot?'Plotting HEL':'Reported HEL'}</small><strong>${plot?range(r.plotHelMin,r.plotHelMax):property(r.hel,r.helMin,r.helMax)}</strong><span class="unit">GPa</span></div><div><small>${plot?'Plotting spall':'Reported spall'}</small><strong>${plot?range(r.plotSpallMin,r.plotSpallMax):property(r.spall,r.spallMin,r.spallMax)}</strong><span class="unit">GPa</span></div></div>`;}
function coverageRows(){const c=data.meta.counts;return [['Positive cloud records',c.cloudRecords],['Unresolved counterparts',c.unresolved],['Reported zero spall',c.zero],['Reviewed exclusions',c.excluded],['All evidence records',c.records]].map(([label,n])=>`<div class="ledger-row"><span>${label}</span><strong>${n}</strong></div>`).join('');}

async function boot(){
  const menu=$('.menu-button');menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',open);$('#main-nav').classList.toggle('open',open);});
  try{
    const response=await fetch(new URL('../data/catalogue.json',import.meta.url),{cache:'no-cache'});
    if(!response.ok)throw new Error(`Data request returned ${response.status}`);
    data=await response.json();sourceMap=new Map(data.sources.map(s=>[s.source_id,s]));recordMap=new Map(data.records.map(r=>[r.id,r]));
    $$('[data-count]').forEach(el=>el.textContent=data.meta.counts[el.dataset.count]?.toLocaleString()??'—');
    $$('[data-minimum-span]').forEach(el=>el.textContent=data.meta.minimumSpanDecades);
    $$('[data-build-note]').forEach(el=>el.textContent=`Literature review: ${data.meta.reviewDate} · Data revision ${data.meta.dataHash.slice(0,10)} · ${data.meta.counts.records} original records · Literature only`);
    if($('#hero-plot')){
      const plot=new AshbyPlot($('#hero-plot'),{preview:true,onSelect:id=>{location.href=`explore.html?material=${encodeURIComponent(data.clouds.find(c=>c.id===id).material)}`;}});
      plot.setData(data.clouds);
    }
    if($('#main-plot'))initExplorer();
    if($('#source-list'))initSources();
    if($('#methods-coverage')){
      $('#methods-coverage').innerHTML=coverageRows();
      $('#model-summary').innerHTML=data.models.map(m=>`<details><summary>${esc(m.Model_ID)} · ${esc(m.Proxy_Material)}</summary><p>Input yield range: ${fmt(m.Yield_Min_MPa)}–${fmt(m.Yield_Max_MPa)} MPa. Conditional HEL: ${range(m.HEL_Estimate_Min_GPa,m.HEL_Estimate_Max_GPa)} GPa.</p><p>${esc(m.Limitations)}</p>${external(m.Yield_URL,`${m.Yield_Citation} — yield input`)}${external(m.Nu_URL,`${m.Nu_Citation} — elastic input`)}</details>`).join('');
    }
    document.documentElement.dataset.ready='true';
  }catch(error){
    const notice=document.createElement('div');notice.className='load-error page-width';notice.setAttribute('role','alert');
    notice.innerHTML='<strong>The literature data could not be loaded.</strong><br>Serve the built website over HTTP, then reload. From the repository, run <code>python scripts/build_website.py</code> and <code>python -m http.server 8000 --directory _site</code>.';
    $('#main').prepend(notice);console.error(error);
  }
}

function initExplorer(){
  const params=new URLSearchParams(location.search);
  const state={view:params.get('view')==='pairs'?'pairs':'clouds',class:params.get('class')||'',evidence:params.get('evidence')||'all',q:params.get('q')||'',source:params.get('source')||'',material:params.get('material')||'',selected:params.get('record')||'',labels:true};
  if(!['all','reported','inferred'].includes(state.evidence))state.evidence='all';
  let objects=[],activeRecords=[];
  const plot=new AshbyPlot($('#main-plot'),{onSelect:select});
  const classFilter=$('#class-filter');
  for(const c of data.classes){const option=document.createElement('option');option.value=c.Material_Class;option.textContent=c.Material_Class;classFilter.append(option);}
  if(!data.classes.some(c=>c.Material_Class===state.class))state.class='';
  classFilter.value=state.class;$('#evidence-filter').value=state.evidence;$('#plot-search').value=state.q;
  if(state.material&&!state.q)$('#plot-search').value=state.material;
  function syncUrl(){
    const p=new URLSearchParams();if(state.view==='pairs')p.set('view','pairs');if(state.class)p.set('class',state.class);if(state.evidence!=='all')p.set('evidence',state.evidence);if(state.q)p.set('q',state.q);if(state.source)p.set('source',state.source);if(state.material)p.set('material',state.material);if(state.selected){if(state.view==='pairs'||recordMap.has(state.selected))p.set('record',state.selected);else{const c=objects.find(c=>c.id===state.selected);if(c)p.set('material',c.material);}}
    history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():''));
  }
  function matches(r){
    if(state.class&&r.class!==state.class||state.source&&r.sourceId!==state.source||state.material&&r.material!==state.material)return false;
    if(state.evidence==='reported'&&r.inferred||state.evidence==='inferred'&&!r.inferred)return false;
    const q=state.q.toLocaleLowerCase().trim();if(q&&!`${r.material} ${r.state} ${r.citation} ${r.id} ${r.sourceId}`.toLocaleLowerCase().includes(q))return false;
    return true;
  }
  function render({reset=true}={}){
    activeRecords=data.records.filter(r=>r.status==='positive_cloud'&&matches(r));
    if(state.view==='pairs'){
      const colors=new Map(data.classes.map(c=>[c.Material_Class,c.Color_Hex]));
      objects=activeRecords.filter(r=>r.verified&&r.hel>0&&r.spall>0).map(r=>({...r,color:colors.get(r.class)}));
    }else objects=filteredClouds(data,activeRecords);
    if(state.material&&!state.selected){const c=objects.find(o=>o.material===state.material);if(c)state.selected=c.id;}
    if(state.selected&&!objects.some(o=>o.id===state.selected)&&!activeRecords.some(r=>r.id===state.selected))state.selected='';
    plot.setData(objects,{reset,labels:state.labels,selected:recordMap.has(state.selected)&&state.view==='clouds'?recordMap.get(state.selected).cloudId:state.selected});
    $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===state.view));
    $('#evidence-filter').disabled=state.view==='pairs';
    const count=state.view==='pairs'?`${objects.length} verified same-shot pairs`:`${objects.length} material clouds · ${activeRecords.length} original records`;
    $('#map-count').textContent=count+(state.source?` · source ${state.source}`:'');
    $('#result-title').textContent=state.view==='pairs'?'Measurements in view':'Materials in view';$('#result-count').textContent=`${objects.length} selectable ${state.view==='pairs'?'records':'materials'}`;
    $('#material-results').innerHTML=objects.length?objects.map(o=>`<button class="material-row" type="button" data-select="${esc(o.id)}" aria-pressed="${o.id===state.selected}">${swatch(o.color)}<span><strong>${esc(o.material)}</strong><small>${state.view==='pairs'?`${esc(o.citation)} · ${esc(o.id)} · HEL ${fmt(o.hel)}, spall ${fmt(o.spall)} GPa`:`${esc(o.class)} · ${o.count} records · ${o.sourceIds.length} sources${o.inferred?` · ${o.inferred} inferred`:''}`}</small></span></button>`).join(''):'<p class="no-results">No supported data match these filters. Try another class or clear your search. Unresolved evidence remains in the source library.</p>';
    $('#class-legend').innerHTML=data.classes.map(c=>`<button class="legend-button" type="button" data-class="${esc(c.Material_Class)}" aria-pressed="${state.class===c.Material_Class}">${swatch(c.Color_Hex)}${esc(c.Material_Class)}</button>`).join('');
    renderSelection();syncUrl();
  }
  function renderSelection(){
    const panel=$('#selection-panel');
    if(!state.selected){
      panel.innerHTML=`<div class="empty-selection"><svg viewBox="0 0 90 65" aria-hidden="true"><path d="M10 5v48h70" stroke="#bcbcc4" fill="none"/><ellipse cx="44" cy="29" rx="27" ry="12" transform="rotate(-28 44 29)" fill="#e4ecf4" stroke="#7b9ab7"/><path d="m63 29 8 20 3-8 9-2Z" fill="#fafafb" stroke="#52525b"/></svg><h2>Follow the evidence.</h2><p>Select a ${state.view==='pairs'?'measurement':'material cloud'} to see exact materials, property bounds and linked papers.</p><button class="quiet-button" id="select-example" type="button">${objects.length?'Inspect the first material →':'Clear filters to explore →'}</button></div>`;return;
    }
    const record=recordMap.get(state.selected);
    if(record){panel.innerHTML=renderRecord(record,state.view==='clouds');return;}
    const cloud=objects.find(o=>o.id===state.selected);if(!cloud){state.selected='';renderSelection();return;}
    const members=cloud.recordIds.map(id=>recordMap.get(id));
    const donors=[...new Set(members.flatMap(r=>split(r.helDonors).concat(split(r.spallDonors))).map(id=>id.replace('LIT:','')))];
    const donorSources=[...new Set(donors.map(id=>recordMap.get(id)?.sourceId).filter(Boolean))].filter(id=>!cloud.sourceIds.includes(id));
    panel.innerHTML=`<button class="detail-close" type="button" data-close aria-label="Clear selection">×</button><p class="eyebrow">${esc(cloud.class)} · ${esc(cloud.id)}</p><h2>${esc(cloud.material)}</h2><p class="state-text">Pooled independent property coverage</p><div class="property-grid"><div><small>Input HEL extent</small><strong>${range(cloud.helMin,cloud.helMax)}</strong><span class="unit">GPa</span></div><div><small>Input spall extent</small><strong>${range(cloud.spallMin,cloud.spallMax)}</strong><span class="unit">GPa</span></div></div><div class="detail-stat">${cloud.count} original records · ${cloud.sourceIds.length} direct sources<br>${cloud.verified} verified pairs · ${cloud.inferred} records with inferred coordinates</div><span class="detail-badge">${cloud.basis==='yield_model'?'Includes yield-based HEL':cloud.basis==='matched_or_substituted'?'Includes matched / substituted coordinates':'Reported coordinates'}</span>${cloud.padded?'<span class="detail-badge">Minimum drawing width applied</span>':''}<div class="detail-section"><h3>Publications behind this cloud</h3>${cloud.sourceIds.map(id=>sourceBlock(id,members.filter(r=>r.sourceId===id).length)).join('')}</div>${donorSources.length?`<div class="detail-section"><h3>Additional donor publications</h3>${donorSources.map(id=>sourceBlock(id)).join('')}</div>`:''}<div class="detail-section"><h3>Inspect the original records</h3>${members.map(r=>`<button class="record-link" data-record="${esc(r.id)}" type="button">${esc(r.id)} · ${esc(r.citation)}<small>${esc(r.state||'Material state unreported')} · ${esc(methodName(r.completion))}</small></button>`).join('')}</div><div class="detail-section"><p>These are input extents. The drawn ellipse may extend beyond them to enclose the bounds. It is not a confidence region.</p><a class="text-link" href="methods.html#geometry">How this cloud was drawn →</a></div>`;
  }
  function select(id){state.selected=id;plot.selected=recordMap.has(id)&&state.view==='clouds'?recordMap.get(id).cloudId:id;plot.draw();renderSelection();$$('[data-select]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.select===id));syncUrl();}
  function clear(){Object.assign(state,{class:'',q:'',source:'',material:'',evidence:'all',selected:''});classFilter.value='';$('#plot-search').value='';$('#evidence-filter').value='all';render();}
  $('#selection-panel').addEventListener('click',event=>{
    const r=event.target.closest('[data-record]');if(r){select(r.dataset.record);$('#selection-panel').scrollTop=0;return;}
    if(event.target.closest('[data-close]')){state.selected='';render({reset:false});}
    const back=event.target.closest('[data-back-cloud]');if(back)select(back.dataset.backCloud);
    if(event.target.closest('#select-example')){objects.length?select(objects[0].id):clear();}
  });
  $('#material-results').addEventListener('click',event=>{const b=event.target.closest('[data-select]');if(b){select(b.dataset.select);if(innerWidth<850)$('#selection-panel').scrollIntoView({behavior:'smooth',block:'nearest'});}});
  classFilter.addEventListener('change',()=>{state.class=classFilter.value;state.selected='';render();});
  $('#evidence-filter').addEventListener('change',()=>{state.evidence=$('#evidence-filter').value;state.selected='';render();});
  $('#plot-search').addEventListener('input',()=>{state.q=$('#plot-search').value;state.material='';state.selected='';render();});
  $('#class-legend').addEventListener('click',event=>{const b=event.target.closest('[data-class]');if(b){state.class=state.class===b.dataset.class?'':b.dataset.class;classFilter.value=state.class;state.selected='';render();}});
  $$('[data-view]').forEach(b=>b.addEventListener('click',()=>{state.view=b.dataset.view;state.selected='';if(state.view==='pairs')state.evidence='all';$('#evidence-filter').value=state.evidence;render();}));
  $('#clear-filters').addEventListener('click',clear);
  $('#show-labels').addEventListener('change',()=>{state.labels=$('#show-labels').checked;plot.labels=state.labels;plot.draw();});
  $('#zoom-in').addEventListener('click',()=>plot.zoom(1/1.4));$('#zoom-out').addEventListener('click',()=>plot.zoom(1.4));$('#zoom-reset').addEventListener('click',()=>plot.reset());
  $('#share-view').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);toast('Link copied with the current filters and selection.');}catch{toast('Copy the current address to share this view.');}});
  $('#export-svg').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([plot.export()],{type:'image/svg+xml'}));const a=document.createElement('a');a.href=url;a.download=`dynamic-ashby-${state.view}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('#coverage-ledger').innerHTML=coverageRows()+`<div class="detail-section"><h3>Class coverage · clouds / all records</h3>${data.classes.map(c=>`<div class="coverage-class"><span>${swatch(c.Color_Hex)}${esc(c.Material_Class)}</span><span>${c.N_Material_Clouds} / ${c.N_Original_Records}</span></div>`).join('')}</div>`;
  render();
}

function sourceBlock(id,count){
  const s=sourceMap.get(id);if(!s)return '';
  return `<div class="detail-source">${external(s.url,s.citation_label||`${s.authors} (${s.year})`,'citation-link')}<small>${esc(s.source_id)}${count?` · ${count} records in this view`:''}</small><a href="sources.html#${encodeURIComponent(id)}" class="text-link" style="font-size:10px">Publication details →</a></div>`;
}

function renderRecord(r,showBack=false){
  const conditions=[['Loading',r.loading],['Temperature',Number.isFinite(r.temperatureC)?`${fmt(r.temperatureC)} °C`:null],['Peak shock stress',Number.isFinite(r.peakStressGPa)?`${fmt(r.peakStressGPa)} GPa`:null],['Tensile strain rate',Number.isFinite(r.strainRate)?`${fmt(r.strainRate)} s⁻¹`:null],['Target thickness',Number.isFinite(r.targetThicknessMm)?`${fmt(r.targetThicknessMm)} mm`:null],['Flyer thickness',Number.isFinite(r.flyerThicknessMm)?`${fmt(r.flyerThicknessMm)} mm`:null]];
  let inference='';
  if(r.inferred){
    inference=`<div class="detail-section"><h3>Separate plotting coordinates</h3>${recordMetrics(r,true)}<p>${esc(r.assumptions||'See the linked donor/model inputs below.')}</p>${['hel','spall'].map(metric=>`<h3>${metric==='hel'?'HEL':'Spall'} basis: ${esc((r[metric+'Basis']||'').replaceAll('_',' '))}</h3><p>${esc(r[metric+'Citations'])}<br>${esc(r[metric+'Locators'])}</p>${split(r[metric+'Urls']).map(url=>external(url,'Open coordinate input','citation-link')).join('')}${split(r[metric+'Donors']).map(id=>`<button type="button" class="record-link" data-record="${esc(id.replace('LIT:',''))}">Inspect donor ${esc(id)}</button>`).join('')}`).join('')}${r.modelId?`<p>Model: ${esc(r.modelId)}. <a href="methods.html#completion">Assumptions and limitations →</a></p>`:''}</div>`;
  }
  return `${showBack&&r.cloudId?`<button type="button" class="back-link" data-back-cloud="${esc(r.cloudId)}">← Back to material cloud</button>`:''}<button class="detail-close" type="button" data-close aria-label="Clear selection">×</button><p class="eyebrow">${esc(r.class)} · ${esc(r.id)}</p><h2>${esc(r.material)}</h2><p class="state-text">${esc(r.state||'Material state unreported')}</p><span class="detail-badge">${esc(methodName(r.completion))}</span>${r.shot?`<span class="detail-badge">Shot ${esc(r.shot)}</span>`:''}${recordMetrics(r)}<div class="detail-section"><h3>Original publication</h3>${sourceBlock(r.sourceId)}<p><strong>Extraction locator</strong><br>${esc(r.locator||'Unreported')}</p><p>${esc(r.extraction||'')}</p></div>${inference}<div class="detail-section"><h3>Test conditions</h3><dl>${conditions.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v||'Unreported')}</dd>`).join('')}</dl>${r.strainRateDefinition?`<p style="margin-top:12px">Rate definition: ${esc(r.strainRateDefinition)}</p>`:''}</div><div class="detail-section"><h3>Reported uncertainty</h3><p>HEL: ${Number.isFinite(r.helUncertainty)?`±${fmt(r.helUncertainty)} GPa`:'unreported'}<br>Spall: ${Number.isFinite(r.spallUncertainty)?`±${fmt(r.spallUncertainty)} GPa`:'unreported'}</p><p>${esc(r.uncertaintyDefinition||'Definition unreported')}</p></div>${r.notes?`<div class="detail-section"><h3>Record notes</h3><p>${esc(r.notes)}</p></div>`:''}`;
}

function initSources(){
  const search=$('#source-search'),status=$('#source-status'),classFilter=$('#source-class');
  data.classes.forEach(c=>{const o=document.createElement('option');o.value=c.Material_Class;o.textContent=c.Material_Class;classFilter.append(o);});
  const params=new URLSearchParams(location.search);search.value=params.get('q')||'';
  function render(){
    const q=search.value.toLocaleLowerCase().trim(),kind=status.value,cls=classFilter.value;
    const sources=data.sources.filter(s=>{
      const materials=data.records.filter(r=>r.sourceId===s.source_id).map(r=>`${r.material} ${r.state}`).join(' ');
      return (!q||`${s.title} ${s.authors} ${s.citation_label} ${s.doi} ${s.source_id} ${s.material_classes?.join(' ')} ${materials}`.toLocaleLowerCase().includes(q))&&(!cls||s.material_classes?.includes(cls)||data.records.some(r=>r.sourceId===s.source_id&&r.class===cls))&&(kind==='all'||kind==='extracted'&&s.records>0||kind==='verified'&&s.verified>0||kind==='pending'&&s.records===0);
    }).sort((a,b)=>(b.year||0)-(a.year||0)||a.source_id.localeCompare(b.source_id));
    $('#source-count').textContent=`${sources.length} of ${data.sources.length} registered sources`;
    $('#source-list').innerHTML=sources.length?sources.map(s=>{
      const records=data.records.filter(r=>r.sourceId===s.source_id);
      return `<article class="source-item" id="${esc(s.source_id)}"><div class="source-id"><span class="source-year">${esc(s.year||'—')}</span>${esc(s.source_id)}</div><div><h2>${esc(s.title)}</h2><p class="source-citation">${esc(s.citation_label||s.authors)}${s.doi?` · DOI ${esc(s.doi)}`:''}</p><div class="source-tags">${(s.material_classes||[]).map(c=>`<span>${esc(c)}</span>`).join('')}<span>${s.records} evidence records</span>${s.verified?`<span>${s.verified} verified pairs</span>`:''}</div>${records.length?`<details><summary>Inspect extracted evidence (${records.length})</summary><div class="source-records">${records.map(r=>`<div class="source-record"><span>${esc(r.id)}</span><div><strong>${esc(r.material)}</strong> · ${esc(r.state||'State unreported')}<p>Reported HEL: ${property(r.hel,r.helMin,r.helMax)} GPa · Spall: ${property(r.spall,r.spallMin,r.spallMax)} GPa</p><p>${esc(r.locator)} · ${esc(methodName(r.completion))}</p>${r.status!=='positive_cloud'?`<p>${esc(r.status.replaceAll('_',' '))}: ${esc(r.unresolved||r.exclusion||r.notes)}</p>`:`<a href="explore.html?${r.verified?'view=pairs&record='+encodeURIComponent(r.id):'material='+encodeURIComponent(r.material)+'&record='+encodeURIComponent(r.id)}">Inspect on the map →</a>`}</div></div>`).join('')}</div></details>`:`<p class="source-note">No numerical evidence extracted yet. ${esc(s.next_action||'Awaiting extraction and review.')}</p>`}</div><div class="source-actions">${external(s.url,'Open paper')}${s.full_text_url&&s.full_text_url!==s.url?external(s.full_text_url,'Full text'):''}${records.some(r=>r.status==='positive_cloud')?`<a href="explore.html?source=${encodeURIComponent(s.source_id)}">Show on map →</a>`:''}<small>${esc(String(s.status||'Registered').replaceAll('_',' '))}</small></div></article>`;
    }).join(''):'<p class="no-results">No papers match these filters. Try another author, material or extraction status.</p>';
  }
  search.addEventListener('input',render);status.addEventListener('change',render);classFilter.addEventListener('change',render);render();
  if(location.hash){const el=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(el)el.scrollIntoView();}
}

boot();
