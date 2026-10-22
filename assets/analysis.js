import {esc, fmt} from './plot.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const NS = 'http://www.w3.org/2000/svg';
const safeUrl = value => {try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
const external = (url,label) => safeUrl(url)?`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
const list = value => Array.isArray(value)?value:[];
const color = value => /^#[0-9a-f]{6}$/i.test(value)?value:'#6e6e73';
const swatch = value => `<i class="swatch" style="--color:${color(value)}" aria-hidden="true"></i>`;
const numeric = value => typeof value==='number' && Number.isFinite(value);
const labelOf = point => point.material || point.id || 'Reviewed observation';
const sourceOf = point => point.citation || point.sourceId || 'Source paper';
const text = value => Array.isArray(value)?value.join(', '):String(value??'');
let nextPlot=0;

/* The browser only renders published coordinates. It never fits an embedding,
   manufactures a property counterpart or joins independent experiments. */
class PropertyScatter {
  constructor(container,{onSelect=()=>{}}={}){
    this.container=container;this.onSelect=onSelect;this.points=[];this.selected='';
    this.clip=`analysis-clip-${++nextPlot}`;this.svg=document.createElementNS(NS,'svg');
    this.svg.setAttribute('role','group');container.replaceChildren(this.svg);
    this.svg.addEventListener('click',event=>{if(this.moved)return;const p=event.target.closest('[data-analysis-point]');if(p)this.onSelect(p.dataset.analysisPoint);});
    this.svg.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.dataset.analysisPoint){event.preventDefault();this.onSelect(event.target.dataset.analysisPoint);}});
    this.svg.addEventListener('wheel',event=>{
      if(!this.domain||!this.points.length)return;event.preventDefault();
      const factor=event.deltaY>0?1.16:1/1.16;const [x0,x1,y0,y1]=this.domain;
      if((x1-x0)*factor<this.initialSpan[0]/100||(x1-x0)*factor>this.initialSpan[0]*10)return;
      const cx=(x0+x1)/2,cy=(y0+y1)/2;this.domain=[cx-(x1-x0)*factor/2,cx+(x1-x0)*factor/2,cy-(y1-y0)*factor/2,cy+(y1-y0)*factor/2];this.draw();
    },{passive:false});
    this.svg.addEventListener('pointerdown',event=>{if(event.button!==0||!this.domain)return;this.drag={x:event.clientX,y:event.clientY,domain:[...this.domain]};this.moved=false;});
    this.svg.addEventListener('pointermove',event=>{
      if(!this.drag)return;const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;
      if(Math.abs(dx)+Math.abs(dy)<5&&!this.moved)return;
      if(!this.moved)this.svg.setPointerCapture(event.pointerId);this.moved=true;
      const d=this.drag.domain;this.domain=[d[0]-dx/this.innerWidth*(d[1]-d[0]),d[1]-dx/this.innerWidth*(d[1]-d[0]),d[2]+dy/this.innerHeight*(d[3]-d[2]),d[3]+dy/this.innerHeight*(d[3]-d[2])];this.draw();
    });
    this.svg.addEventListener('pointerup',()=>{this.drag=null;});this.svg.addEventListener('pointercancel',()=>{this.drag=null;});
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(container);
  }
  setData(points,options={}){
    this.options={xKey:'x',yKey:'y',xLabel:'Coordinate 1',yLabel:'Coordinate 2',xLog:false,yLog:false,...options};
    const o=this.options;this.points=points.filter(p=>numeric(p[o.xKey])&&numeric(p[o.yKey])&&(!o.xLog||p[o.xKey]>0)&&(!o.yLog||p[o.yKey]>0));
    const tx=v=>o.xLog?Math.log10(v):v,ty=v=>o.yLog?Math.log10(v):v;
    if(this.points.length){
      const xs=this.points.map(p=>tx(p[o.xKey])),ys=this.points.map(p=>ty(p[o.yKey]));
      const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
      const xp=Math.max(o.xLog?.12:.1,(xmax-xmin)*.12),yp=Math.max(o.yLog?.12:.1,(ymax-ymin)*.15);
      this.domain=[xmin-xp,xmax+xp,ymin-yp,ymax+yp];
    }else this.domain=[0,1,0,1];
    this.initial=[...this.domain];this.initialSpan=[this.domain[1]-this.domain[0],this.domain[3]-this.domain[2]];this.draw();
  }
  reset(){this.domain=[...this.initial];this.draw();}
  select(id){const hadFocus=this.svg.contains(document.activeElement);this.selected=id;this.draw();if(hadFocus)this.svg.querySelector(`[data-analysis-point="${CSS.escape(id)}"]`)?.focus({preventScroll:true});}
  export(){const copy=this.svg.cloneNode(true),style=document.createElementNS(NS,'style');style.textContent='text{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}.plot-axis{fill:#6e6e73;font-size:10px}.plot-axis-label{fill:#4f4f54;font-size:11px;font-weight:500}.plot-grid{stroke:#dddde3;stroke-width:.65}.analysis-empty-title{font-size:14px;fill:#1d1d1f}.analysis-empty-text{font-size:10px;fill:#6e6e73}';copy.prepend(style);return new XMLSerializer().serializeToString(copy);}
  draw(){
    if(!this.options||!this.domain)return;
    const o=this.options,w=Math.max(260,this.container.clientWidth),marginal=Boolean(o.yCategories);
    const h=marginal?Math.max(235,o.yCategories.length*32+90):Math.max(310,Math.min(520,w*.76));
    const m={left:marginal?Math.min(140,w*.33):59,right:20,top:24,bottom:63};
    const iw=w-m.left-m.right,ih=h-m.top-m.bottom;this.innerWidth=iw;this.innerHeight=ih;
    const [x0,x1,y0,y1]=this.domain,tx=v=>o.xLog?Math.log10(v):v,ty=v=>o.yLog?Math.log10(v):v;
    const x=v=>m.left+(tx(v)-x0)/(x1-x0)*iw,y=v=>h-m.bottom-(ty(v)-y0)/(y1-y0)*ih;
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.style.height=`${h}px`;this.svg.setAttribute('aria-label',`${o.yLabel} versus ${o.xLabel}. ${this.points.length} selectable observations.`);
    if(!this.points.length){this.svg.innerHTML=`<rect width="${w}" height="${h}" fill="#f5f5f7" rx="14"/><text x="${w/2}" y="${h/2-20}" text-anchor="middle" class="analysis-empty-title">${esc(o.emptyTitle||'No supported observations in this view')}</text><text x="${w/2}" y="${h/2+10}" text-anchor="middle" class="analysis-empty-text">${esc(o.emptyText||'Missing properties remain unresolved.')}</text>`;return;}
    const ticks=(lo,hi,log)=>{
      if(log){const out=[];for(let e=Math.floor(lo);e<=Math.ceil(hi);e++)for(const k of [1,2,5]){const v=k*10**e;if(Math.log10(v)>=lo&&Math.log10(v)<=hi)out.push(v);}return out;}
      const rough=(hi-lo)/4,base=10**Math.floor(Math.log10(rough));const step=[1,2,5,10].map(n=>n*base).find(n=>n>=rough)||10*base;const out=[];for(let v=Math.ceil(lo/step)*step;v<=hi+step*.0001;v+=step)out.push(v);return out;
    };
    let markup=`<defs><clipPath id="${this.clip}"><rect x="${m.left}" y="${m.top}" width="${iw}" height="${ih}"/></clipPath></defs>`;
    for(const v of ticks(x0,x1,o.xLog)){markup+=`<line class="plot-grid" x1="${x(v)}" x2="${x(v)}" y1="${m.top}" y2="${h-m.bottom}"/><text class="plot-axis" text-anchor="middle" x="${x(v)}" y="${h-m.bottom+21}">${esc(fmt(v))}</text>`;}
    const yticks=marginal?o.yCategories.map((label,index)=>({value:index+1,label})):ticks(y0,y1,o.yLog).map(v=>({value:v,label:fmt(v)}));
    for(const t of yticks){const yp=y(t.value);if(yp<m.top||yp>h-m.bottom)continue;markup+=`<line class="plot-grid" x1="${m.left}" x2="${w-m.right}" y1="${yp}" y2="${yp}"/><text class="plot-axis" text-anchor="end" x="${m.left-9}" y="${yp+4}">${esc(t.label.length>21?t.label.slice(0,20)+'…':t.label)}</text>`;}
    markup+=`<path d="M${m.left} ${m.top}V${h-m.bottom}H${w-m.right}" fill="none" stroke="#b4b4bb"/><text class="plot-axis-label" text-anchor="middle" x="${m.left+iw/2}" y="${h-17}">${esc(o.xLabel)}</text>`;
    if(!marginal)markup+=`<text class="plot-axis-label" text-anchor="middle" transform="translate(15 ${m.top+ih/2}) rotate(-90)">${esc(o.yLabel)}</text>`;
    markup+=`<g clip-path="url(#${this.clip})">`;
    for(const p of this.points){
      const selected=p.id===this.selected,r=selected?7:5,px=x(p[o.xKey]),py=y(p[o.yKey]);
      const provisional=Boolean(p.toughnessMethod)&&/KQ|conditional|provisional/i.test(`${p.toughnessMethod} ${p.qualification||''}`);
      const tooltip=`${labelOf(p)} · ${sourceOf(p)} · ${o.xLabel}: ${fmt(p[o.xKey])}${marginal?'':` · ${o.yLabel}: ${fmt(p[o.yKey])}`}${p.toughnessMethod?' · '+p.toughnessMethod:''}`;
      const attributes=`class="analysis-point${selected?' selected':''}" data-analysis-point="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(tooltip)}" aria-pressed="${selected}" fill="${color(p.displayColor||p.color)}" fill-opacity=".76" stroke="${selected?'#1d1d1f':'#fff'}" stroke-width="${selected?2:1}"`;
      markup+=provisional?`<path ${attributes} d="M${px.toFixed(2)} ${(py-r-1).toFixed(2)}L${(px+r+1).toFixed(2)} ${(py+r).toFixed(2)}L${(px-r-1).toFixed(2)} ${(py+r).toFixed(2)}Z"><title>${esc(tooltip)}</title></path>`:`<circle ${attributes} cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${r}"><title>${esc(tooltip)}</title></circle>`;
    }
    this.svg.innerHTML=markup+'</g>';
  }
}

function classOptions(select,points){
  const previous=select.value;select.innerHTML='<option value="">All material classes</option>'+[...new Set(points.map(p=>p.class).filter(Boolean))].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');select.value=previous;
}
function legend(element,points){
  const entries=new Map(points.map(p=>[p.class||'Unclassified',color(p.color)]));element.innerHTML=[...entries].sort((a,b)=>a[0].localeCompare(b[0])).map(([name,c])=>`<span class="analysis-legend-item">${swatch(c)}${esc(name)}</span>`).join('');
}
function sections(element,items){if(!element)return;element.innerHTML=list(items).map(item=>`<article><h3>${esc(item.title||'Method')}</h3><p>${esc(item.text||item.description||'')}</p>${item.url?`<p class="analysis-source">${external(item.url,item.citation||'Open the supporting paper')}</p>`:''}</article>`).join('');}
function references(element,items){if(element)element.innerHTML=list(items).map(item=>external(item.url,item.title||item.citation||'Method reference')).filter(Boolean).join('');}
function details(point){
  const fields=[['Material class',point.class],['Material condition',point.state],['Evidence category',point.pairKind||point.kind],['Measurement method',point.method],['Yield test',point.yieldKind],['Toughness method',point.toughnessMethod],['Toughness qualification',point.qualification],['HEL',numeric(point.hel)?`${fmt(point.hel)} GPa`:null],['Spall strength',numeric(point.spall)?`${fmt(point.spall)} GPa`:null],['Yield strength',numeric(point.yieldMPa)?`${fmt(point.yieldMPa)} MPa`:null],['Reported toughness',numeric(point.toughnessMPaSqrtM)?`${fmt(point.toughnessMPaSqrtM)} MPa√m`:null],['Reported value',numeric(point.value)?`${fmt(point.value)} ${point.unit||''}`:null],['Extraction locator',point.locator],['Experiment / condition',point.experimentId],['Input records',list(point.recordIds).join(', ')]];
  const features=Object.entries(point.features||{});
  return `<div class="analysis-selection-heading"><div><p class="eyebrow">Selected evidence · ${esc(point.id||'')}</p><h3>${esc(labelOf(point))}</h3></div>${external(point.url,sourceOf(point))}</div><dl class="analysis-detail-grid">${fields.filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(text(v))}</dd></div>`).join('')}${features.map(([k,v])=>`<div><dt>${esc(point.featureLabels?.[k]||k.replaceAll('_',' '))}</dt><dd>${esc(numeric(v)?fmt(v):text(v))}</dd></div>`).join('')}</dl>${point.notes?`<p class="analysis-caption">${esc(point.notes)}</p>`:''}`;
}
function records(element,points){element.innerHTML=points.length?points.map(p=>`<button type="button" class="analysis-record" data-analysis-record="${esc(p.id)}">${swatch(p.color)}<span><strong>${esc(labelOf(p))}</strong><small>${esc(sourceOf(p))} · ${esc(p.method||p.kind||p.class||'Reviewed measurement')}</small></span><span class="analysis-record-arrow" aria-hidden="true">→</span></button>`).join(''):'<p class="no-results">No observations match these filters.</p>';}

function bootComparison(data){
  const statics=list(data.staticPoints),dynamics=list(data.dynamicPoints),yieldValues=list(data.staticMarginals?.yield),toughnessValues=list(data.staticMarginals?.toughness);
  const related=list(data.comparison?.relatedPlots).map((plot,index)=>({...plot,id:plot.id||`related-${index}`,points:list(plot.points).map((p,i)=>({...p,id:p.id||`related-${index}-${i}`}))}));
  const all=[...statics,...dynamics,...yieldValues,...toughnessValues,...related.flatMap(p=>p.points)];
  classOptions($('#comparison-class'),all);
  const plots=[],lookup=new Map(all.map(p=>[p.id,p]));
  function select(id){const p=lookup.get(id);if(!p)return;$('#comparison-selection').innerHTML=details(p);for(const plot of plots)plot.select(id);$$('[data-analysis-record]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.analysisRecord===id));}
  const staticPlot=new PropertyScatter($('#static-comparison-plot'),{onSelect:select}),dynamicPlot=new PropertyScatter($('#dynamic-comparison-plot'),{onSelect:select});
  const yieldPlot=new PropertyScatter($('#yield-marginal-plot'),{onSelect:select}),toughnessPlot=new PropertyScatter($('#toughness-marginal-plot'),{onSelect:select});plots.push(staticPlot,dynamicPlot,yieldPlot,toughnessPlot);
  const relatedPlots=[];
  if(related.length){$('#related-static-section').hidden=false;for(const group of related){const article=document.createElement('article');article.className='analysis-card';article.innerHTML=`<p class="eyebrow">Measured static properties</p><h3>${esc(group.title)}</h3><div class="analysis-plot" data-related-plot="${esc(group.id)}"></div><p class="analysis-caption">${esc(group.note||'Reported values linked within a reviewed source material condition. Inspect methods before comparison.')}</p>`;$('#related-static-plots').append(article);const plot=new PropertyScatter(article.querySelector('.analysis-plot'),{onSelect:select});relatedPlots.push({group,plot});plots.push(plot);}}
  const reasons=list(data.comparison?.unmatchedReasons).map(r=>typeof r==='string'?r:r.reason||r.text).filter(Boolean);
  const comparisonStatus={no_matched_specimens:'No verified shared specimens connect all four properties.'}[data.comparison?.status]||data.comparison?.status||'The cross-regime comparison is limited by matched coverage.';
  $('#comparison-status').innerHTML=`<strong>${esc(comparisonStatus)}</strong><p>${esc(data.comparison?.scope||'A material name alone does not establish the same state or test condition.')}</p>${reasons.length?`<ul>${reasons.map(r=>`<li>${esc(r)}</li>`).join('')}</ul>`:''}`;
  function render(){
    const chosen=$('#comparison-class').value,q=$('#comparison-search').value.toLocaleLowerCase().trim();
    const match=p=>(!chosen||p.class===chosen)&&(!q||`${labelOf(p)} ${sourceOf(p)} ${p.state||''}`.toLocaleLowerCase().includes(q));
    const s=statics.filter(match),d=dynamics.filter(match),ys=yieldValues.filter(match),ks=toughnessValues.filter(match);
    staticPlot.setData(s,{xKey:'yieldMPa',yKey:'toughnessMPaSqrtM',xLabel:'Yield strength (MPa)',yLabel:'Fracture toughness (MPa√m)',xLog:true,yLog:true,emptyText:'Yield and toughness do not share a reviewed condition.'});
    dynamicPlot.setData(d,{xKey:'hel',yKey:'spall',xLabel:'Hugoniot elastic limit (GPa)',yLabel:'Spall strength (GPa)',xLog:true,yLog:true});
    $('#static-map-count').textContent=`${s.length} pairs`;$('#dynamic-map-count').textContent=`${d.length} reported pairs`;
    for(const [points,plot,label] of [[ys,yieldPlot,'Yield strength (MPa)'],[ks,toughnessPlot,'Fracture toughness (MPa√m)']]){
      const classes=[...new Set(points.map(p=>p.class||'Unclassified'))].sort();plot.setData(points.map(p=>({...p,classRow:classes.indexOf(p.class||'Unclassified')+1})),{xKey:'value',yKey:'classRow',xLabel:label,yLabel:'Material class',xLog:true,yCategories:classes,emptyText:'No reviewed values match these filters.'});
    }
    for(const {group,plot} of relatedPlots)plot.setData(group.points.filter(match),{xLabel:group.xLabel,yLabel:group.yLabel,xLog:true,yLog:true});
    const shown=all.filter(match);records($('#comparison-records'),shown);$('#comparison-record-count').textContent=`(${shown.length})`;legend($('#comparison-legend'),shown);
  }
  $('#comparison-class').addEventListener('change',render);$('#comparison-search').addEventListener('input',render);$('#comparison-clear').addEventListener('click',()=>{$('#comparison-class').value='';$('#comparison-search').value='';$('#comparison-selection').innerHTML='<p>Select a plotted observation or a record below to inspect its source.</p>';render();});
  $('#comparison-records').addEventListener('click',event=>{const b=event.target.closest('[data-analysis-record]');if(b)select(b.dataset.analysisRecord);});
  sections($('#analysis-discussion'),data.discussion);sections($('#analysis-methods'),data.methods);references($('#analysis-references'),data.references);
  const coverage=list(data.coverage);$('#analysis-property-coverage').innerHTML=`<table class="analysis-table"><caption>Reviewed values are counted once per property. Counts do not imply matched conditions.</caption><thead><tr><th scope="col">Property</th><th scope="col">Values</th><th scope="col">Conditions</th><th scope="col">Papers</th><th scope="col">Classes</th><th scope="col">Unit</th></tr></thead><tbody>${coverage.map(c=>`<tr><th scope="row">${esc(c.property)}</th><td>${esc(c.values)}</td><td>${esc(c.experiments)}</td><td>${esc(c.papers)}</td><td>${esc(text(c.classes))}</td><td>${esc(c.unit)}</td></tr>`).join('')}</tbody></table>`;
  render();
}

function bootEmbeddings(data){
  const groups=list(data.embeddings),select=$('#embedding-select');
  select.innerHTML=groups.map((g,index)=>`<option value="${index}">${esc(g.title||g.id)} · ${esc(g.method||'Precomputed')}</option>`).join('');
  if(!groups.length){$('#embedding-status').textContent='No embedding cohort meets the reviewed-data requirements yet.';return;}
  const plot=new PropertyScatter($('#embedding-plot'),{onSelect:choose});let current=groups[0],shown=[];
  const pointId=(p,i)=>p.id||`${current.id}-${i}`;
  function choose(id){const p=shown.find(p=>p.id===id);if(!p)return;$('#embedding-selection').innerHTML=details({...p,featureLabels:current.featureLabels});plot.select(id);$$('[data-analysis-record]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.analysisRecord===id));}
  function diagnostics(){
    const d=current.diagnostics||{},features=list(current.features);
    $('#embedding-method-label').textContent=current.method||'Precomputed coordinates';$('#embedding-title').textContent=current.title||'Embedding';
    const outcomeWarning=current.outcomesExcluded?'HEL and spall are held out of the input features. Outcome colours are descriptive associations within this cohort.':'HEL and/or spall are input features in this view. Colour separation by an input outcome is descriptive, not evidence of an independent predictor.';
    const statusLabel={computed:'Computed from the reviewed complete-case cohort.',insufficient_data:'Too few complete features or observations to fit this view.',dependency_unavailable:'The required analysis dependency was unavailable at build time.'}[current.status]||current.status||'Precomputed exploratory view';
    $('#embedding-status').innerHTML=`<strong>${esc(statusLabel)}</strong><p>${esc(current.scope||'')}</p><p>${esc(outcomeWarning)}</p>`;
    const rows=[['Cohort size',d.n??list(current.points).length],['Papers',d.papers],['Material classes',d.classes],['Scaling',d.featureScaling],['Neighbour preservation',numeric(d.neighborPreservation)?`${fmt(d.neighborPreservation)}`:d.neighborPreservation],['Same-paper neighbours',numeric(d.sourceNeighborFraction)?`${fmt(d.sourceNeighborFraction*100)}%`:d.sourceNeighborFraction],['Random paper baseline',numeric(d.sourceRandomBaseline)?`${fmt(d.sourceRandomBaseline*100)}%`:d.sourceRandomBaseline]];
    $('#embedding-inputs').innerHTML=`<p class="analysis-caption">Input features</p><ul class="feature-tags">${features.map(f=>`<li>${esc(typeof f==='string'?(current.featureLabels?.[f]||f):f.label||f.name)}</li>`).join('')}</ul><dl class="diagnostic-list">${rows.filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(text(v))}</dd></div>`).join('')}</dl>${d.note?`<p class="analysis-caption">${esc(d.note)}</p>`:''}${list(d.stability).length?`<details class="stability-detail"><summary>Stability checks</summary><ul>${list(d.stability).map(s=>`<li>${esc(typeof s==='string'?s:`${s.parameter}; neighbour agreement ${fmt(s.neighborAgreement)}`)}</li>`).join('')}</ul></details>`:''}`;
    const associations=list(current.associations),assoc=$('#embedding-associations');
    assoc.innerHTML=associations.length?`<p class="eyebrow">Inputs and measured response</p><h3>Associations, with the source effect visible.</h3><p class="analysis-lead">Spearman rank correlations describe this complete-case cohort. Each paper contributes multiple observations to the pooled result; paper-median and leave-one-paper-out results show how study sampling can change it. These are not causal or validated predictive effects.</p><div class="analysis-table-wrap"><table class="analysis-table"><caption>Numbers use the complete precomputed cohort; a class display filter does not recalculate them.</caption><thead><tr><th scope="col">Input → response</th><th scope="col">N / papers</th><th scope="col">Pooled ρ</th><th scope="col">Paper-median ρ</th><th scope="col">Leave-one-paper range</th></tr></thead><tbody>${associations.map(a=>`<tr><th scope="row">${esc(current.featureLabels?.[a.feature]||a.feature)} → ${a.outcome==='hel'?'HEL':'Spall'}</th><td>${esc(a.n)} / ${esc(a.papers)}</td><td>${numeric(a.spearman)?fmt(a.spearman):'Undefined'}</td><td>${numeric(a.paperMedianSpearman)?fmt(a.paperMedianSpearman):'Undefined'}</td><td>${list(a.leaveOnePaperRange).length===2?a.leaveOnePaperRange.map(v=>fmt(v)).join(' to '):'Unavailable'}</td></tr>`).join('')}</tbody></table></div><details class="stability-detail"><summary>Within-paper associations</summary>${associations.map(a=>`<p>${esc(current.featureLabels?.[a.feature]||a.feature)} → ${a.outcome==='hel'?'HEL':'Spall'}</p><ul>${list(a.withinPaper).map(w=>`<li>${esc(w.sourceId)} · n=${esc(w.n)} · ρ=${numeric(w.rho)?fmt(w.rho):'undefined'}</li>`).join('')}</ul>`).join('')}</details>`:'<p class="analysis-caption">No independent input-to-dynamic-response association is reported for this cohort. Outcome-only embeddings reuse the response values; static-only cohorts lack matched dynamic tests.</p>';
    const colors=$('#embedding-color');for(const option of colors.options)if(option.value!=='class')option.disabled=!list(current.points).some(p=>numeric(p[option.value]));if(colors.selectedOptions[0]?.disabled)colors.value='class';
  }
  function render(){
    const cls=$('#embedding-class').value,by=$('#embedding-color').value;
    shown=list(current.points).map((p,i)=>({...p,id:pointId(p,i)})).filter(p=>!cls||p.class===cls);
    if(by!=='class'){
      const values=list(current.points).map(p=>p[by]).filter(v=>numeric(v)&&v>0),logs=values.map(Math.log10),lo=Math.min(...logs),hi=Math.max(...logs);
      shown=shown.map(p=>{if(!numeric(p[by])||p[by]<=0)return {...p,displayColor:'#b4b4bb'};const t=hi===lo?.5:(Math.log10(p[by])-lo)/(hi-lo);const from=[43,82,159],to=[184,53,31];return {...p,displayColor:'#'+from.map((v,i)=>Math.round(v+(to[i]-v)*t).toString(16).padStart(2,'0')).join('')};});
    }
    plot.setData(shown,{xLabel:current.method?.toLowerCase().includes('diffusion')?'Diffusion coordinate 1':'Embedding coordinate 1',yLabel:current.method?.toLowerCase().includes('diffusion')?'Diffusion coordinate 2':'Embedding coordinate 2',emptyText:'This cohort lacks the required matched features.'});
    $('#embedding-count').textContent=`${shown.length} observations`;
    if(by==='class')legend($('#embedding-legend'),shown);else {const vals=list(current.points).map(p=>p[by]).filter(v=>numeric(v)&&v>0);$('#embedding-legend').innerHTML=vals.length?`<span class="analysis-legend-item">${swatch('#2b529f')}${fmt(Math.min(...vals))} GPa</span><span class="analysis-legend-item">${swatch('#b8351f')}${fmt(Math.max(...vals))} GPa</span><span class="analysis-caption">${by==='hel'?'HEL':'Spall strength'} · logarithmic colour scale · grey = unreported</span>`:'';}
    records($('#embedding-records'),shown);$('#embedding-record-count').textContent=`(${shown.length})`;
  }
  function change(){current=groups[Number(select.value)||0];classOptions($('#embedding-class'),list(current.points));$('#embedding-class').value='';$('#embedding-selection').innerHTML='<p>Select an observation to inspect its source and measured values.</p>';diagnostics();render();}
  select.addEventListener('change',change);$('#embedding-color').addEventListener('change',render);$('#embedding-class').addEventListener('change',render);$('#embedding-reset').addEventListener('click',()=>{$('#embedding-class').value='';$('#embedding-color').value='class';render();});
  $('#embedding-records').addEventListener('click',event=>{const b=event.target.closest('[data-analysis-record]');if(b)choose(b.dataset.analysisRecord);});
  $('#embedding-export').addEventListener('click',()=>{const blob=new Blob([plot.export()],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`dynamic-ashby-${current.id||'embedding'}.svg`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  sections($('#embedding-methods'),data.methods);references($('#embedding-references'),data.references);change();
}

async function boot(){
  const page=$('[data-analysis-page]');if(!page)return;
  try{
    const response=await fetch(new URL('../data/analysis.json',import.meta.url),{cache:'no-cache'});if(!response.ok)throw new Error(`Analysis request returned ${response.status}`);const data=await response.json();
    $$('[data-analysis-count]').forEach(el=>{const v=data.summary?.[el.dataset.analysisCount];el.textContent=numeric(v)?v.toLocaleString():'—';});
    if(page.dataset.analysisPage==='comparison')bootComparison(data);else bootEmbeddings(data);
    document.documentElement.dataset.analysisReady='true';
  }catch(error){const el=document.createElement('div');el.className='load-error page-width';el.setAttribute('role','alert');el.innerHTML='<strong>The property analysis could not be loaded.</strong><br>Rebuild the website from the reviewed literature inputs, serve it over HTTP, then reload.';page.prepend(el);console.error(error);}
}
boot();
