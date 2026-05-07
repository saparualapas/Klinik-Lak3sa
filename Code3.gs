// ════════════════════════════════════════════════════════════════
//  LAK3SA KLINIK — Code.gs  FINAL v4
//  Lapas Kelas III Saparua
//
//  ╔══════════════════════════════════════════════════════════════╗
//  ║  Sheet "config"  — 2 KOLOM (A–B)                            ║
//  ║   A: key          B: value                                   ║
//  ║   api_url         https://script.google.com/...             ║
//  ║   active_sheet    Data 2026                                  ║
//  ╠══════════════════════════════════════════════════════════════╣
//  ║  Sheet "users"  — 2 KOLOM (A–B)                             ║
//  ║   A: Username     B: Password                                ║
//  ╠══════════════════════════════════════════════════════════════╣
//  ║  Sheet "patients"  — 8 KOLOM (A–H)                          ║
//  ║   0 No.Register  1 No.KTP  2 No.BPJS  3 Nama                ║
//  ║   4 TglLahir  5 JK  6 Alergi  7 Riwayat                     ║
//  ╠══════════════════════════════════════════════════════════════╣
//  ║  Sheet "Data YYYY"  — 10 KOLOM (A–J)                        ║
//  ║   0 Tanggal  1 No.Reg  2 Nama  3 Keluhan  4 TD               ║
//  ║   5 Suhu  6 BB  7 Diagnosa  8 Therapy  9 Keterangan          ║
//  ╚══════════════════════════════════════════════════════════════╝
//
//  CARA SETUP:
//  1. Paste file ini ke Apps Script → Deploy → Web App → Anyone
//  2. Copy URL deploy → masukkan ke web app sekali saja
//  3. Login dengan username & password dari sheet "users"
// ════════════════════════════════════════════════════════════════

const SS = SpreadsheetApp.getActiveSpreadsheet();
const TZ = 'Asia/Jayapura'; // WIT UTC+9

// ── HEADER ARRAYS ─────────────────────────────────────────────
const HC = ['key', 'value'];
const HU = ['Username', 'Password'];
const HP = ['No. Register','No. KTP','No. BPJS','Nama Lengkap','Tanggal Lahir','Jenis Kelamin','Alergi Obat','Riwayat Penyakit'];
const HV = ['Tanggal','No. Reg WBP','Nama WBP','Keluhan','Tekanan Darah','Suhu Tubuh (°C)','Berat Badan (kg)','Diagnosa','Therapy / Obat','Keterangan'];

// ── HELPERS ───────────────────────────────────────────────────
function fmtDate(v) {
  if (!v) return '';
  try {
    const d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  } catch(e) { return String(v); }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function makeSheet(name, headers) {
  let s = SS.getSheetByName(name);
  if (!s) {
    s = SS.insertSheet(name);
    s.appendRow(headers);
    const hdr = s.getRange(1, 1, 1, headers.length);
    hdr.setFontWeight('bold').setBackground('#0d9488')
       .setFontColor('#ffffff').setFontSize(10)
       .setHorizontalAlignment('center').setVerticalAlignment('middle');
    s.setRowHeight(1, 36);
    s.setFrozenRows(1);
    headers.forEach((_, i) => s.setColumnWidth(i + 1, 150));
  }
  return s;
}

function getConfig(key) {
  const s = SS.getSheetByName('config');
  if (!s || s.getLastRow() < 2) return '';
  const rows = s.getDataRange().getValues();
  const r = rows.find(r => String(r[0]).trim() === key);
  return r ? String(r[1] || '').trim() : '';
}

function setConfig(key, value) {
  const s = makeSheet('config', HC);
  const rows = s.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === key) {
      s.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  s.appendRow([key, value]);
}

function readPatients() {
  const s = makeSheet('patients', HP);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, HP.length).getValues().map(r => {
    const row = [...r];
    row[4] = fmtDate(row[4]);
    return row;
  });
}

function buildPatientMap() {
  const map = {};
  readPatients().forEach(r => { map[String(r[0]).trim()] = r; });
  return map;
}

function readVisits(sheetName) {
  const s = SS.getSheetByName(sheetName);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, HV.length).getValues().map(r => {
    const row = [...r];
    row[0] = fmtDate(row[0]);
    return row;
  });
}

// ── INIT ──────────────────────────────────────────────────────
// Hanya membuat sheet struktur + sheet Data tahun ini.
// TIDAK membuat user otomatis — user diisi manual di sheet "users".
// TIDAK menampilkan alert jika dijalankan dari web (doGet/doPost).
function initSheets() {
  makeSheet('config', HC);
  makeSheet('users', HU);
  makeSheet('patients', HP);
  const yr = String(new Date().getFullYear());
  const sheetName = 'Data ' + yr;
  makeSheet(sheetName, HV);
  // Set active_sheet otomatis ke tahun sekarang jika belum ada
  if (!getConfig('active_sheet')) setConfig('active_sheet', sheetName);
  try {
    SpreadsheetApp.getUi().alert(
      '✅ Inisialisasi selesai!\n\n' +
      'Sheet: config · users · patients · ' + sheetName + '\n\n' +
      '⚠️ Tambahkan user di sheet "users" secara manual:\n' +
      '   Kolom A: username\n' +
      '   Kolom B: password\n\n' +
      'Sheet aktif sudah diset ke "' + sheetName + '"'
    );
  } catch(e) {} // Bisa dijalankan tanpa UI
}

function resetAndInit() {
  try {
    const ui = SpreadsheetApp.getUi();
    const ans = ui.alert('⚠️ Reset Struktur', 'Hapus & buat ulang sheet patients dan Data YYYY?\nData lama HILANG.', ui.ButtonSet.YES_NO);
    if (ans !== ui.Button.YES) return;
  } catch(e) {}
  const ps = SS.getSheetByName('patients');
  if (ps) SS.deleteSheet(ps);
  SS.getSheets().filter(s => /^Data \d{4}$/.test(s.getName())).forEach(s => SS.deleteSheet(s));
  initSheets();
}

// ── ROUTING ───────────────────────────────────────────────────
function doGet(e) {
  try {
    const a = e.parameter.action;
    if (a === 'getConfig')   return handleGetConfig();
    if (a === 'getWbp')      return out({ wbp: readPatients() });
    if (a === 'getSheets')   return out({ sheets: SS.getSheets().map(s => s.getName()) });
    if (a === 'getStats')    return handleGetStats(e.parameter.sheet);
    if (a === 'search')      return handleSearch(e.parameter.q, e.parameter.sheet);
    if (a === 'getAllVisits') return handleGetAllVisits(e.parameter.sheet);
    return out({ success: false, message: 'Unknown GET: ' + a });
  } catch(err) { return out({ success: false, message: err.toString() }); }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const a = d.action;
    if (a === 'login')          return handleLogin(d);
    if (a === 'changePassword') return handleChangePw(d);
    if (a === 'setupUrl')       return handleSetupUrl(d);
    if (a === 'saveConfig')     return handleSaveConfig(d);
    if (a === 'addWbp')         return handleAddWbp(d);
    if (a === 'updateWbp')      return handleUpdateWbp(d);
    if (a === 'deleteWbp')      return handleDeleteWbp(d);
    if (a === 'saveVisit')      return handleSaveVisit(d);
    if (a === 'updateVisit')    return handleUpdateVisit(d);
    if (a === 'deleteVisit')    return handleDeleteVisit(d);
    if (a === 'addSheet')       return handleAddSheet(d);
    if (a === 'deleteSheet')    return handleDeleteSheet(d);
    return out({ success: false, message: 'Unknown POST: ' + a });
  } catch(err) { return out({ success: false, message: err.toString() }); }
}

// ── CONFIG ────────────────────────────────────────────────────
function handleGetConfig() {
  // Auto-init sheets jika belum ada (akses pertama dari device baru)
  makeSheet('config', HC);
  makeSheet('users', HU);
  makeSheet('patients', HP);
  // Auto-set active_sheet ke tahun sekarang jika belum ada
  let activeSheet = getConfig('active_sheet');
  if (!activeSheet) {
    const yr = String(new Date().getFullYear());
    const sheetName = 'Data ' + yr;
    makeSheet(sheetName, HV);
    setConfig('active_sheet', sheetName);
    activeSheet = sheetName;
  }
  return out({
    activeSheet: activeSheet,
    apiUrl:      getConfig('api_url')
  });
}

function handleSaveConfig(d) {
  if (d.active_sheet !== undefined) setConfig('active_sheet', d.active_sheet);
  if (d.api_url      !== undefined) setConfig('api_url',      d.api_url);
  return out({ success: true });
}

// Dipanggil saat pertama kali setup dari device baru
// Menyimpan URL ke config agar device lain bisa ambil otomatis
function handleSetupUrl(d) {
  if (!d.url) return out({ success: false, message: 'URL kosong' });
  setConfig('api_url', d.url);
  // Auto-init & set active_sheet
  makeSheet('patients', HP);
  let activeSheet = getConfig('active_sheet');
  if (!activeSheet) {
    const yr = String(new Date().getFullYear());
    const sheetName = 'Data ' + yr;
    makeSheet(sheetName, HV);
    setConfig('active_sheet', sheetName);
    activeSheet = sheetName;
  }
  return out({
    success:     true,
    activeSheet: activeSheet,
    apiUrl:      d.url
  });
}

// ── AUTH ──────────────────────────────────────────────────────
function handleLogin(d) {
  const s = SS.getSheetByName('users');
  if (!s || s.getLastRow() < 2)
    return out({ success: false, message: 'Belum ada user. Tambahkan di sheet "users" (A=username, B=password).' });
  const ok = s.getDataRange().getValues().slice(1).find(r =>
    String(r[0]).trim() === String(d.username).trim() &&
    String(r[1]).trim() === String(d.password).trim()
  );
  return out({ success: !!ok });
}

function handleChangePw(d) {
  const s = SS.getSheetByName('users');
  if (!s) return out({ success: false, message: 'Sheet users tidak ada' });
  const rows = s.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(d.username).trim()) {
      if (String(rows[i][1]).trim() !== String(d.oldPassword).trim())
        return out({ success: false, message: 'Password lama salah!' });
      s.getRange(i + 1, 2).setValue(d.newPassword);
      return out({ success: true });
    }
  }
  return out({ success: false, message: 'User tidak ditemukan' });
}

// ── WBP CRUD ──────────────────────────────────────────────────
function handleAddWbp(d) {
  const s   = makeSheet('patients', HP);
  const w   = d.wbp;
  const all = readPatients();

  // No.Register: cek unik hanya jika diisi
  if (w.reg && w.reg.trim()) {
    if (all.find(r => String(r[0]).trim() === String(w.reg).trim()))
      return out({ success: false, message: 'No. Register "' + w.reg + '" sudah terdaftar!' });
  }

  // No.KTP: cek unik hanya jika diisi
  if (w.ktp && w.ktp.trim()) {
    if (all.find(r => r[1] && String(r[1]).trim() === String(w.ktp).trim()))
      return out({ success: false, message: 'No. KTP "' + w.ktp + '" sudah terdaftar!' });
  }

  // No.BPJS: cek unik hanya jika diisi
  if (w.bpjs && w.bpjs.trim()) {
    if (all.find(r => r[2] && String(r[2]).trim() === String(w.bpjs).trim()))
      return out({ success: false, message: 'No. BPJS "' + w.bpjs + '" sudah terdaftar!' });
  }

  s.appendRow([
    w.reg    || '',
    w.ktp    || '',
    w.bpjs   || '',
    w.nama,
    w.tglLahir,
    w.jk,
    w.alergi  || '',
    w.riwayat || ''
  ]);
  return out({ success: true });
}

function handleUpdateWbp(d) {
  const s = makeSheet('patients', HP);
  const w = d.wbp;
  const rowNum = parseInt(d.idx) + 2;
  if (rowNum < 2) return out({ success: false, message: 'Index tidak valid' });

  const all    = readPatients();
  const others = all.filter((_, i) => i !== parseInt(d.idx));

  // Cek unik hanya jika diisi
  if (w.reg && w.reg.trim()) {
    if (others.find(r => String(r[0]).trim() === String(w.reg).trim()))
      return out({ success: false, message: 'No. Register "' + w.reg + '" sudah dipakai WBP lain!' });
  }
  if (w.ktp && w.ktp.trim()) {
    if (others.find(r => r[1] && String(r[1]).trim() === String(w.ktp).trim()))
      return out({ success: false, message: 'No. KTP "' + w.ktp + '" sudah dipakai WBP lain!' });
  }
  if (w.bpjs && w.bpjs.trim()) {
    if (others.find(r => r[2] && String(r[2]).trim() === String(w.bpjs).trim()))
      return out({ success: false, message: 'No. BPJS "' + w.bpjs + '" sudah dipakai WBP lain!' });
  }

  s.getRange(rowNum, 1, 1, HP.length).setValues([[
    w.reg    || '',
    w.ktp    || '',
    w.bpjs   || '',
    w.nama,
    w.tglLahir,
    w.jk,
    w.alergi  || '',
    w.riwayat || ''
  ]]);
  return out({ success: true });
}

function handleDeleteWbp(d) {
  const s = makeSheet('patients', HP);
  const rowNum = parseInt(d.idx) + 2;
  if (rowNum < 2) return out({ success: false, message: 'Index tidak valid' });
  s.deleteRow(rowNum);
  return out({ success: true });
}

// ── SEARCH ────────────────────────────────────────────────────
function handleSearch(q, sheetName) {
  if (!q) return out({ patient: null, history: [] });
  const ql = q.toLowerCase();
  const pts = readPatients().filter(r =>
    String(r[0]).toLowerCase().includes(ql) ||
    String(r[1]).toLowerCase().includes(ql) ||
    String(r[2]).toLowerCase().includes(ql) ||
    String(r[3]).toLowerCase().includes(ql)
  );
  const patient = pts[0] || null;
  let history = [];
  if (patient && sheetName) {
    history = readVisits(sheetName)
      .filter(v => String(v[1]).trim() === String(patient[0]).trim())
      .reverse();
  }
  return out({ patient, history });
}

// ── SAVE VISIT ────────────────────────────────────────────────
function handleSaveVisit(d) {
  if (!d.sheet) return out({ success: false, message: 'Sheet tidak dipilih' });
  const vs = makeSheet(d.sheet, HV);
  const v  = d.visit;

  if ((d.alergiUpdate || '').trim() || (d.riwayatUpdate || '').trim()) {
    const ps = makeSheet('patients', HP);
    if (ps.getLastRow() > 1) {
      const col = ps.getRange(2, 1, ps.getLastRow() - 1, 1).getValues();
      for (let i = 0; i < col.length; i++) {
        if (String(col[i][0]).trim() === String(d.wbpReg).trim()) {
          if ((d.alergiUpdate || '').trim())  ps.getRange(i + 2, 7).setValue(d.alergiUpdate);
          if ((d.riwayatUpdate || '').trim()) ps.getRange(i + 2, 8).setValue(d.riwayatUpdate);
          break;
        }
      }
    }
  }

  vs.appendRow([v.tanggal, d.wbpReg, v.nama, v.keluhan, v.td, v.suhu, v.bb, v.diagnosa, v.therapy, v.keterangan]);
  return out({ success: true });
}

// ── UPDATE VISIT ──────────────────────────────────────────────
function handleUpdateVisit(d) {
  if (!d.sheet) return out({ success: false, message: 'Sheet tidak dipilih' });
  const vs = SS.getSheetByName(d.sheet);
  if (!vs)      return out({ success: false, message: 'Sheet tidak ditemukan' });
  const rowNum = parseInt(d.idx) + 2;
  if (rowNum < 2) return out({ success: false, message: 'Index tidak valid' });
  const v   = d.visit;
  const cur = vs.getRange(rowNum, 1, 1, HV.length).getValues()[0];
  vs.getRange(rowNum, 1, 1, HV.length).setValues([[
    v.tanggal, cur[1], cur[2],
    v.keluhan, v.td, v.suhu, v.bb, v.diagnosa, v.therapy, v.keterangan
  ]]);
  return out({ success: true });
}

// ── DELETE VISIT ──────────────────────────────────────────────
function handleDeleteVisit(d) {
  if (!d.sheet) return out({ success: false, message: 'Sheet tidak dipilih' });
  const vs = SS.getSheetByName(d.sheet);
  if (!vs)      return out({ success: false, message: 'Sheet tidak ditemukan' });
  const rowNum = parseInt(d.idx) + 2;
  if (rowNum < 2) return out({ success: false, message: 'Index tidak valid' });
  vs.deleteRow(rowNum);
  return out({ success: true });
}

// ── GET ALL VISITS (JOIN ke patients) ─────────────────────────
function handleGetAllVisits(sheetName) {
  if (!sheetName) return out({ visits: [] });
  const visits = readVisits(sheetName);
  if (!visits.length) return out({ visits: [] });
  const pMap = buildPatientMap();
  const joined = visits.map(v => {
    const p = pMap[String(v[1]).trim()] || null;
    return [
      ...v,
      p ? String(p[1] || '') : '',  // [10] No. KTP
      p ? String(p[2] || '') : '',  // [11] No. BPJS
      p ? String(p[4] || '') : '',  // [12] Tanggal Lahir
      p ? String(p[5] || '') : '',  // [13] Jenis Kelamin
      p ? String(p[6] || '') : '',  // [14] Alergi Obat
      p ? String(p[7] || '') : '',  // [15] Riwayat Penyakit
    ];
  });
  return out({ visits: joined });
}

// ── STATS ─────────────────────────────────────────────────────
function handleGetStats(sheetName) {
  const ps = makeSheet('patients', HP);
  const totalPatients = Math.max(0, ps.getLastRow() - 1);
  let totalVisits = 0, todayVisits = 0;
  if (sheetName) {
    const vs = SS.getSheetByName(sheetName);
    if (vs && vs.getLastRow() > 1) {
      const col = vs.getRange(2, 1, vs.getLastRow() - 1, 1).getValues();
      totalVisits = col.length;
      const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
      todayVisits = col.filter(r => fmtDate(r[0]) === today).length;
    }
  }
  return out({ totalVisits, todayVisits, totalPatients });
}

// ── SHEETS ────────────────────────────────────────────────────
function handleAddSheet(d) {
  if (!d.name) return out({ success: false, message: 'Nama sheet kosong' });
  if (!/^Data \d{4}$/.test(d.name))
    return out({ success: false, message: 'Format harus "Data YYYY"' });
  if (SS.getSheetByName(d.name))
    return out({ success: false, message: 'Sheet "' + d.name + '" sudah ada' });
  makeSheet(d.name, HV);
  return out({ success: true });
}

function handleDeleteSheet(d) {
  if (!d.name || d.name === 'users' || d.name === 'patients' || d.name === 'config')
    return out({ success: false, message: 'Sheet sistem tidak bisa dihapus' });
  if (!/^Data \d{4}$/.test(d.name))
    return out({ success: false, message: 'Hanya sheet "Data YYYY" yang bisa dihapus' });
  // Cek jika ini sheet aktif
  if (d.name === getConfig('active_sheet'))
    return out({ success: false, message: 'Sheet "' + d.name + '" sedang aktif. Aktifkan sheet lain dulu sebelum menghapus.' });
  const s = SS.getSheetByName(d.name);
  if (!s) return out({ success: false, message: 'Sheet tidak ditemukan' });
  SS.deleteSheet(s);
  return out({ success: true });
}
