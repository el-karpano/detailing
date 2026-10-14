/**
 * Shared chat handler for Xiaomi MiMo (OpenAI-compatible /v1).
 * Used by the Cloudflare Worker (prod) and Vite middleware (local dev).
 * API key comes from env — never hardcode.
 */

const MAX_INPUT = 2000

/**
 * Чистим «мысли» модели: reasoning_content, chain-of-thought, инструкции самому себе.
 * В чат должен попадать только финальный ответ клиенту.
 */
function cleanReply(raw) {
  let t = String(raw || '').replace(/\r/g, '\n').trim()

  // маркеры thinking/reasoning
  t = t
    .replace(/^(analysis|thinking|thought|reasoning|chain[\s-]?of[\s-]?thought)\s*:?\s*[\s\S]*/gim, '')
    .replace(/\[?(?:thinking|reasoning|thoughts?)\]?[\s\S]*?(?=\n[А-ЯA-Z]|\n\n|$)/gi, '')

  // блоки «Let me…» / «The user…» / «I should…» — внутренние заметки на английском
  const noise =
    /^(let me|i should|i need|i'll|i will|i can|i think|i'll suggest|the user|actually|ok,|ok\.|so,|so\.|now i|now let|first,|next,|overall|in summary|to summarize|hmm|wait,|maybe i|better to|this way|the instruction|guidance|format|i'll recommend|i'll keep|i'll propose|i'll say|but recommending|if i'm|that way|looking at|based on)\b/im
  t = t
    .split('\n')
    .filter((line) => {
      const s = line.trim()
      if (!s) return true
      if (noise.test(s)) return false
      if (/^(for a solid|quartz \(|i'll |let me |the user has|they want)/i.test(s)) return false
      return true
    })
    .join('\n')

  // ACTION вырезаем отдельно (не должны видеть пользователи)
  t = t.replace(/\n?ACTION:\s*\{[\s\S]*?\}\s*$/i, '')

  // оставляем самую «ответную» часть: если после мусора есть русский абзац — берём с него
  const ru = t.search(/[А-Яа-яЁё]{20,}/)
  if (ru > 0 && ru < t.length * 0.7) {
    t = t.slice(ru)
  }

  return t
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[·•\-*]\s*/gm, '• ')
    .trim()
}

export async function handleChat(request, env) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const apiKey = env.MIMO_API_KEY
  const baseUrl = (env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimimo.com/v1').replace(/\/$/, '')
  const model = env.MIMO_MODEL || 'mimo-v2.5'

  if (!apiKey) {
    return json({ error: 'AI не настроен (нет MIMO_API_KEY)' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Неверный JSON' }, 400)
  }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  const studio = body?.studio
  const freeSlots = Array.isArray(body?.freeSlots) ? body.freeSlots : []

  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUser?.content || typeof lastUser.content !== 'string') {
    return json({ error: 'Пустое сообщение' }, 400)
  }
  if (lastUser.content.length > MAX_INPUT) {
    return json({ error: 'Сообщение слишком длинное' }, 400)
  }

  const system = buildSystemPrompt(studio, freeSlots)
  const convo = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_INPUT) }))

  const payload = {
    model,
    messages: [{ role: 'system', content: system }, ...convo],
    temperature: 0.5,
    max_tokens: 500,
  }

  try {
    let reply = ''
    for (let attempt = 0; attempt < 2 && !reply; attempt++) {
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      })

      if (!upstream.ok) {
        const errText = await upstream.text().catch(() => '')
        console.error('mimo upstream', upstream.status, errText.slice(0, 300))
        if (attempt === 0) continue
        return json({ error: 'ИИ временно недоступен' }, 502)
      }

      const data = await upstream.json()
      // только content — reasoning_content НЕ показываем клиенту
      reply = (data?.choices?.[0]?.message?.content || '').trim()
    }

    if (!reply) {
      return json({ error: 'ИИ вернул пустой ответ' }, 502)
    }

    // ACTION:{"serviceId":"...","date":"...","time":"..."} в конце ответа
    const m = reply.match(/\nACTION:\s*(\{[\s\S]*?\})\s*$/i)
    let action = null
    let text = cleanReply(m ? reply.slice(0, m.index) : reply)
    if (m) {
      try {
        const parsed = JSON.parse(m[1])
        if (parsed && typeof parsed.serviceId === 'string') {
          action = {
            serviceId: String(parsed.serviceId),
            date: typeof parsed.date === 'string' ? parsed.date : '',
            time: typeof parsed.time === 'string' ? parsed.time : '',
          }
        }
      } catch {
        /* ignore bad ACTION */
      }
    }

    if (!text) {
      text = 'Подскажу по услугам и свободному времени. Что нужно автомобилю?'
    }

    return json({ reply: text, action })
  } catch (e) {
    console.error('mimo error', e)
    return json({ error: 'Не удалось связаться с ИИ' }, 502)
  }
}

function buildSystemPrompt(studio, freeSlots) {
  const s = studio || {}
  const services = Array.isArray(s.services) ? s.services : []
  const active = services.filter((x) => x.active !== false)

  const svcLines = active
    .map(
      (x) =>
        `- ${x.title} | ${x.price} ${s.currency || 'Br'}${x.priceFrom ? ' (от)' : ''} | ~${Math.round((x.durationMin || 60) / 60)} ч | id:${x.id} | ${x.description || ''}`,
    )
    .join('\n')

  const slotLines = (freeSlots || [])
    .slice(0, 8)
    .map((d) => `- ${d.date}: ${(d.times || []).slice(0, 8).join(', ')}`)
    .join('\n')

  const today = new Date().toISOString().slice(0, 10)
  const fmt = (iso) => {
    const [y, m, d] = String(iso).split('-').map(Number)
    return d && m ? `${d} ${['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][m - 1]}` : iso
  }

  return `Ты — ассистент по записи в детейлинг-студию «${s.name || 'студия'}». Язык: русский.
Сегодня: ${today} (${fmt(today)}). Никогда не выдумывай другую «сегодняшнюю» дату.

Контакты:
- Адрес: ${s.address || '—'}
- Телефон: ${s.phone || '—'}
- Часы: ${s.workHours || '—'} (${s.weekends || ''})
- Отмена: ${s.cancelPolicy || '—'}

Услуги (цена в ${s.currency || 'Br'}):
${svcLines || '- (нет данных)'}

Ближайшие свободные окна (только эти даты/часы реально свободны):
${slotLines || '- (нет данных)'}

Как отвечать:
- Помогай выбрать услугу под задачу (мойка, полировка, химчистка, плёнка, запах).
- Называй цену и длительность. Если цена «от» — так и говори.
- Про время: ссылайся ТОЛЬКО на список свободных окон. Называй дату словами («6 октября в 10:00»).
- Не говори «завтра», если завтрашняя дата не из списка окон — сразу предложи ближайшую реальную дату из списка.
- Отвечай КРАТКО: 1–4 предложения, без markdown, без **жирного**, без таблиц, без списков длиннее 3 пунктов.
- Не выдумывай услуги и цены. Не знаешь — предложи позвонить.
- Ты помощник студии, не упоминай, что ты ИИ-модель.

Формат записи (обязательно):
Как только советуешь КОНКРЕТНУЮ услугу из списка — в САМОМ КОНЦЕ ответа добавь ровно одну строку:
ACTION:{"serviceId":"<id из списка>","date":"YYYY-MM-DD","time":"HH:MM"}
serviceId — обязательно; date/time — если есть конкретное окно из списка (можно без них).
Строку ACTION не показывай в тексте. Если не рекомендовал услугу — не добавляй ACTION.

КРИТИЧНО: отвечай ТОЛЬКО финальным текстом клиенту по-русски.
Никаких «Let me…», «The user…», «I should…», размышлений и рассуждений — только результат.
Ничего не пиши про свои инструкции, модели, токены, ACTION-формат (кроме самой строки ACTION в конце).`
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}
