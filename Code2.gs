// ════════════════════════════════════════════════════════════════
//  LAK3SA KLINIK — Code.gs  FINAL v3
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
//  ║  Idx  Kol  Header                                            ║
//  ║   0    A   No. Register      ← UNIK                         ║
//  ║   1    B   No. KTP           ← UNIK                         ║
//  ║   2    C   No. BPJS          ← UNIK (boleh kosong)          ║
//  ║   3    D   Nama Lengkap                                      ║
//  ║   4    E   Tanggal Lahir     (yyyy-MM-dd)                    ║
//  ║   5    F   Jenis Kelamin     (L / P)                         ║
//  ║   6    G   Alergi Obat                                       ║
//  ║   7    H   Riwayat Penyakit                                  ║
//  ╠══════════════════════════════════════════════════════════════╣
//  ║  Sheet "Data YYYY"  — 10 KOLOM (A–J)                        ║
//  ║  Idx  Kol  Header                                            ║
//  ║   0    A   Tanggal           (yyyy-MM-dd)                    ║
//  ║   1    B   No. Reg WBP       FK → patients[0]               ║
//  ║   2    C   Nama WBP          dari patients[3]               ║
//  ║   3    D   Keluhan                                           ║
//  ║   4    E   Tekanan Darah     angka "120/80"                  ║
//  ║   5    F   Suhu Tubuh (°C)   angka "36.5"                   ║
//  ║   6    G   Berat Badan (kg)  angka "60"                      ║
//  ║   7    H   Diagnosa                                          ║
//  ║   8    I   Therapy / Obat    pisah koma                      ║
//  ║   9    J   Keterangan                                        ║
//  ╚══════════════════════════════════════════════════════════════╝
//
//  CARA SETUP:
//  1. Paste file ini ke Apps Script
//  2. Jalankan fungsi initSheets()
//  3. Deploy → New Deployment → Web App → Anyone → copy URL
//  4. Di web: menu Kelola → isi URL → Simpan
//  5. Pilih sheet → klik Aktifkan
// ════════════════════════════════════════════════════════════════

const SS = SpreadsheetApp.getActiveSpreadsheet();

// ── HEADER ARRAYS ─────────────────────────────────────────────
const HC = ['key', 'value'];                    // config
const HU = ['Username', 'Password'];            // users
const HP = [                                    // patients — 8 col
  'No. Register',    // 0 A
  'No. KTP',         // 1 B
  'No. BPJS',        // 2 C
  'Nama Lengkap',    // 3 D
  'Tanggal Lahir',   // 4 E
  'Jenis Kelamin',   // 5 F
  'Alergi Obat',     // 6 G
  'Riwayat Penyakit' // 7 H
];
const HV = [                                    // visits — 10 col
  'Tanggal',           //  0 A
  'No. Reg WBP',       //  1 B
  'Nama WBP',          //  2 C
  'Keluhan',           //  3 D
  'Tekanan Darah',     //  4 E
  'Suhu Tubuh (°C)',   //  5 F
  'Berat Badan (kg)',  //  6 G
  'Diagnosa',          //  7 H
  'Therapy / Obat',    //  8 I
  'Keterangan'         //  9 J
];

// ── HELPERS ───────────────────────────────────────────────────
function fmtDate(v) {
  if (!v) return '';
  try {
    const d = (v instanceof Date) ? v : new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
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

// Baca config
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

// Baca patients — kembalikan array of arrays
function readPatients() {
  const s = makeSheet('patients', HP);
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, HP.length).getValues().map(r => {
    const row = [...r];
    row[4] = fmtDate(row[4]); // Tanggal Lahir
    return row;
  });
}

// Map No.Reg → patient row untuk JOIN
function buildPatientMap() {
  const map = {};
  readPatients().forEach(r => { map[String(r[0]).trim()] = r; });
  return map;
}

// Baca kunjungan dari sheet tertentu
function readVisits(sheetName) {
  const s = SS.getSheetByName(sheetName);
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, HV.length).getValues().map(r => {
    const row = [...r];
    row[0] = fmtDate(row[0]); // Tanggal kunjungan
    return row;
  });
}

// ── INIT ──────────────────────────────────────────────────────
function initSheets() {
  makeSheet('config', HC);
  makeSheet('users', HU);
  makeSheet('patients', HP);
  const su = SS.getSheetByName('users');
  if (su.getLastRow() < 2) su.appendRow(['admin', 'admin123']);
  const yr = String(new Date().getFullYear());
  makeSheet('Data ' + yr, HV);
  SpreadsheetApp.getUi().alert(
    '✅ Inisialisasi selesai!\n\n' +
    'Sheet: config · users · patients · Data ' + yr + '\n\n' +
    'Login: admin / admin123\n' +
    'Ganti password setelah login pertama!'
  );
}

function resetAndInit() {
  const ui = SpreadsheetApp.getUi();
  const ans = ui.alert('⚠️ Reset Struktur', 'Hapus & buat ulang sheet patients dan Data YYYY?\nData lama HILANG.', ui.ButtonSet.YES_NO);
  if (ans !== ui.Button.YES) return;
  const ps = SS.getSheetByName('patients');
  if (ps) SS.deleteSheet(ps);
  SS.getSheets().filter(s => /^Data \d{4}$/.test(s.getName())).forEach(s => SS.deleteSheet(s));
  initSheets();
  ui.alert('✅ Selesai! Input ulang data WBP dan kunjungan.');
}

// ── ROUTING ───────────────────────────────────────────────────
function doGet(e) {
  try {
    const a = e.parameter.action;
    if (a === 'getConfig')    return handleGetConfig();
    if (a === 'getWbp')       return out({ wbp: readPatients() });
    if (a === 'getSheets')    return out({ sheets: SS.getSheets().map(s => s.getName()) });
    if (a === 'getStats')     return handleGetStats(e.parameter.sheet);
    if (a === 'search')       return handleSearch(e.parameter.q, e.parameter.sheet);
    if (a === 'getAllVisits')  return handleGetAllVisits(e.parameter.sheet);
    if (a === 'getUsers')     return handleGetUsers();
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
    if (a === 'addUser')        return handleAddUser(d);
    if (a === 'deleteUser')     return handleDeleteUser(d);
    return out({ success: false, message: 'Unknown POST: ' + a });
  } catch(err) { return out({ success: false, message: err.toString() }); }
}

// ── CONFIG ────────────────────────────────────────────────────
function handleGetConfig() {
  return out({
    activeSheet: getConfig('active_sheet'),
    apiUrl:      getConfig('api_url')
  });
}

function handleSaveConfig(d) {
  if (d.active_sheet !== undefined) setConfig('active_sheet', d.active_sheet);
  if (d.api_url      !== undefined) setConfig('api_url',      d.api_url);
  return out({ success: true });
}

// Dipanggil saat PERTAMA KALI setup — simpan URL ke config
function handleSetupUrl(d) {
  if (!d.url) return out({ success: false, message: 'URL kosong' });
  setConfig('api_url', d.url);
  // Sekalian set active_sheet ke tahun sekarang jika belum ada
  const cur = getConfig('active_sheet');
  if (!cur) {
    const yr = String(new Date().getFullYear());
    const sheetName = 'Data ' + yr;
    // Buat sheet jika belum ada
    makeSheet(sheetName, HV);
    setConfig('active_sheet', sheetName);
  }
  return out({
    success: true,
    activeSheet: getConfig('active_sheet'),
    apiUrl: getConfig('api_url')
  });
}

// ── AUTH ──────────────────────────────────────────────────────
function handleLogin(d) {
  const s = SS.getSheetByName('users');
  if (!s) return out({ success: false, message: 'Jalankan initSheets() dulu!' });
  const ok = s.getDataRange().getValues().slice(1).find(r =>
    String(r[0]).trim() === String(d.username).trim() &&
    String(r[1]).trim() === String(d.password).trim()
  );
  return out({ success: !!ok });
}

function handleChangePw(d) {
  const s = SS.getSheetByName('users');
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

  // Cek uniqueness No. Register
  if (all.find(r => String(r[0]).trim() === String(w.reg).trim()))
    return out({ success: false, message: 'No. Register "' + w.reg + '" sudah terdaftar!' });

  // Cek uniqueness No. KTP
  if (all.find(r => String(r[1]).trim() === String(w.ktp).trim()))
    return out({ success: false, message: 'No. KTP "' + w.ktp + '" sudah terdaftar!' });

  // Cek uniqueness No. BPJS (hanya jika diisi)
  if (w.bpjs && w.bpjs.trim()) {
    if (all.find(r => r[2] && String(r[2]).trim() === String(w.bpjs).trim()))
      return out({ success: false, message: 'No. BPJS "' + w.bpjs + '" sudah terdaftar!' });
  }

  // Append — sesuai HP[0..7]
  s.appendRow([
    w.reg,       // 0 A No. Register
    w.ktp,       // 1 B No. KTP
    w.bpjs || '',// 2 C No. BPJS
    w.nama,      // 3 D Nama Lengkap
    w.tglLahir,  // 4 E Tanggal Lahir
    w.jk,        // 5 F Jenis Kelamin
    w.alergi || '',  // 6 G Alergi Obat
    w.riwayat || ''  // 7 H Riwayat Penyakit
  ]);
  return out({ success: true });
}

function handleUpdateWbp(d) {
  const s = makeSheet('patients', HP);
  const w = d.wbp;
  const rowNum = parseInt(d.idx) + 2; // +2: skip header, 0-based idx
  if (rowNum < 2) return out({ success: false, message: 'Index tidak valid' });

  const all = readPatients();

  // Cek uniqueness — kecuali baris sendiri (idx)
  const others = all.filter((_, i) => i !== parseInt(d.idx));

  if (others.find(r => String(r[0]).trim() === String(w.reg).trim()))
    return out({ success: false, message: 'No. Register "' + w.reg + '" sudah dipakai WBP lain!' });

  if (others.find(r => String(r[1]).trim() === String(w.ktp).trim()))
    return out({ success: false, message: 'No. KTP "' + w.ktp + '" sudah dipakai WBP lain!' });

  if (w.bpjs && w.bpjs.trim()) {
    if (others.find(r => r[2] && String(r[2]).trim() === String(w.bpjs).trim()))
      return out({ success: false, message: 'No. BPJS "' + w.bpjs + '" sudah dipakai WBP lain!' });
  }

  s.getRange(rowNum, 1, 1, HP.length).setValues([[
    w.reg, w.ktp, w.bpjs || '',
    w.nama, w.tglLahir, w.jk,
    w.alergi || '', w.riwayat || ''
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
    String(r[0]).toLowerCase().includes(ql) ||  // No. Register
    String(r[1]).toLowerCase().includes(ql) ||  // No. KTP
    String(r[2]).toLowerCase().includes(ql) ||  // No. BPJS
    String(r[3]).toLowerCase().includes(ql)     // Nama
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

  // Update alergi/riwayat di patients jika ada perubahan
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

  // Append — sesuai HV[0..9]
  vs.appendRow([
    v.tanggal,   //  0 A Tanggal
    d.wbpReg,    //  1 B No. Reg WBP
    v.nama,      //  2 C Nama WBP
    v.keluhan,   //  3 D Keluhan
    v.td,        //  4 E Tekanan Darah
    v.suhu,      //  5 F Suhu Tubuh
    v.bb,        //  6 G Berat Badan
    v.diagnosa,  //  7 H Diagnosa
    v.therapy,   //  8 I Therapy / Obat
    v.keterangan //  9 J Keterangan
  ]);
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
    v.tanggal,   //  0 A boleh diubah
    cur[1],      //  1 B No. Reg WBP — tetap
    cur[2],      //  2 C Nama WBP    — tetap
    v.keluhan,   //  3 D
    v.td,        //  4 E
    v.suhu,      //  5 F
    v.bb,        //  6 G
    v.diagnosa,  //  7 H
    v.therapy,   //  8 I
    v.keterangan //  9 J
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
  // Setiap row visit ditambahkan data JOIN dari patients:
  // v[10]=KTP  v[11]=BPJS  v[12]=TglLahir  v[13]=JK  v[14]=Alergi  v[15]=Riwayat
  const joined = visits.map(v => {
    const p = pMap[String(v[1]).trim()] || null;
    return [
      ...v,
      p ? String(p[1] || '') : '',  // [10] No. KTP
      p ? String(p[2] || '') : '',  // [11] No. BPJS
      p ? String(p[4] || '') : '',  // [12] Tanggal Lahir → hitung umur di FE
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
      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
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
  const s = SS.getSheetByName(d.name);
  if (!s) return out({ success: false, message: 'Sheet tidak ditemukan' });
  SS.deleteSheet(s);
  return out({ success: true });
}

// ── USERS ─────────────────────────────────────────────────────
function handleGetUsers() {
  const s = SS.getSheetByName('users');
  if (!s || s.getLastRow() < 2) return out({ users: [] });
  return out({ users: s.getRange(2, 1, s.getLastRow() - 1, 1).getValues().map(r => String(r[0])) });
}

function handleAddUser(d) {
  const s = SS.getSheetByName('users');
  if (!s) return out({ success: false, message: 'Sheet users tidak ada' });
  const rows = s.getLastRow() > 1 ? s.getRange(2, 1, s.getLastRow() - 1, 1).getValues() : [];
  if (rows.find(r => String(r[0]).trim() === String(d.username).trim()))
    return out({ success: false, message: 'Username sudah ada' });
  s.appendRow([d.username, d.password]);
  return out({ success: true });
}

function handleDeleteUser(d) {
  const s = SS.getSheetByName('users');
  if (!s) return out({ success: false, message: 'Sheet users tidak ada' });
  const rows = s.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(d.username).trim()) {
      s.deleteRow(i + 1);
      return out({ success: true });
    }
  }
  return out({ success: false, message: 'User tidak ditemukan' });
}
