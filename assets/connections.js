/* Source setup is token-free. This module fetches only the published site snapshot. */
import {esc} from './plot.js';

const $ = selector => document.querySelector(selector);
const emptySnapshot = () => ({schemaVersion:1,generatedAt:null,sources:[],records:[],clouds:[],classes:[],meta:{counts:{records:0,clouds:0,plotted:0}}});
let lastSnapshot=null, downloadUrl='', refreshTimer=null;
const publicUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}};
const dateLabel=value=>{const date=new Date(value);return value&&Number.isFinite(date.getTime())?date.toLocaleString():'Not yet';};
const count=value=>Number.isFinite(value)?value:Array.isArray(value)?value.length:0;
const statusLabels={awaiting_approval:'Awaiting publication approval',disabled:'Disabled',ok:'Synchronized',stale:'Last good snapshot · refresh failed',error:'Synchronization failed',discovery:'Discovery only',not_synced:'Awaiting first sync',unconfigured:'Not configured'};

export async function loadConnectedSources(){
  try{
    const response=await fetch(new URL('../data/connected-experiments.json',import.meta.url),{cache:'no-store'});
    if(!response.ok)throw new Error('Published connected-source snapshot is unavailable.');
    const payload=await response.json();
    if(payload.schemaVersion!==1||!['sources','records','clouds','classes'].every(key=>Array.isArray(payload[key])))throw new Error('Published connected-source snapshot has an unsupported schema.');
    lastSnapshot=payload;
    return payload;
  }catch{
    return {...(lastSnapshot||emptySnapshot()),loadError:'The latest connected-source status could not be loaded. '+(lastSnapshot?'Showing the last loaded snapshot.':'The literature map remains available.')};
  }
}

export function renderConnectionStatus(payload){
  const target=$('#connection-status');if(!target)return;
  const error=payload.loadError?`<p class="connection-load-error" role="alert">${esc(payload.loadError)}</p>`:'';
  if(!payload.sources.length){target.innerHTML=`${error}<div class="connection-empty"><span class="connection-status-mark" aria-hidden="true">↗</span><div><h3>No sources connected yet.</h3><p>Create a connection configuration and add it to your research repository. Credentials stay in encrypted Actions secrets.</p><a href="contribute.html#connect-source" class="text-link">Set up a source →</a></div></div>`;return;}
  target.innerHTML=error+payload.sources.map(source=>{
    const state=Object.hasOwn(statusLabels,source.status)?source.status:'unconfigured';
    const url=publicUrl(source.url);
    const checkedAt=new Date(source.lastChecked).getTime();
    const overdue=['ok','discovery'].includes(state)&&Number.isFinite(checkedAt)&&Date.now()-checkedAt>3*60*60*1000;
    const detail=source.diagnostic||({awaiting_approval:'Source contents are not fetched or published until the configuration has explicit publication approval.',disabled:'Scheduled synchronization is disabled for this source.',discovery:'Datasets are inventoried. No numerical values have been admitted; map their schema to enable measured-pair ingestion.',ok:source.plotted?'Accepted measured pairs are available in the experimental layer.':'No accepted positive HEL–spall pairs are currently available.',stale:'Retained the last successful snapshot. Check the workflow before interpreting this as the latest source state.',error:'No new data were published for this source. Check credentials and the source configuration.',not_synced:'This configured source has not been checked yet. Run the website workflow or wait for its scheduled check.',unconfigured:'Complete the source configuration and credential setup.'}[state]);
    return `<article class="connection-source-card" id="connected-source-${esc(source.id)}"><div class="connection-source-heading"><div><p class="eyebrow">${esc(source.mode||'Experimental collection')}</p><h3>${esc(source.label||source.id)}</h3></div><span class="connection-status-pill" data-status="${state}">${esc(statusLabels[state])}</span></div><p>${esc(detail)}</p>${overdue?'<p class="connection-overdue"><strong>Scheduled check overdue.</strong> The last check is more than three hours old. Run the website workflow to check for newer data.</p>':''}<div class="connection-source-counts"><span><strong>${source.files==null?'—':count(source.files)}</strong> ${source.files==null?'files not inventoried':'files'}</span><span><strong>${count(source.items)}</strong> dataset items</span><span><strong>${count(source.plotted)}</strong> plotted records</span><span><strong>${count(source.held)}</strong> held records</span></div><dl class="connection-source-times"><div><dt>Last checked</dt><dd>${esc(dateLabel(source.lastChecked))}</dd></div><div><dt>Last successful sync</dt><dd>${esc(dateLabel(source.lastSuccess))}</dd></div></dl><div class="connection-source-links">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Open collection ↗</a>`:''}${count(source.plotted)?`<a href="explore.html?layer=connected&source=${encodeURIComponent('EXP-SOURCE-'+source.id)}">Show on the map →</a>`:''}<small>${count(source.records)} accepted records · Connection ${esc(source.id)}</small></div></article>`;
  }).join('');
  if(payload.generatedAt)target.insertAdjacentHTML('beforeend',`<p class="connection-snapshot-time">Published snapshot: ${esc(dateLabel(payload.generatedAt))}</p>`);
}

export function parseCollectionUrl(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.search)throw new Error('Use an HTTPS collection URL without credentials or query parameters.');
  const path=decodeURIComponent(url.pathname+'/'+url.hash.replace(/^#\/?/,''));
  const matches=[...path.matchAll(/(?:^|\/)(folder|collection)\/([a-f0-9]{24})(?=\/|$)/gi)];
  if(!matches.length)throw new Error('Choose a collection or folder URL, or enter its 24-character root ID below.');
  const last=matches[matches.length-1];
  return {url:url.href,root:{type:last[1].toLowerCase(),id:last[2].toLowerCase()},apiUrl:url.origin+'/api/v1'};
}

export function initConnections(payload){
  const form=$('#connection-form');
  if(form){
    const format=$('#connection-format'),measurement=$('#connection-measurement-options'),message=$('#connection-form-message');
    const value=name=>String(form.elements.namedItem(name)?.value||'').trim();
    function updateMode(){
      const mode=format.value,discovery=mode==='discovery';
      measurement.hidden=discovery;
      measurement.querySelectorAll('input,select').forEach(input=>input.disabled=discovery);
      $('#connection-pairing').required=!discovery;
      updatePairing();
      $('#connection-records-path').disabled=mode!=='json';
      $('#connection-file-pattern').disabled=mode==='item_metadata'||discovery;
      const pattern=$('#connection-file-pattern');
      if(['*.csv','*.json'].includes(pattern.value))pattern.value=mode==='json'?'*.json':'*.csv';
      $('#connection-format-help').textContent=discovery?'Discovery lists the available datasets without publishing numerical values. Start here if you have not reviewed the source schema. XLSX files and incomplete property sets need schema and measurement review before ingestion.':mode==='item_metadata'?'Read one experimentally identified record from each Girder item’s metadata. Use dotted field paths for nested metadata.':'Read measured records from matching files. Every row needs stable identity, explicit experimental basis and supported units.';
    }
    function updatePairing(){const fields=['field-hel','field-spall'].map(name=>value(name));form.elements.namedItem('field-shot').required=format.value!=='discovery'&&fields.every(Boolean);}
    ['field-hel','field-spall'].forEach(name=>form.elements.namedItem(name).addEventListener('input',updatePairing));
    format.addEventListener('change',updateMode);updateMode();
    $('#connection-url').addEventListener('change',()=>{
      try{const parsed=parseCollectionUrl(value('portalUrl'));$('#connection-root-type').value=parsed.root.type;$('#connection-root-id').value=parsed.root.id;$('#connection-api-url').value=parsed.apiUrl;message.textContent='Collection location recognized. Review the root and read mode before generating the configuration.';message.dataset.kind='info';}catch{message.textContent='Enter the collection or folder root ID if it is not encoded in this URL.';message.dataset.kind='info';}
    });
    form.addEventListener('submit',event=>{
      event.preventDefault();
      try{
        if(!form.reportValidity())return;
        const portal=new URL(value('portalUrl')),api=new URL(value('apiUrl'));
        if([portal,api].some(url=>url.protocol!=='https:'||url.username||url.password||url.search))throw new Error('Collection and API URLs must use HTTPS and contain no credentials or query parameters.');
        if(api.hash)throw new Error('The API endpoint must not include a URL fragment.');
        if(!/^[a-z0-9][a-z0-9-]{0,63}$/.test(value('id')))throw new Error('Use a lowercase connection ID with 1–64 letters, numbers or hyphens.');
        if(!/^[a-f0-9]{24}$/i.test(value('rootId')))throw new Error('The collection or folder root ID must contain 24 hexadecimal characters.');
        const repository=value('repository');
        if(repository&&!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))throw new Error('Use owner/repository for the GitHub repository.');
        if(format.value!=='discovery'&&!$('#connection-pairing').checked)throw new Error('Confirm the same-experiment relationship before creating a measurement connection.');
        if(format.value!=='discovery'&&!value('field-hel')&&!value('field-spall'))throw new Error('Map at least one property: HEL or spall strength. Leave an unavailable counterpart blank.');
        const id=value('id'),fields=Object.fromEntries(['id','material','class','state','shot','hel','spall','basis'].map(key=>[key,value('field-'+key)]));
        const config={schemaVersion:1,id,label:value('label'),enabled:true,apiUrl:api.href.replace(/\/$/,''),root:{type:value('rootType'),id:value('rootId').toLowerCase()},portalUrl:portal.href,format:format.value,filePattern:value('filePattern')||'*.csv',fields,units:{hel:value('helUnit')||'GPa',spall:value('spallUnit')||'GPa'},recordsPath:format.value==='json'?value('recordsPath'):'',auth:{mode:value('auth'),credential:id},pairing:'same_experiment',publicApproved:$('#connection-public').checked};
        const text=JSON.stringify(config,null,2)+'\n',path=`data/connected_sources/${id}.json`;
        if(downloadUrl)URL.revokeObjectURL(downloadUrl);
        downloadUrl=URL.createObjectURL(new Blob([text],{type:'application/json'}));
        const download=$('#connection-download');download.href=downloadUrl;download.download=id+'.json';
        $('#connection-config-preview').textContent=text;$('#connection-output-path').textContent=path;
        $('#connection-output-title').textContent=config.publicApproved?'Ready for repository setup.':'Draft · awaiting approval.';
        $('#connection-output-note').textContent=config.publicApproved?'This file approves public source synchronization after it is committed. Add the credential secret before running the workflow.':'This file does not approve fetching or publishing source contents. Enable publicApproved only after reviewing the collection and its sharing permissions.';
        const links=[['#connection-github-create',repository?`https://github.com/${repository}/new/main?filename=${encodeURIComponent(path)}&value=${encodeURIComponent(text)}`:''],['#connection-github-secret',repository?`https://github.com/${repository}/settings/secrets/actions`:''],['#connection-github-action',repository?`https://github.com/${repository}/actions/workflows/website.yml`:'']];
        links.forEach(([selector,url])=>{const link=$(selector);link.hidden=!url;if(url)link.href=url;else link.removeAttribute('href');});
        $('#connection-github-secret').hidden=!repository||config.auth.mode==='none';
        $('#connection-output').hidden=false;message.textContent='Configuration generated locally. Nothing has been connected or published yet.';message.dataset.kind='success';
        $('#connection-output').scrollIntoView({behavior:'smooth',block:'nearest'});
        document.dispatchEvent(new CustomEvent('ashby-connection-config-ready',{detail:config}));
      }catch(error){message.textContent=error.message||'Review the configuration fields.';message.dataset.kind='error';}
    });
  }
  // Check only this website's public snapshot, never an authenticated collection.
  if($('#connection-status')&&!refreshTimer){
    refreshTimer=setInterval(async()=>{
      if(document.hidden)return;
      const updated=await loadConnectedSources();renderConnectionStatus(updated);
      document.dispatchEvent(new CustomEvent('ashby-connected-update',{detail:updated}));
    },60000);
  }
  if(location.hash.startsWith('#connected-source-'))requestAnimationFrame(()=>document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({block:'start'}));
}
