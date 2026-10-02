# ElderHub – Centrum Operacyjne Gildii (ElderMT2)

Centrum dowodzenia i system operacyjny gildii:
- **Panel Operacyjny (`/panel`):** Radar bossów terenowych (5 kanałów) w czasie rzeczywistym, HUD Lochu Pająków V3, widok custom oraz konfigurowalne dźwięki per mapa (Web Audio API).
- **Kalendarz Gildijny (`/kalendarz`):** Zapisy na wyprawy blokowe (V3, Red Las) oraz raid party na bossy/dungeony z odznaczaniem obecności.
- **Składki i Rozliczenia (`/skladki`):** Automatyczny skarbiec i rozliczanie składek PvP (3 kk) / PvM (7 kk) powiązany z obecnością na wydarzeniach.
- **Statystyki (`/statystyki`):** Zestawienie aktywności członków gildii na wyprawach.

## Lokalnie

```bash
cp .env.example .env.local
# ustaw AUTH_SECRET (openssl rand -base64 32)
# na start wystarczy DEV_LOGIN=true — bez Discorda i bez Neon
npm install
npm run dev
```

Wejście deweloperskie na `/login` tworzy konto z nickiem. Zaznacz „Zaloguj jako admin”, żeby testować wpłaty i cudze zapisy.

Bez `DATABASE_URL` w `.env.local` baza to PGlite w `./data` (gitignored). Neon jest tylko na Vercelu — nie odpalaj `neon env pull` do `.env.local`.

## Discord

1. Włącz tryb deweloperski w Discordzie (Ustawienia → Zaawansowane).
2. PPM na serwer gildii → **Kopiuj ID serwera** → `DISCORD_GUILD_ID`.
3. [discord.com/developers/applications](https://discord.com/developers/applications) → New Application → OAuth2.
4. Redirecty:
   - `http://localhost:3000/api/auth/callback/discord`
   - `https://<projekt>.vercel.app/api/auth/callback/discord`
5. Client ID / Secret → `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET`.
6. Swoje Discord ID (PPM na awatar) wpisz w `LEADER_DISCORD_IDS`.

## Vercel + Neon (darmowe)

1. Wrzuć repo na GitHub.
2. [Neon](https://console.neon.tech) → nowy projekt → skopiuj connection string do `DATABASE_URL`.
3. [Vercel](https://vercel.com) → Import projektu → wklej zmienne z `.env.example` (bez `DEV_LOGIN`).
4. `AUTH_URL` = `https://<projekt>.vercel.app`.
5. Dopisz ten sam adres jako Discord redirect.
6. Deploy.

`DEV_LOGIN` w produkcji jest wyłączony nawet jeśli ktoś go ustawi — warunek to `NODE_ENV !== "production"`.

## VPS OVH

`v3-zapisy` działa jako osobna usługa systemd na `127.0.0.1:3001`, za istniejącym
Nginxem. PostgreSQL działa lokalnie na VPS-ie, z osobną bazą `elder_hub` i użytkownikiem.
Po przełączeniu `DATABASE_URL` wskazuje na `127.0.0.1:5432`; port bazy nie jest publiczny.
Baza została przeniesiona z Neon przez końcowy eksport i zweryfikowany import.
Neon pozostaje archiwum z wyłączonymi zapisami; stary projekt Vercel jest
wstrzymany i odłączony od GitHub. Produkcyjną konfiguracją zarządzają sekrety
środowiska `production` w GitHub.
Build `output: "standalone"` zawiera serwer i jego
zależności; na VPS-ie wystarczy Node.js 22 lub nowszy.

1. Zainstaluj Node.js na Ubuntu: `sudo apt-get install nodejs`.
2. Prześlij katalog `deploy` i publiczny klucz wdrożeniowy. Jako root uruchom
   `bash deploy/provision.sh /ścieżka/do/klucza.pub`.
3. W GitHub → Settings → Environments → `production` ustaw sekrety
   `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `AUTH_DISCORD_ID`,
   `AUTH_DISCORD_SECRET`, `DISCORD_GUILD_ID` i opcjonalnie `LEADER_DISCORD_IDS`.
   Zachowaj obecne `AUTH_SECRET` i dane połączenia z bazą. Discord wymaga całego
   zestawu trzech wartości; bez nich działa tylko logowanie hasłem.
   Sekrety są przesyłane przez SSH podczas deployu i zapisywane w `.env` wydania
   z prawami `0640`. Nie trafiają do artefaktów builda ani do przeglądarki.
   `/srv/v3-zapisy/shared/.env` wskazuje na `.env` bieżącego wydania,
   więc rollback przywraca również poprzednią konfigurację.
   `AUTH_URL` i `APP_URL` to `https://elder-hub.pl`, a `DEV_LOGIN=false`.
4. W środowisku GitHub Actions `production` ustaw zmienne `DEPLOY_HOST` i
   `DEPLOY_USER=v3-zapisy-deploy` oraz sekrety `DEPLOY_SSH_KEY` i
   `DEPLOY_KNOWN_HOSTS` (zweryfikowany klucz hosta VPS).
5. Workflow `.github/workflows/deploy.yml` testuje i buduje aplikację na Linuxie,
   a push do `main` wdraża ją przez SSH. Po restarcie sprawdza `/api/health`,
   łącznie z dostępem do bazy. Przy błędzie przywraca poprzednią wersję.
   Po zmianie sekretów uruchom workflow ręcznie lub wykonaj kolejny push do `main`.
6. Konfiguracja `deploy/nginx.conf` obsługuje `elder-hub.pl` i przekierowuje `www`
   na domenę główną. Zainstaluj jako
   `/etc/nginx/sites-available/v3-zapisy` i dodaj symlink w `sites-enabled`.
   Sprawdź `sudo nginx -t` i przeładuj Nginx.
7. Rekord DNS `A` domeny skieruj na `57.131.43.47`. Po propagacji uzyskaj HTTPS
   przez Certbot (`sudo /snap/bin/certbot certonly --webroot -w /var/www/html -d elder-hub.pl -d www.elder-hub.pl`).
   Najpierw Nginx musi obsługiwać HTTP i ścieżkę `/.well-known/acme-challenge/`,
   a rekordy A i AAAA muszą wskazywać na ten VPS. Dodaj
   `https://elder-hub.pl/api/auth/callback/discord` do redirectów aplikacji Discord.
8. Przed uruchomieniem timera wyłącz cron starej produkcji na Vercelu.
   Usunięcie harmonogramu z `vercel.json` nie wyłącza go w starszym aktywnym wdrożeniu.
   Po uruchomieniu domeny i sprawdzeniu aplikacji
   uruchom `sudo systemctl enable --now v3-zapisy-cron.timer`.
   Timer sprawdza powiadomienia co godzinę i respektuje ustawioną godzinę w Warszawie.

Diagnostyka: `systemctl status v3-zapisy`, `journalctl -u v3-zapisy -n 50`,
`curl --fail http://127.0.0.1:3001/api/health`. Test wdrożenia na Linuxie:
`bash tests/deployment/release-test.sh`.

Backup PostgreSQL: po utworzeniu bazy uruchom
`sudo systemctl enable --now v3-zapisy-backup.timer`.
Kopie powstają codziennie o 03:15 UTC w `/var/backups/elder-hub/daily`
i są przechowywane przez 14 dni. Pierwszą kopię można wymusić przez
`sudo systemctl start v3-zapisy-backup.service`.
Kopie należy również przechowywać poza VPS-em; lokalny harmonogram tego nie robi.

Test rzeczywistego PostgreSQL używa osobnej bazy `elder_hub_test` na localhost:
`TEST_DATABASE_URL=postgres://.../elder_hub_test npm test`.
Pozostałe testy nadal używają PGlite.

## Zasady

- Sloty: 08:30–11:30, 11:30–14:30, 14:30–17:30, 17:30–20:30.
- Pozycje: R1, R2, R3, Prawo, R1 korytarz, Prawo korytarz.
- Jeden zapis na osobę na dzień kalendarzowy (`Europe/Warsaw`).
- Gracz rusza tylko siebie; admin — wszystko, w tym składki.
- Login i hasło: admin zakłada konto albo gracz dopisuje je na Koncie obok Discorda. Nie ma publicznej rejestracji.
