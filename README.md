# V3 zapisy

Siatka zapisów gildii na V3 zamiast Excela. Logowanie Discordem (tylko członkowie serwera) albo loginem i hasłem od admina, jeden zapis na osobę dziennie, składki PVP 3 kk / PVM 7 kk, statystyki pozycji.

## Lokalnie

```bash
cp .env.example .env.local
# ustaw AUTH_SECRET (openssl rand -base64 32)
# na start wystarczy DEV_LOGIN=true — bez Discorda i bez Neon
npm install
npm run dev
```

Wejście deweloperskie na `/login` tworzy konto z nickiem. Zaznacz „Zaloguj jako admin”, żeby testować wpłaty i cudze zapisy.

Bez `DATABASE_URL` baza to PGlite w `./data` (gitignored). Na produkcji musi być Neon.

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

## Zasady

- Sloty: 08:30–11:30, 11:30–14:30, 14:30–17:30, 17:30–20:30.
- Pozycje: R1, R2, R3, Prawo, R1 korytarz, Prawo korytarz.
- Jeden zapis na osobę na dzień kalendarzowy (`Europe/Warsaw`).
- Gracz rusza tylko siebie; admin — wszystko, w tym składki.
- Login i hasło: admin zakłada konto albo gracz dopisuje je na Koncie obok Discorda. Nie ma publicznej rejestracji.
