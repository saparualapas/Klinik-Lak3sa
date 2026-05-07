// ════════════════════════════════════════════════════════════════
//  LAK3SA KLINIK — app.js  FINAL v5
//
//  CONFIG TERSIMPAN PER-USER di sheet "users" kolom C & D
//  Device baru login → dapat config langsung dari server
//  Tidak ada setup page — URL hardcode sebagai default bootstrap
// ════════════════════════════════════════════════════════════════

// URL default untuk bootstrap pertama kali
// Setelah login, URL dari server (per-user) akan menggantikan ini
const DEFAULT_API = 'https://script.google.com/macros/s/AKfycbyzlhxkEt7G_WeZCSMUsU8cSAM5tEAW0w430NtgvE9cm_XOMMk2F-yrMcnyWCRiRTJrHw/exec';

let API_URL     = localStorage.getItem('klinik_api') || DEFAULT_API;
let curUser     = '';
let activeSheet = '';
let selWbp      = null;
let selSheet    = '';
let allSheets   = [];

const C = {
  wbp:    { d: null, ok: false },
  visits: { d: null, ok: false },
  stats:  { d: null, ok: false },
};
const inv    = k => { C[k].d = null; C[k].ok = false; };
const invAll = ()  => Object.keys(C).forEach(inv);

const PG = 15;
const pg = { wbp: { p:1, rows:[] }, riw: { p:1, rows:[] } };

const LS = {
  save:  u  => sessionStorage.setItem('kl_u', u),
  load:  ()  => sessionStorage.getItem('kl_u') || '',
  clear: ()  => sessionStorage.removeItem('kl_u'),
};

// ═══════════════ BOOT ═════════════════════════════════════════
window.addEventListener('load', () => {
  setTimeout(() => {
    const sp = document.getElementById('splash');
    sp.classList.add('out');
    setTimeout(async () => {
      sp.style.display = 'none';
      // Sinkronkan default URL ke localStorage
      localStorage.setItem('klinik_api', API_URL);
      const u = LS.load();
      if (u) {
        curUser = u;
        // Reload config user dari server
        await loadUserConfig(u);
        showApp();
      } else {
        showLogin();
      }
    }, 720);
  }, 2400);
});

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('app').style.display       = 'none';
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('app').style.display       = 'flex';
  document.getElementById('topbarUser').textContent  = '👤 ' + curUser;
  document.getElementById('fTgl').value = today();
  initDash();
  lazyObs();
}

window.addEventListener('resize', applyGrid);

function lazyObs() {
  const o = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vs'); o.unobserve(e.target); }});
  }, { threshold: 0.04 });
  document.querySelectorAll('.lzy').forEach(el => o.observe(el));
}

// ═══════════════ CONFIG PER-USER ══════════════════════════════
// Muat config user dari server (kolom C & D sheet users)
async function loadUserConfig(username) {
  try {
    const r = await api({ action: 'getConfig', username });
    if (r.apiUrl && r.apiUrl !== API_URL) {
      API_URL = r.apiUrl;
      localStorage.setItem('klinik_api', r.apiUrl);
    }
    if (r.activeSheet) {
      activeSheet = r.activeSheet;
      localStorage.setItem('klinik_sheet', r.activeSheet);
      updSheetBadge();
    } else {
      const cached = localStorage.getItem('klinik_sheet');
      if (cached) { activeSheet = cached; updSheetBadge(); }
    }
  } catch(e) {
    const cached = localStorage.getItem('klinik_sheet');
    if (cached) { activeSheet = cached; updSheetBadge(); }
    console.warn('loadUserConfig failed', e);
  }
}

// Simpan config user ke server (per-user di kolom C & D sheet users)
async function saveUserConfig(key, value) {
  try {
    await api({ action: 'saveUserConfig', username: curUser, [key]: value }, 'POST');
    if (key === 'active_sheet') localStorage.setItem('klinik_sheet', value);
    if (key === 'api_url')      localStorage.setItem('klinik_api',   value);
  } catch(e) {
    // Fallback: simpan lokal saja
    if (key === 'active_sheet') localStorage.setItem('klinik_sheet', value);
    if (key === 'api_url')      localStorage.setItem('klinik_api',   value);
  }
}

// ═══════════════ UTILS ════════════════════════════════════════
const WIT_OFFSET = 9 * 60; // WIT = UTC+9 Maluku/Jayapura
function nowWIT() {
  const d = new Date();
  return new Date(d.getTime() + (WIT_OFFSET - d.getTimezoneOffset()) * 60000);
}
const today = () => nowWIT().toISOString().split('T')[0];

function normalDate(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (s.includes('T')) return s.substring(0, 10);
  return s;
}

function fmtDate(v) {
  if (!v) return '—';
  try {
    const d = new Date(normalDate(v) + 'T00:00:00');
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  } catch { return String(v); }
}

function ageFrom(dob) {
  if (!dob) return '';
  const s = normalDate(dob); if (!s) return '';
  const b = new Date(s + 'T00:00:00'), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return isNaN(a) || a < 0 ? '' : a;
}

function autoAge(inId, outId) {
  const a = ageFrom(document.getElementById(inId).value);
  document.getElementById(outId).value = a !== '' ? a + ' tahun' : '';
}

function getTD(sId, dId) {
  const s = (document.getElementById(sId)?.value || '').trim();
  const d = (document.getElementById(dId)?.value || '').trim();
  if (!s && !d) return '';
  return (s && d) ? s + '/' + d : (s || d);
}

function setTD(val, sId, dId) {
  const str = String(val || '').replace(/\s*mmhg\s*/i, '').trim();
  const pts = str.split('/');
  const se = document.getElementById(sId), de = document.getElementById(dId);
  if (se) se.value = (pts[0] || '').trim();
  if (de) de.value = (pts[1] || '').trim();
}

function setNum(val, id, re) {
  const el = document.getElementById(id); if (!el) return;
  el.value = String(val || '').replace(re, '').trim();
}

const showTD   = v => { const s=String(v||'').trim(); return(!s||s==='—')?'—':(/^\d+\/\d+$/.test(s)?s+' mmHg':s); };
const showSuhu = v => { const s=String(v||'').trim(); return(!s||s==='—')?'—':s+' °C'; };
const showBB   = v => { const s=String(v||'').trim(); return(!s||s==='—')?'—':s+' kg'; };

function renderDrugs(v) {
  if (!v || String(v).trim() === '' || v === '—') return '<span style="color:var(--li)">—</span>';
  const ds = String(v).split(',').map(d => d.trim()).filter(Boolean);
  if (!ds.length) return '<span style="color:var(--li)">—</span>';
  if (ds.length === 1) return '<span style="color:#1e40af;font-size:.76rem">' + esc(ds[0]) + '</span>';
  return '<div class="dtgs">' + ds.map(d => '<span class="dtg">' + esc(d) + '</span>').join('') + '</div>';
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ═══════════════ TOAST ════════════════════════════════════════
function toast(msg, type='ok', dur=3800) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = 'show ' + type;
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), dur);
}

// ═══════════════ CRUD SPLASH ══════════════════════════════════
// Splash ditampilkan saat mulai operasi.
// hideCrudSplash() dipanggil SETELAH data selesai dirender ke UI.
function showCrudSplash(msg) {
  const el = document.getElementById('crudSplash');
  const tx = document.getElementById('crudSplashMsg');
  if (el) { if (tx) tx.textContent = msg || 'Memproses...'; el.classList.add('on'); }
}
function hideCrudSplash() {
  const el = document.getElementById('crudSplash');
  if (el) el.classList.remove('on');
}

const showMod  = id => document.getElementById(id).classList.add('op');
const closeMod = id => document.getElementById(id).classList.remove('op');

function setBtn(id, loading, lbl='') {
  const b = document.getElementById(id); if (!b) return;
  if (loading) { b._l = b.innerHTML; b.innerHTML = '<span class="sp2"></span>'; b.disabled = true; }
  else { b.innerHTML = lbl || b._l || ''; b.disabled = false; }
}

const debounce = (fn, ms=320) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

function skelRows(cols, n=4) {
  return Array(n).fill(0).map(() =>
    '<tr>' + Array(cols).fill(0).map(() =>
      '<td><div class="sk" style="height:12px;border-radius:5px"></div></td>'
    ).join('') + '</tr>'
  ).join('');
}

// ═══════════════ API ══════════════════════════════════════════
async function api(params, method='GET') {
  if (!API_URL) { toast('❌ URL API belum diset!', 'er'); throw new Error('No API_URL'); }
  try {
    const res = method === 'POST'
      ? await fetch(API_URL, { method:'POST', body:JSON.stringify(params), headers:{'Content-Type':'text/plain;charset=utf-8'} })
      : await fetch(API_URL + '?' + new URLSearchParams(params));
    return await res.json();
  } catch(e) {
    toast('❌ Gagal terhubung ke server. Cek koneksi.', 'er');
    throw e;
  }
}

// ═══════════════ AUTH ═════════════════════════════════════════
async function doLogin() {
  const u = document.getElementById('login_u').value.trim();
  const p = document.getElementById('login_p').value;
  if (!u || !p) { toast('⚠️ Isi username dan password', 'er'); return; }
  setBtn('loginBtn', true);
  document.getElementById('loginErr').style.display = 'none';
  try {
    const r = await api({ action: 'login', username: u, password: p }, 'POST');
    if (r.success) {
      curUser = u;
      LS.save(u);
      // Terapkan config user dari response login
      if (r.apiUrl && r.apiUrl !== API_URL) {
        API_URL = r.apiUrl;
        localStorage.setItem('klinik_api', r.apiUrl);
      }
      if (r.activeSheet) {
        activeSheet = r.activeSheet;
        localStorage.setItem('klinik_sheet', r.activeSheet);
      }
      toast('✅ Login berhasil! Selamat datang, ' + u + ' 👋');
      showApp();
    } else {
      document.getElementById('loginErr').textContent = r.message || 'Username atau password salah';
      document.getElementById('loginErr').style.display = 'block';
      toast('❌ ' + (r.message || 'Login gagal'), 'er');
    }
  } catch {
    document.getElementById('loginErr').style.display = 'block';
  }
  setBtn('loginBtn', false, 'MASUK');
}

function doLogout() {
  if (!confirm('Yakin ingin keluar?')) return;
  LS.clear(); curUser = ''; selWbp = null; invAll(); pgLoaded = {};
  showLogin();
  document.getElementById('login_u').value = '';
  document.getElementById('login_p').value = '';
  document.getElementById('loginErr').style.display = 'none';
}

async function doCP() {
  const o=document.getElementById('pwo').value, n=document.getElementById('pwn').value, c=document.getElementById('pwc').value;
  if (!o||!n||!c) { toast('⚠️ Semua field wajib diisi','er'); return; }
  if (n!==c) { toast('❌ Password baru tidak cocok!','er'); return; }
  if (n.length<4) { toast('⚠️ Password minimal 4 karakter','er'); return; }
  showCrudSplash('🔑 Menyimpan password...');
  const r = await api({ action:'changePassword', username:curUser, oldPassword:o, newPassword:n }, 'POST');
  hideCrudSplash();
  if (r.success) {
    toast('✅ Password berhasil diubah!');
    closeMod('modPw');
    ['pwo','pwn','pwc'].forEach(id => document.getElementById(id).value='');
  } else toast('❌ ' + (r.message||'Gagal'), 'er');
}

async function doCP2() {
  const o=document.getElementById('pw2o').value, n=document.getElementById('pw2n').value, c=document.getElementById('pw2c').value;
  if (!o||!n||!c) { toast('⚠️ Semua field wajib diisi','er'); return; }
  if (n!==c) { toast('❌ Password baru tidak cocok!','er'); return; }
  if (n.length<4) { toast('⚠️ Password minimal 4 karakter','er'); return; }
  showCrudSplash('🔑 Menyimpan password...');
  const r = await api({ action:'changePassword', username:curUser, oldPassword:o, newPassword:n }, 'POST');
  hideCrudSplash();
  if (r.success) {
    toast('✅ Password berhasil diubah!');
    ['pw2o','pw2n','pw2c'].forEach(id => document.getElementById(id).value='');
  } else toast('❌ ' + (r.message||'Gagal'), 'er');
}

// ═══════════════ NAVIGATION ═══════════════════════════════════
let pgLoaded = {};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('on'));
  document.getElementById('page-'+name).classList.add('on');
  ['nav-'+name, 'd-nav-'+name].forEach(id => {
    const el = document.getElementById(id); if (el) el.classList.add('on');
  });
  closeDrawer();
  if (!pgLoaded[name]) {
    pgLoaded[name] = true;
    if (name==='wbp') loadWbp();
    if (name==='riw') loadVisits();
    if (name==='adm') loadAdmData();
  }
  setTimeout(() => {
    document.querySelectorAll('#page-'+name+' .lzy:not(.vs)').forEach(el => el.classList.add('vs'));
    applyGrid(); syncBadge();
  }, 40);
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('on');
  document.getElementById('drawerOv').classList.remove('on');
}
function openDrawer() {
  document.getElementById('drawer').classList.add('on');
  document.getElementById('drawerOv').classList.add('on');
}

function syncBadge() {
  const b1=document.getElementById('sheetBadge'), b2=document.getElementById('sheetBadgeD');
  if (b1&&b2) b2.textContent = b1.textContent;
}

// ═══════════════ STATS ════════════════════════════════════════
async function initDash() {
  await loadUserConfig(curUser);
  await loadSheets();
  await loadStats();
}

async function loadStats() {
  if (!activeSheet) { renderStats(null); return; }
  if (C.stats.ok)   { renderStats(C.stats.d); return; }
  try {
    const r = await api({ action:'getStats', sheet:activeSheet });
    C.stats.d = r; C.stats.ok = true; renderStats(r);
  } catch { renderStats(null); }
}

function renderStats(r) {
  document.getElementById('sTotal').textContent  = r?.totalVisits   ?? '—';
  document.getElementById('sToday').textContent  = r?.todayVisits   ?? '—';
  document.getElementById('sWbp').textContent    = r?.totalPatients ?? '—';
  document.getElementById('sSheet').textContent  = activeSheet || '—';
}

// ═══════════════ SEARCH ═══════════════════════════════════════
async function doSearch() {
  const q = document.getElementById('srchInp').value.trim();
  if (!q) { toast('⚠️ Masukkan kata pencarian','er'); return; }
  if (!activeSheet) { toast('⚠️ Pilih & aktifkan sheet di menu Kelola!','er'); return; }

  document.getElementById('wbpFound').style.display = 'none';
  document.getElementById('wbpNF').style.display    = 'none';
  document.getElementById('histList').innerHTML =
    '<div style="padding:.75rem;text-align:center;color:var(--li);font-size:.77rem">⏳ Mencari...</div>';

  try {
    const r = await api({ action:'search', q, sheet:activeSheet });
    if (r.patient) {
      selWbp = r.patient;
      fillWbpInfo(r.patient);
      document.getElementById('wbpFound').style.display = 'block';
      renderHistory(r.history || []);
    } else {
      selWbp = null; disableForm();
      document.getElementById('wbpNF').style.display = 'block';
      document.getElementById('histList').innerHTML =
        '<div class="emp"><div class="ei">❌</div><p style="font-size:.77rem">WBP tidak ditemukan</p></div>';
    }
  } catch { toast('❌ Gagal mencari data','er'); }
}

function fillWbpInfo(p) {
  const age  = ageFrom(p[4]);
  const umurS = age !== '' ? age+' tahun' : '—';
  const jkS   = p[5]==='L' ? 'Laki-laki' : p[5]==='P' ? 'Perempuan' : (p[5]||'—');

  document.getElementById('wbpFoundInfo').innerHTML =
    '<strong>'+esc(p[3]||'—')+'</strong>' +
    ' <span style="color:var(--mu)">·</span> '+jkS+' · '+umurS+
    ' · Reg: <strong>'+esc(p[0]||'—')+'</strong>'+
    (p[6] ? '<br><span style="color:#dc2626;font-size:.7rem">⚠️ Alergi: <b>'+esc(p[6])+'</b></span>' : '');

  const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val||'—'; };
  set('iReg', p[0]); set('iKTP', p[1]); set('iBPJS', p[2]); set('iNama', p[3]);
  set('iTgl',  p[4] ? fmtDate(p[4]) : '—');
  set('iUmur', umurS); set('iJK', jkS);
  set('iAlergi', p[6]||'Tidak ada'); set('iRiw', p[7]||'Tidak ada');

  document.getElementById('fReg').value           = p[0]||'';
  document.getElementById('fNama').value          = p[3]||'';
  document.getElementById('wbpIB').style.display  = 'block';
  document.getElementById('wbpIE').style.display  = 'none';
  document.getElementById('formMode').textContent = 'WBP Dipilih ✓';
  document.getElementById('formMode').className   = 'badge bt';
  document.getElementById('saveBtn').disabled     = false;
}

function disableForm() {
  document.getElementById('wbpIB').style.display  = 'none';
  document.getElementById('wbpIE').style.display  = 'block';
  document.getElementById('formMode').textContent = 'Pilih WBP dulu';
  document.getElementById('formMode').className   = 'badge ba';
  document.getElementById('saveBtn').disabled     = true;
  document.getElementById('fReg').value = '';
  document.getElementById('fNama').value = '';
}

function clearSrch() {
  selWbp = null;
  document.getElementById('srchInp').value          = '';
  document.getElementById('wbpFound').style.display = 'none';
  document.getElementById('wbpNF').style.display    = 'none';
  document.getElementById('histList').innerHTML =
    '<div class="emp"><div class="ei">🔍</div><p style="font-size:.77rem">Cari WBP untuk melihat riwayat</p></div>';
  disableForm(); clearVisitForm();
}

function clearVisitForm() {
  ['fKeluhan','fAlergiUpd','fRiwUpd','fDiagnosa','fTherapy','fKet','fTDs','fTDd','fSuhu','fBB']
    .forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('fTgl').value = today();
}

function renderHistory(hist) {
  const hl = document.getElementById('histList');
  if (!hist.length) {
    hl.innerHTML = '<div class="emp"><div class="ei">📋</div><p style="font-size:.77rem">Belum ada riwayat kunjungan</p></div>';
    return;
  }
  hl.innerHTML = hist.map(h => {
    const vitals = [
      h[4] ? '💓 '+showTD(h[4])   : '',
      h[5] ? '🌡 '+showSuhu(h[5]) : '',
      h[6] ? '⚖ '+showBB(h[6])   : ''
    ].filter(Boolean).join(' · ');
    return '<div class="hc">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.35rem;flex-wrap:wrap;gap:.25rem">' +
        '<span class="badge bt">'+fmtDate(h[0])+'</span>' +
        (vitals ? '<span style="font-size:.65rem;color:var(--mu);background:#f1f5f9;padding:.1rem .45rem;border-radius:99px">'+vitals+'</span>' : '') +
      '</div>' +
      (h[3] ? '<p style="font-size:.76rem;margin-bottom:.25rem"><strong style="color:var(--mu)">Keluhan:</strong> '+esc(h[3])+'</p>' : '') +
      (h[7] ? '<p style="font-size:.76rem;color:var(--t3);margin-bottom:.25rem"><strong>Diagnosa:</strong> '+esc(h[7])+'</p>' : '') +
      (h[8] ? '<div style="font-size:.75rem;margin-bottom:.2rem"><strong style="color:var(--mu)">Obat:</strong> '+renderDrugs(h[8])+'</div>' : '') +
      (h[9] ? '<p style="font-size:.7rem;color:var(--li)"><em>Ket: '+esc(h[9])+'</em></p>' : '') +
    '</div>';
  }).join('');
}

// ═══════════════ SAVE VISIT ═══════════════════════════════════
async function doSave() {
  if (!selWbp)      { toast('⚠️ Pilih WBP dulu!','er'); return; }
  if (!activeSheet) { toast('⚠️ Pilih & aktifkan sheet dulu di menu Kelola!','er'); return; }
  const tgl = document.getElementById('fTgl').value;
  if (!tgl) { toast('⚠️ Tanggal wajib diisi!','er'); return; }

  setBtn('saveBtn', true);
  showCrudSplash('💾 Menyimpan pemeriksaan...');

  const payload = {
    action: 'saveVisit', sheet: activeSheet, wbpReg: selWbp[0],
    alergiUpdate:  document.getElementById('fAlergiUpd').value.trim(),
    riwayatUpdate: document.getElementById('fRiwUpd').value.trim(),
    visit: {
      tanggal:    tgl,
      nama:       selWbp[3],
      keluhan:    document.getElementById('fKeluhan').value,
      td:         getTD('fTDs','fTDd'),
      suhu:       document.getElementById('fSuhu').value.trim(),
      bb:         document.getElementById('fBB').value.trim(),
      diagnosa:   document.getElementById('fDiagnosa').value,
      therapy:    document.getElementById('fTherapy').value,
      keterangan: document.getElementById('fKet').value,
    },
  };

  try {
    const r = await api(payload, 'POST');
    if (r.success) {
      clearVisitForm(); inv('visits'); inv('stats'); C.stats.ok = false;
      // Muat ulang stats & riwayat, tunggu selesai, baru tutup splash
      await loadStats();
      document.getElementById('srchInp').value = selWbp[0];
      await doSearch();
      hideCrudSplash();
      toast('✅ ' + (r.message || 'Pemeriksaan berhasil disimpan!'));
    } else {
      hideCrudSplash();
      toast('❌ ' + (r.message || 'Gagal menyimpan'), 'er');
    }
  } catch { hideCrudSplash(); }
  setBtn('saveBtn', false, '💾 SIMPAN PEMERIKSAAN');
}

// ═══════════════ WBP ══════════════════════════════════════════
async function loadWbp() {
  showCrudSplash('📋 Memuat data WBP...');
  document.getElementById('wbpBd').innerHTML = skelRows(10);
  try {
    const r = await api({ action:'getWbp' });
    C.wbp.d  = r.wbp||[]; C.wbp.ok = true;
    pg.wbp.rows = [...C.wbp.d]; pg.wbp.p = 1;
    renderWbp();
    hideCrudSplash();
    toast('✅ Data WBP dimuat — ' + C.wbp.d.length + ' WBP terdaftar');
  } catch {
    C.wbp.d = [];
    renderWbp();
    hideCrudSplash();
    toast('❌ Gagal memuat data WBP','er');
  }
}

function renderWbp() {
  const rows=pg.wbp.rows, total=rows.length;
  const pages=Math.ceil(total/PG)||1, p=Math.min(pg.wbp.p,pages);
  const slice=rows.slice((p-1)*PG, p*PG);

  document.getElementById('wbpInf').textContent = total ? total+' data · hal '+p+'/'+pages : '';
  document.getElementById('wbpBd').innerHTML = !slice.length
    ? '<tr><td colspan="11" style="padding:2rem;text-align:center;color:var(--li)">Belum ada data WBP</td></tr>'
    : slice.map((row, i) => {
        const ri  = C.wbp.d.indexOf(row);
        const age = ageFrom(row[4]);
        return '<tr>'+
          '<td data-label="#">'+((p-1)*PG+i+1)+'</td>'+
          '<td data-label="No.Reg"><span class="badge bt">'+esc(row[0]||'—')+'</span></td>'+
          '<td data-label="Nama" style="font-weight:600">'+esc(row[3]||'—')+'</td>'+
          '<td data-label="Tgl Lahir" style="white-space:nowrap;font-size:.72rem">'+fmtDate(row[4])+'</td>'+
          '<td data-label="Umur">'+(age!==''?age+' thn':'—')+'</td>'+
          '<td data-label="JK">'+(row[5]==='L'?'♂ L':'♀ P')+'</td>'+
          '<td data-label="No. KTP" class="el" style="font-size:.71rem;color:var(--mu)">'+esc(row[1]||'—')+'</td>'+
          '<td data-label="No. BPJS" class="el" style="font-size:.71rem;color:var(--mu)">'+esc(row[2]||'—')+'</td>'+
          '<td data-label="Alergi" class="el" style="color:#dc2626;font-size:.72rem">'+esc(row[6]||'—')+'</td>'+
          '<td data-label="Riwayat" class="el" style="font-size:.72rem">'+esc(row[7]||'—')+'</td>'+
          '<td data-label="Aksi"><div style="display:flex;gap:.25rem">'+
            '<button class="btn bs bsm" onclick="editWbpMod('+ri+')">✏️</button>'+
            '<button class="btn bd bsm" onclick="delWbp('+ri+')">🗑️</button>'+
          '</div></td>'+
        '</tr>';
      }).join('');
  renderPg('wbp', pages, p);
}

const wbpSF = debounce(() => {
  const q=document.getElementById('wbpSrch').value.toLowerCase();
  pg.wbp.rows = !q ? [...(C.wbp.d||[])] :
    (C.wbp.d||[]).filter(r=>
      (r[3]||'').toLowerCase().includes(q) || (r[0]||'').toLowerCase().includes(q) ||
      (r[1]||'').toLowerCase().includes(q) || (r[2]||'').toLowerCase().includes(q));
  pg.wbp.p=1; renderWbp();
});

function resetWbpForm() {
  document.getElementById('wbpFT').textContent = '👤 Tambah WBP Baru';
  document.getElementById('wbpEI').value = '';
  ['wReg','wKTP','wNama','wTgl','wUmur','wBPJS','wAlergi','wRiw'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('wJK').value = 'L';
}

async function saveWbp() {
  const nama = document.getElementById('wNama').value.trim();
  const tgl  = document.getElementById('wTgl').value;
  if (!nama||!tgl) { toast('⚠️ Nama Lengkap dan Tanggal Lahir wajib diisi!','er'); return; }

  const ei = document.getElementById('wbpEI').value;
  const payload = {
    action: ei!==''?'updateWbp':'addWbp', idx: ei,
    wbp: {
      reg:     document.getElementById('wReg').value.trim(),
      ktp:     document.getElementById('wKTP').value.trim(),
      bpjs:    document.getElementById('wBPJS').value.trim(),
      nama, tglLahir: tgl,
      jk:      document.getElementById('wJK').value,
      alergi:  document.getElementById('wAlergi').value.trim(),
      riwayat: document.getElementById('wRiw').value.trim(),
    },
  };
  setBtn('wbpSaveBtn', true);
  showCrudSplash(ei!==''?'✏️ Memperbarui data WBP...':'👤 Mendaftarkan WBP baru...');
  try {
    const r = await api(payload, 'POST');
    if (r.success) {
      resetWbpForm(); inv('wbp'); inv('stats');
      pgLoaded['wbp'] = false;
      await loadWbp();  // tunggu render selesai
      await loadStats();
      // hideCrudSplash sudah dipanggil dalam loadWbp
      toast('✅ ' + (r.message || (ei!==''?'Data WBP diperbarui!':'WBP berhasil didaftarkan!')));
    } else {
      hideCrudSplash();
      toast('❌ ' + (r.message||'Gagal'), 'er');
    }
  } catch { hideCrudSplash(); }
  setBtn('wbpSaveBtn', false, '💾 Simpan Data WBP');
}

function editWbpMod(i) {
  const p=C.wbp.d[i]; if(!p) return;
  document.getElementById('ewIdx').value    = i;
  document.getElementById('ewReg').value    = p[0]||'';
  document.getElementById('ewKTP').value    = p[1]||'';
  document.getElementById('ewBPJS').value   = p[2]||'';
  document.getElementById('ewNama').value   = p[3]||'';
  document.getElementById('ewTgl').value    = normalDate(p[4]);
  document.getElementById('ewJK').value     = p[5]||'L';
  document.getElementById('ewAlergi').value = p[6]||'';
  document.getElementById('ewRiw').value    = p[7]||'';
  autoAge('ewTgl','ewUmur');
  showMod('modEW');
}

async function updWbpMod() {
  const i   = document.getElementById('ewIdx').value;
  const tgl = document.getElementById('ewTgl').value;
  const payload = { action:'updateWbp', idx:i, wbp:{
    reg:     document.getElementById('ewReg').value.trim(),
    ktp:     document.getElementById('ewKTP').value.trim(),
    bpjs:    document.getElementById('ewBPJS').value.trim(),
    nama:    document.getElementById('ewNama').value.trim(),
    tglLahir:tgl, jk: document.getElementById('ewJK').value,
    alergi:  document.getElementById('ewAlergi').value.trim(),
    riwayat: document.getElementById('ewRiw').value.trim(),
  }};
  showCrudSplash('✏️ Memperbarui data WBP...');
  try {
    const r = await api(payload, 'POST');
    if (r.success) {
      closeMod('modEW'); inv('wbp'); pgLoaded['wbp'] = false;
      await loadWbp(); // splash hilang setelah data tampil
      toast('✅ ' + (r.message||'Data WBP diperbarui!'));
    } else { hideCrudSplash(); toast('❌ ' + (r.message||'Gagal'), 'er'); }
  } catch { hideCrudSplash(); }
}

async function delWbp(i) {
  const p = C.wbp.d[i];
  if (!confirm('Hapus WBP "'+(p[3]||'')+'" ('+(p[0]||'')+')?')) return;
  showCrudSplash('🗑️ Menghapus data WBP...');
  try {
    const r = await api({ action:'deleteWbp', idx:i }, 'POST');
    if (r.success) {
      inv('wbp'); inv('stats');
      await loadWbp();  // splash hilang setelah data tampil
      await loadStats();
      toast('✅ ' + (r.message||'WBP berhasil dihapus'));
    } else { hideCrudSplash(); toast('❌ ' + (r.message||'Gagal'), 'er'); }
  } catch { hideCrudSplash(); }
}

// ═══════════════ RIWAYAT ══════════════════════════════════════
async function loadVisits() {
  if (!activeSheet) { toast('⚠️ Pilih & aktifkan sheet dulu!','er'); return; }
  showCrudSplash('📋 Memuat riwayat kunjungan...');
  document.getElementById('riwBd').innerHTML = skelRows(9);
  try {
    const r = await api({ action:'getAllVisits', sheet:activeSheet });
    C.visits.d = r.visits||[]; C.visits.ok = true;
    pg.riw.rows = [...C.visits.d]; pg.riw.p = 1;
    renderRiw();
    hideCrudSplash();
    toast('✅ Riwayat dimuat — ' + C.visits.d.length + ' data kunjungan');
  } catch {
    C.visits.d = [];
    renderRiw();
    hideCrudSplash();
    toast('❌ Gagal memuat riwayat','er');
  }
}

function renderRiw() {
  const rows=pg.riw.rows, total=rows.length;
  const pages=Math.ceil(total/PG)||1, p=Math.min(pg.riw.p,pages);
  const allRev=[...rows].reverse();
  const slice=allRev.slice((p-1)*PG, p*PG);

  document.getElementById('riwInf').textContent = total ? total+' data · hal '+p+'/'+pages : '';
  document.getElementById('riwBd').innerHTML = !slice.length
    ? '<tr><td colspan="9" style="padding:2rem;text-align:center;color:var(--li)">Belum ada data kunjungan</td></tr>'
    : slice.map(h => {
        const ri  = C.visits.d.indexOf(h);
        const age = ageFrom(h[12]||'');
        return '<tr>'+
          '<td data-label="Tanggal" style="white-space:nowrap;font-size:.72rem">'+fmtDate(h[0])+'</td>'+
          '<td data-label="No.Reg"><span class="badge bt">'+esc(h[1]||'—')+'</span></td>'+
          '<td data-label="No. BPJS" style="font-size:.72rem;color:var(--mu)">'+esc(h[11]||'—')+'</td>'+
          '<td data-label="No. KTP" style="font-size:.72rem;color:var(--mu)">'+esc(h[10]||'—')+'</td>'+
          '<td data-label="Nama" style="font-weight:600">'+esc(h[2]||'—')+'</td>'+
          '<td data-label="Umur">'+(age!==''?age+' thn':'—')+'</td>'+
          '<td data-label="Diagnosa" class="el" style="color:var(--t3);font-weight:500">'+esc(h[7]||'—')+'</td>'+
          '<td data-label="Therapy" style="min-width:130px">'+renderDrugs(h[8])+'</td>'+
          '<td data-label="Aksi"><div style="display:flex;gap:.25rem">'+
            '<button class="btn bs bsm" onclick="viewVisit('+ri+')" title="Detail">👁</button>'+
            '<button class="btn bs bsm" onclick="editVisit('+ri+')" title="Edit">✏️</button>'+
            '<button class="btn bd bsm" onclick="delVisit('+ri+')" title="Hapus">🗑️</button>'+
          '</div></td>'+
        '</tr>';
      }).join('');
  renderPg('riw', pages, p);
}

const riwSF = debounce(() => {
  const q=document.getElementById('riwSrch').value.toLowerCase();
  pg.riw.rows = !q ? [...(C.visits.d||[])] :
    (C.visits.d||[]).filter(h=>
      (h[2]||'').toLowerCase().includes(q) || (h[1]||'').toLowerCase().includes(q) ||
      (h[7]||'').toLowerCase().includes(q) || (h[3]||'').toLowerCase().includes(q) ||
      (h[10]||'').toLowerCase().includes(q)|| (h[11]||'').toLowerCase().includes(q));
  pg.riw.p=1; renderRiw();
});

function viewVisit(i) {
  const h=C.visits.d[i]; if(!h) return;
  const age=ageFrom(h[12]||'');
  document.getElementById('dvBody').innerHTML =
    '<div style="display:flex;flex-direction:column;gap:0">'+
      row2('Tanggal',       fmtDate(h[0]))+
      row2('No. Register',  h[1]||'—')+
      row2('No. BPJS',      h[11]||'—')+
      row2('No. KTP',       h[10]||'—')+
      row2('Nama WBP',      h[2]||'—')+
      row2('Umur',          age!==''?age+' tahun':'—')+
      row2('Keluhan',       h[3]||'—')+
      row2('Tekanan Darah', showTD(h[4]))+
      row2('Suhu Tubuh',    showSuhu(h[5]))+
      row2('Berat Badan',   showBB(h[6]))+
      row2('Diagnosa',      h[7]||'—')+
      '<div class="ir"><span class="ik">Therapy / Obat</span><span class="iv">'+renderDrugs(h[8])+'</span></div>'+
      row2('Keterangan',    h[9]||'—')+
    '</div>';
  showMod('modDV');
}
function row2(k,v) { return '<div class="ir"><span class="ik">'+k+'</span><span class="iv">'+esc(v)+'</span></div>'; }

function editVisit(i) {
  const h=C.visits.d[i]; if(!h) return;
  document.getElementById('evIdx').value  = i;
  document.getElementById('evTgl').value  = normalDate(h[0]);
  document.getElementById('evReg').value  = h[1]||'';
  document.getElementById('evKel').value  = h[3]||'';
  setTD(h[4], 'evTDs', 'evTDd');
  setNum(h[5],'evSuhu',/[^\d.]/g);
  setNum(h[6],'evBB',  /[^\d.]/g);
  document.getElementById('evDiag').value = h[7]||'';
  document.getElementById('evTher').value = h[8]||'';
  document.getElementById('evKet').value  = h[9]||'';
  showMod('modEV');
}

async function updVisit() {
  if (!activeSheet) { toast('⚠️ Sheet tidak aktif','er'); return; }
  const i = document.getElementById('evIdx').value;
  const payload = { action:'updateVisit', sheet:activeSheet, idx:i, visit:{
    tanggal:    document.getElementById('evTgl').value,
    keluhan:    document.getElementById('evKel').value,
    td:         getTD('evTDs','evTDd'),
    suhu:       document.getElementById('evSuhu').value.trim(),
    bb:         document.getElementById('evBB').value.trim(),
    diagnosa:   document.getElementById('evDiag').value,
    therapy:    document.getElementById('evTher').value,
    keterangan: document.getElementById('evKet').value,
  }};
  showCrudSplash('✏️ Memperbarui kunjungan...');
  try {
    const r = await api(payload, 'POST');
    if (r.success) {
      closeMod('modEV'); inv('visits');
      await loadVisits(); // splash hilang setelah data tampil
      toast('✅ ' + (r.message||'Data kunjungan diperbarui!'));
    } else { hideCrudSplash(); toast('❌ ' + (r.message||'Gagal'), 'er'); }
  } catch { hideCrudSplash(); }
}

async function delVisit(i) {
  if (!confirm('Hapus data kunjungan ini? Tidak bisa dibatalkan!')) return;
  if (!activeSheet) { toast('⚠️ Sheet tidak aktif','er'); return; }
  showCrudSplash('🗑️ Menghapus kunjungan...');
  try {
    const r = await api({ action:'deleteVisit', sheet:activeSheet, idx:i }, 'POST');
    if (r.success) {
      inv('visits'); inv('stats');
      await loadVisits(); // splash hilang setelah data tampil
      await loadStats();
      toast('✅ ' + (r.message||'Data kunjungan dihapus'));
    } else { hideCrudSplash(); toast('❌ ' + (r.message||'Gagal'), 'er'); }
  } catch { hideCrudSplash(); }
}

// ═══════════════ PAGINATION ═══════════════════════════════════
function renderPg(key, pages, cur) {
  const el=document.getElementById(key==='wbp'?'wbpPgs':'riwPgs');
  if(pages<=1){el.innerHTML='';return;}
  let h='<button class="pgb" onclick="goPg(\''+key+'\','+(cur-1)+')" '+(cur===1?'disabled':'')+'>‹</button>';
  for(let i=1;i<=pages;i++){
    if(pages>7&&Math.abs(i-cur)>2&&i!==1&&i!==pages){
      if(i===2||i===pages-1) h+='<span style="padding:.26rem .2rem;color:var(--li)">…</span>';
      continue;
    }
    h+='<button class="pgb'+(i===cur?' on':'')+'" onclick="goPg(\''+key+'\','+i+')">'+i+'</button>';
  }
  h+='<button class="pgb" onclick="goPg(\''+key+'\','+(cur+1)+')" '+(cur===pages?'disabled':'')+'>›</button>';
  el.innerHTML=h;
}
function goPg(key,p){
  const src=key==='wbp'?pg.wbp:pg.riw;
  src.p=Math.max(1,Math.min(p,Math.ceil(src.rows.length/PG)||1));
  if(key==='wbp')renderWbp();else renderRiw();
}

// ═══════════════ ADMIN ════════════════════════════════════════
async function loadAdmData() {
  await loadSheets();
  document.getElementById('apiUrlInp').value = API_URL;
  const lbl = document.getElementById('urlUserLabel');
  if (lbl) lbl.textContent = curUser || '—';
}

async function loadSheets() {
  try {
    const r=await api({action:'getSheets'});
    allSheets=(r.sheets||[]).filter(s=>/^Data \d{4}$/.test(s)).sort();
    toast('✅ Daftar sheet dimuat — ' + allSheets.length + ' sheet tersedia');
  } catch { allSheets=[]; toast('❌ Gagal memuat daftar sheet','er'); }
  renderSheetList();
  updSheetBadge();
}

function renderSheetList() {
  const el=document.getElementById('sheetList');
  if(!allSheets.length){
    el.innerHTML='<div class="emp" style="padding:.65rem"><div class="ei" style="font-size:1.1rem">📂</div><p style="font-size:.72rem">Belum ada sheet Data YYYY.</p></div>';
    document.getElementById('btnAktifkan').disabled=true;
    document.getElementById('btnHapus').disabled=true;
    selSheet='';return;
  }
  el.innerHTML=allSheets.map(s=>{
    const isA=s===activeSheet, isS=s===selSheet;
    return '<div class="sheet-item'+(isA?' aktif':isS?' selected':'')+'" onclick="pilihSheet(\''+s+'\')" style="cursor:pointer">'+
      '<div style="display:flex;align-items:center;gap:.45rem">'+
        '<span>'+(isA?'✅':'📄')+'</span>'+
        '<div>'+
          '<div style="font-weight:700;font-size:.8rem;color:var(--txt)">'+s+'</div>'+
          (isA?'<div style="font-size:.62rem;color:#16a34a;font-weight:600">AKTIF</div>':'')+
        '</div>'+
      '</div>'+
      (isS&&!isA?'<span class="badge bl2" style="font-size:.63rem">Terpilih</span>':'')+
    '</div>';
  }).join('');
  document.getElementById('btnAktifkan').disabled=!selSheet||selSheet===activeSheet;
  document.getElementById('btnHapus').disabled=!selSheet||selSheet===activeSheet;
}

function pilihSheet(name){selSheet=name;renderSheetList();}

async function aktivasiSheet() {
  if(!selSheet){toast('⚠️ Pilih sheet dulu!','er');return;}
  showCrudSplash('✅ Mengaktifkan sheet "'+selSheet+'"...');
  activeSheet=selSheet;
  updSheetBadge();
  // Simpan ke server (per-user) DAN localStorage
  await saveUserConfig('active_sheet', activeSheet);
  inv('stats');inv('visits');C.stats.ok=false;C.visits.ok=false;
  pgLoaded['riw']=false;
  await loadStats();
  hideCrudSplash();
  toast('✅ Sheet "'+activeSheet+'" aktif & tersimpan untuk akun Anda');
  renderSheetList();
}

function updSheetBadge(){
  ['sheetBadge','sheetBadgeD'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.textContent=activeSheet||'—';
  });
}

async function addSheet(){
  const yr=document.getElementById('newYear').value.trim();
  if(!yr||!/^\d{4}$/.test(yr)){toast('⚠️ Masukkan tahun 4 digit (mis: 2027)','er');return;}
  const name='Data '+yr;
  if(allSheets.includes(name)){toast('⚠️ Sheet "'+name+'" sudah ada','er');return;}
  showCrudSplash('📂 Membuat sheet "'+name+'"...');
  try {
    const r=await api({action:'addSheet',name},'POST');
    if(r.success){
      document.getElementById('newYear').value=''; selSheet=name;
      await loadSheets();
      hideCrudSplash();
      toast('✅ ' + (r.message||'Sheet "'+name+'" berhasil dibuat'));
    } else { hideCrudSplash(); toast('❌ '+(r.message||'Gagal'),'er'); }
  } catch { hideCrudSplash(); }
}

async function delSheet(){
  if(!selSheet){toast('⚠️ Pilih sheet dulu!','er');return;}
  if(selSheet===activeSheet){toast('❌ Sheet "'+selSheet+'" sedang aktif — aktifkan sheet lain dulu','er');return;}
  if(!confirm('Hapus sheet "'+selSheet+'"?\nSemua data di dalamnya akan hilang permanen!'))return;
  showCrudSplash('🗑️ Menghapus sheet "'+selSheet+'"...');
  try {
    const r=await api({action:'deleteSheet',name:selSheet},'POST');
    if(r.success){
      const deleted=selSheet; selSheet='';
      await loadSheets();
      hideCrudSplash();
      toast('✅ ' + (r.message||'Sheet "'+deleted+'" dihapus'));
    } else { hideCrudSplash(); toast('❌ '+(r.message||'Gagal'),'er'); }
  } catch { hideCrudSplash(); }
}

async function saveApiUrl(){
  const url=document.getElementById('apiUrlInp').value.trim();
  if(!url){toast('⚠️ Masukkan URL!','er');return;}
  showCrudSplash('💾 Menyimpan URL API...');
  API_URL=url;
  // Simpan per-user ke server + localStorage
  await saveUserConfig('api_url', url);
  hideCrudSplash();
  toast('✅ URL API tersimpan untuk akun "'+curUser+'" — berlaku di semua device');
}

// ═══════════════ EKSPOR EXCEL ══════════════════════════════════
const HFILL={patternType:'solid',fgColor:{rgb:'0D9488'}};
const HFONT={bold:true,color:{rgb:'FFFFFF'},sz:11,name:'Arial'};
const DFONT={sz:10,name:'Arial'};
const BTHIN={top:{style:'thin',color:{rgb:'CCFBF1'}},bottom:{style:'thin',color:{rgb:'CCFBF1'}},left:{style:'thin',color:{rgb:'CCFBF1'}},right:{style:'thin',color:{rgb:'CCFBF1'}}};
const BHDR={top:{style:'medium',color:{rgb:'0F766E'}},bottom:{style:'medium',color:{rgb:'0F766E'}},left:{style:'medium',color:{rgb:'0F766E'}},right:{style:'medium',color:{rgb:'0F766E'}}};

function mkCell(v,isH,even){
  const cell={v:v==null?'':v,t:typeof v==='number'?'n':'s'};
  cell.s={font:isH?HFONT:DFONT,fill:isH?HFILL:even?{patternType:'solid',fgColor:{rgb:'F0FDF4'}}:{patternType:'solid',fgColor:{rgb:'FFFFFF'}},border:isH?BHDR:BTHIN,alignment:{vertical:'center',wrapText:true,horizontal:isH?'center':'left'}};
  return cell;
}
function buildWs(headers,dataRows){
  const ws={};
  headers.forEach((h,ci)=>{ws[XLSX.utils.encode_cell({r:0,c:ci})]=mkCell(h,true,false);});
  dataRows.forEach((row,ri)=>{row.forEach((val,ci)=>{ws[XLSX.utils.encode_cell({r:ri+1,c:ci})]=mkCell(val,false,ri%2===0);});});
  ws['!ref']=XLSX.utils.encode_range({s:{r:0,c:0},e:{r:dataRows.length,c:headers.length-1}});
  ws['!cols']=headers.map(()=>({wch:20}));
  ws['!freeze']={xSplit:0,ySplit:1,topLeftCell:'A2',activePane:'bottomLeft',state:'frozen'};
  return ws;
}
function dlXlsx(wb,filename){
  try{XLSX.writeFile(wb,filename);toast('✅ File Excel berhasil diunduh!');}
  catch(e){toast('❌ Gagal ekspor: '+e.message,'er');}
}

function expRiw(){
  const data=C.visits.d;
  if(!data||!data.length){toast('⚠️ Tidak ada data untuk diekspor','er');return;}
  const headers=['Tanggal','No. Register','No. BPJS','No. KTP','Nama WBP','Umur (thn)','Tekanan Darah','Suhu (°C)','BB (kg)','Diagnosa','Therapy / Obat','Keterangan'];
  const rows=[...data].reverse().map(h=>{
    const age=ageFrom(h[12]||'');
    return[h[0]?fmtDate(h[0]):'',String(h[1]||''),String(h[11]||''),String(h[10]||''),String(h[2]||''),age!==''?Number(age):'',String(h[4]||''),h[5]?Number(String(h[5]).replace(/[^\d.]/g,''))||String(h[5]):'',h[6]?Number(String(h[6]).replace(/[^\d.]/g,''))||String(h[6]):'',String(h[7]||''),String(h[8]||''),String(h[9]||'')];
  });
  const ws=buildWs(headers,rows);
  ws['!cols']=[{wch:14},{wch:13},{wch:16},{wch:18},{wch:22},{wch:8},{wch:14},{wch:10},{wch:9},{wch:28},{wch:40},{wch:20}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Riwayat Kunjungan');
  const wsI=buildWs(['Keterangan','Nilai'],[['Nama Klinik','Lak3sa Klinik — Lapas Kelas III Saparua'],['Sheet Data',activeSheet||'—'],['Tanggal Ekspor',fmtDate(today())],['Total Data',rows.length],['Diekspor oleh',curUser]]);
  wsI['!cols']=[{wch:18},{wch:40}];
  XLSX.utils.book_append_sheet(wb,wsI,'Info');
  dlXlsx(wb,'Riwayat_'+(activeSheet||'data')+'_'+today()+'.xlsx');
}

function expWbp(){
  const data=C.wbp.d;
  if(!data||!data.length){toast('⚠️ Tidak ada data untuk diekspor','er');return;}
  const headers=['No','No. Register','No. KTP','No. BPJS','Nama Lengkap','Tanggal Lahir','Umur (thn)','Jenis Kelamin','Alergi Obat','Riwayat Penyakit'];
  const rows=data.map((r,i)=>{
    const age=ageFrom(r[4]);
    return[i+1,String(r[0]||''),String(r[1]||''),String(r[2]||''),String(r[3]||''),r[4]?fmtDate(r[4]):'',age!==''?Number(age):'',r[5]==='L'?'Laki-laki':r[5]==='P'?'Perempuan':String(r[5]||''),String(r[6]||''),String(r[7]||'')];
  });
  const ws=buildWs(headers,rows);
  ws['!cols']=[{wch:5},{wch:13},{wch:18},{wch:16},{wch:22},{wch:14},{wch:9},{wch:13},{wch:22},{wch:25}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Data WBP');
  const wsI=buildWs(['Keterangan','Nilai'],[['Nama Klinik','Lak3sa Klinik — Lapas Kelas III Saparua'],['Tanggal Ekspor',fmtDate(today())],['Total WBP',rows.length],['Diekspor oleh',curUser]]);
  wsI['!cols']=[{wch:18},{wch:40}];
  XLSX.utils.book_append_sheet(wb,wsI,'Info');
  dlXlsx(wb,'Data_WBP_'+today()+'.xlsx');
}

// ═══════════════ RESPONSIVE ═══════════════════════════════════
function applyGrid(){
  const W=window.innerWidth;
  const g=document.getElementById('pemGrid');
  if(g)g.style.gridTemplateColumns=W>=900?'minmax(0,340px) 1fr':'1fr';
  const wg=document.getElementById('wbpTopGrid');
  if(wg)wg.style.gridTemplateColumns=W>=768?'1fr 1fr':'1fr';
  const ag=document.getElementById('admGrid');
  if(ag)ag.style.gridTemplateColumns=W>=768?'1fr 1fr':'1fr';
}
window.addEventListener('resize',applyGrid);
document.addEventListener('DOMContentLoaded',()=>setTimeout(applyGrid,50));
setTimeout(applyGrid,150);
