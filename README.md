# ProjectMS — Project Management System

Aplikasi web manajemen proyek perangkat lunak: perencanaan, penjadwalan, dan pengawasan
proyek dengan **Gantt Chart**, **Network Diagram**, **PERT**, dan **Critical Path Analysis (CPM)**
yang dihitung di atas **kalender kerja** (hari kerja + hari libur).

## Teknologi

| Bagian | Teknologi |
|---|---|
| Frontend | React 19 + TypeScript + Vite (react-router, tanpa UI library) |
| Backend | Node.js + Express 5 + TypeScript |
| Database | SQLite (`node:sqlite` bawaan Node — tanpa dependensi native) |
| Validasi | Zod |
| Pengujian | Vitest (unit + integrasi API) + verifikasi render headless Chrome |

## Menjalankan (Windows / lokal)

```bash
npm install          # instal semua dependensi (workspaces)
npm run seed         # (opsional) buat ulang database dengan data contoh
npm run dev:server   # backend  -> http://localhost:3001
npm run dev:client   # frontend -> http://localhost:5173 (proxy /api ke 3001)
```

Perintah lain:

```bash
npm run typecheck    # tsc --noEmit server & client
npm test             # 44 pengujian (vitest)
npm run build        # build produksi (server/dist + client/dist)
npm start            # jalankan backend hasil build
```

> Di Windows, hentikan server terlebih dahulu sebelum `npm run seed` (file DB dikunci saat server berjalan).

## Fitur

1. **Dashboard** — ringkasan proyek, jumlah tugas, progres rata-rata, daftar tugas terlambat.
2. **Manajemen proyek** — CRUD lengkap + status (perencanaan/aktif/tertunda/selesai/batal).
3. **Tugas & subtugas** — nama, deskripsi, tanggal mulai, durasi (hari kerja), tenggat, status,
   prioritas, progres, penugasan, hierarki anti-siklus.
4. **Gantt Chart** — bar per tugas di atas sumbu hari kalender (kolom non-kerja diarsir),
   panah dependensi berlabel tipe+lag, penanda jalur kritis.
5. **Dependensi** — FS, SS, FF, SF dengan lag (hari kerja); validasi duplikat & siklus (409).
6. **Kalender kerja** — setelan hari kerja mingguan + CRUD hari libur; memengaruhi seluruh perhitungan.
7. **Sumber daya** — CRUD anggota tim, penugasan ke proyek & tugas (otomatis lepas saat dihapus).
8. **Network Diagram** — node per level dependensi, edge berlabel, jalur kritis diwarnai merah.
9. **PERT** — TE = (O + 4M + P) / 6, SD = (P − O) / 6, varian = SD², agregat ΣTE/ΣVar/√ΣVar.
10. **CPM** — forward/backward pass (ES, EF, LS, LF), total float, jalur kritis,
    durasi minimum proyek (hari kerja), agregat PERT pada jalur kritis terpanjang.
11. **Validasi & error handling** — Zod per-field (400), 404, 409 konflik, JSON rusak (400),
    pesan berbahasa Indonesia.

## Struktur

```
├── package.json            # npm workspaces + skrip root
├── server/
│   ├── src/
│   │   ├── index.ts        # entry
│   │   ├── app.ts          # express + middleware error
│   │   ├── db.ts schema.ts # koneksi & DDL SQLite (node:sqlite)
│   │   ├── validation.ts   # skema Zod
│   │   ├── routes/         # projects, tasks, members, calendar, dependencies, dashboard, analysis
│   │   ├── services/       # calendar (hari kerja), scheduling (ES/EF/LS/LF), cpm, pert, graph
│   │   ├── seed.ts         # data contoh
│   │   └── tests/          # vitest unit + integrasi
│   └── data/app.db         # SQLite (dibuat otomatis; di-ignore git)
└── client/
    ├── index.html
    └── src/
        ├── api.ts          # klien API ter-tipe + tipe data
        ├── App.tsx         # shell + routing
        ├── pages/          # Dashboard, Projects, ProjectDetail, Members, Calendar
        └── components/     # TasksTab, GanttTab, NetworkTab, AnalysisTab, MembersTab, Modal
```

## Model data (relasi)

```
projects 1─∞ tasks (parentId self-ref untuk subtugas)
projects ∞─∞ members (project_members)   tasks ∞─1 members (assigneeId)
projects 1─∞ dependencies (predecessorId/successorId → tasks, tipe FS|SS|FF|SF + lag)
workdays (0..6) & holidays — kalender kerja global
tasks menyimpan estimasi PERT (optimisticDays, mostLikelyDays, pessimisticDays)
```

## Algoritma penjadwalan

1. **Topological sort** (Kahn) — graph dependensi harus DAG (siklus ditolak 409).
2. **Forward pass**: `ES = max(floor proyek, floor mandiri, constraint dependensi)`;
   `EF = ES + (durasi − 1) hari kerja`. Constraint: FS `EF_pred +1+lag`, SS `ES_pred +lag`,
   FF/SF dikonversi ke ES lewat mundur `(durasi_succ − 1)`.
3. **Backward pass**: `LF = min(finish proyek, constraint dari successor)`, `LS = LF − (durasi − 1)`.
4. **Total float** = jumlah hari kerja pada interval `(ES, LS]`; **kritis bila float ≤ 0**.
5. **Jalur kritis** = rantai mundur dari tugas kritis dengan `EF = finish` melalui edge
   *driving* (constraint yang tepat menentukan ES successor).
## Screenshot Aplikasi

### Dashboard
![Dashboard Sistem Manajemen Proyek](screenshots/dashboard.png)

### Daftar Proyek
![Daftar Proyek](screenshots/proyek.png)

### Detail Proyek
![Detail Proyek](screenshots/detailproyek.png)

### Manajemen Tugas
![Manajemen Tugas](screenshots/tugas.png)

### Gantt Chart
![Gantt Chart Sistem Manajemen Proyek](screenshots/detail%20proyek-gantt%20char.png)

### Kalender Kerja
![Kalender Kerja](screenshots/kalender%20kerja.png)

### Sumber Daya
![Sumber Daya Sistem Manajemen Proyek](screenshots/summber%20daya.png)