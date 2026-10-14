# AI-HANDOFF — white-label PWA «детейлинг»

Документ для **другого ИИ-агента / разработчика**, который подхватывает проект.
Кратко: что это, как устроено, как деплоить, что уже живо, на что не наступать.

Дата handoff: 2026-10-07 · Проект: `E:\python_works\детейлинг` · Repo: `https://github.com/el-karpano/detailing_main`

---

## 1. Что это

**White-label PWA онлайн-записи для детейлинг-студий.** Одна кодовая база → под каждого клиента свой билд, свой Worker, своя D1, свой субдомен.

Продукт: продаём студиям «приложение» (услуги/цены/фото/запись/кабинет владельца). Клиент ставит на телефон, записывается без звонков.

**UI/UX — 1:1 клон** `https://studio-booking-theta.vercel.app/s/graphite/` (graphite-токены, не «по мотивам»). Правило: не отходить от образца без явной просьбы пользователя.

### Стек
| Слой | Технология |
|---|---|
| Фронт | React 19 + TypeScript + Vite 7 + Tailwind 4 + vite-plugin-pwa |
| Роутинг | react-router-dom v7 |
| Бэк | Cloudflare Workers (`worker/*.js`) + Assets |
| БД | Cloudflare D1 (записи, owner-auth, профиль студии) |
| KV | `VISITS` (push-визиты, media `media:*`, auth-сессии `auth:*`) |
| AI | Xiaomi MiMo (OpenAI-compatible) через Worker `/api/chat` |
| Push | Web Push (VAPID) + cron `*/15` + `.ics VALARM` fallback |
| Деплой | `npx wrangler deploy` (pages.dev из BY-сети connection-reset → рабочий URL = workers.dev) |

---

## 2. Контекст и живые клиенты

| Slug | Worker / URL | D1 | Назначение |
|---|---|---|---|
| `sgx` | `detailing-main` → https://detailing-main.deteiling-pro.workers.dev | `detailing-main-db` | демо/презентация, **локализовано под РБ** (Br, Минск, +375) |
| `hvv` | `detailing-hvv` → https://detailing-hvv.deteiling-pro.workers.dev | `detailing-hvv-db` | sales-demo «ХВВ» (Барановичи), реальные данные |
| `demo` | `detailing-demo` | — | изоляция/тест |
| `testqa` | `detailing-testqa` | — | throwaway |

Cloudflare account id `e154905dd1487caccfcbf009313c0ceee`, subdomain `deteiling-pro`.
Общий KV `VISITS` id `9b9db4766eb84d6ea2c4250ba8f44eb3` — ключи с префиксом `WORKER_NAME:`.
**R2 выключен** (CF code 10042) — медиа живут в KV.

Аккаунты владельцев (хеши в D1, пароли **не хранить в git** — выдаются пользователю в чат):
- HVV: `owner@hvv.by` · SGX: `owner@sgx.by`
- Пересев/смена: `node scripts/seed-owner.mjs <slug> <email> <password> [имя]`

---

## 3. Быстрый старт агента

```bash
npm install
npm run dev              # prepare-client + vite (текущий slug из clients/.current)
npm run build            # prepare + tsc -b + vite build → dist/
npm run ship -- <slug>   # prepare + D1 create (если нет) + build + deploy + недостающие secrets
```

| Команда | Что делает |
|---|---|
| `npm run new-client -- <slug>` | папка клиента из `clients/_template` |
| `npm run prepare:client -- <slug>` | генерит `src/data/client-data.ts`, подменяет assets/index/wrangler |
| `npm run ship -- <slug>` | полный деплой клиента |
| `npm run preview` | локальный просмотр `dist` (**IPv6** `http://localhost:4173`, не `127.0.0.1`) |

**Правка контента клиента:** `clients/<slug>/client.json` (+ `assets/`) → `npm run ship -- <slug>`.
`DEFAULTS_REV` (hash контента) пересчитывается автоматом; при смене rev клиенты подтягивают новые услуги/фото/тексты (записи не трогаются).

---

## 4. Архитектура

### 4.1 White-label pipeline
```
clients/<slug>/client.json + assets/
        │
        ▼ scripts/prepare-client.mjs
src/data/client-data.ts   (CLIENT_BRAND / CLIENT_STUDIO / DEFAULTS_REV)
public/assets/            (фото клиента)
index.html, wrangler.toml (name / WORKER_NAME / database_name)
        │
        ▼ npm run ship -- <slug>
deploy → https://detailing-<workerName>.deteiling-pro.workers.dev
```
Текущий slug: `clients/.current`. `workerName` у `sgx` = `detailing-main` (не `detailing-sgx`).

Валюта: `brand.currency` (`"Br"` / `"₽"`) → `src/lib/money.ts` (`formatMoney`, `formatServicePrice` + `priceFrom`).

### 4.2 Customer flow (PWA)
| Маршрут | Страница |
|---|---|
| `/` | Home: hero, услуги, работы, CTA запись, контакты, install |
| `/services` | полный прайс |
| `/book/:serviceId` | календарь (60-дневное окно, месячная сетка) + слоты + форма |
| `/my` | мои записи (localStorage mine + синхронизация) |
| `/assistant` | AI-подбор услуги + ACTION-CTA «Записаться» |
| `/account` | профиль |
| `/install` | install-flow 1:1 (device-tabs, beforeinstallprompt, iOS) |
| `/owner` … `/owner/{dashboard,bookings,settings}` | кабинет владельца |

Bottom-nav: Главная / Услуги / Моя запись. На `/assistant` nav скрыт (фокусный flow).

### 4.3 Кабинет владельца (операционный)
- План дня по часам, «Ждут подтверждения», форма записи (услуга + слоты)
- `/owner/bookings`: фильтры/поиск, статусы без `nav(0)`
- Телефон клиента кликабелен (`tel:` / `PhoneLink`) — звонок в один тап
- Удаление: «Удалить» + `confirm` → hard `DELETE /api/bookings/:id` (не только cancel)
- `/owner/settings`: загрузка/замена фото (file picker, «＋ Добавить фото», ✕), профиль студии → сервер

### 4.4 Данные: localStorage = кэш, D1 = истина
- `src/data/store.ts` — singleton store, реактивный (`subscribeStore` + `bump()` + `useStoreTick()` / `useSyncExternalStore`)
- **`useStoreTick()` обязателен** на страницах, читающих `getStudio()`/`getBookings()` (Home/Services/Layout/…), иначе sync с D1 не перерисует UI
- `syncBookingsFromServer()` на boot; `addBooking` async + `pushBooking`/`patchBooking`
- Конфликт слота на сервере → 409 → показать пользователю
- **Один канонический `studioId`** (local `studio.id` ↔ D1 `studio_id` / GET `?studio=`). Несовпадение (`studio-hvv` vs `default`) делает серверные записи невидимыми
- `markMyBooking(id)` в `addBooking` — иначе owner-запись теряется при sync (`localOnly = mine && !remote && !seed-*`)
- `seed-*` демо-записи в D1 не уезжают и **исчезают** после первого успешного sync — smoke-ы создают записи через API/форму

### 4.5 Расписание и часы
`seedSchedule(60, studio.workHours)` парсит `09:00–20:00` из `workHours` (не хардкод).
Короткий `schedule` мигрирует при `load()`. Длинные услуги (полировка 8ч) при маленьком рабочем дне дают **ноль слотов** — UI различает «Все окна заняты» и «студия не работает».

### 4.6 Worker API
База: `worker/index.js`, `run_worker_first=["/api/*"]` (иначе `/api/*` уходит в SPA index.html).

| Метод | Путь | Auth | Что |
|---|---|---|---|
| POST | `/api/chat` | — | AI MiMo → `{reply, action}` |
| GET | `/api/push/public-key` | — | VAPID public |
| POST/DELETE | `/api/visits`, `/api/visits/:id` | — | push-визиты (KV) |
| POST | `/api/auth/login` | — | email+пароль → session token (KV `auth:{WORKER_NAME}:{token}`, TTL 30д) |
| POST | `/api/auth/logout` · GET `/api/auth/me` | token | сессия |
| GET/POST/PATCH | `/api/bookings` | — | клиент записывается/отменяет |
| DELETE | `/api/bookings/:id` | **Bearer** | hard delete (кабинет) |
| GET | `/api/media/:id` | — | картинка из KV |
| POST/DELETE | `/api/media` | **Bearer** | загрузка/удаление фото (≤2MB, jpeg/png/webp/gif) |
| GET | `/api/studio` | — | профиль студии (D1 `studio_profile`, может быть `null`) |
| PUT | `/api/studio` | **Bearer** | сохранить профиль/фото из админки |

Owner-auth: D1 `owners(email, password_hash, studio_id, name)`, PBKDF2-SHA256 100000 (`pbkdf2-sha256$iter$salt_hex$hash_hex`).

### 4.7 AI-запись
- Ключ **не** на фронте: Worker `worker/chat.js` `handleChat` → MiMo `POST {MIMO_BASE_URL}/chat/completions`
- Модель `mimo-v2.5`, base `https://token-plan-sgp.xiaomimimo.com/v1`, key `MIMO_API_KEY` (secret / `.env`, **не git**)
- System prompt строится из `client.json` (услуги/цены/слоты + сегодняшняя дата)
- **ACTION-протокол**: модель дописывает `ACTION:{"serviceId","date","time"}` последней строкой → UI кнопка «Записаться» → `/book/:id?date&time`
- `cleanReply` режет chain-of-thought (`reasoning_content` **не** использовать как фолбэк ответа)
- Fallback `guessAction` из текста

### 4.8 Напоминания
- Web Push: VAPID + KV `VISITS` + cron `*/15` → push за ~24ч (`visitAt-24h`)
- SW: `public/sw-push.js` через `workbox.importScripts`
- iOS PWA push — только после «На экран Домой» (iOS 16.4+)
- `.ics` `VALARM TRIGGER:-P1D` как запасной канал

---

## 5. Дизайн-система (graphite, 1:1)

Токены: bg `#000`, raised `#141414`, stroke `#242424`, surface `#0d0d0d`, overlay `#1c1c1c`, secondary `#A1A1A1`, radius `28px`, accent `#2694fe`, Helvetica Neue.

Классы: `.topbar`, `.wordmark`, `.hero-photo`, `.service-row`, `.booking-card`, `.bottom-nav`, `.install-*`, `.ocean-content`, `.chip-scroll`, `.PhoneLink`.

Фото — **без** цветокоррекции/overlay (hero `mix-blend-mode: color` и saturate-фильтры **убраны** пользователем).

Mobile polish: `@media (max-width:640px|360px)` в `src/index.css` (типографика, hero 220px, `.safe-bottom` ~100px, `.work-photo { aspect-ratio:4/3 }`). Footer владеет `padding` (не `.shell`) и скрыт на `/owner`. Map/phone CTA — всегда из `studio.address`/`studio.phone`.

---

## 6. QA / smoke (обязательно после изменений)

Правило пользователя: **«проверяй, чтобы ничего не сломалось и все работало четко»** — build + live smoke + edge cases (занятые слоты, смена дня, пустые формы), не только happy path.

| Скрипт | Что |
|---|---|
| `check_sgx_by.py` | bundle localization + bookings API + studio profile |
| `check_sgx_by_ui.py` | Playwright live Home/Services/Book (Br, Минск, tel:) |
| `qa_full.py`, `qa_owner.py`, `qa_clockwork.py`, `qa_final_scenario.py`, `qa_fill_day.py`, `qa_day_switch.py` | сквозные сценарии |
| `test_bookings_api.py`, `test_push_api.py`, `test_chat_live.py` | API |
| `check_owner_auth.py`, `check_owner_phone.py`, `check_admin_media_delete.py`, `check_clients.py` | owner/кабинет/мультиклиент |
| `cleanup_hvv_testdata.py` | чистка тестовых записей |

**Python Playwright/парсинг — только в `.py` файлы** (PowerShell ломает `python -c` / heredoc).
Cloudflare режет `Python-urllib/*` UA (403) → всегда `User-Agent: Mozilla/5.0`.
Preview: `Start-Process cmd "/c npm run preview > preview.log 2>&1"` (detached), BASE = `http://localhost:4173`.

**Перед визуальной QA задеплоенного UI обязательно сбросить SW/кэш:**
```js
await Promise.all((await caches.keys()).map(k => caches.delete(k)));
await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r => r.unregister()));
// + reload
```
Иначе Playwright «видит» старый бандл.

---

## 7. Подводные камни (не наступать)

1. **`dist/_redirects` перед `wrangler deploy` → CF 100324 Infinite loop.** `ship.mjs` уже удаляет.
2. **`wrangler d1 execute --command` не ест multi-statement SQL** → временный `.sql` + `--file`.
3. **Named `@param` object-bind и multi-`exec()` в D1 → 1101** — только `?1..?n`, по одному `CREATE ... IF NOT EXISTS`.
4. **Singleton store + `useMemo` ≠ live UI** — без `useStoreTick()` upload фото/настройки не видны на Home.
5. **PWA SW отдаёт старый бандл после deploy** (см. §6).
6. **Commit ≠ deploy** — live может отставать от git; сверять бандл (`check_live.py`).
7. **`.booking-card` режет текст** (`overflow:hidden` + radius без padding) → контент в `.ocean-content`. Playwright `full_page:true` фейкит sticky `.topbar`.
8. **Календарь**: дни по `getDate()` в Monday-first pad от 1-го; последовательный append после pad месяца съезжает.
9. **Smoke 1×1 PNG** может остаться в `studio.photos`/KV `media:` — чистить после смоуков.
10. **`create-vite` в непустой каталог отменяется** (из-за `.mimocode`).
11. **Git PAT leak**: глобальный `.gitconfig` `url.*.insteadof` содержит ghp_ токен — пользователь предупреждён (rotate). Config агентом **не** править.
12. **2GIS bulk parse — captcha** (`2gis.by` с датацентр/BY IP). Лиды собирать через Яндекс/av.by/taplink/gorodwiki. Адаптер: `parse_by_detailing.py`.
13. **Task tool DB нестабилен** — задачи теряются; чек-лист держать в checkpoint / этом файле.
14. **README.md — стоковый Vite**; реальное знание — здесь и в `DEPLOY.md` + `src/`.
15. **`seed-*` исчезают после D1 sync** — не полагаться на них в smoke.
16. **`127.0.0.1:4173` refused** — preview слушает IPv6 `localhost`.
17. **D1 `database_id` важнее `database_name`.** `prepare-client.mjs` обязан писать оба поля из `clients/<slug>/client.json` (`databaseName` + `databaseId`). Иначе все клиенты цепляются к uuid первого клиента и шарят `owners`/`bookings` — чужие пароли логинят (было: hvv→sgx). `ship.mjs` создаёт D1 при `REPLACE_BY_SHIP` и сохраняет uuid в `client.json`. Login/`requireAuth` дополнительно сверяют `studio_id` с `env.STUDIO_ID`. Smoke: `check_auth_isolation.py`.

---

## 8. Безопасность

- Секреты/tokens/скрины с ключами **НЕ коммитить**. MiMo/VAPID — только `.env` (gitignored) + `wrangler secret`.
- Пароли владельцев выдаём пользователю **в чат**; в git/source не класть.
- `npm run ship` сам докладывает недостающие secrets (`MIMO_API_KEY`, `VAPID_*`).
- Публично только то, что нужно клиенту записи; мутации админки — за Bearer.

---

## 9. Sales / leads (контекст продукта)

- Целевой сегмент: **детейлинг-студии Беларуси без сайта и без Yclients** (телефон/IG/taplink/av.by).
- Файлы: `leads/by-detailing-nosite.{md,csv}` (приоритет), `leads/by-detailing-30.{md,csv,json}`, `leads/outreach-andrey-2026-10-07.md` (30 сообщений «от Андрея»).
- GTM: **не** 20 демо/день. Telegram ~10–15 новых диалогов/день на свежем аккаунте, **без ссылок и без демо** в первом сообщении, opt-out «напишите нет»; демо 3–5/нед **по ответу**; один фолоап через 3–4 дня.
- Viber личным cold = бан. 2GIS bulk = captcha.

---

## 10. Что сделано / что не закоммичено / next

### Готово и задеплоено (hvv + sgx)
- UI 1:1 graphite + PWA install-flow
- Календарь 60 дней, слоты по `workHours`, D1-записи + 409 на конфликт
- AI-запись (MiMo + ACTION), Web Push + cron
- Кабинет: план дня, фильтры, форма записи, `tel:`, удаление, фото в KV, профиль в D1
- Owner-auth в D1 (PBKDF2) + KV-сессии
- Mobile polish
- **SGX локализован под РБ** (Br, Минск ул. Калиновского 12, +375 29 123-45-67, 09:00–20:00, мойка 45 / химчистка от 250 / полировка от 300 / керамика от 550) — smoke 22 API + 10 UI

### Git
HEAD `c969ad6`. Вся white-label/AI/push/D1/owner/QA/leads-волна **uncommitted**.  
**Не делать `git push` без явной просьбы пользователя.** Секреты в коммит не тащить.

### Ближайшие возможные шаги
1. Закоммитить волны (по согласованию)
2. Свой домен — после первого платящего клиента
3. Миграция медиа на R2, если включат
4. Продолжить outreach по `outreach-andrey-2026-10-07.md`
5. Персональные демо по ответам (`new-client` + `ship` за день)

---

## 11. Куда смотреть в коде

```
src/
  App.tsx                 — роуты
  data/store.ts           — singleton store, D1 sync, markMyBooking, updateStudio
  data/defaults.ts        — DEFAULT_STUDIO из client-data
  data/client-data.ts     — AUTO-GENERATED (prepare-client), не редактировать руками
  lib/{money,auth,bookingsApi,mediaApi,studioApi,reminders,useStoreTick}.ts
  pages/*                 — Home, Services, BookingPage, MyBookings, Assistant, Install, Owner*
  index.css               — graphite tokens + mobile polish
worker/
  index.js                — fetch-роутинг + scheduled push
  chat.js | bookings.js | media.js | studio.js | auth.js
scripts/
  prepare-client.mjs | ship.mjs | new-client.mjs | seed-owner.mjs
clients/<slug>/{client.json, assets/}
public/sw-push.js         — Web Push в SW
DEPLOY.md                 — deploy/domains (общий шаблон)
```

Готово к подхвату. Вопросы по продукту/данным клиентов — к пользователю (переписка и пароли только в чате).
