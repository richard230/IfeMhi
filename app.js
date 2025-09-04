/* Mini Dev Console — HTML + CSS + JS only
 * Captures: console.* | fetch | XHR | WebSocket | errors | unhandled rejections
 * Tabs: Console, Network, Errors, Storage, Performance
 * Toggle: Ctrl+` or floating button
 * License: MIT (use freely)
 */

(() => {
  const root = document.getElementById('devconsole-root');
  const toggleBtn = document.getElementById('devconsole-toggle');

  // ---------- State ----------
  const state = {
    open: false,
    activeTab: 'network', // 'console' | 'network' | 'errors' | 'storage' | 'performance'
    consoleLogs: [],
    network: [],
    errors: [],
    wsEvents: [],
    selectedId: null,
    seq: 0,
  };

  const original = {
    console: {},
    fetch: window.fetch,
    XHR: window.XMLHttpRequest,
    WebSocket: window.WebSocket
  };

  // ---------- Utils ----------
  const $ = (sel, ctx = root) => ctx.querySelector(sel);
  const el = (tag, props = {}, ...children) => {
    const n = document.createElement(tag);
    Object.assign(n, props);
    for (const c of children) n.append(c?.nodeType ? c : document.createTextNode(c ?? ''));
    return n;
  };
  const nowISO = () => new Date().toISOString();
  const shortURL = (u) => {
    try {
      const {origin, pathname} = new URL(u, location.href);
      return origin + pathname + (u.includes('?') ? '…' : '');
    } catch { return u; }
  };
  const fmtBytes = (n) => (n == null || isNaN(n)) ? '—' :
    (n < 1024 ? `${n} B` : n < 1024*1024 ? `${(n/1024).toFixed(1)} KB` : `${(n/1024/1024).toFixed(1)} MB`);
  const safeJSON = (val) => {
    try { return JSON.stringify(val, null, 2); } catch { return String(val); }
  };
  const syntaxHighlight = (json) => {
    if (json == null) return '';
    const esc = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
    const str = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
    return esc(str)
      .replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"(?=\s*:)/g, '<span class="key">$&</span>')
      .replace(/"(\\u[a-fA-F0-9]{4}|\\[^u]|[^"\\])*"/g, '<span class="str">$&</span>')
      .replace(/\b(true|false)\b/g, '<span class="boo">$1</span>')
      .replace(/\b(null)\b/g, '<span class="nul">$1</span>')
      .replace(/\b(-?\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>');
  };
  const genId = () => (++state.seq).toString(36) + '-' + Date.now().toString(36);

  const clamp = (min, val, max) => Math.max(min, Math.min(max, val));

  // ---------- UI Skeleton ----------
  const render = () => {
    root.classList.toggle('open', state.open);
    toggleBtn.setAttribute('aria-expanded', String(state.open));
    if (!state.open) return;

    root.innerHTML = '';
    const header = el('div', {className:'dc-header'},
      el('span', {className:'dc-title'}, 'Developer Console'),
      el('span', {className:'dc-badge'}, location.host || 'file://'),
      el('div', {className:'dc-spacer'}),
      el('button', {className:'dc-btn', title:'Export logs', onclick: exportAll}, 'Export'),
      el('button', {className:'dc-btn', title:'Clear current tab', onclick: clearCurrent}, 'Clear'),
      el('button', {className:'dc-btn', title:'Close (Ctrl+`)', onclick: toggleOpen}, 'Close'),
    );

    const tabs = el('div', {className:'dc-tabs', role:'tablist'},
      tabButton('console','Console'),
      tabButton('network','Network'),
      tabButton('errors','Errors'),
      tabButton('storage','Storage'),
      tabButton('performance','Performance')
    );

    const body = el('div', {className:'dc-body'});

    switch (state.activeTab) {
      case 'console': mountConsole(body); break;
      case 'network': mountNetwork(body); break;
      case 'errors': mountErrors(body); break;
      case 'storage': mountStorage(body); break;
      case 'performance': mountPerformance(body); break;
    }

    const footer = el('div', {className:'dc-footer'});
    if (state.activeTab === 'console') {
      const input = el('input', {className:'dc-input', id:'dc-repl', placeholder:'› Type JavaScript… (Shift+Enter for newline). Use await freely.'});
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          runRepl(input.value);
          input.value = '';
        }
      });
      footer.append(
        input,
        el('button', {className:'dc-btn', onclick: () => { const v = $('#dc-repl').value; runRepl(v); $('#dc-repl').value='';}}, 'Run'),
        el('button', {className:'dc-btn', onclick: () => $('#dc-repl').value=''}, 'Clear')
      );
    } else {
      footer.append(
        el('span', {}, 'Tip: Use Ctrl+` to toggle. Click a row for details.')
      );
    }

    root.append(header, tabs, body, footer);
  };

  const tabButton = (id, label) => {
    const b = el('button', {className:'dc-tab', role:'tab', 'aria-selected': String(state.activeTab===id), onclick: () => { state.activeTab=id; state.selectedId=null; render(); }}, label);
    b.dataset.tab = id;
    return b;
  };

  const clearCurrent = () => {
    if (state.activeTab === 'console') state.consoleLogs.length = 0;
    if (state.activeTab === 'network') state.network.length = 0;
    if (state.activeTab === 'errors') state.errors.length = 0;
    state.selectedId = null;
    render();
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify({
      exportedAt: nowISO(),
      url: location.href,
      logs: state.consoleLogs,
      network: state.network,
      errors: state.errors,
      ws: state.wsEvents
    }, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.download = `devconsole-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    a.href = URL.createObjectURL(blob);
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  };

  const toggleOpen = () => { state.open = !state.open; render(); };

  // ---------- Console Tab ----------
  function mountConsole(body){
    const list = el('div', {className:'dc-list', role:'list'});
    const detail = el('div', {className:'dc-detail', role:'region'});

    // filter bar
    const filterBar = el('div', {className:'dc-row console', style:'position:sticky;top:0;background:#10121a;border-bottom:1px solid #1b1f2d;z-index:1'},
      el('span', {className:'level-pill'}, 'Filter'),
      (()=>{
        const i = el('input', {className:'dc-input', placeholder:'Search text…'});
        i.addEventListener('input', ()=> render());
        i.id = 'dc-console-filter';
        return i;
      })(),
      el('span', {style:'text-align:right;color:var(--dc-muted);font-family:var(--mono)'}, `${state.consoleLogs.length}`)
    );
    list.append(filterBar);

    const q = ($('#dc-console-filter')?.value || '').toLowerCase();

    state.consoleLogs
      .filter(row => !q || JSON.stringify(row.args).toLowerCase().includes(q) || (row.stack||'').toLowerCase().includes(q))
      .slice(-1000) // keep UI snappy
      .reverse()
      .forEach(row => {
        const r = el('div', {className:'dc-row console', role:'listitem', onclick: ()=>{ state.selectedId=row.id; render(); }});
        const lvl = el('span', {className:`level-pill level-${row.level}`}, row.level.toUpperCase());
        const txt = el('div', {className:'url'}, summarizeArgs(row.args));
        const ts = el('span', {style:'text-align:right;color:var(--dc-muted); font-family:var(--mono);'}, new Date(row.time).toLocaleTimeString());
        r.append(lvl, txt, ts);
        list.append(r);
      });

    const selected = state.consoleLogs.find(x=>x.id===state.selectedId);
    if (selected) {
      detail.append(renderConsoleDetail(selected));
    } else {
      detail.append(el('div', {className:'section'}, el('h3', {}, 'Details'), el('div', {className:'kv'}, el('div', {className:'k'}, 'Select a row'))));
    }

    body.append(list, detail);
  }

  const summarizeArgs = (args) => {
    return args.map(a => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      try { return JSON.stringify(a); } catch{ return String(a); }
    }).join(' ');
  };

  const renderConsoleDetail = (row) => {
    const wrap = el('div');
    wrap.append(
      sectionKV('Meta', {
        Level: row.level.toUpperCase(),
        Time: new Date(row.time).toLocaleString(),
      }),
      codeSection('Arguments', row.args),
      row.stack ? codeSection('Stack', row.stack) : el('div')
    );
    return wrap;
  };

  const codeSection = (title, data) => {
    const s = el('div',{className:'section'});
    s.append(el('h3',{}, title));
    const pre = el('pre', {className:'code'});
    const content = typeof data === 'string' ? data : syntaxHighlight(data);
    pre.innerHTML = content;
    s.append(pre);
    return s;
  };

  const sectionKV = (title, obj) => {
    const s = el('div',{className:'section'});
    s.append(el('h3',{}, title));
    const kv = el('div',{className:'kv'});
    Object.entries(obj).forEach(([k,v]) => kv.append(el('div',{className:'k'}, k), el('div',{}, String(v))));
    s.append(kv);
    return s;
  };

  async function runRepl(code){
    if (!code?.trim()) return;
    // Display the input
    pushConsole('log', ['› ' + code]);

    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('return (async()=>{'+code+'\n})()');
      const result = await fn();
      pushConsole('log', [result]);
    } catch (err) {
      pushConsole('error', [err]);
    }
  }

  // ---------- Network Tab ----------
  function mountNetwork(body){
    const list = el('div', {className:'dc-list', role:'list'});
    const detail = el('div', {className:'dc-detail', role:'region'});

    const head = el('div', {className:'dc-row', style:'position:sticky;top:0;background:#10121a;border-bottom:1px solid #1b1f2d;z-index:1'},
      el('strong', {className:'method'}, 'Method'),
      el('strong', {className:'url'}, 'URL'),
      el('strong', {className:'status'}, 'Status'),
      el('strong', {className:'dur'}, 'Time')
    );
    list.append(head);

    state.network.slice(-1000).reverse().forEach(req => {
      const r = el('div', {className:'dc-row', role:'listitem', onclick: ()=>{ state.selectedId=req.id; render(); }});
      r.append(
        el('span', {className:'method'}, req.method),
        el('div', {className:'url', title:req.url}, shortURL(req.url)),
        el('span', {className:'status', style:`color:${statusColor(req.status)};`}, req.status ?? '—'),
        el('span', {className:'dur'}, `${req.duration?.toFixed?.(0) ?? '—'} ms`)
      );
      list.append(r);
    });

    const selected = state.network.find(x=>x.id===state.selectedId);
    if (selected) detail.append(renderNetworkDetail(selected));
    else detail.append(sectionKV('Details', {Hint:'Select a request'}));

    body.append(list, detail);
  }

  const statusColor = (s) => s == null ? 'var(--dc-muted)' :
    s >= 500 ? 'var(--dc-red)' : s >= 400 ? 'var(--dc-yellow)' : 'var(--dc-green)';

  const renderNetworkDetail = (req) => {
    const wrap = el('div');
    wrap.append(
      sectionKV('Overview', {
        Method: req.method,
        URL: req.url,
        Type: req.type,
        Status: req.status ?? '—',
        Duration: (req.duration?.toFixed?.(0) ?? '—') + ' ms',
        'Req Size': fmtBytes(req.requestSize),
        'Res Size': fmtBytes(req.responseSize),
        Started: new Date(req.startTime).toLocaleString(),
        Finished: req.endTime ? new Date(req.endTime).toLocaleString() : '—'
      }),
      sectionKV('Request Headers', req.requestHeaders || {'(none)':''}),
      req.requestBody ? codeSection('Request Body', tryFormat(req.requestBody)) : el('div'),
      sectionKV('Response Headers', req.responseHeaders || {'(none)':''}),
      req.error ? codeSection('Error', String(req.error)) :
        (req.responseText ? codeSection('Response', previewContent(req)) : el('div')),
      (()=>{
        const s = el('div', {className:'section'});
        s.append(el('h3', {}, 'Actions'));
        const bar = el('div', {className:'kv'});
        const curl = buildCurl(req);
        const copyBtn = el('button', {className:'dc-btn', onclick: () => { navigator.clipboard.writeText(curl); pushConsole('info', ['Copied cURL to clipboard']); }}, 'Copy as cURL');
        const repeatBtn = el('button', {className:'dc-btn', onclick: () => repeatRequest(req)}, 'Repeat Request');
        bar.append(el('div', {className:'k'}, 'cURL'), el('div', {}, copyBtn), el('div', {className:'k'}, 'Replay'), el('div',{}, repeatBtn));
        s.append(bar);
        return s;
      })()
    );
    return wrap;
  };

  const tryFormat = (body) => {
    if (typeof body === 'string') {
      // maybe JSON
      try { return JSON.stringify(JSON.parse(body), null, 2); } catch { return body; }
    }
    return body;
  };

  const previewContent = (req) => {
    const ct = (req.responseHeaders?.['content-type'] || '').toLowerCase();
    if (ct.includes('application/json')) {
      try { return syntaxHighlight(JSON.parse(req.responseText)); } catch { return syntaxHighlight(req.responseText); }
    }
    if (ct.includes('text/')) return req.responseText;
    return `(binary ${fmtBytes(req.responseSize)})`;
  };

  const buildCurl = (req) => {
    const h = req.requestHeaders || {};
    const headerLines = Object.entries(h).map(([k,v]) => `-H ${shQuote(k+': '+v)}`).join(' ');
    const method = req.method && req.method.toUpperCase() !== 'GET' ? `-X ${req.method.toUpperCase()}` : '';
    const data = req.requestBody != null && req.requestBody !== '' ? `--data-raw ${shQuote(typeof req.requestBody === 'string' ? req.requestBody : JSON.stringify(req.requestBody))}` : '';
    return `curl ${method} ${headerLines} ${data} ${shQuote(req.url)}`.replace(/\s+/g,' ').trim();
  };

  const shQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

  async function repeatRequest(req){
    try {
      const init = {
        method: req.method,
        headers: req.requestHeaders,
        body: (req.method||'GET').toUpperCase() === 'GET' ? undefined :
              (typeof req.requestBody === 'string' ? req.requestBody : JSON.stringify(req.requestBody))
      };
      const res = await fetch(req.url, init);
      console.info('Replayed request', req.method, req.url, res.status);
    } catch (e) {
      console.error('Replay failed', e);
    }
  }

  // ---------- Errors Tab ----------
  function mountErrors(body){
    const list = el('div', {className:'dc-list', role:'list'});
    const detail = el('div', {className:'dc-detail', role:'region'});

    const head = el('div', {className:'dc-row console', style:'position:sticky;top:0;background:#10121a;border-bottom:1px solid #1b1f2d;z-index:1'},
      el('strong', {}, 'Type'),
      el('strong', {}, 'Message'),
      el('strong', {}, 'Time'),
    );
    list.append(head);

    state.errors.slice(-1000).reverse().forEach(e => {
      const r = el('div', {className:'dc-row console', role:'listitem', onclick: ()=>{ state.selectedId=e.id; render(); }});
      r.append(
        el('span', {className:'level-pill level-error'}, e.kind.toUpperCase()),
        el('div', {className:'url'}, e.message),
        el('span', {style:'text-align:right;color:var(--dc-muted); font-family:var(--mono);'}, new Date(e.time).toLocaleTimeString()),
      );
      list.append(r);
    });

    const selected = state.errors.find(x=>x.id===state.selectedId);
    if (selected) {
      const wrap = el('div');
      wrap.append(
        sectionKV('Overview', {Type: selected.kind, Time: new Date(selected.time).toLocaleString(), Source: selected.source || 'window'}),
        selected.stack ? codeSection('Stack', selected.stack) : el('div'),
        selected.extra ? codeSection('Extra', selected.extra) : el('div')
      );
      detail.append(wrap);
    } else {
      detail.append(sectionKV('Details', {Hint:'Select an error'}));
    }

    body.append(list, detail);
  }

  // ---------- Storage Tab ----------
  function mountStorage(body){
    const wrap = el('div', {className:'storage-wrap'});
    wrap.append(storagePane('LocalStorage', localStorage), storagePane('SessionStorage', sessionStorage), cookiePane());
    body.append(wrap);
  }

  function storagePane(title, storage){
    const pane = el('div', {className:'storage-pane'});
    pane.append(el('h4',{}, title));
    const list = el('div', {className:'storage-list'});
    pane.append(list);
    const renderItems = () => {
      list.innerHTML='';
      for (let i=0;i<storage.length;i++){
        const key = storage.key(i);
        const val = storage.getItem(key);
        list.append(storageItem(storage, key, val));
      }
      // add new
      list.append(storageEditor(storage));
    };
    renderItems();
    return pane;
  }

  function storageItem(storage, key, val){
    const row = el('div', {className:'storage-item'});
    const k = el('code', {}, key);
    const v = el('code', {}, (val?.length>80?val.slice(0,80)+'…':val) || '');
    const del = el('button', {onclick: ()=>{ storage.removeItem(key); pushConsole('warn',[`Removed ${key} from ${storage===localStorage?'local':'session'}Storage`]); render(); }}, 'Delete');
    row.append(k, v, del);
    return row;
  }

  function storageEditor(storage){
    const row = el('div', {className:'storage-item'});
    const keyIn = el('input', {placeholder:'key'});
    const valIn = el('input', {placeholder:'value'});
    const add = el('button', {onclick: ()=>{ storage.setItem(keyIn.value, valIn.value); pushConsole('info',[`Set ${keyIn.value}`]); render(); }}, 'Add/Update');
    row.append(keyIn, valIn, add);
    return row;
  }

  function cookiePane(){
    const pane = el('div', {className:'storage-pane'});
    pane.append(el('h4',{}, 'Cookies'));
    const list = el('div', {className:'storage-list'});
    const parsed = parseCookies(document.cookie);
    Object.entries(parsed).forEach(([k,v]) => {
      const row = el('div', {className:'storage-item'});
      row.append(el('code',{},k), el('code',{},v), (()=>{
        const del = el('button', {onclick: ()=>{ document.cookie = `${encodeURIComponent(k)}=; Max-Age=0; path=/`; pushConsole('warn',[`Deleted cookie ${k}`]); render(); }}, 'Delete');
        return del;
      })());
      list.append(row);
    });
    pane.append(list);
    return pane;
  }

  const parseCookies = (cookieStr) => cookieStr.split(/;\s*/).filter(Boolean).reduce((acc, pair)=>{
    const idx = pair.indexOf('=');
    if (idx === -1) acc[decodeURIComponent(pair)] = '';
    else acc[decodeURIComponent(pair.slice(0,idx))] = decodeURIComponent(pair.slice(idx+1));
    return acc;
  },{});

  // ---------- Performance Tab ----------
  function mountPerformance(body){
    const wrap = el('div', {className:'perf-wrap'});

    // FPS
    const fpsCard = el('div', {className:'perf-card'});
    fpsCard.append(el('h4',{},'FPS'), el('div', {className:'perf-metric', id:'fps-val'}, '—'), el('div',{className:'perf-note'}, 'Measured via rAF over 1s window.'));
    wrap.append(fpsCard);

    // Memory (Chrome-only typically)
    const memCard = el('div', {className:'perf-card'});
    memCard.append(el('h4',{},'Memory'), el('div', {className:'perf-metric', id:'mem-val'}, '—'), el('div',{className:'perf-note'}, 'performance.memory (non-standard).'));
    wrap.append(memCard);

    // Navigation Timing
    const navCard = el('div', {className:'perf-card'});
    navCard.append(el('h4',{},'Navigation Timing'), el('pre', {className:'code', id:'nav-timing'}));
    wrap.append(navCard);

    body.append(wrap);

    // start FPS loop
    startFPSCounter($('#fps-val'));

    // memory
    updateMemory($('#mem-val'));
    setInterval(()=>updateMemory($('#mem-val')), 2000);

    // navigation/resource timing snapshot
    try {
      const nav = performance.getEntriesByType('navigation')[0] || performance.timing;
      $('#nav-timing').innerHTML = syntaxHighlight(nav.toJSON ? nav.toJSON() : nav);
    } catch (e) {
      $('#nav-timing').textContent = 'Navigation timing not available.';
    }
  }

  let fpsRAF = null;
  function startFPSCounter(target){
    let last = performance.now();
    let frame = 0, fps = 0;
    const loop = (t) => {
      frame++;
      const dt = t - last;
      if (dt >= 1000) {
        fps = Math.round((frame * 1000) / dt);
        target.textContent = fps + ' fps';
        frame = 0; last = t;
      }
      fpsRAF = requestAnimationFrame(loop);
    };
    if (fpsRAF) cancelAnimationFrame(fpsRAF);
    fpsRAF = requestAnimationFrame(loop);
  }

  function updateMemory(target){
    const m = performance.memory;
    if (m) {
      target.textContent = `${(m.usedJSHeapSize/1048576).toFixed(1)} / ${(m.jsHeapSizeLimit/1048576).toFixed(0)} MB`;
    } else target.textContent = 'N/A';
  }

  // ---------- Capture Console ----------
  ['log','info','warn','error','debug','table','group','groupEnd','time','timeEnd','trace'].forEach(level=>{
    original.console[level] = console[level].bind(console);
    console[level] = function(...args){
      try { pushConsole(level, args, getStack(2)); } catch {}
      return original.console[level](...args);
    };
  });

  function pushConsole(level, args, stack){
    const row = { id: genId(), level, args, time: Date.now(), stack };
    state.consoleLogs.push(row);
    if (state.open && state.activeTab==='console') scheduleRender();
  }

  const getStack = (skip=1) => {
    const e = new Error();
    if (!e.stack) return '';
    return e.stack.split('\n').slice(1+skip).join('\n');
  };

  // ---------- Capture fetch ----------
  window.fetch = async function(input, init={}){
    const id = genId();
    const url = typeof input === 'string' ? input : input.url;
    const method = (init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    const headers = new Headers(init.headers || (typeof input !== 'string' ? input.headers : undefined));
    const requestHeaders = {};
    headers.forEach((v,k)=> requestHeaders[k.toLowerCase()] = v);
    const body = init.body;
    const start = performance.now();

    const rec = {
      id, url, method, type:'fetch', startTime: Date.now(), requestHeaders,
      requestBody: await bodyToString(body),
    };
    state.network.push(rec);
    scheduleRender();

    try {
      const res = await original.fetch(input, init);
      const clone = res.clone();
      rec.status = res.status;
      rec.responseHeaders = {};
      clone.headers.forEach((v,k)=> rec.responseHeaders[k.toLowerCase()] = v);
      rec.responseText = await readResponseTextSafe(clone);
      rec.responseSize = sizeFromHeaders(rec.responseHeaders, rec.responseText);
      rec.endTime = Date.now();
      rec.duration = performance.now() - start;
      scheduleRender();
      return res;
    } catch (error) {
      rec.error = error.message || String(error);
      rec.endTime = Date.now();
      rec.duration = performance.now() - start;
      scheduleRender();
      throw error;
    }
  };

  // ---------- Capture XHR ----------
  function wrapXHR(){
    const XHR = original.XHR;
    function PatchedXHR(){
      const xhr = new XHR();
      let _method = 'GET', _url = '', _async = true, _headers = {};
      const id = genId();
      const rec = { id, type:'xhr', method:_method, url:_url, requestHeaders:{}, startTime:0 };

      xhr.addEventListener('loadstart', () => {
        rec.startTime = Date.now();
      });
      xhr.addEventListener('readystatechange', () => {
        if (xhr.readyState === 2) { // HEADERS_RECEIVED
          rec.status = xhr.status;
          rec.responseHeaders = parseRawHeaders(xhr.getAllResponseHeaders());
        }
      });
      xhr.addEventListener('loadend', () => {
        rec.endTime = Date.now();
        rec.duration = rec.endTime - rec.startTime;
        try {
          rec.responseText = xhr.responseType === '' || xhr.responseType === 'text' ? xhr.responseText : '';
        } catch{ rec.responseText = ''; }
        rec.responseSize = sizeFromHeaders(rec.responseHeaders, rec.responseText);
        scheduleRender();
      });
      xhr.addEventListener('error', () => {
        rec.error = 'Network Error';
        rec.endTime = Date.now();
        rec.duration = rec.endTime - rec.startTime;
        scheduleRender();
      });

      const _open = xhr.open;
      xhr.open = function(method, url, async=true, user, password){
        _method = method; _url = url; _async = async;
        rec.method = String(method||'GET').toUpperCase();
        rec.url = url;
        state.network.push(rec);
        scheduleRender();
        return _open.apply(xhr, arguments);
      };

      const _setHeader = xhr.setRequestHeader;
      xhr.setRequestHeader = function(k,v){
        _headers[k.toLowerCase()] = v;
        rec.requestHeaders[k.toLowerCase()] = v;
        return _setHeader.apply(xhr, arguments);
      };

      const _send = xhr.send;
      xhr.send = function(body){
        bodyToString(body).then(b => { rec.requestBody = b; });
        return _send.apply(xhr, arguments);
      };

      return xhr;
    }
    window.XMLHttpRequest = PatchedXHR;
  }
  wrapXHR();

  // ---------- Capture WebSocket ----------
  function wrapWS(){
    const OWS = original.WebSocket;
    function PatchedWS(url, protocols){
      const ws = new OWS(url, protocols);
      const id = genId();
      const base = { id, url: String(url), time: Date.now(), type:'ws' };
      state.wsEvents.push({...base, event:'open-pending'});
      ws.addEventListener('open', () => {
        pushConsole('info', ['WebSocket open', url]);
        state.wsEvents.push({...base, event:'open', time: Date.now()});
        scheduleRender();
      });
      ws.addEventListener('message', (ev) => {
        state.wsEvents.push({...base, event:'message', time: Date.now(), data: String(ev.data).slice(0,2_000)});
        scheduleRender();
      });
      ws.addEventListener('close', (ev) => {
        state.wsEvents.push({...base, event:'close', time: Date.now(), code: ev.code, reason: ev.reason});
        scheduleRender();
      });
      ws.addEventListener('error', (ev) => {
        state.wsEvents.push({...base, event:'error', time: Date.now(), data: String(ev.message || ev)});
        scheduleRender();
      });

      const _send = ws.send;
      ws.send = function(data){
        state.wsEvents.push({...base, event:'send', time: Date.now(), data: typeof data==='string'?data: '[binary]'});
        scheduleRender();
        return _send.apply(ws, arguments);
      };
      return ws;
    }
    window.WebSocket = PatchedWS;
  }
  wrapWS();

  // ---------- Helpers for network ----------
  async function bodyToString(body){
    if (body == null) return '';
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (body instanceof Blob) {
      if (body.type.startsWith('text') || body.type.includes('json')) return await body.text();
      return `[blob ${fmtBytes(body.size)} ${body.type||'application/octet-stream'}]`;
    }
    if (body instanceof FormData) {
      const entries = [];
      for (const [k,v] of body.entries()){
        if (v instanceof File) entries.push(`${k}=[file ${v.name} ${fmtBytes(v.size)}]`);
        else entries.push(`${k}=${v}`);
      }
      return entries.join('&');
    }
    try { return JSON.stringify(body); } catch { return String(body); }
  }

  function parseRawHeaders(raw){
    const out = {};
    raw.trim().split(/[\r\n]+/).forEach(line => {
      const idx = line.indexOf(':');
      if (idx>0) out[line.slice(0,idx).trim().toLowerCase()] = line.slice(idx+1).trim();
    });
    return out;
  }

  async function readResponseTextSafe(res){
    try {
      if (res.type === 'opaque') return '[opaque response]';
      const ct = res.headers.get('content-type') || '';
      if (/application\/json|text\//i.test(ct)) return await res.text();
      // Try to read small blobs (e.g., SVG)
      const buf = await res.arrayBuffer();
      return `[binary ${fmtBytes(buf.byteLength)}]`;
    } catch (e) {
      return `[unreadable: ${e.message}]`;
    }
  }

  function sizeFromHeaders(headers, fallbackText){
    const cl = headers?.['content-length'];
    if (cl && !Number.isNaN(+cl)) return +cl;
    if (typeof fallbackText === 'string') return new TextEncoder().encode(fallbackText).length;
    return null;
  }

  // ---------- Global Error Capture ----------
  window.addEventListener('error', (ev) => {
    pushError('error', ev.message, ev.error?.stack, {filename: ev.filename, lineno: ev.lineno, colno: ev.colno});
  });
  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason instanceof Error ? ev.reason.message : safeJSON(ev.reason);
    pushError('unhandledrejection', reason, ev.reason?.stack, {});
  });

  function pushError(kind, message, stack, extra){
    state.errors.push({ id: genId(), kind, message, stack, extra: extra && safeJSON(extra), time: Date.now(), source: 'window' });
    if (state.open && state.activeTab==='errors') scheduleRender();
  }

  // ---------- Minimal render scheduler ----------
  let renderTimer = null;
  const scheduleRender = () => {
    if (!state.open) return;
    if (renderTimer) return;
    renderTimer = requestAnimationFrame(()=>{ render(); renderTimer=null; });
  };

  // ---------- Open + Hotkeys ----------
  toggleBtn.addEventListener('click', toggleOpen);
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '`') {
      e.preventDefault();
      toggleOpen();
    }
  });

  // Initially mount root container
  render();

  // Accessibility: prevent focus trap issues
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleOpen();
  });

  // Nice: remember open state in session
  try {
    const saved = sessionStorage.getItem('__devconsole_open');
    if (saved === '1') { state.open = true; render(); }
    const observer = new MutationObserver(()=> {
      sessionStorage.setItem('__devconsole_open', state.open ? '1' : '0');
    });
    observer.observe(root, {attributes:true, attributeFilter:['class']});
  } catch{}

})();
