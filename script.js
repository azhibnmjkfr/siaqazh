const CONFIG = {
    SHEET_ID: '1YBFPTE_TaE5n5FJrmE9RY5i7_ZWdAPVi2cEss-diNy8',
    FEE: {
        reguler: 30000,
        club: 60000
    }
};

const JADWAL_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=JADWAL`;
const REKAP_URL  = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=REKAP`;
const FEE_DONE_URL    = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=FEE_DONE`;
const FEE_PENDING_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=FEE_PENDING`;

let allJadwal = [];
let allRekap = [];
let feeDone = { classes: [], club: [], subtotalClasses: 0, subtotalClub: 0 };
let feePending = { classes: [], club: [], subtotalClasses: 0, subtotalClub: 0 };
let currentTab = 'semua';
let salaryStatus = 'success';
let salaryKategori = 'classes';

const $ = id => document.getElementById(id);

const loadingScreen = $('loadingScreen');
const loadingPercent = $('loadingPercent');
const loadingStage = $('loadingStage');
const loadingError = $('loadingError');
const loadingErrorDesc = $('loadingErrorDesc');
const loadingRetry = $('loadingRetry');

const CIRCUMFERENCE = 2 * Math.PI * 88;

function setLoadingStage(text, percent) {
    if (loadingStage) loadingStage.textContent = text;
    if (typeof percent === 'number') {
        const p = Math.max(0, Math.min(100, percent));
        const seal = $('sealProgress');
        if (seal) {
            const offset = CIRCUMFERENCE - (p / 100) * CIRCUMFERENCE;
            seal.style.strokeDashoffset = offset;
        }
        if (loadingPercent) loadingPercent.textContent = Math.round(p) + '%';
    }
}

function hideLoadingScreen() {
    setLoadingStage('Selesai', 100);
    setTimeout(() => {
        loadingScreen.classList.add('hide');
        setTimeout(() => { loadingScreen.style.display = 'none'; }, 700);
    }, 250);
}

function showLoadingError(msg) {
    loadingError.hidden = false;
    loadingErrorDesc.textContent = msg || 'Periksa koneksi lalu coba lagi.';
    if (loadingStage) loadingStage.textContent = 'Gagal';
    loadingScreen.classList.add('is-error');
    const seal = $('sealProgress');
    if (seal) seal.style.strokeDashoffset = 0;
    if (loadingPercent) loadingPercent.textContent = '!';
}

if (loadingRetry) loadingRetry.addEventListener('click', () => location.reload());

function clean(str) {
    return (str || '').trim().replace(/^"|"$/g, '');
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function num(v) {
    return parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0;
}

function formatRpShort(v) {
    const n = num(v);
    if (!n) return '-';
    return 'Rp' + Math.round(n / 1000) + 'K';
}

function formatRpFull(v) {
    return 'Rp' + num(v).toLocaleString('id-ID');
}

function parseTanggal(str) {
    if (!str) return null;
    const s = String(str).trim();
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
}

function sortByTanggalDesc(arr) {
    return [...arr].sort((a, b) => {
        const da = parseTanggal(a.TANGGAL);
        const db = parseTanggal(b.TANGGAL);
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return db - da;
    });
}

function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => clean(h));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = [];
        let cur = '', inQ = false;
        for (const ch of lines[i]) {
            if (ch === '"') inQ = !inQ;
            else if (ch === ',' && !inQ) { cols.push(clean(cur)); cur = ''; }
            else cur += ch;
        }
        cols.push(clean(cur));
        if (cols.length < headers.length) continue;
        const obj = {};
        headers.forEach((h, idx) => obj[h] = cols[idx] || '');
        rows.push(obj);
    }
    return rows;
}

function parseCSVRaw(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = [];
        let cur = '', inQ = false;
        for (const ch of lines[i]) {
            if (ch === '"') inQ = !inQ;
            else if (ch === ',' && !inQ) { cols.push(clean(cur)); cur = ''; }
            else cur += ch;
        }
        cols.push(clean(cur));
        rows.push(cols);
    }
    return rows;
}

async function fetchAll() {
    setLoadingStage('Menghubungi server', 12);
    const urls = [JADWAL_URL, REKAP_URL, FEE_DONE_URL, FEE_PENDING_URL];
    const res = await Promise.all(urls.map(u => fetch(u)));
    for (const r of res) if (!r.ok) throw new Error('Koneksi ke spreadsheet gagal.');

    setLoadingStage('Mengunduh data', 48);
    const [t1, t2, t3, t4] = await Promise.all(res.map(r => r.text()));

    setLoadingStage('Menyusun tampilan', 82);
    return {
        jadwal: parseCSV(t1),
        rekap: parseCSV(t2),
        feeDone: parseCSVRaw(t3),
        feePending: parseCSVRaw(t4)
    };
}

function extractFee(rows) {
    const classes = [];
    const club = [];
    let subtotalClasses = 0;
    let subtotalClub = 0;

    if (rows[0]) {
        subtotalClasses = num(rows[0][6]);
        subtotalClub = num(rows[0][14]);
    }

    for (const r of rows) {
        const tglC = r[0] || '', hariC = r[1] || '', kelasC = r[2] || '';
        if (tglC || hariC || kelasC) {
            classes.push({
                TANGGAL: tglC, HARI: hariC, KELAS: kelasC,
                JP: r[3] || '', STAT: r[4] || '',
                AMOUNT: r[5] || ''
            });
        }
        const tglK = r[8] || '', hariK = r[9] || '', kelasK = r[10] || '';
        if (tglK || hariK || kelasK) {
            club.push({
                TANGGAL: tglK, HARI: hariK, KELAS: kelasK,
                JP: r[11] || '', STAT: r[12] || '',
                AMOUNT: r[13] || ''
            });
        }
    }
    return { classes, club, subtotalClasses, subtotalClub };
}

function updateStats(jadwal, rekap) {
    const totalP = jadwal.length;
    const totalJ = rekap.reduce((s, r) => s + num(r['TOTAL JAM']), 0);
    const totalS = rekap.reduce((s, r) => s + num(r['SUDAH']), 0);
    const totalB = rekap.reduce((s, r) => s + num(r['BELUM']), 0);

    ['statPertemuan', 'statPertemuanDesktop'].forEach(id => {
        const el = $(id); if (el) el.textContent = totalP;
    });
    ['statJam', 'statJamDesktop'].forEach(id => {
        const el = $(id); if (el) el.textContent = totalJ;
    });
    ['statSudah', 'statSudahDesktop'].forEach(id => {
        const el = $(id); if (el) el.textContent = totalS;
    });
    ['statBelum', 'statBelumDesktop'].forEach(id => {
        const el = $(id); if (el) el.textContent = totalB;
    });
}

function populateDropdowns(jadwal) {
    const months = [...new Set(jadwal.map(r => r.PERIODE).filter(Boolean))].sort();
    ['filterSemua', 'filterReguler', 'filterClub'].forEach(id => {
        const sel = $(id);
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = `<option value="all">Semua bulan</option><option value="">Pilih bulan</option>`;
        for (const m of months) sel.innerHTML += `<option value="${m}">${m}</option>`;
        if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
        else sel.value = 'all';
    });
}

function updateCaption(tab, count) {
    const cap = tab.charAt(0).toUpperCase() + tab.slice(1);
    const el = $(`caption${cap}`);
    if (!el) return;
    const select = $(`filter${cap}`);
    const month = select ? select.value : 'all';
    const monthLabel = (!month || month === 'all') ? 'Semua bulan' : month;
    const tabLabel = tab === 'semua' ? 'Semua' : cap;
    el.textContent = `${tabLabel} · ${monthLabel} · ${count} sesi`;
}

function applyFilter(tab) {
    const cap = tab.charAt(0).toUpperCase() + tab.slice(1);
    const select = $(`filter${cap}`);
    const from = $(`from${cap}`);
    const to = $(`to${cap}`);
    const wrap = $(`table${cap}Wrap`);
    const empty = $(`empty${cap}`);
    const tbody = $(`table${cap}`);

    if (!wrap) return;

    const selectedMonth = select ? select.value : 'all';
    const fromVal = from ? from.value : '';
    const toVal = to ? to.value : '';

    let data = [...allJadwal];
    if (tab === 'reguler') data = data.filter(r => r.KETERANGAN === 'Reguler');
    else if (tab === 'club') data = data.filter(r => r.KETERANGAN === 'Club');

    if (selectedMonth && selectedMonth !== 'all') {
        data = data.filter(r => r.PERIODE === selectedMonth);
    }

    if (fromVal || toVal) {
        const fromDate = fromVal ? new Date(fromVal) : null;
        const toDate = toVal ? new Date(toVal) : null;
        if (toDate) toDate.setHours(23, 59, 59, 999);
        data = data.filter(r => {
            const d = parseTanggal(r.TANGGAL);
            if (!d) return false;
            if (fromDate && d < fromDate) return false;
            if (toDate && d > toDate) return false;
            return true;
        });
    }

    if (!data.length) {
        wrap.hidden = true;
        empty.hidden = false;
        updateCaption(tab, 0);
        return;
    }

    empty.hidden = true;
    wrap.hidden = false;
    renderJadwalRows(tbody, data);
    updateCaption(tab, data.length);
}

function renderJadwalRows(tbody, data) {
    if (!tbody) return;
    const sorted = sortByTanggalDesc(data);
    tbody.innerHTML = sorted.map(r => {
        const dataAttr = escapeHtml(JSON.stringify(r));
        return `
            <div class="data-row" data-row='${dataAttr}'>
                <div class="cell-date">${escapeHtml(r.TANGGAL) || '-'}</div>
                <div class="cell-day">${escapeHtml(r.HARI) || '-'}</div>
                <div class="cell-class">${escapeHtml(r.KELAS) || '-'}</div>
                <div class="cell-hour">${escapeHtml(r.JAM) || '-'}</div>
                <div class="cell-arrow"><i data-lucide="chevron-right"></i></div>
            </div>`;
    }).join('');

    tbody.querySelectorAll('.data-row').forEach(row => {
        row.addEventListener('click', () => {
            try {
                const d = JSON.parse(row.dataset.row.replace(/&quot;/g, '"'));
                openModalDetail(d);
            } catch (e) { console.error(e); }
        });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function resetFilter(tab) {
    const cap = tab.charAt(0).toUpperCase() + tab.slice(1);
    const select = $(`filter${cap}`);
    const from = $(`from${cap}`);
    const to = $(`to${cap}`);
    if (select) select.value = 'all';
    if (from) from.value = '';
    if (to) to.value = '';
    applyFilter(tab);
}

function renderRekap() {
    const list = $('rekapList');
    if (!list) return;
    if (!allRekap.length) {
        list.innerHTML = `<div class="data-loading">Belum ada data rekap.</div>`;
        return;
    }

    list.innerHTML = allRekap.map(r => {
        const p = r.PERIODE || 'Tanpa Periode';
        const total = num(r['TOTAL JAM']);
        const success = num(r['SUDAH']);
        const pending = num(r['BELUM']);
        const dataAttr = escapeHtml(JSON.stringify(r));
        return `
            <div class="data-row rekap-row" data-rekap='${dataAttr}'>
                <div class="cell-period">${escapeHtml(p)}</div>
                <div class="cell-num">${total}</div>
                <div class="cell-num">${num(r['REGULER'])}</div>
                <div class="cell-num">${num(r['CLUB'])}</div>
                <div class="cell-badge"><span class="badge success">${success}</span></div>
                <div class="cell-badge"><span class="badge pending">${pending}</span></div>
                <div class="rekap-mobile-info">
                    <div class="rkm-line"><span>Success:</span> ${success}</div>
                    <div class="rkm-line"><span>Pending:</span> ${pending}</div>
                </div>
                <div class="cell-arrow"><i data-lucide="chevron-right"></i></div>
            </div>`;
    }).join('');

    list.querySelectorAll('[data-rekap]').forEach(row => {
        row.addEventListener('click', () => {
            try {
                const d = JSON.parse(row.dataset.rekap.replace(/&quot;/g, '"'));
                openModalRekap(d);
            } catch (e) { console.error(e); }
        });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function currentFeeData() {
    const src = salaryStatus === 'success' ? feeDone : feePending;
    const arr = salaryKategori === 'classes' ? src.classes : src.club;
    return sortByTanggalDesc(arr);
}

function currentSubtotal() {
    const src = salaryStatus === 'success' ? feeDone : feePending;
    return salaryKategori === 'classes' ? src.subtotalClasses : src.subtotalClub;
}

function isSalaryFilterActive() {
    const from = $('salFrom') ? $('salFrom').value : '';
    const to = $('salTo') ? $('salTo').value : '';
    return !!(from || to);
}

function renderSalary() {
    const list = $('salaryList');
    const empty = $('salaryEmpty');
    const wrap = $('salaryWrap');
    if (!list) return;

    const data = currentFeeData();
    const filtered = filterSalaryByDate(data);

    const total = isSalaryFilterActive()
        ? filtered.reduce((s, r) => s + num(r.AMOUNT), 0)
        : currentSubtotal();

    $('salKategoriLabel').textContent = salaryKategori === 'classes' ? 'Classes' : 'Club';
    $('salCount').textContent = filtered.length + ' data';
    $('salTotal').textContent = formatRpFull(total);

    if (!filtered.length) {
        wrap.hidden = true;
        empty.hidden = false;
        return;
    }

    wrap.hidden = false;
    empty.hidden = true;

    list.innerHTML = filtered.map(r => {
        const dataAttr = escapeHtml(JSON.stringify(r));
        return `
            <div class="data-row" data-sal='${dataAttr}'>
                <div class="cell-date">${escapeHtml(r.TANGGAL) || '-'}</div>
                <div class="cell-day">${escapeHtml(r.HARI) || '-'}</div>
                <div class="cell-class">${escapeHtml(r.KELAS) || '-'}</div>
                <div class="cell-num">${escapeHtml(r.JP) || '-'}</div>
                <div class="cell-num">${formatRpShort(r.AMOUNT)}</div>
                <div class="cell-arrow"><i data-lucide="chevron-right"></i></div>
            </div>`;
    }).join('');

    list.querySelectorAll('[data-sal]').forEach(row => {
        row.addEventListener('click', () => {
            try {
                const d = JSON.parse(row.dataset.sal.replace(/&quot;/g, '"'));
                openModalSalary(d);
            } catch (e) { console.error(e); }
        });
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function filterSalaryByDate(data) {
    const from = $('salFrom') ? $('salFrom').value : '';
    const to = $('salTo') ? $('salTo').value : '';
    if (!from && !to) return data;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (toDate) toDate.setHours(23, 59, 59, 999);
    return data.filter(r => {
        const d = parseTanggal(r.TANGGAL);
        if (!d) return false;
        if (fromDate && d < fromDate) return false;
        if (toDate && d > toDate) return false;
        return true;
    });
}

function openModalDetail(d) {
    $('modalDetailTitle').textContent = d.KELAS || 'Sesi';
    $('mdTanggal').textContent = d.TANGGAL || '-';
    $('mdHari').textContent = d.HARI || '-';
    $('mdKelas').textContent = d.KELAS || '-';
    $('mdJam').textContent = d.JAM || '-';
    $('mdMateri').textContent = d.MATERI || '-';
    $('mdKet').textContent = d.KETERANGAN || '-';
    openModal('modalDetail');
}

function openModalRekap(d) {
    const regS = num(d['REGULER SUCCESS']);
    const regP = num(d['REGULER PENDING']);
    const clubS = num(d['CLUB SUCCESS']);
    const clubP = num(d['CLUB PENDING']);
    const feeS = num(d['FEE SUCCESS']);
    const feeP = num(d['FEE PENDING']);

    $('modalRekapTitle').textContent = d.PERIODE || 'Rekap';
    $('mrRegSuccess').textContent = regS + ' jam';
    $('mrRegSuccessFee').textContent = formatRpFull(regS * CONFIG.FEE.reguler);
    $('mrClubSuccess').textContent = clubS + ' jam';
    $('mrClubSuccessFee').textContent = formatRpFull(clubS * CONFIG.FEE.club);
    $('mrTotalSuccess').textContent = formatRpFull(feeS);

    $('mrRegPending').textContent = regP + ' jam';
    $('mrRegPendingFee').textContent = formatRpFull(regP * CONFIG.FEE.reguler);
    $('mrClubPending').textContent = clubP + ' jam';
    $('mrClubPendingFee').textContent = formatRpFull(clubP * CONFIG.FEE.club);
    $('mrTotalPending').textContent = formatRpFull(feeP);

    openModal('modalRekap');
}

function openModalSalary(d) {
    $('msEyebrow').textContent = salaryStatus === 'success' ? 'Fee Success' : 'Fee Pending';
    $('msTitle').textContent = d.KELAS || 'Detail';
    $('msTanggal').textContent = d.TANGGAL || '-';
    $('msHari').textContent = d.HARI || '-';
    $('msKelas').textContent = d.KELAS || '-';
    $('msJp').textContent = d.JP ? d.JP + ' JP' : '-';
    $('msStat').textContent = salaryStatus === 'success' ? 'Success' : 'Pending';
    $('msAmount').textContent = formatRpFull(d.AMOUNT);
    openModal('modalSalary');
}

function openModal(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeAllModals() {
    document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
}

document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => {
        if (e.target === m) closeAllModals();
    });
});
document.querySelectorAll('.modal-close').forEach(b => {
    b.addEventListener('click', closeAllModals);
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllModals();
});

$('profileTrigger').addEventListener('click', () => openModal('modalProfile'));

function switchTab(tab) {
    currentTab = tab;

    ['semua', 'reguler', 'club', 'rekap', 'salary'].forEach(t => {
        const panel = $(`panel${t.charAt(0).toUpperCase() + t.slice(1)}`);
        if (panel) panel.hidden = (t !== tab);
    });

    document.querySelectorAll('.tab').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === tab);
    });

    if (tab === 'rekap') renderRekap();
    else if (tab === 'salary') renderSalary();
    else applyFilter(tab);

    document.body.dataset.view = 'tab';
    document.body.dataset.tab = tab;

    document.querySelectorAll('.bn-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.nav === tab);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.tab').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
});

['semua', 'reguler', 'club'].forEach(tab => {
    const cap = tab.charAt(0).toUpperCase() + tab.slice(1);
    const select = $(`filter${cap}`);
    const from = $(`from${cap}`);
    const to = $(`to${cap}`);
    const reset = $(`reset${cap}`);
    if (select) select.addEventListener('change', () => applyFilter(tab));
    if (from) from.addEventListener('change', () => applyFilter(tab));
    if (to) to.addEventListener('change', () => applyFilter(tab));
    if (reset) reset.addEventListener('click', () => resetFilter(tab));
});

function setupDropdown(triggerId, menuId, onChange) {
    const trigger = $(triggerId);
    const menu = $(menuId);
    if (!trigger || !menu) return;
    const parent = trigger.closest('.salary-dropdown');

    trigger.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.salary-dropdown.open').forEach(d => {
            if (d !== parent) d.classList.remove('open');
        });
        parent.classList.toggle('open');
    });

    menu.querySelectorAll('.dd-item').forEach(item => {
        item.addEventListener('click', () => {
            menu.querySelectorAll('.dd-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            parent.classList.remove('open');
            onChange(item.dataset.value);
        });
    });
}

document.addEventListener('click', () => {
    document.querySelectorAll('.salary-dropdown.open').forEach(d => d.classList.remove('open'));
});

setupDropdown('ddStatusBtn', 'ddStatusMenu', v => {
    salaryStatus = v;
    $('ddStatusValue').textContent = v === 'success' ? 'Success' : 'Pending';
    renderSalary();
});

setupDropdown('ddKategoriBtn', 'ddKategoriMenu', v => {
    salaryKategori = v;
    $('ddKategoriValue').textContent = v === 'classes' ? 'Classes' : 'Club';
    renderSalary();
});

const salFrom = $('salFrom');
const salTo = $('salTo');
if (salFrom) salFrom.addEventListener('change', renderSalary);
if (salTo) salTo.addEventListener('change', renderSalary);

$('salReset').addEventListener('click', () => {
    if (salFrom) salFrom.value = '';
    if (salTo) salTo.value = '';
    renderSalary();
});

$('salPrint').addEventListener('click', handlePrint);

function handlePrint() {
    const data = filterSalaryByDate(currentFeeData());
    const label = salaryKategori === 'classes' ? 'Classes' : 'Club';
    const statusLabel = salaryStatus === 'success' ? 'SUCCESS' : 'PENDING';

    const total = isSalaryFilterActive()
        ? data.reduce((s, r) => s + num(r.AMOUNT), 0)
        : currentSubtotal();

    const today = new Date();
    const tanggalCetak = today.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'long', year: 'numeric'
    });

    let rangeInfo = '';
    const fromVal = salFrom ? salFrom.value : '';
    const toVal = salTo ? salTo.value : '';
    if (fromVal && toVal) {
        const f = new Date(fromVal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        const t = new Date(toVal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        rangeInfo = ` &nbsp;·&nbsp; Periode: ${f} — ${t}`;
    } else if (fromVal) {
        const f = new Date(fromVal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        rangeInfo = ` &nbsp;·&nbsp; Dari: ${f}`;
    } else if (toVal) {
        const t = new Date(toVal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
        rangeInfo = ` &nbsp;·&nbsp; Sampai: ${t}`;
    }

    let rowsHtml = '';
    for (const r of data) {
        rowsHtml += `
            <tr>
                <td>${escapeHtml(r.TANGGAL)}</td>
                <td>${escapeHtml(r.HARI)}</td>
                <td>${escapeHtml(r.KELAS)}</td>
                <td>${escapeHtml(r.JP) || '-'}</td>
                <td>${formatRpShort(r.AMOUNT)}</td>
                <td>${formatRpShort(r.AMOUNT)}</td>
            </tr>`;
    }

    $('printArea').innerHTML = `
        <div class="print-head">
            <div class="print-title">REKAP FEE ${statusLabel}</div>
            <div class="print-subtitle">Sekolah Islam Akhlaqul Quran</div>
            <div class="print-subtitle">Ahmad Zaman Huri — Guru Bahasa Inggris</div>
            <div class="print-meta">Kategori: ${escapeHtml(label)} &nbsp;·&nbsp; Dicetak: ${tanggalCetak}${rangeInfo}</div>
        </div>
        <div class="print-divider"></div>
        <table>
            <thead>
                <tr>
                    <th>Tanggal</th>
                    <th>Hari</th>
                    <th>Kelas</th>
                    <th>JP</th>
                    <th>Amount</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="6" style="text-align:center;">Tidak ada data.</td></tr>'}
            </tbody>
        </table>
        <div class="print-summary">
            <span>Jumlah: ${data.length} pertemuan</span>
            <span class="print-summary-value">TOTAL: ${formatRpFull(total)}</span>
        </div>`;

    setTimeout(() => window.print(), 60);
}

const goTop = $('goTop');
window.addEventListener('scroll', () => {
    if (goTop) goTop.classList.toggle('visible', window.scrollY > 300);
});
if (goTop) goTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

async function init() {
    try {
        const { jadwal, rekap, feeDone: fd, feePending: fp } = await fetchAll();

        allJadwal = jadwal;
        allRekap = rekap;
        feeDone = extractFee(fd);
        feePending = extractFee(fp);

        updateStats(jadwal, rekap);
        populateDropdowns(jadwal);

        switchTab('semua');

        hideLoadingScreen();
    } catch (err) {
        console.error(err);
        showLoadingError(err.message);
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

init();
