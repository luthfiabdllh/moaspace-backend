# Setup VPS Produksi — MoaSpace

Panduan sekali-jalan untuk menyiapkan VPS Anda supaya CI/CD dari kedua repo
GitHub (`moaspace-backend`, `moaspace-frontend`) bisa auto-deploy setiap kali
ada push ke branch `main`.

Asumsi: Docker + Docker Compose plugin sudah terpasang di VPS, Anda punya
domain yang sudah diarahkan (A record) ke IP VPS ini.

Ganti **`app.moaspace.my.id`** di seluruh panduan ini dan di
`nginx/user_conf.d/moaspace.conf` dengan domain asli Anda.

---

## 1. Siapkan direktori deploy di VPS

```bash
ssh user@vps-anda
sudo mkdir -p /opt/moaspace
sudo chown $USER:$USER /opt/moaspace
cd /opt/moaspace
```

Salin 3 hal dari folder `deploy/` repo backend ini ke `/opt/moaspace` di VPS
(lewat `scp`, `rsync`, atau `git clone` repo backend lalu `cp -r
moaspace-backend/deploy/* /opt/moaspace/`):

```
/opt/moaspace/
├── docker-compose.yml
├── nginx/
│   └── user_conf.d/
│       └── moaspace.conf
└── .env                    # dibuat di langkah 2, JANGAN dari git
```

Contoh pakai `scp` dari laptop Anda:

```bash
scp -r deploy/* user@vps-anda:/opt/moaspace/
```

## 2. Buat file `.env` berisi rahasia produksi

Di VPS:

```bash
cd /opt/moaspace
cp .env.production.example .env
nano .env
```

Isi setiap nilai. Generate password/secret yang kuat:

```bash
openssl rand -hex 24   # untuk POSTGRES_PASSWORD
openssl rand -hex 32   # untuk JWT_SECRET
openssl rand -base64 18   # untuk ADMIN_PASSWORD
```

**Penting:** `JWT_SECRET` wajib sama persis untuk backend & frontend — tapi
karena satu `.env` ini dipakai bersama oleh kedua service, cukup isi sekali.

`ALLOWED_ORIGINS` dan `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_API_URL` (lihat
langkah 5) harus pakai domain asli Anda dengan `https://`, contoh:

```
ALLOWED_ORIGINS=https://app.moaspace.my.id
```

**`ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`** — akun Super Admin
satu-satunya yang dibuat otomatis saat deploy pertama (lihat langkah 7).
7 divisi default organisasi ikut dibuat (tanpa anggota), tapi **tidak ada**
akun Kormanit atau data contoh (task/story/epic/request) apa pun — admin ini
yang login pertama kali lalu mengatur anggota & penugasan dari UI.
**Catat password ini di tempat aman** — script seednya idempotent, jadi
deploy berikutnya TIDAK akan menimpa password yang sudah ada (termasuk
kalau Anda menggantinya lewat halaman profil di aplikasi).

## 3. Sesuaikan domain di konfigurasi Nginx

```bash
nano /opt/moaspace/nginx/user_conf.d/moaspace.conf
```

Ganti semua `app.moaspace.my.id` dengan domain Anda (ada di 3 baris:
`server_name` ×2, `ssl_certificate`, `ssl_certificate_key`).

## 4. Login ke GitHub Container Registry (sekali saja)

Image Docker yang dibangun GitHub Actions bersifat **private** secara
default. VPS perlu login sekali supaya bisa `docker compose pull`.

1. Buat Personal Access Token di GitHub: **Settings → Developer settings →
   Personal access tokens → Tokens (classic)** → scope minimal
   `read:packages`. Karena image-nya di-push ke bawah organisasi
   `KKN-Moa-Bercerita` (bukan akun personal), akun yang membuat token ini
   harus jadi anggota organisasi tersebut dengan akses ke package-nya —
   cek di **github.com/orgs/KKN-Moa-Bercerita/packages** → package →
   **Package settings** → pastikan akun Anda (atau tim Anda) punya akses
   `Read` minimal.
2. Di VPS:
   ```bash
   echo "GHP_TOKEN_ANDA" | docker login ghcr.io -u USERNAME_GITHUB_ANDA --password-stdin
   ```
   (`USERNAME_GITHUB_ANDA` tetap username akun GitHub pribadi Anda yang
   membuat token di langkah 1, bukan nama organisasi.)

Token ini tersimpan di `~/.docker/config.json` VPS — tidak perlu diulang
per-deploy, GitHub Actions nanti SSH masuk dan pakai sesi Docker yang sudah
login ini.

## 5. Buat SSH deploy key khusus untuk GitHub Actions

**Jangan pakai SSH key pribadi Anda.** Buat key baru khusus:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/moaspace_deploy_key -N ""
```

Tambahkan public key-nya ke VPS (user yang dipakai harus bisa jalankan
`docker compose`, mis. ada di group `docker`):

```bash
cat ~/moaspace_deploy_key.pub | ssh user@vps-anda "cat >> ~/.ssh/authorized_keys"
```

Simpan isi **private key** (`cat ~/moaspace_deploy_key`) — dibutuhkan di
langkah 6.

## 6. Set GitHub Secrets & Variables — di KEDUA repo

Karena backend dan frontend adalah repo terpisah tapi deploy ke VPS & stack
compose yang sama, isi secret berikut di **kedua** repo
(`moaspace-backend` dan `moaspace-frontend`): **Settings → Secrets and
variables → Actions**.

### Secrets (tab "Secrets") — sama di kedua repo

| Nama | Isi |
|---|---|
| `VPS_HOST` | IP atau hostname VPS Anda |
| `VPS_USER` | user SSH yang dipakai (yang authorized_keys-nya diisi di langkah 5) |
| `VPS_SSH_KEY` | isi private key `~/moaspace_deploy_key` (seluruh isi file, termasuk header/footer) |
| `VPS_DEPLOY_PATH` | `/opt/moaspace` |

### Variables (tab "Variables") — **khusus repo `moaspace-frontend` saja**

| Nama | Isi |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.moaspace.my.id` |
| `NEXT_PUBLIC_API_URL` | `https://app.moaspace.my.id/api` |

(Ini dipakai sebagai `--build-arg` saat `docker build` — lihat
`.github/workflows/cd.yml` frontend. Bukan rahasia, cuma URL publik, jadi
pakai tab Variables bukan Secrets.)

## 7. Deploy pertama

1. **Push kode Dockerfile/workflow ini ke `main`** di kedua repo (lewat PR
   seperti biasa). Begitu merge, workflow `CD` jalan otomatis: build → push
   image ke `ghcr.io` → SSH ke VPS → `docker compose pull && up -d`.
   - Deploy SSH-nya akan **gagal** di percobaan pertama kalau langkah 1–6 di
     atas belum beres (compose file/env belum ada di VPS) — itu wajar,
     tinggal selesaikan setup VPS lalu re-run job dari tab Actions.

2. Setelah image pertama berhasil ter-push ke GHCR (cek di tab **Packages**
   profil/organisasi GitHub Anda), di VPS:
   ```bash
   cd /opt/moaspace
   docker compose up -d postgres redis
   docker compose --profile migrate pull backend migrate
   docker compose --profile migrate run --rm migrate
   docker compose up -d
   ```
   Perintah `migrate` di atas menjalankan skema migration (`drizzle-kit
   migrate`, dari `packages/database/drizzle/*.sql`) **lalu** membuat akun
   Super Admin satu-satunya (dari `ADMIN_EMAIL`/`ADMIN_PASSWORD` di `.env`)
   + 7 divisi default organisasi — tanpa Kormanit atau data contoh
   (task/story/epic/request) apa pun, tinggal login dan atur anggota &
   penugasan dari situ. Outputnya langsung tercetak di terminal saat
   command berjalan (cari baris `✅ Super Admin created: ...` dan
   `✅ Division created: ...`); kalau tidak melihat baris sukses tersebut
   atau proses keluar dengan error, jangan lanjut ke langkah berikutnya.

   `docker compose up -d` (tanpa argumen) menjalankan `backend`, `frontend`,
   dan `nginx`. Nginx (image `jonasal/nginx-certbot`) otomatis menerbitkan
   sertifikat HTTPS untuk domain yang ada di `nginx/user_conf.d/*.conf` —
   **pastikan DNS domain Anda sudah mengarah ke IP VPS ini sebelum langkah
   ini**, kalau belum, penerbitan sertifikat akan gagal.

3. Cek:
   ```bash
   docker compose ps
   docker compose logs -f nginx    # pastikan sertifikat berhasil diterbitkan
   docker compose logs -f backend
   docker compose logs -f frontend
   ```
   Lalu buka `https://app.moaspace.my.id` di browser dan login dengan
   `ADMIN_EMAIL` / `ADMIN_PASSWORD` yang Anda isi di `.env` (langkah 2).

Setelah ini, **setiap push/merge ke `main`** di masing-masing repo otomatis
build image baru, push ke GHCR, dan restart service yang bersangkutan di
VPS — tidak perlu SSH manual lagi.

## Operasional sehari-hari

- **Lihat log**: `docker compose logs -f <backend|frontend|nginx|postgres|redis>`
- **Rollback cepat** ke commit sebelumnya: di VPS,
  `docker compose pull backend` ganti tag `:latest` jadi SHA commit
  tertentu di `docker-compose.yml`, atau paling simpel: revert commit di
  GitHub lalu push ulang ke `main` (CD akan build & deploy ulang versi lama).
- **Restart manual satu service**: `docker compose restart backend`
- **Backup database**:
  `docker compose exec postgres pg_dump -U postgres moaspace > backup.sql`
- **Lihat disk image lama menumpuk**: workflow sudah jalankan
  `docker image prune -f` tiap deploy, tapi cek sesekali dengan
  `docker system df`.

## Mengganti domain atau aktifkan proteksi deploy (opsional)

- Ganti domain nanti: update `nginx/user_conf.d/moaspace.conf` +
  `.env` (`ALLOWED_ORIGINS`) di VPS, update Variables `NEXT_PUBLIC_*` di
  GitHub repo frontend, lalu **rebuild frontend** (push dummy commit ke
  `main` atau re-run workflow) — karena `NEXT_PUBLIC_*` sudah terpanggang di
  build, restart container saja tidak cukup.
- Mau approval manual sebelum deploy produksi? Buat Environment bernama
  `production` di **Settings → Environments** masing-masing repo, lalu
  aktifkan "Required reviewers" — job `deploy` di kedua workflow sudah
  diset `environment: production` jadi otomatis akan menunggu approval
  begitu Environment itu punya protection rule.
