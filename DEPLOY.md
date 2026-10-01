# Деплой бесплатно — инструкция на все проекты

Один и тот же маршрут для лендингов, SPA и Next.js.  
Хостинг: **Cloudflare Pages** (основной) или **Vercel** (запасной).  
Домен: бесплатно `*.pages.dev` / `*.is-a.dev` / `*.eu.org`, платно `.com` / `.by`.

---

## 0. Быстрый чек-лист (5 минут)

1. Проект собирается локально: `npm run build` → папка `dist/`
2. В корне есть SPA-фоллбэк (если есть роутер):
   - `public/_redirects` → `/*    /index.html   200`
   - или `vercel.json` → `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]`
3. GitHub: `git init` → `git add .` → `git commit` → `git remote add origin ...` → `git push -u origin main`
4. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
5. Build settings:
   - Framework: `Vite` / `React` / `Next.js` / `None`
   - Build command: `npm run build` (для статики из HTML — пусто)
   - Build output: `dist` (Next.js — `.next` / `out`, статика — `.` или `public`)
6. Deploy → получить `https://<имя>.pages.dev`
7. (Опц.) Custom domain → добавить в проект → DNS у регистратора

**Правило:** если `npm run build` локально зелёный — деплой почти наверняка пройдёт.

---

## 1. Cloudflare Pages (рекомендуется)

### Почему
- Трафик **безлимитный** на free
- SSL бесплатно
- Сколько угодно проектов с одного аккаунта
- Свой домен подключается бесплатно
- Git-деплой + drag-and-drop архива

### Подключение из GitHub
1. https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Выбрать repo, ветка `main`
3. Настройки сборки:

| Тип проекта | Build command | Output directory |
|---|---|---|
| Vite / React / Vue / Svelte | `npm run build` | `dist` |
| Next.js (static export) | `npm run build` | `out` |
| Next.js (SSR) | `npm run build` | — (нужен Vercel/Render, не Pages) |
| Чистый HTML-лендинг | — | корень проекта |
| Astro | `npm run build` | `dist` |

4. **Save and Deploy**
5. Через 1–2 минуты сайт на `https://<project>.pages.dev`

### Без GitHub (быстро для демо)
1. Локально: `npm run build`
2. Cloudflare Pages → **Create** → **Upload assets**
3. Перетащить папку `dist`
4. Готово (без автодеплоя)

### SPA-роутинг (если есть react-router / vue-router)
В `public/_redirects` (попадёт в `dist`):
```
/*    /index.html   200
```
Иначе обновление `/owner/dashboard` на сервере даст 404.

---

## 2. Vercel (запасной / Next.js)

1. https://vercel.com → **Add New** → **Project** → импорт из GitHub
2. Framework preset: Vite / Next.js — обычно угадывает сам
3. Build: `npm run build`, Output: `dist`
4. Deploy → `https://<project>.vercel.app`
5. SPA уже покрыто `vercel.json` в корне (в этом проекте)

CLI-вариант:
```bash
npm i -g vercel
vercel          # превью
vercel --prod   # прод
```

---

## 3. Домены

### Бесплатно навсегда
| Что даёт | Вид | Как получить |
|---|---|---|
| Cloudflare Pages | `имя.pages.dev` | сразу при деплое |
| Vercel | `имя.vercel.app` | сразу при деплое |
| Netlify | `имя.netlify.app` | сразу при деплое |
| **is-a.dev** | `имя.is-a.dev` | PR в github.com/is-a-dev/register |
| **eu.org** | `имя.eu.org` | заявка на nic.eu.org (1–2 дня) |
| js.org | `имя.js.org` | только JS/opensource проекты |

`pages.dev` достаточно для демо клиенту.  
`is-a.dev` / `eu.org` — если хочется «не xxx.pages.dev».

### Платно (для реального клиента)
| Домен | Цена/год | Где купить |
|---|---|---|
| `.com` / `.net` / `.org` | ~$10–12 | Porkbun, Cloudflare Registrar, Namecheap |
| `.by` | ~20–40 BYN | domain.by, hoster.by |

Подключить свой домен к Pages — **бесплатно**:
1. Pages → проект → **Custom domains** → **Set up a custom domain**
2. У регистратора: CNAME `www` → `<project>.pages.dev`, APEX → IP из инструкции Cloudflare
3. SSL выпускается автоматически

**Не брать:** Freenom (`.tk`, `.ml`) — ненадёжно; «free .com forever» на странных хостингах — капкан.

---

## 4. Повторяемый шаблон нового проекта

```text
1. Создать проект, добить до npm run build (или положить index.html)
2. Добавить public/_redirects  (если SPA)
3. git init && git add . && git commit -m "init"
4. Создать private repo на GitHub, запушить
5. Cloudflare Pages → Connect to Git → build → deploy
6. Проверить: открыть pages.dev на телефоне и ПК
7. Клиенту: ссылка + (опц.) свой домен
```

Для **множества студий/брендов** на одном деплое — query-параметр:
`https://app.pages.dev/?studio=slug`  
(в detailing-mvp так сделана изоляция данных студии)

---

## 5. Чек-лист перед показом клиенту

- [ ] `npm run build` без ошибок
- [ ] HTTPS открывается (автоматически на Pages/Vercel)
- [ ] Роуты работают при прямом открытии ссылок (`/services`, `/my` …)
- [ ] Телефон + ПК
- [ ] PWA: «Добавить на экран» / install prompt (если PWA)
- [ ] Нет секретов/токенов в JS (всё через env на сервере)
- [ ] Контакты, цены, название — данные клиента (не placeholder)

---

## 6. Ограничения free-тир (честно)

| | Cloudflare Pages | Vercel Hobby |
|---|---|---|
| Трафик | безлимит | 100 ГБ/мес |
| Сборки | 500 min/мес | ~6000 min/мес |
| Деплоев | разумно хватает | 100/день |
| SSR / серверный код | Workers (отдельно) | есть free-лимиты |
| Для лендингов/SPA | **хватит навсегда** | хватит навсегда |

Если проект растёт в SaaS с базой — free backend: **Supabase** (Postgres + Auth) или **Cloudflare D1 + Workers**.

---

## 7. Этот проект (detailing-mvp)

```bash
npm install
npm run dev       # разработка
npm run build     # dist/
npm run preview   # локальный просмотр dist
```

- Build output: `dist`
- SPA rewrite: `public/_redirects` + `vercel.json`
- Мультистудия: `/?studio=имя-студии`
- Владелец (демо): `owner@studio.local` / `owner123`

Deploy на Pages: build `npm run build`, output `dist`.
