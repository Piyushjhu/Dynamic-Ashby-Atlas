/* GitHub authorizes every mutation. No credentials or private configs are persisted. */
import {esc} from './plot.js';

const $ = selector => document.querySelector(selector);
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SHA = /^[a-f0-9]{40,64}$/;
const DIRECTORY = 'data/connected_sources';
let session = null, busy = false, draft = null, pending = null;
const message = (text, kind = 'info') => {$('#admin-message').textContent = text; $('#admin-message').dataset.kind = kind;};
const pathFor = id => {if (!ID.test(id)) throw new Error('Invalid connection ID.'); return `${DIRECTORY}/${id}.json`;};
const encode = text => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const decode = text => new TextDecoder('utf-8', {fatal:true}).decode(Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0)));

function setBusy(value) {
  busy = value;
  document.querySelectorAll('#admin-session button, #admin-workspace button, #admin-confirm button').forEach(button => button.disabled = value);
  if (!value) $('#admin-confirm-submit').disabled = !pending || $('#admin-confirm-id').value !== pending.source.config.id;
}

function signOut() {
  session?.abort.abort(); session = null; draft = null; pending = null;
  $('#admin-token').value = ''; $('#admin-login').hidden = false;
  $('#admin-session').hidden = true; $('#admin-workspace').hidden = true;
  $('#admin-sources').replaceChildren(); $('#admin-review-json').textContent = '';
  $('#admin-review').hidden = true; $('#connection-output').hidden = true;
  $('#connection-config-preview').textContent = ''; $('#admin-confirm').close();
  setBusy(false);
}

async function api(s, path, options = {}) {
  // Never use response-provided URLs or redirects with the authorization header.
  const url = new URL(`https://api.github.com/repos/${s.repository}${path}`);
  const controller = new AbortController();
  const abort = () => controller.abort(); s.abort.signal.addEventListener('abort', abort, {once:true});
  const timeout = setTimeout(abort, 25000);
  try {
    const response = await fetch(url, {...options, cache:'no-store', credentials:'omit', redirect:'error', referrerPolicy:'no-referrer', signal:controller.signal,
      headers:{Accept:'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28', 'Content-Type':'application/json', Authorization:`Bearer ${s.token}`}});
    if (session !== s) throw new Error('Admin session ended.');
    if (!response.ok) {
      const explanations = {401:'GitHub rejected the token. Disconnect and use a valid token.', 403:'GitHub denied this action. Check your administrator role, token Contents permission and branch rules.', 404:'Repository or connection not found, or this token cannot access it.', 409:'The repository changed since this list was loaded. Refresh the list before retrying.', 422:'GitHub rejected this change. The source may already exist, or branch rules may require a pull request.', 429:'GitHub rate limit reached. Wait before refreshing.'};
      const error = new Error(explanations[response.status] || `GitHub request failed (${response.status}).`);
      error.status = response.status; throw error;
    }
    return response.status === 204 ? {} : await response.json();
  } catch (error) {
    if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('GitHub could not be reached. A submitted change may have completed; refresh the source list before retrying.');
    throw error;
  } finally {clearTimeout(timeout); s.abort.signal.removeEventListener('abort', abort);}
}

function validateDraft(config) {
  const allowed = ['schemaVersion','id','label','enabled','apiUrl','root','portalUrl','format','filePattern','fields','units','recordsPath','auth','pairing','publicApproved'];
  if (!config || Object.keys(config).some(key => !allowed.includes(key)) || config.schemaVersion !== 1 || !ID.test(config.id)) throw new Error('Invalid connection configuration.');
  if (typeof config.enabled !== 'boolean' || typeof config.publicApproved !== 'boolean' || !config.label?.trim() || config.label.length > 120) throw new Error('Review the label and explicit publication decision.');
  const serialized = JSON.stringify(config);
  if (/(?:github_pat_|gh[pousr]_|Girder-Token|file:\/\/|\/Users\/|\/Volumes\/)/.test(serialized) || (session?.token && serialized.includes(session.token))) throw new Error('Remove credentials or private paths from the configuration.');
  for (const [key, value] of [['apiUrl',config.apiUrl], ['portalUrl',config.portalUrl]]) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || (key === 'apiUrl' && url.hash) || (url.port && url.port !== '443') || ['localhost','localhost.localdomain'].includes(url.hostname)) throw new Error('Use public HTTPS collection and API URLs without credentials or query parameters.');
  }
  if (!['folder','collection'].includes(config.root?.type) || !/^[a-f0-9]{24}$/.test(config.root.id)) throw new Error('Invalid collection root.');
  if (!['none','api_key','token'].includes(config.auth?.mode) || Object.keys(config.auth).some(key => !['mode','credential'].includes(key)) || (config.auth.mode !== 'none' && !ID.test(config.auth.credential))) throw new Error('Use a credential reference, never a collection API key.');
  if (!['discovery','csv','json','item_metadata'].includes(config.format)) throw new Error('Unsupported source format.');
  return structuredClone(config);
}

async function loadSources(s) {
  let entries;
  try {entries = await api(s, `/contents/${DIRECTORY}?ref=main`);} catch (error) {if (error.status !== 404) throw error; entries = [];}
  if (!Array.isArray(entries) || entries.length >= 1000) throw new Error('The source directory could not be listed completely. Check it on GitHub.');
  const sources = [];
  for (const entry of entries) {
    if (!entry.name?.endsWith('.json')) continue;
    const id = entry.name.slice(0,-5), expected = pathFor(id);
    if (entry.type !== 'file' || entry.path !== expected || !SHA.test(entry.sha)) throw new Error('Unexpected connection file. Review the directory on GitHub.');
    const file = await api(s, `/contents/${expected}?ref=main`);
    if (file.type !== 'file' || file.encoding !== 'base64' || !SHA.test(file.sha) || file.size > 50000) throw new Error('Unsupported connection file. Review it on GitHub.');
    const config = JSON.parse(decode(file.content));
    if (config.id !== id) throw new Error('Connection ID and filename do not match. Review it on GitHub.');
    sources.push({config, sha:file.sha});
  }
  if (session !== s) return;
  const target = $('#admin-sources');
  target.innerHTML = sources.length ? '' : '<div class="connection-empty"><div><h3>No sources connected.</h3><p>Add a collection using the form below.</p></div></div>';
  for (const source of sources) {
    const c = source.config, card = document.createElement('article'); card.className = 'connection-source-card';
    card.innerHTML = `<div class="connection-source-heading"><div><p class="eyebrow">${esc(c.id)}</p><h3>${esc(c.label)}</h3></div><span class="connection-status-pill">${c.enabled ? c.publicApproved ? 'Enabled' : 'Awaiting approval' : 'Paused'}</span></div><p>${esc(c.format)} · ${c.publicApproved ? 'Public sharing approved' : 'Not approved for publication'}</p><div class="admin-toolbar"><button class="button" type="button" data-action="pause">${c.enabled ? 'Pause' : 'Resume'}</button><button class="button admin-danger" type="button" data-action="remove">Remove source</button></div>`;
    card.querySelector('[data-action="pause"]').addEventListener('click', () => confirmChange(c.enabled ? 'pause' : 'resume', source));
    card.querySelector('[data-action="remove"]').addEventListener('click', () => confirmChange('remove', source));
    target.append(card);
  }
}

function confirmChange(action, source) {
  if (busy || !session) return;
  pending = {action, source};
  $('#admin-confirm-title').textContent = `${action === 'remove' ? 'Remove' : action === 'pause' ? 'Pause' : 'Resume'} ${source.config.label}?`;
  $('#admin-confirm-detail').textContent = action === 'remove' ? 'This deletes the connection configuration. Its card and connected measurements disappear after the website rebuild. The original collection and reviewed literature remain intact.' : action === 'pause' ? 'Stop synchronization and remove its measurements after rebuilding. Keep the configuration and a disabled status card.' : source.config.publicApproved ? 'Resume synchronization and public sharing under this source’s existing approval.' : 'Enable this configuration. Publication remains blocked until the source is approved.';
  $('#admin-confirm-id').value = ''; $('#admin-confirm-submit').disabled = true;
  $('#admin-confirm').showModal(); $('#admin-confirm-id').focus();
}

async function changeSource() {
  if (busy || !session || !pending || $('#admin-confirm-id').value !== pending.source.config.id) return;
  const s = session, {action, source} = pending, id = source.config.id;
  setBusy(true);
  try {
    const body = {message:`${action === 'remove' ? 'Remove' : action === 'pause' ? 'Pause' : 'Resume'} experimental source ${id}`, branch:'main', sha:source.sha};
    if (action !== 'remove') body.content = encode(JSON.stringify({...source.config, enabled:action === 'resume'},null,2)+'\n');
    await api(s, `/contents/${pathFor(id)}`, {method:action === 'remove' ? 'DELETE' : 'PUT', body:JSON.stringify(body)});
    $('#admin-confirm').close(); pending = null;
    message(`Source ${action === 'remove' ? 'removed' : action === 'pause' ? 'paused' : 'resumed'} in the repository. The public site will change after the Website workflow and deployment finish.`, 'success');
    await loadSources(s);
  } catch (error) {if (session === s) message(error.message, 'error');}
  finally {if (session === s) setBusy(false);}
}

async function saveSource() {
  if (busy || !session || !draft) return;
  const s = session; setBusy(true);
  try {
    const config = validateDraft(draft), path = pathFor(config.id);
    // No SHA for creation: an existing ID must fail rather than overwrite.
    await api(s, `/contents/${path}`, {method:'PUT', body:JSON.stringify({message:`Add experimental source ${config.id}`, branch:'main', content:encode(JSON.stringify(config,null,2)+'\n')})});
    draft = null; $('#admin-review').hidden = true;
    message('Source saved to the repository. Follow the website rebuild above. Restricted collections also need their credential in the encrypted Actions secret before synchronization can succeed.', 'success');
    await loadSources(s);
  } catch (error) {if (session === s) message(error.message, 'error');}
  finally {if (session === s) setBusy(false);}
}

if (window.top === window.self) {
  $('#admin-login').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || session) return;
    const repository = $('#admin-repository').value.trim(), token = $('#admin-token').value.trim();
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || repository.split('/').some(p => ['.','..'].includes(p))) {message('Use owner/repository.', 'error'); return;}
    if (!token.startsWith('github_pat_') || token.length < 30) {message('Use a fine-grained GitHub token restricted to the research repository.', 'error'); return;}
    const s = {repository, token, abort:new AbortController()}; session = s;
    $('#admin-token').value = ''; $('#admin-login button').disabled = true;
    try {
      const repo = await api(s, '');
      if (repo.permissions?.admin !== true) throw new Error('A GitHub repository administrator is required.');
      if (!repo.private || repo.default_branch !== 'main') throw new Error('Choose the private research repository with its main branch, rather than the generated public website repository.');
      await loadSources(s);
      $('#admin-login').hidden = true; $('#admin-session').hidden = false; $('#admin-workspace').hidden = false;
      $('#admin-session-label').textContent = `Admin · ${s.repository}`;
      $('#admin-workflow').href = `https://github.com/${s.repository}/actions/workflows/website.yml`;
      $('#connection-repo').value = s.repository; $('#connection-repo').readOnly = true;
      $('#connection-form button[type="submit"]').textContent = 'Review source before saving →';
      message('Connected. Review each source before saving a repository change.');
    } catch (error) {if (session === s) {signOut(); message(error.message, 'error');}}
    finally {$('#admin-login button').disabled = false;}
  });
  $('#admin-disconnect').addEventListener('click', () => {if (!busy) {signOut(); message('Disconnected. The token and private source list have been cleared.');}});
  $('#admin-refresh').addEventListener('click', async () => {if (!session || busy) return; const s = session; setBusy(true); try {await loadSources(s); message('Repository source list refreshed.');} catch (error) {message(error.message,'error');} finally {if (session === s) setBusy(false);}});
  document.addEventListener('ashby-connection-config-ready', event => {
    if (!session || busy) return;
    try {
      draft = validateDraft(event.detail);
      $('#admin-review-summary').textContent = `${draft.label} · ${draft.id} · ${draft.format}. ${draft.publicApproved ? 'Accepted source contents are approved for public sharing.' : 'Draft only; fetching and publication remain blocked.'}`;
      $('#admin-review-json').textContent = JSON.stringify(draft,null,2);
      $('#admin-credential-note').textContent = draft.auth.mode === 'none' ? 'This is a public collection; no collection credential is required.' : `Before this source can synchronize, add the credential reference “${draft.auth.credential}” to ASHBY_DATA_SOURCE_CREDENTIALS in GitHub Actions secrets. Collection keys never go into this form.`;
      $('#admin-review').hidden = false; $('#admin-review').scrollIntoView({behavior:'smooth',block:'start'});
    } catch (error) {draft = null; $('#admin-review').hidden = true; message(error.message,'error');}
  });
  $('#admin-save').addEventListener('click', saveSource);
  $('#admin-cancel-add').addEventListener('click', () => {draft = null; $('#admin-review').hidden = true;});
  $('#admin-confirm-id').addEventListener('input', () => {$('#admin-confirm-submit').disabled = busy || !pending || $('#admin-confirm-id').value !== pending.source.config.id;});
  $('#admin-confirm-submit').addEventListener('click', changeSource);
  $('#admin-confirm-cancel').addEventListener('click', () => {if (!busy) {pending = null; $('#admin-confirm').close();}});
  $('#admin-confirm').addEventListener('cancel', event => {if (busy) event.preventDefault(); else pending = null;});
  window.addEventListener('pagehide', signOut);
} else {
  $('#admin-login').hidden = true; message('Open this administrator page directly in its own tab.', 'error');
}
