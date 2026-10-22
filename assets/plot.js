/* SVG rendering uses the same independent log-space enclosure as the Python pipeline. */
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const fmt = value => Number.isFinite(value) ? Number(value.toPrecision(3)).toLocaleString('en-US', {maximumSignificantDigits:3}) : 'Unreported';
export const range = (lo, hi) => Number.isFinite(lo) && Number.isFinite(hi) ? lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}` : 'Unreported';
export const methodName = value => ({verified_pair:'Verified same-shot pair',reported_pair:'Reported coordinates',reported_range:'Reported range',independent_reported:'Independent reported values',matched_same_source_state:'Same-source state match',cross_paper_same_material:'Cross-paper material match',material_state_substitute:'Material-state substitute',material_composition_substitute:'Composition substitute',yield_model:'Yield-based HEL estimate',unresolved:'Unresolved'}[value] || String(value || 'Unresolved').replaceAll('_',' '));

export function enclosure(bounds, minimum=.075) {
  const lo = [Math.log10(bounds[0]), Math.log10(bounds[2])];
  const hi = [Math.log10(bounds[1]), Math.log10(bounds[3])];
  const center = lo.map((v,i) => (v+hi[i])/2);
  const radii = lo.map((v,i) => Math.max(hi[i]-v, minimum)*Math.SQRT2/2);
  return Array.from({length:121}, (_,i) => {
    const t=i/120*Math.PI*2;
    return [10**(center[0]+Math.cos(t)*radii[0]),10**(center[1]+Math.sin(t)*radii[1])];
  });
}

export function filteredClouds(data, records) {
  const ids = new Set(records.map(r=>r.id));
  const groups = data.clouds.map(c=>({...c, members:data.records.filter(r=>c.recordIds.includes(r.id)&&ids.has(r.id))})).filter(c=>c.members.length);
  const maxCount = Math.max(1,...data.clouds.map(c=>c.count));
  return groups.map(c=>{
    const members=c.members;
    const bounds=[Math.min(...members.map(r=>r.plotHelMin)),Math.max(...members.map(r=>r.plotHelMax)),Math.min(...members.map(r=>r.plotSpallMin)),Math.max(...members.map(r=>r.plotSpallMax))];
    const same = members.length === c.count;
    return {...c,count:members.length,verified:members.filter(r=>r.verified).length,inferred:members.filter(r=>r.inferred).length,
      recordIds:members.map(r=>r.id),sourceIds:[...new Set(members.map(r=>r.sourceId))],
      helMin:bounds[0],helMax:bounds[1],spallMin:bounds[2],spallMax:bounds[3],
      basis:members.some(r=>r.completion==='yield_model')?'yield_model':members.some(r=>r.inferred)?'matched_or_substituted':'reported',
      padded:Math.log10(bounds[1]/bounds[0])<data.meta.minimumSpanDecades||Math.log10(bounds[3]/bounds[2])<data.meta.minimumSpanDecades,
      alpha:.11+(.4-.11)*members.length/maxCount,boundary:same?c.boundary:enclosure(bounds,data.meta.minimumSpanDecades)};
  });
}

export class AshbyPlot {
  constructor(container, {preview=false,onSelect=()=>{}}={}) {
    this.container=container;this.preview=preview;this.onSelect=onSelect;this.objects=[];this.selected='';this.labels=true;
    this.svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    this.svg.setAttribute('role',preview?'img':'group');this.svg.setAttribute('aria-label','Spall strength versus Hugoniot elastic limit, logarithmic axes in GPa');
    container.replaceChildren(this.svg);
    this.svg.addEventListener('click',event=>{
      if(this.moved)return;
      const node=event.target.closest('[data-object]');if(node)this.onSelect(node.dataset.object);
    });
    this.svg.addEventListener('keydown',event=>{
      if((event.key==='Enter'||event.key===' ')&&event.target.dataset.object){event.preventDefault();this.onSelect(event.target.dataset.object);}
    });
    this.svg.addEventListener('pointermove',event=>this.hover(event));
    this.svg.addEventListener('pointerleave',()=>this.hideTooltip());
    if(!preview) {
      this.svg.addEventListener('wheel',event=>{
        event.preventDefault();const p=this.point(event);this.zoom(event.deltaY>0?1.16:1/1.16,p);
      },{passive:false});
      this.svg.addEventListener('pointerdown',event=>{
        if(event.button!==0||!this.domain)return;
        this.drag={x:event.clientX,y:event.clientY,domain:[...this.domain]};this.moved=false;
      });
      this.svg.addEventListener('pointermove',event=>{
        if(!this.drag)return;
        const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;
        if(Math.abs(dx)+Math.abs(dy)<5&&!this.moved)return;
        if(!this.moved)this.svg.setPointerCapture(event.pointerId);
        this.moved=true;this.hideTooltip();
        const d=this.drag.domain;const sx=(d[1]-d[0])/this.innerW,sy=(d[3]-d[2])/this.innerH;
        this.domain=[d[0]-dx*sx,d[1]-dx*sx,d[2]+dy*sy,d[3]+dy*sy];this.draw();
      });
      this.svg.addEventListener('pointerup',()=>{this.drag=null;});
      this.svg.addEventListener('pointercancel',()=>{this.drag=null;});
    }
    this.observer=new ResizeObserver(()=>this.draw());this.observer.observe(container);
  }
  point(event){const rect=this.svg.getBoundingClientRect();return [(event.clientX-rect.left)/rect.width*this.width,(event.clientY-rect.top)/rect.height*this.height];}
  setData(objects,{reset=true,labels=true,selected=''}={}) {
    this.objects=objects;this.labels=labels;this.selected=selected;
    if(reset||!this.domain) {
      if(objects.length){
        const xs=objects.flatMap(o=>o.boundary?o.boundary.map(p=>Math.log10(p[0])):[Math.log10(o.hel)]);
        const ys=objects.flatMap(o=>o.boundary?o.boundary.map(p=>Math.log10(p[1])):[Math.log10(o.spall)]);
        const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
        const xp=Math.max(.15,(x1-x0)*.09),yp=Math.max(.15,(y1-y0)*.12);
        this.domain=[x0-xp,x1+xp,y0-yp,y1+yp];
      }else this.domain=[-2,1,-2,1.5];
      this.initial=[...this.domain];
    }
    this.draw();
  }
  zoom(factor,point) {
    if(!this.domain)return;
    const d=this.domain,px=point?Math.max(0,Math.min(1,(point[0]-this.margin.left)/this.innerW)):.5;
    const py=point?1-Math.max(0,Math.min(1,(point[1]-this.margin.top)/this.innerH)):.5;
    const wx=(d[1]-d[0])*factor,wy=(d[3]-d[2])*factor;
    if(wx<.15||wy<.15||wx>12||wy>12)return;
    const cx=d[0]+(d[1]-d[0])*px,cy=d[2]+(d[3]-d[2])*py;
    this.domain=[cx-wx*px,cx+wx*(1-px),cy-wy*py,cy+wy*(1-py)];this.hideTooltip();this.draw();
  }
  reset(){this.domain=[...this.initial];this.draw();}
  hover(event) {
    if(this.preview||this.moved&&this.drag)return;
    const el=event.target.closest('[data-object]'),tip=document.querySelector('#plot-tooltip');
    if(!el||!tip){this.hideTooltip();return;}
    const o=this.objects.find(o=>o.id===el.dataset.object);if(!o)return;
    tip.innerHTML=`<strong>${esc(o.material)}</strong><span>${esc(o.class)}</span><span>${o.boundary?`${o.count} records · ${o.inferred} with inference`:`${esc(o.citation)} · ${esc(o.id)}`}</span><span>Click to inspect sources →</span>`;
    tip.hidden=false;tip.style.left=`${Math.max(8,Math.min(window.innerWidth-270,event.clientX+14))}px`;tip.style.top=`${Math.max(8,Math.min(window.innerHeight-130,event.clientY+15))}px`;
  }
  hideTooltip(){const el=document.querySelector('#plot-tooltip');if(el)el.hidden=true;}
  draw() {
    if(!this.domain)return;
    this.width=Math.max(280,this.container.clientWidth);
    this.height=this.preview?Math.max(285,Math.min(460,this.width*.43)):Math.max(350,Math.min(640,this.width*.69));
    this.margin={left:this.width<500?51:64,right:this.width<500?12:23,top:20,bottom:this.width<500?55:62};
    const m=this.margin,w=this.width,h=this.height;this.innerW=w-m.left-m.right;this.innerH=h-m.top-m.bottom;
    this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);this.svg.style.height=`${h}px`;
    const [x0,x1,y0,y1]=this.domain;
    const x=v=>m.left+(Math.log10(v)-x0)/(x1-x0)*this.innerW;
    const y=v=>h-m.bottom-(Math.log10(v)-y0)/(y1-y0)*this.innerH;
    const bg=this.preview?'#f5f5f7':'#ffffff';
    let markup=`<rect width="${w}" height="${h}" fill="${bg}"/><defs><clipPath id="plot-clip"><rect x="${m.left}" y="${m.top}" width="${this.innerW}" height="${this.innerH}"/></clipPath></defs>`;
    const ticks=(lo,hi)=>{
      const out=[];for(let e=Math.floor(lo);e<=Math.ceil(hi);e++)for(const k of [1,2,5]){const v=k*10**e;if(Math.log10(v)>=lo&&Math.log10(v)<=hi)out.push({v,major:k===1});}return out;
    };
    for(const {v,major} of ticks(x0,x1)){
      markup+=`<line class="plot-grid ${major?'':'minor'}" x1="${x(v)}" x2="${x(v)}" y1="${m.top}" y2="${h-m.bottom}"/><text class="plot-axis" x="${x(v)}" y="${h-m.bottom+20}" text-anchor="middle">${esc(fmt(v))}</text>`;
    }
    for(const {v,major} of ticks(y0,y1)){
      markup+=`<line class="plot-grid ${major?'':'minor'}" y1="${y(v)}" y2="${y(v)}" x1="${m.left}" x2="${w-m.right}"/><text class="plot-axis" x="${m.left-10}" y="${y(v)+3}" text-anchor="end">${esc(fmt(v))}</text>`;
    }
    markup+=`<path d="M${m.left},${m.top}V${h-m.bottom}H${w-m.right}" fill="none" stroke="#a4a4ab" stroke-width=".8"/><text class="plot-axis-label" x="${m.left+this.innerW/2}" y="${h-10}" text-anchor="middle">Hugoniot elastic limit, HEL (GPa)</text><text class="plot-axis-label" transform="translate(14 ${m.top+this.innerH/2}) rotate(-90)" text-anchor="middle">Spall strength (GPa)</text><g clip-path="url(#plot-clip)">`;
    const sorted=[...this.objects].sort((a,b)=>(a.id===this.selected?1:0)-(b.id===this.selected?1:0)||b.count-a.count);
    for(const o of sorted){
      const selected=o.id===this.selected,dim=this.selected&&!selected;
      const attrs=`class="plot-object" data-object="${esc(o.id)}" tabindex="${this.preview?-1:0}" role="button" aria-label="${esc(o.material)}, ${esc(o.boundary?`${o.count} records`:`${o.citation}, HEL ${fmt(o.hel)}, spall ${fmt(o.spall)} GPa`)}" aria-pressed="${selected}"`;
      if(o.boundary){
        const d=o.boundary.map((p,i)=>`${i?'L':'M'}${x(p[0]).toFixed(2)},${y(p[1]).toFixed(2)}`).join('')+'Z';
        markup+=`<path ${attrs} d="${d}" fill="${o.color}" fill-opacity="${dim?.055:selected?.5:o.alpha}" stroke="${o.color}" stroke-opacity="${dim?.28:1}" stroke-width="${selected?2.4:1.15}" stroke-dasharray="${o.basis==='yield_model'?'2 3':o.basis==='matched_or_substituted'?'5 3':''}"><title>${esc(o.material)} · ${o.count} records</title></path>`;
      }else{
        const cx=x(o.hel),cy=y(o.spall);
        if(Number.isFinite(o.helUncertainty)&&o.helUncertainty>0&&o.hel>o.helUncertainty)markup+=`<line x1="${x(o.hel-o.helUncertainty)}" x2="${x(o.hel+o.helUncertainty)}" y1="${cy}" y2="${cy}" stroke="${o.color}" stroke-opacity=".5"/>`;
        if(Number.isFinite(o.spallUncertainty)&&o.spallUncertainty>0&&o.spall>o.spallUncertainty)markup+=`<line x1="${cx}" x2="${cx}" y1="${y(o.spall-o.spallUncertainty)}" y2="${y(o.spall+o.spallUncertainty)}" stroke="${o.color}" stroke-opacity=".5"/>`;
        markup+=`<circle ${attrs} cx="${cx}" cy="${cy}" r="${selected?6:4}" fill="${o.color}" fill-opacity="${dim?.2:.85}" stroke="${selected?'#1d1d1f':'white'}" stroke-width="${selected?2:1}"><title>${esc(o.material)} · ${esc(o.citation)} · ${esc(o.id)}</title></circle>`;
      }
    }
    const boxes=[];
    if(this.labels){
      const labels=[...this.objects].sort((a,b)=>(b.id===this.selected?1:0)-(a.id===this.selected?1:0)||(b.count||0)-(a.count||0));
      const seen=new Set();
      for(const o of labels){
        if(seen.has(o.material))continue;seen.add(o.material);
        if(this.preview&&boxes.length>(this.width<500?5:13))break;
        const cx=o.boundary?x(Math.sqrt(o.helMin*o.helMax)):x(o.hel),cy=o.boundary?y(Math.sqrt(o.spallMin*o.spallMax)):y(o.spall);
        let text=o.material;if(text.length>32)text=text.slice(0,29)+'…';
        const font=this.width<500?8:10,bw=text.length*font*.51,bh=font+5;
        const positions=[[7,-7],[7,16],[-bw-7,-7],[-bw-7,16],[7,-25],[-bw/2,-20]];
        for(const [dx,dy] of positions){
          const bx=cx+dx,by=cy+dy-bh+3;
          if(bx<m.left+3||bx+bw>w-m.right-3||by<m.top||by+bh>h-m.bottom-2)continue;
          if(o.id!==this.selected&&boxes.some(b=>bx<b.x+b.w+5&&bx+bw+5>b.x&&by<b.y+b.h+3&&by+bh+3>b.y))continue;
          boxes.push({x:bx,y:by,w:bw,h:bh});
          markup+=`<text class="plot-label" x="${bx}" y="${cy+dy}" font-size="${font}" opacity="${this.selected&&o.id!==this.selected?.4:1}">${esc(text)}</text>`;break;
        }
      }
    }
    markup+='</g>';
    if(!this.objects.length)markup+=`<text x="${m.left+this.innerW/2}" y="${m.top+this.innerH/2}" text-anchor="middle" fill="#6e6e73" font-size="13">No supported data match these filters.</text>`;
    this.svg.innerHTML=markup;
  }
  export(){
    const clone=this.svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='text{font-family:Arial,sans-serif}.plot-axis{fill:#6e6e73;font-size:10px}.plot-axis-label{fill:#4f4f54;font-size:11px}.plot-grid{stroke:#dddde3;stroke-width:.65}.plot-grid.minor{stroke:#e8e8ed;stroke-dasharray:2 4}.plot-label{fill:#55555b;paint-order:stroke;stroke:white;stroke-width:3;stroke-linejoin:round}';clone.prepend(style);
    return new XMLSerializer().serializeToString(clone);
  }
}
