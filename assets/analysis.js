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
const isCloud = value => Array.isArray(value?.boundary) && value.boundary.length>2;
const isReference = value => value?.referenceEnvelope===true || value?.basis==='published_reference_envelope';
const labelOf = point => point.material || point.id || 'Reviewed observation';
const sourceOf = point => point.citation || point.sourceId || 'Source paper';
const text = value => Array.isArray(value)?value.join(', '):String(value??'');
const readable = value => text(value).replaceAll('_',' ');
const propertyUnit = (value,fallback) => /MPa\s*m\^0\.5/i.test(value||'')?'MPa√m':value||fallback;
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
    const o=this.options;this.points=points.filter(p=>isCloud(p)?p.boundary.every(([x,y])=>numeric(x)&&numeric(y)&&(!o.xLog||x>0)&&(!o.yLog||y>0)):numeric(p[o.xKey])&&numeric(p[o.yKey])&&(!o.xLog||p[o.xKey]>0)&&(!o.yLog||p[o.yKey]>0));
    if(!this.points.some(p=>p.id===this.selected))this.selected='';
    const tx=v=>o.xLog?Math.log10(v):v,ty=v=>o.yLog?Math.log10(v):v;
    if(this.points.length){
      const coordinates=this.points.flatMap(p=>isCloud(p)?p.boundary:[[p[o.xKey],p[o.yKey]]]);
      const xs=coordinates.map(p=>tx(p[0])),ys=coordinates.map(p=>ty(p[1]));
      const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
      const xp=Math.max(o.xLog?.12:.1,(xmax-xmin)*.12),yp=Math.max(o.yLog?.12:.1,(ymax-ymin)*.15);
      this.domain=[xmin-xp,xmax+xp,ymin-yp,ymax+yp];
    }else this.domain=[0,1,0,1];
    this.initial=[...this.domain];this.initialSpan=[this.domain[1]-this.domain[0],this.domain[3]-this.domain[2]];this.draw();
  }
  reset(){this.domain=[...this.initial];this.draw();}
  select(id){const hadFocus=this.svg.contains(document.activeElement);this.selected=id;this.draw();if(hadFocus)this.svg.querySelector(`[data-analysis-point="${CSS.escape(id)}"]`)?.focus({preventScroll:true});}
  export(){const copy=this.svg.cloneNode(true),style=document.createElementNS(NS,'style');style.textContent='text{font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}.plot-axis{fill:#6e6e73;font-size:10px}.plot-axis-label{fill:#4f4f54;font-size:11px;font-weight:500}.plot-grid{stroke:#dddde3;stroke-width:.65}.analysis-empty-title{font-size:14px;fill:#1d1d1f}.analysis-empty-text{font-size:10px;fill:#6e6e73}.analysis-cloud-label{paint-order:stroke;stroke:#f5f5f7;stroke-width:3;stroke-linejoin:round;fill:#4f4f54;font-weight:500}';copy.prepend(style);return new XMLSerializer().serializeToString(copy);}
  draw(){
    if(!this.options||!this.domain)return;
    const o=this.options,w=Math.max(260,this.container.clientWidth),marginal=Boolean(o.yCategories);
    const h=marginal?Math.max(235,o.yCategories.length*32+90):Math.max(310,Math.min(520,w*.76));
    const m={left:marginal?Math.min(140,w*.33):59,right:20,top:24,bottom:63};
    const iw=w-m.left-m.right,ih=h-m.top-m.bottom;this.innerWidth=iw;this.innerHeight=ih;
    const [x0,x1,y0,y1]=this.domain,tx=v=>o.xLog?Math.log10(v):v,ty=v=>o.yLog?Math.log10(v):v;
    const x=v=>m.left+(tx(v)-x0)/(x1-x0)*iw,y=v=>h-m.bottom-(ty(v)-y0)/(y1-y0)*ih;
    const referenceCount=this.points.filter(isReference).length;
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.style.height=`${h}px`;this.svg.setAttribute('aria-label',`${o.yLabel} versus ${o.xLabel}. ${referenceCount?`${referenceCount} published reference ranges and ${this.points.length-referenceCount} reviewed objects`:`${this.points.length} selectable ${this.points.some(isCloud)?'material clouds':'observations'}`}.`);
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
    const ordered=[...this.points].sort((a,b)=>(a.id===this.selected?1:0)-(b.id===this.selected?1:0)||Number(!isReference(a))-Number(!isReference(b))||(b.count||0)-(a.count||0));
    for(const p of ordered){
      if(isCloud(p)){
        const selected=p.id===this.selected,dim=this.selected&&!selected,reference=isReference(p);
        const family=String(p.toughnessFamily||'').toLowerCase();
        const dash=reference?'10 4':p.basis==='yield_model'||family.includes('provisional')||family.includes('kq')?'2 3':p.basis==='matched_or_substituted'||family.includes('indentation')?'6 3':'';
        const shape=p.boundary.map(([xx,yy],i)=>`${i?'L':'M'}${x(xx).toFixed(2)},${y(yy).toFixed(2)}`).join('')+'Z';
        const tooltip=reference?`${labelOf(p)} · Published reference range · ${p.strengthDefinition||'Strength definition in source'} · ${p.toughnessDefinition||'Fracture toughness as reported'}`:`${labelOf(p)} · ${p.count} supporting records${p.yieldKind?' · '+p.yieldKind:''}${p.toughnessFamily?' · '+p.toughnessFamily:''}`;
        const opacity=reference?(dim?.04:selected?.24:.12):(dim?.07:selected?.42:Math.max(.1,Math.min(.42,numeric(p.alpha)?p.alpha:.22)));
        markup+=`<path class="analysis-cloud${reference?' analysis-cloud-reference':''}" data-analysis-point="${esc(p.id)}" data-analysis-cloud="${esc(p.id)}"${reference?` data-analysis-reference="${esc(p.id)}"`:''} role="button" tabindex="0" aria-label="${esc(tooltip)}" aria-pressed="${selected}" d="${shape}" fill="${color(p.color)}" fill-opacity="${opacity}" stroke="${color(p.color)}" stroke-opacity="${dim?.4:1}" stroke-width="${selected?2.5:1.3}" stroke-dasharray="${dash}"><title>${esc(tooltip)}</title></path>`;
        continue;
      }
      const selected=p.id===this.selected,r=selected?7:5,px=x(p[o.xKey]),py=y(p[o.yKey]);
      const provisional=Boolean(p.toughnessMethod)&&/KQ|conditional|provisional/i.test(`${p.toughnessMethod} ${p.qualification||''}`);
      const tooltip=`${labelOf(p)} · ${sourceOf(p)} · ${o.xLabel}: ${fmt(p[o.xKey])}${marginal?'':` · ${o.yLabel}: ${fmt(p[o.yKey])}`}${p.toughnessMethod?' · '+p.toughnessMethod:''}`;
      const attributes=`class="analysis-point${selected?' selected':''}" data-analysis-point="${esc(p.id)}" role="button" tabindex="0" aria-label="${esc(tooltip)}" aria-pressed="${selected}" fill="${color(p.displayColor||p.color)}" fill-opacity=".76" stroke="${selected?'#1d1d1f':'#fff'}" stroke-width="${selected?2:1}"`;
      markup+=provisional?`<path ${attributes} d="M${px.toFixed(2)} ${(py-r-1).toFixed(2)}L${(px+r+1).toFixed(2)} ${(py+r).toFixed(2)}L${(px-r-1).toFixed(2)} ${(py+r).toFixed(2)}Z"><title>${esc(tooltip)}</title></path>`:`<circle ${attributes} cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${r}"><title>${esc(tooltip)}</title></circle>`;
    }
    if(o.labels){
      const boxes=[];
      for(const p of [...ordered].reverse().filter(isCloud)){
        const xmin=p.xMin??p.yieldMin??p.helMin,xmax=p.xMax??p.yieldMax??p.helMax,ymin=p.yMin??p.toughnessMin??p.spallMin,ymax=p.yMax??p.toughnessMax??p.spallMax;
        if(![xmin,xmax,ymin,ymax].every(v=>numeric(v)&&v>0))continue;
        const cx=x(Math.sqrt(xmin*xmax)),cy=y(Math.sqrt(ymin*ymax)),font=w<450?8:9;
        let label=labelOf(p);
        if(p.scope==='class'&&p.yieldKind){
          const kind=/compress/i.test(p.yieldKind)?'compressive':'tensile',family=/KQ|provisional/i.test(p.toughnessFamily||'')?'KQ':/elastic.plastic/i.test(p.toughnessFamily||'')?'KJc':/indentation/i.test(p.toughnessFamily||'')?'indentation':/plane.stress/i.test(p.toughnessFamily||'')?'plane stress':/notched/i.test(p.toughnessFamily||'')?'notched':'reported';
          label+=` · ${kind}/${family}`;
        }else if(/KQ|provisional/i.test(p.toughnessFamily||''))label+=' (KQ)';
        if(label.length>40)label=label.slice(0,37)+'…';
        const bw=label.length*font*.5,bh=font+6;
        for(const [dx,dy] of [[7,-7],[7,15],[-bw-7,-7],[-bw-7,15],[-bw/2,-22]]){
          const bx=cx+dx,by=cy+dy-bh+3;
          if(bx<m.left+3||bx+bw>w-m.right-3||by<m.top||by+bh>h-m.bottom-2)continue;
          if(p.id!==this.selected&&boxes.some(b=>bx<b.x+b.w+4&&bx+bw+4>b.x&&by<b.y+b.h+3&&by+bh+3>b.y))continue;
          boxes.push({x:bx,y:by,w:bw,h:bh});markup+=`<text class="analysis-cloud-label" x="${bx}" y="${cy+dy}" font-size="${font}" opacity="${this.selected&&p.id!==this.selected?.5:1}">${esc(label)}</text>`;break;
        }
      }
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
  const fields=[['Material class',point.class],['Material condition',point.state],['Evidence category',point.pairKind||point.kind],['Measurement method',point.method],['Full test context',point.measurementMethod!==point.method?point.measurementMethod:null],['Yield test',point.yieldKind],['Toughness method',point.toughnessMethod],['Toughness qualification',point.qualification],['HEL',numeric(point.hel)?`${fmt(point.hel)} GPa`:null],['Spall strength',numeric(point.spall)?`${fmt(point.spall)} GPa`:null],['Yield strength',numeric(point.yieldMPa)?`${fmt(point.yieldMPa)} MPa`:null],['Reported toughness',numeric(point.toughnessMPaSqrtM)?`${fmt(point.toughnessMPaSqrtM)} MPa√m`:null],['Reported value',numeric(point.value)?`${fmt(point.value)} ${point.unit||''}`:null],['Extraction locator',point.locator],['Experiment / condition',point.experimentId],['Input records',list(point.recordIds).join(', ')]];
  const features=Object.entries(point.features||{});
  return `<div class="analysis-selection-heading"><div><p class="eyebrow">Selected evidence · ${esc(point.id||'')}</p><h3>${esc(labelOf(point))}</h3></div>${external(point.url,sourceOf(point))}</div><dl class="analysis-detail-grid">${fields.filter(([,v])=>v!=null&&v!=='').map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(text(v))}</dd></div>`).join('')}${features.map(([k,v])=>`<div><dt>${esc(point.featureLabels?.[k]||k.replaceAll('_',' '))}</dt><dd>${esc(numeric(v)?fmt(v):text(v))}</dd></div>`).join('')}</dl>${point.notes?`<p class="analysis-caption">${esc(point.notes)}</p>`:''}`;
}
function records(element,points){element.innerHTML=points.length?points.map(p=>`<button type="button" class="analysis-record" data-analysis-record="${esc(p.id)}">${swatch(p.color)}<span><strong>${esc(labelOf(p))}</strong><small>${esc(isReference(p)?`Published reference range · ${p.strengthDefinition||p.class||'Source-defined strength'}`:isCloud(p)?`${p.regime==='static'?'Static':'Dynamic'} cloud · ${p.count} supporting records${p.toughnessFamily?' · '+p.toughnessFamily:''}`:`${sourceOf(p)} · ${p.method||p.kind||p.class||'Reviewed measurement'}`)}</small></span><span class="analysis-record-arrow" aria-hidden="true">→</span></button>`).join(''):'<p class="no-results">No observations match these filters.</p>';}

function cloudSources(cloud){
  const supports=Object.values(cloud.supports||{}).flatMap(list);
  const items=[...list(cloud.sources),...supports],sources=new Map();
  for(const s of items){const key=safeUrl(s.url)||s.sourceId;if(key&&!sources.has(key))sources.set(key,{sourceId:s.sourceId,citation:s.citation,url:s.url});}
  for(const support of supports)for(const url of list(support.urls)){const key=safeUrl(url);if(key&&!sources.has(key))sources.set(key,{url:key,citation:`Coordinate / model source · ${new URL(key).hostname}`});}
  return [...sources.values()];
}
function propertyExtent(min,max,unit){return numeric(min)&&numeric(max)?`${min===max?fmt(min):`${fmt(min)}–${fmt(max)}`} ${unit}`:'See source records';}
function publishedReferenceDetails(envelope){
  const sources=list(envelope.sources),fields=[
    ['Material class',envelope.class],
    ['Strength range',propertyExtent(envelope.xMin,envelope.xMax,'MPa')],
    ['Strength definition',envelope.strengthDefinition||'Inspect the source strength convention'],
    ['Toughness range',propertyExtent(envelope.yMin,envelope.yMax,'MPa√m')],
    ['Toughness definition',envelope.toughnessDefinition||'Fracture toughness as reported in the source'],
    ['Range construction',envelope.extractionBasis||'Published reference envelope'],
    ['Source locator',envelope.locator||'See the cited source'],
  ];
  return `<div class="analysis-selection-heading"><div><p class="eyebrow">Published reference envelope · ${esc(envelope.class||'Material family')}</p><h3>${esc(labelOf(envelope))}</h3></div><span class="detail-badge">Published context only</span></div><dl class="analysis-detail-grid">${fields.map(([key,value])=>`<div><dt>${esc(key)}</dt><dd>${esc(text(value))}</dd></div>`).join('')}</dl><p class="analysis-caption">${esc(envelope.notes||'This range provides published material-selection context; its interior does not represent newly measured paired observations.')} Source-defined yield, flow and failure strengths remain distinct. Reference ranges do not enter the experimental counts, rankings or multivariable analyses.</p><div class="cloud-source-section"><h4>Published sources (${sources.length})</h4><div class="reference-source-list">${sources.map(source=>`<article>${external(source.url,source.citation||source.title||source.sourceId||'Open source')} ${source.title&&source.title!==source.citation?`<p>${esc(source.title)}</p>`:''}${source.locator?`<p>${esc(source.locator)}</p>`:''}${source.doi?`<small>DOI: ${esc(source.doi)}</small>`:''}</article>`).join('')||'<p class="analysis-caption">The source record is unavailable for this range.</p>'}</div></div>`;
}
function cloudDetails(cloud){
  const isStatic=cloud.regime==='static',classView=cloud.scope==='class',axes=isStatic?[['yield','Yield strength','MPa'],['toughness','Fracture toughness','MPa√m']]:[['hel','HEL','GPa'],['spall','Spall strength','GPa']];
  const sources=cloudSources(cloud),basis={reported:'Reported coordinates',matched_or_substituted:'Includes matched or substituted coordinates',yield_model:'Includes yield-based HEL estimates',independent_measured_property_extents:'Independent measured property extents',independent_class_property_extents:'Independent class property extents'}[cloud.basis]||text(cloud.basis).replaceAll('_',' ');
  const supportList=([key,label,unit])=>{
    const rows=list(cloud.supports?.[key]);
    return `<details class="cloud-support" open><summary>${esc(label)} supports (${rows.length})</summary><ul>${rows.map(r=>`<li><strong>${esc(numeric(r.value)?`${fmt(r.value)} ${propertyUnit(r.unit,unit)}`:numeric(r.min)&&numeric(r.max)?propertyExtent(r.min,r.max,propertyUnit(r.unit,unit)):'Range / basis in source')}</strong><small>${numeric(r.value)?'Reported value':r.inferred?'Completed plotting extent; not a measured counterpart':'Reported extent / source basis'}</small>${r.material?`<span class="cloud-support-material">${esc(r.material)}</span>`:''}<span>${esc(readable([r.method,r.measurementMethod!==r.method?r.measurementMethod:null,r.qualification,r.state].filter(Boolean).join(' · ')))}</span>${external(r.url,sourceOf(r))}${list(r.urls).filter(url=>safeUrl(url)&&safeUrl(url)!==safeUrl(r.url)).map((url,index)=>external(url,`Coordinate / model source ${index+1}`)).join('')}<small>${esc(r.locator||'')}${r.basis?` · ${esc(readable(r.basis))}`:''}${list(r.donorIds).filter(Boolean).length?` · Donor records: ${esc(r.donorIds.filter(Boolean).join(', '))}`:''}${r.notes?` · ${esc(r.notes)}`:''}</small></li>`).join('')}</ul>${rows.length?'':'<p class="analysis-caption">Inspect the original records and source/model links for this coordinate.</p>'}</details>`;
  };
  return `<div class="analysis-selection-heading"><div><p class="eyebrow">${isStatic?'Static':'Dynamic'} ${classView?'class coverage':'material cloud'} · ${esc(cloud.class)}</p><h3>${esc(cloud.material)}</h3></div><span class="detail-badge">${esc(basis||'Reported property coverage')}</span></div>${isStatic?`<p class="cloud-method-label">${esc([cloud.yieldKind,cloud.toughnessFamily].filter(Boolean).join(' · '))}</p>`:''}<dl class="analysis-detail-grid"><div><dt>${isStatic?'Yield strength extent':'HEL extent'}</dt><dd>${esc(propertyExtent(cloud.xMin,cloud.xMax,isStatic?'MPa':'GPa'))}</dd></div><div><dt>${isStatic?'Toughness extent':'Spall extent'}</dt><dd>${esc(propertyExtent(cloud.yMin,cloud.yMax,isStatic?'MPa√m':'GPa'))}</dd></div><div><dt>Supporting records</dt><dd>${esc(cloud.count)} unique inputs · ${esc(cloud.xCount??list(cloud.supports?.[axes[0][0]]).length)} ${axes[0][1]} supports · ${esc(cloud.yCount??list(cloud.supports?.[axes[1][0]]).length)} ${axes[1][1]} supports</dd></div>${classView?`<div><dt>Exact material labels</dt><dd>${esc(cloud.supportMaterialCount??new Set(Object.values(cloud.supports||{}).flatMap(list).map(r=>r.material).filter(Boolean)).size)} supporting materials; the two axes can be supported by different alloys or states.</dd></div>`:''}${cloud.inferred?`<div><dt>Inferred coordinates</dt><dd>${esc(cloud.inferred)} original records include completion; these are not additional measured pairs.</dd></div>`:''}${list(cloud.qualifications).length?`<div><dt>Toughness qualification</dt><dd>${esc(readable(cloud.qualifications.join('; ')))}</dd></div>`:''}</dl><p class="analysis-caption">${esc(cloud.notes||'This cloud encloses independent property extents for the named material across available conditions. Its interior is not a collection of observed paired tests.')}${cloud.padded?' Minimum drawing width was applied; the added width is not measured scatter.':''}</p><div class="cloud-source-section"><h4>All supporting papers (${sources.length})</h4><div class="cloud-paper-links">${sources.map(s=>external(s.url,s.citation||s.sourceId||'Source paper')).join('')}</div></div><div class="cloud-support-grid">${axes.map(supportList).join('')}</div>`;
}

function bootComparison(data){
  const context=data.publishedStaticContext||{},referenceEnvelopes=list(context.envelopes).map(envelope=>({...envelope,regime:'static',referenceEnvelope:true}));
  const statics=list(data.staticPoints),dynamics=list(data.dynamicPoints),yieldValues=list(data.staticMarginals?.yield),toughnessValues=list(data.staticMarginals?.toughness);
  const staticClouds=list(data.staticClouds).map(c=>({...c,regime:'static'})),dynamicClouds=list(data.dynamicClouds).map(c=>({...c,regime:'dynamic'}));
  const staticClassClouds=list(data.staticClassClouds).map(c=>({...c,regime:'static'})),dynamicClassClouds=list(data.dynamicClassClouds).map(c=>({...c,regime:'dynamic'}));
  const related=list(data.comparison?.relatedPlots).map((plot,index)=>({...plot,id:plot.id||`related-${index}`,points:list(plot.points).map((p,i)=>({...p,id:p.id||`related-${index}-${i}`}))}));
  const all=[...referenceEnvelopes,...staticClouds,...dynamicClouds,...staticClassClouds,...dynamicClassClouds,...statics,...dynamics,...yieldValues,...toughnessValues,...related.flatMap(p=>p.points)];
  $$('[data-cloud-count]').forEach(el=>el.textContent=list(data[el.dataset.cloudCount]).length.toLocaleString());
  classOptions($('#comparison-class'),all);
  const plots=[],lookup=new Map(all.map(p=>[p.id,p]));let view='clouds',staticDataset=referenceEnvelopes.length?'published':'reviewed';
  const datasetSelect=$('#static-dataset');datasetSelect.value=staticDataset;datasetSelect.querySelector('[value="published"]').disabled=!referenceEnvelopes.length;
  function select(id){const p=lookup.get(id);if(!p)return;$('#comparison-selection').innerHTML=isReference(p)?publishedReferenceDetails(p):isCloud(p)?cloudDetails(p):details(p);for(const plot of plots)plot.select(id);$$('[data-analysis-record]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.analysisRecord===id));}
  const staticPlot=new PropertyScatter($('#static-comparison-plot'),{onSelect:select}),dynamicPlot=new PropertyScatter($('#dynamic-comparison-plot'),{onSelect:select});
  const yieldPlot=new PropertyScatter($('#yield-marginal-plot'),{onSelect:select}),toughnessPlot=new PropertyScatter($('#toughness-marginal-plot'),{onSelect:select});plots.push(staticPlot,dynamicPlot,yieldPlot,toughnessPlot);
  const relatedPlots=[];
  if(related.length){$('#related-static-section').hidden=false;for(const group of related){const article=document.createElement('article');article.className='analysis-card';article.innerHTML=`<p class="eyebrow">Measured static properties</p><h3>${esc(group.title)}</h3><div class="analysis-plot" data-related-plot="${esc(group.id)}"></div><p class="analysis-caption">${esc(group.note||'Reported values linked within a reviewed source material condition. Inspect methods before comparison.')}</p>`;$('#related-static-plots').append(article);const plot=new PropertyScatter(article.querySelector('.analysis-plot'),{onSelect:select});relatedPlots.push({group,plot});plots.push(plot);}}
  function missingMaterials(){
    if(Array.isArray(data.staticCloudCoverage?.unmatched))return data.staticCloudCoverage.unmatched;
    const groups=new Map();
    for(const [rows,kind] of [[yieldValues,'yield'],[toughnessValues,'toughness']])for(const p of rows){const key=`${p.class}\u001f${p.material}`;if(!groups.has(key))groups.set(key,{material:p.material,class:p.class,color:p.color,yield:[],toughness:[]});groups.get(key)[kind].push(p);}
    return [...groups.values()].filter(g=>!g.yield.length||!g.toughness.length).map(g=>({...g,missingProperty:g.yield.length?'Fracture toughness':'Yield strength',availableProperty:g.yield.length?'Yield strength':'Fracture toughness',count:g.yield.length+g.toughness.length,sources:cloudSources({supports:{yield:g.yield,toughness:g.toughness}})}));
  }
  const missing=missingMaterials();
  function render(){
    const chosen=$('#comparison-class').value,q=$('#comparison-search').value.toLocaleLowerCase().trim();
    const match=p=>(!chosen||p.class===chosen)&&(!q||`${labelOf(p)} ${sourceOf(p)} ${p.state||''} ${p.yieldKind||''} ${p.toughnessFamily||''} ${p.strengthDefinition||''} ${p.toughnessDefinition||''} ${isCloud(p)?cloudSources(p).map(sourceOf).join(' ')+' '+list(p.sources).map(source=>source.title||'').join(' ')+' '+Object.values(p.supports||{}).flatMap(list).map(r=>r.material||'').join(' '):''}`.toLocaleLowerCase().includes(q));
    const clouds=view!=='pairs',classView=view==='classes',contextMode=staticDataset==='published',refs=contextMode?referenceEnvelopes.filter(match):[],reviewedStatics=(contextMode?staticClouds:classView?staticClassClouds:clouds?staticClouds:statics).filter(match),s=[...refs,...reviewedStatics],d=(classView?dynamicClassClouds:clouds?dynamicClouds:dynamics).filter(match),ys=yieldValues.filter(match),ks=toughnessValues.filter(match),labels=$('#comparison-labels').checked;
    staticPlot.setData(s,{xKey:'yieldMPa',yKey:'toughnessMPaSqrtM',xLabel:contextMode?'Strength (MPa)':'Yield strength (MPa)',yLabel:'Fracture toughness (MPa√m)',xLog:true,yLog:true,labels:(contextMode||clouds)&&labels,emptyText:contextMode?'No published ranges or reviewed clouds match these filters.':clouds?'Both properties need support for the exact material.':'Yield and toughness do not share a reviewed condition.'});
    dynamicPlot.setData(d,{xKey:'hel',yKey:'spall',xLabel:'Hugoniot elastic limit (GPa)',yLabel:'Spall strength (GPa)',xLog:true,yLog:true,labels:clouds&&labels});
    $('#static-map-count').textContent=contextMode?`${refs.length} reference ranges · ${reviewedStatics.length} measured clouds`:`${s.length} ${classView?'class clouds':clouds?'material clouds':'pairs'}`;$('#dynamic-map-count').textContent=`${d.length} ${classView?'class clouds':clouds?'material clouds':'reported pairs'}`;
    $('#static-map-title').textContent=contextMode?'Strength × toughness':'Yield strength × toughness';
    $('#static-map-eyebrow').textContent=contextMode?'Published context + reviewed evidence':'Classical static map · reviewed measurements';
    $('#static-comparison-plot').setAttribute('aria-label',contextMode?'Fracture toughness versus source-defined strength':'Fracture toughness versus yield strength');
    $('#comparison-display-note').textContent=contextMode?'Published + reviewed keeps reference ranges and exact-material measured clouds in the left panel. The measured display controls change the right dynamic panel.':'The measured display controls apply to both reviewed panels. Each map uses its own material population.';
    $('#static-context-summary').innerHTML=referenceEnvelopes.length?`<strong>${referenceEnvelopes.length} published reference ranges</strong> add classical material-selection context. Select a range for its strength convention, construction and paper link. They are excluded from measured totals and ML analyses.`:'Published reference ranges will appear here when reviewed source envelopes are available. The current map uses reviewed measurements.';
    $('#comparison-status').innerHTML=contextMode?'<strong>Published ranges give context; reviewed clouds retain their measurements.</strong><p>The static panel overlays source-linked reference ranges with the reviewed exact-material yield–toughness clouds. Published strength can mean yield, flow or failure stress depending on the material family and source; inspect each range’s definition. These envelopes add no experimental records or paired observations. The dynamic panel retains its existing evidence and display mode.</p>':classView?'<strong>Class coverage pools independent property sets.</strong><p>The static and dynamic class maps use their own available literature. A class cloud may combine yield from one alloy with toughness from another; its interior is schematic class coverage, not a measured paired population. Yield-test kind and toughness family remain separate, and all exact source materials stay in the selected cloud’s supports. No artificial paired observations are generated.</p>':clouds?'<strong>Two independent literature maps. No shared-material requirement.</strong><p>Each static cloud needs reviewed yield and toughness support for its exact material, but the values may come from different conditions or papers. Static clouds keep yield-test kind and toughness-method family separate. Dynamic clouds retain reported, matched and modeled coordinate labels. No Cartesian pairs or new measured observations are created.</p>':'<strong>A stricter view within each loading regime.</strong><p>Static points share a reviewed source/material condition; dynamic points have reported same-shot HEL and spall. The material sets remain independent across maps. Triangles flag provisional KQ, not qualified KIc; circles retain their reported test methods.</p>';
    $('#static-comparison-caption').innerHTML=contextMode?`Strength: MPa. Toughness: MPa√m. Long-dashed ranges are published reference context with constant fill opacity; the other clouds retain reviewed yield and toughness supports. Source-specific yield, flow and failure definitions are not interchangeable. ${esc(context.note||'Select a reference range to inspect its source and construction.')}`:clouds?`Yield: MPa. Toughness: MPa√m. ${classView?'Class clouds can combine different exact alloys and states; their corners need not describe any material.':'Material clouds pool independent measured extents for exact material labels.'} Yield kind and toughness family remain separate. Dashed = indentation; dotted = provisional K<sub>Q</sub>; other toughness families use solid outlines. Equivalent K from elastic–plastic tests and plane-stress toughness remain separate from K<sub>Ic</sub>. Source temperatures stay in the supports.`:'Yield: MPa. Toughness: MPa√m. Triangles flag provisional K<sub>Q</sub>; circles show other reported toughness methods. Only values sharing a reviewed material condition form a point. Inspect yield kind and toughness qualification before comparison.';
    $('#dynamic-comparison-caption').innerHTML=clouds?`Both axes: GPa. ${classView?'Class clouds combine supported extents across materials and conditions; these can include the main explorer’s completed coordinates. Selection lists the exact materials, reported values, completed bounds and donor/model links.':'Material clouds enclose supported HEL and spall extents for each exact material. Solid = reported coordinates; dashed = includes matched/substituted values; dotted = includes yield-based HEL. Click to inspect every support and assumption.'}`:'Both axes: GPa. Positive reported same-shot coordinates only. These points do not require a matching static material. Other supported and completed coordinates remain in the <a href="explore.html">main explorer</a>.';
    $('#comparison-geometry-note').textContent=contextMode?'Published reference ranges use constant opacity; their shape is a source envelope or a documented range construction, not data density, measured covariance or confidence. Reviewed clouds keep their supporting record counts and method qualifications. No reference envelope enters the measured strips, class rankings or UMAP/diffusion inputs.':clouds?`Closed log-space clouds show literature coverage, not measured covariance, probability or confidence. Minimum drawing width keeps narrow ranges visible. ${classView?'Class fills use constant opacity; the darkness is not a record-density estimate. A cloud’s corners may combine different alloys or states.':'Fill intensity reflects the number of supporting input records, not their probability density.'} Every original measurement keeps its own source and condition; pooled conditions may include cryogenic, room and elevated temperatures.`:'Points in this view retain reported coordinates and reviewed experiment or material-condition links. Provisional toughness remains visibly qualified. Neither map requires the same materials to be present in the other.';
    $$('[data-comparison-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.comparisonView===view));$('#comparison-labels').disabled=!clouds&&!contextMode;
    for(const [points,plot,label] of [[ys,yieldPlot,'Yield strength (MPa)'],[ks,toughnessPlot,'Fracture toughness (MPa√m)']]){
      const classes=[...new Set(points.map(p=>p.class||'Unclassified'))].sort();plot.setData(points.map(p=>({...p,classRow:classes.indexOf(p.class||'Unclassified')+1})),{xKey:'value',yKey:'classRow',xLabel:label,yLabel:'Material class',xLog:true,yCategories:classes,emptyText:'No reviewed values match these filters.'});
    }
    for(const {group,plot} of relatedPlots)plot.setData(group.points.filter(match),{xLabel:group.xLabel,yLabel:group.yLabel,xLog:true,yLog:true});
    const observations=[...yieldValues,...toughnessValues,...related.flatMap(p=>p.points)];
    const shown=[...s,...d,...observations.filter(match)];records($('#comparison-records'),shown);$('#comparison-record-count').textContent=`(${shown.length})`;legend($('#comparison-legend'),[...s,...d]);
    const unmatched=missing.filter(match);$('#static-unmatched-count').textContent=`(${unmatched.length})`;
    $('#static-cloud-coverage').innerHTML=`<p><strong>${new Set([...ys,...ks].map(p=>p.id)).size}</strong> reviewed static property values in the strips · <strong>${ys.length}</strong> yield values · <strong>${ks.length}</strong> toughness values · <strong>${unmatched.length}</strong> material labels awaiting a counterpart.</p>`;
    $('#static-unmatched-materials').innerHTML=unmatched.length?unmatched.map(p=>`<article>${swatch(p.color)}<div><h4>${esc(p.material)}</h4><p>${esc(p.class)} · ${esc(p.count??'')} ${esc(p.availableProperty||'Available property')} values<br>Missing: <strong>${esc(p.missingProperty||'the other static property')}</strong></p><div class="cloud-paper-links">${list(p.sources).map(source=>external(source.url,sourceOf(source))).join('')}</div></div></article>`).join(''):'<p class="no-results">No single-property materials match these filters.</p>';
  }
  $('#comparison-class').addEventListener('change',render);$('#comparison-search').addEventListener('input',render);$('#comparison-labels').addEventListener('change',render);$('#comparison-clear').addEventListener('click',()=>{$('#comparison-class').value='';$('#comparison-search').value='';$('#comparison-selection').innerHTML='<p>Select a material cloud or a record below to inspect its sources.</p>';render();});
  datasetSelect.addEventListener('change',()=>{staticDataset=datasetSelect.value;$('#comparison-selection').innerHTML='<p>Select a published range, measured cloud or record to inspect its sources.</p>';render();});
  $$('[data-comparison-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.comparisonView;$('#comparison-selection').innerHTML='<p>Select a material cloud or a record below to inspect its sources.</p>';render();}));
  $('#comparison-reset-view').addEventListener('click',()=>{staticPlot.reset();dynamicPlot.reset();});
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
