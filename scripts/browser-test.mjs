/**
 * Pengujian browser interaktif (puppeteer-core + Chrome terpasang).
 * Jalankan saat dev server hidup:  node scripts/browser-test.mjs
 *
 * Menguji alur nyata pengguna: render, navigasi, form CRUD, toast,
 * dialog konfirmasi, tab Gantt/Network/Analisis, kalender, dan menangkap
 * error JavaScript di console sebagai kegagalan.
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const CHROME =
  process.env.CHROME_PATH ??
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function textOf(page, selector) {
  return page.$eval(selector, (el) => el.textContent?.trim() ?? '').catch(() => null);
}

async function clickByText(page, selector, text) {
  const handle = await page.evaluateHandle(
    (sel, txt) => {
      const els = [...document.querySelectorAll(sel)];
      return els.find((e) => (e.textContent ?? '').trim().includes(txt)) ?? null;
    },
    selector,
    text,
  );
  const el = handle.asElement();
  if (!el) throw new Error(`Elemen ${selector} berisi "${text}" tidak ditemukan`);
  await el.click();
}

async function waitForToast(page, kind, contains = '', timeout = 8000) {
  await page.waitForFunction(
    (k, c) =>
      [...document.querySelectorAll(`.toast-${k}`)].some((t) => (t.textContent ?? '').includes(c)),
    { timeout },
    kind,
    contains,
  );
  return textOf(page, `.toast-${kind}`);
}

const consoleErrors = [];
const pageErrors = [];

async function clickInRow(page, rowText, title) {
  const ok = await page.evaluate(
    (rt, t) => {
      const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(rt));
      if (!row) return false;
      const btn = row.querySelector(`button[title="${t}"]`);
      if (!btn) return false;
      btn.click();
      return true;
    },
    rowText,
    title,
  );
  if (!ok) throw new Error(`Tombol [title="${title}"] pada baris "${rowText}" tidak ditemukan`);
}

async function cleanupTestData() {
  // Hapus sisa data uji antar-run agar test idempoten
  try {
    const res = await fetch(`${BASE}/api/projects`);
    const projects = await res.json();
    for (const p of projects) {
      if (p.name.includes('Proyek Uji Browser')) {
        await fetch(`${BASE}/api/projects/${p.id}`, { method: 'DELETE' });
      }
    }
  } catch {
    /* server belum siap — biarkan */
  }
}

async function selectAndType(page, selector, text) {
  await page.focus(selector);
  await page.keyboard.down('Control');
  await page.keyboard.press('KeyA');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text);
}

async function main() {
  console.log(`Membuka ${BASE} …`);
  await cleanupTestData();
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const url = msg.location()?.url ?? '';
      consoleErrors.push(`${msg.text()} @ ${url}`);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  /* ---------------- 1. Dashboard ---------------- */
  console.log('\n[1] Dashboard');
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.page-title', { timeout: 15000 });
  check('Dashboard render', (await textOf(page, '.page-title')) === 'Dashboard');
  check('Tombol "Proyek baru" ada', (await page.$x ? true : true) && (await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('Proyek baru')))));
  const hasDueSoon = await page.evaluate(() => document.body.innerText.includes('Mendekati tenggat'));
  check('Seksi "Mendekati tenggat" tampil', hasDueSoon);
  const statCount = await page.$$eval('.stat', (els) => els.length);
  check('Ringkasan statistik tampil', statCount >= 5, `${statCount} kartu statistik`);

  /* ---------------- 2. CRUD proyek via tombol dashboard ---------------- */
  console.log('\n[2] CRUD proyek (dari tombol dashboard)');
  await clickByText(page, 'button', 'Proyek baru');
  await page.waitForSelector('.modal', { timeout: 8000 });
  check('Form proyek baru terbuka otomatis dari dashboard', true);
  await page.type('.modal input[type="text"], .modal input:not([type])', 'Proyek Uji Browser');
  await clickByText(page, '.modal button', 'Simpan');
  await waitForToast(page, 'success', 'dibuat');
  check('Toast sukses "dibuat" muncul', true);
  await page.waitForFunction(() => document.body.innerText.includes('Proyek Uji Browser'), { timeout: 8000 });
  check('Proyek baru muncul di tabel', true);

  /* ---------------- 3. Edit & hapus proyek (dialog konfirmasi) ---------------- */
  console.log('\n[3] Edit + hapus proyek (dialog konfirmasi kustom)');
  const countBefore = await page.evaluate(() =>
    [...document.querySelectorAll('tbody tr')].filter((r) => r.textContent.includes('Proyek Uji Browser')).length,
  );
  check('Tepat satu proyek uji di tabel (data bersih)', countBefore === 1, `${countBefore} baris`);
  await clickInRow(page, 'Proyek Uji Browser', 'Ubah proyek');
  await page.waitForSelector('.modal', { timeout: 8000 });
  await selectAndType(page, '.modal input[type="text"], .modal input:not([type])', 'Proyek Uji Browser Diubah');
  await clickByText(page, '.modal button', 'Simpan');
  await waitForToast(page, 'success', 'diperbarui');
  check('Edit proyek tersimpan (toast sukses)', true);
  await page.waitForFunction(() => document.body.innerText.includes('Proyek Uji Browser Diubah'), { timeout: 8000 });

  const row2ok = await page.evaluate(() => document.body.innerText.includes('Proyek Uji Browser Diubah'));
  check('Nama proyek ter-update di tabel', row2ok);
  await clickInRow(page, 'Proyek Uji Browser Diubah', 'Hapus proyek');
  await page.waitForSelector('[role="alertdialog"]', { timeout: 8000 });
  check('Dialog konfirmasi kustom muncul (bukan window.confirm)', true);
  await clickByText(page, '[role="alertdialog"] button', 'Ya, hapus');
  await waitForToast(page, 'success', 'dihapus');
  await page.waitForFunction(() => !document.body.innerText.includes('Proyek Uji Browser Diubah'), { timeout: 8000 });
  check('Proyek terhapus dari tabel', true);

  /* ---------------- 4. Detail proyek: CRUD tugas ---------------- */
  console.log('\n[4] Detail proyek: tugas & dependensi');
  await page.goto(`${BASE}/projects/1`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.tabs', { timeout: 15000 });
  check('Tab detail proyek render', (await page.$$eval('.tab', (t) => t.length)) === 5);

  await clickByText(page, 'button', 'Tugas baru');
  await page.waitForSelector('.modal', { timeout: 8000 });
  await page.type('.modal input[type="text"], .modal input:not([type])', 'Tugas Browser Test');
  await clickByText(page, '.modal button', 'Simpan');
  await waitForToast(page, 'success', 'dibuat');
  await page.waitForFunction(() => document.body.innerText.includes('Tugas Browser Test'), { timeout: 8000 });
  check('Tugas baru dibuat & tampil di daftar', true);

  const tRowOk = await page.evaluate(() => document.body.innerText.includes('Tugas Browser Test'));
  check('Tugas baru muncul di daftar', tRowOk);
  await clickInRow(page, 'Tugas Browser Test', 'Hapus tugas');
  await page.waitForSelector('[role="alertdialog"]', { timeout: 8000 });
  await clickByText(page, '[role="alertdialog"] button', 'Ya, hapus');
  await waitForToast(page, 'success', 'dihapus');
  await page.waitForFunction(() => !document.body.innerText.includes('Tugas Browser Test'), { timeout: 8000 });
  check('Tugas terhapus lewat dialog konfirmasi', true);

  /* ---------------- 5. Tab Gantt / Network / Analisis ---------------- */
  console.log('\n[5] Gantt, Network, Analisis (data aktual)');
  await clickByText(page, '.tab', 'Gantt');
  await page.waitForSelector('.gantt-bar', { timeout: 15000 });
  const bars = await page.$$eval('.gantt-bar', (els) => els.length);
  check('Gantt menampilkan bar tugas aktual', bars >= 5, `${bars} bar`);
  const arrows = await page.$$eval('.gantt-svg path[marker-end], .gantt-svg g', (els) => els.length);
  check('Gantt menampilkan panah dependensi', arrows >= 1, `${arrows} elemen panah`);

  await clickByText(page, '.tab', 'Network');
  await page.waitForSelector('.net-node', { timeout: 15000 });
  const nodes = await page.$$eval('.net-node', (els) => els.length);
  check('Network menampilkan node aktual', nodes >= 5, `${nodes} node`);
  const critNodes = await page.$$eval('.net-node.critical', (els) => els.length);
  check('Node jalur kritis ditandai', critNodes >= 1, `${critNodes} kritis`);

  await clickByText(page, '.tab', 'Jadwal');
  await page.waitForFunction(() => document.body.innerText.includes('Critical Path Analysis'), { timeout: 15000 });
  check('Analisis CPM tampil (ES/EF/LS/LF/float)', await page.evaluate(() => document.body.innerText.includes('Float')));
  const hasPert = await page.evaluate(() => document.body.innerText.includes('TE = (O + 4M + P) / 6'));
  check('Rumus PERT tampil', hasPert);
  const criticalChips = await page.$$eval('.chip.crit', (els) => els.length);
  check('Jalur kritis ditampilkan sebagai chip', criticalChips >= 3, `${criticalChips} chip`);

  /* ---------------- 6. Kalender ---------------- */
  console.log('\n[6] Kalender kerja');
  await page.goto(`${BASE}/calendar`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.day-toggle', { timeout: 15000 });
  const toggles = await page.$$eval('.day-toggle', (els) => els.length);
  check('7 hari tampil sebagai toggle', toggles === 7);
  // Matikan & aktifkan kembali hari Sabtu (tanpa mengubah data permanen)
  const sat = await page.evaluateHandle(() => [...document.querySelectorAll('.day-toggle')].find((t) => t.textContent.includes('Sabtu')));
  await sat.asElement().click();
  await waitForToast(page, 'success', 'diperbarui');
  check('Toggle hari kerja tersimpan lewat API (toast sukses)', true);
  const sat2 = await page.evaluateHandle(() => [...document.querySelectorAll('.day-toggle')].find((t) => t.textContent.includes('Sabtu')));
  await sat2.asElement().click();
  await waitForToast(page, 'success', 'diperbarui');
  check('Toggle hari kerja dikembalikan', true);

  /* ---------------- 7. Anggota tim ---------------- */
  console.log('\n[7] Anggota tim');
  await page.goto(`${BASE}/members`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('.page-title', { timeout: 15000 });
  check('Halaman anggota render', (await textOf(page, '.page-title')) === 'Anggota tim');
  await clickByText(page, 'button', 'Anggota baru');
  await page.waitForSelector('.modal', { timeout: 8000 });
  // validasi: nama kosong tidak bisa disimpan (tombol disabled)
  const disabled = await page.$eval('.modal button.btn-primary', (b) => b.disabled);
  check('Tombol simpan nonaktif saat nama kosong (validasi form)', disabled);
  await page.keyboard.press('Escape');
  await sleep(300);
  const modalClosed = (await page.$('.modal')) == null;
  check('Dialog tertutup dengan tombol Escape', modalClosed);

  /* ---------------- 8. Error console ---------------- */
  console.log('\n[8] Kesehatan console browser');
  const realErrors = pageErrors.filter((e) => !e.includes('favicon'));
  check('Tanpa error JavaScript di halaman', pageErrors.length === 0, pageErrors[0] ?? '');
  const filteredConsole = consoleErrors.filter(
    (e) => !e.includes('favicon') && !e.includes('net::ERR') && !e.includes('[vite]') && !e.includes('/favicon.ico'),
  );
  check('Tanpa error console signifikan', filteredConsole.length === 0, filteredConsole[0] ?? '');
  void realErrors;

  await browser.close();

  console.log(`\n=== RINGKASAN: ${results.filter((r) => r.ok).length}/${results.length} lulus, ${failures} gagal ===`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('ERROR pengujian browser:', err);
  if (pageErrors.length) console.error('Page errors:', pageErrors);
  process.exit(2);
});
