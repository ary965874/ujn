import { Bun } from "bun"

type SubButton = {
  label: string
  imageUrl?: string
  caption?: string
}

type MainButton = {
  label: string
  message?: string
  subButtons: SubButton[]
}

type MenuConfig = {
  defaultImageUrl: string
  defaultCaption: string
  mainButtons: MainButton[]
}

const DEFAULT_IMAGE = "https://i.ibb.co/pvpn8kDc/x.jpg"
const DEFAULT_CAPTION = "send payment and send ss"

const CONFIG_FILE = "menu-config.json"

// Environment
const BOT_TOKEN = Bun.env.BOT_TOKEN || ""
const ADMIN_PASS = Bun.env.ADMIN_PASS || "admin123"

if (!BOT_TOKEN) {
  console.warn("[v0] Missing BOT_TOKEN env var. The webhook route will return 403 until set.")
}

// Load/save config with persistence
let config: MenuConfig = {
  defaultImageUrl: DEFAULT_IMAGE,
  defaultCaption: DEFAULT_CAPTION,
  mainButtons: Array.from({ length: 5 }).map((_, i) => ({
    label: `Button ${i + 1}`,
    message: `This is message ${i + 1}`,
    subButtons: [{ label: "Option A" }, { label: "Option B" }],
  })),
}

async function loadConfig() {
  try {
    const file = Bun.file(CONFIG_FILE)
    if (await file.exists()) {
      const text = await file.text()
      const parsed = JSON.parse(text)
      // Basic shape check
      if (parsed && Array.isArray(parsed.mainButtons)) {
        config = parsed
        console.log("[v0] Loaded config from disk.")
      }
    }
  } catch (e) {
    console.warn("[v0] Failed to load config:", e)
  }
}

async function saveConfig() {
  try {
    await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2))
    console.log("[v0] Saved config to disk.")
  } catch (e) {
    console.error("[v0] Failed to save config:", e)
  }
}

await loadConfig()

// Telegram helpers
async function tg<T = any>(token: string, method: string, body: Record<string, any>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) {
    console.error("[v0] Telegram API error:", json)
  }
  return json
}

function mainKeyboard() {
  // Inline keyboard with 5 main buttons
  return {
    inline_keyboard: [
      [{ text: config.mainButtons[0]?.label || "Button 1", callback_data: "main:0" }],
      [{ text: config.mainButtons[1]?.label || "Button 2", callback_data: "main:1" }],
      [{ text: config.mainButtons[2]?.label || "Button 3", callback_data: "main:2" }],
      [{ text: config.mainButtons[3]?.label || "Button 4", callback_data: "main:3" }],
      [{ text: config.mainButtons[4]?.label || "Button 5", callback_data: "main:4" }],
    ],
  }
}

function subKeyboard(mainIndex: number) {
  const mb = config.mainButtons[mainIndex]
  if (!mb || !mb.subButtons?.length) return undefined
  const rows = mb.subButtons.map((sb, j) => [
    { text: sb.label || `Sub ${j + 1}`, callback_data: `sub:${mainIndex}:${j}` },
  ])
  return { inline_keyboard: rows }
}

async function sendMenu(token: string, chat_id: number, text = "Choose an option:") {
  return tg(token, "sendMessage", {
    chat_id,
    text,
    reply_markup: mainKeyboard(),
  })
}

async function sendSubMenu(token: string, chat_id: number, mainIndex: number) {
  const kb = subKeyboard(mainIndex)
  if (!kb) {
    return tg(token, "sendMessage", { chat_id, text: "No options available." })
  }
  return tg(token, "sendMessage", {
    chat_id,
    text: "Choose a sub-option:",
    reply_markup: kb,
  })
}

async function sendPhotoWithDefaults(token: string, chat_id: number, imageUrl?: string, caption?: string) {
  const photo = imageUrl || config.defaultImageUrl || DEFAULT_IMAGE
  const cap = caption ?? config.defaultCaption ?? DEFAULT_CAPTION
  return tg(token, "sendPhoto", { chat_id, photo, caption: cap })
}

// Admin HTML
function adminHtml(pass: string) {
  // Simple vanilla JS UI to load/edit/save config
  return /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Menu Admin</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, Helvetica, Apple Color Emoji, Segoe UI Emoji; margin: 16px; color: #111; }
    .wrap { max-width: 900px; margin: 0 auto; }
    h1, h2 { margin: 0 0 12px; }
    .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    label { display: block; font-size: 14px; margin-bottom: 6px; color: #374151; }
    input, textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 6px; padding: 8px; font-size: 14px; }
    .row { display: flex; gap: 12px; }
    .col { flex: 1; }
    button { background: #111827; color: #fff; border: 0; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
    .btn-secondary { background: #4b5563; }
    .btn-danger { background: #b91c1c; }
    .mb-2 { margin-bottom: 8px; }
    .mb-4 { margin-bottom: 16px; }
    .mt-2 { margin-top: 8px; }
    .mt-4 { margin-top: 16px; }
    small { color: #6b7280; }
    .grid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
    @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } .row { flex-direction: column; } }
    code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Edit Menu</h1>
    <p class="mb-4">Password provided via <code>?pass=...</code>. Defaults prefilled to send image with caption "send payment and send ss" on any button click.</p>

    <div class="card">
      <h2>Defaults</h2>
      <div class="grid">
        <div>
          <label>Default Image URL</label>
          <input id="defaultImageUrl" placeholder="https://..." />
          <small>Used for main clicks and any sub-button without its own image.</small>
        </div>
        <div>
          <label>Default Caption</label>
          <input id="defaultCaption" placeholder="Caption" />
          <small>Used for main clicks and any sub-button without its own caption.</small>
        </div>
      </div>
    </div>

    <div id="mains"></div>

    <div class="row mt-4">
      <button id="save">Save</button>
      <button id="reload" class="btn-secondary">Reload</button>
    </div>
  </div>

  <template id="main-template">
    <div class="card">
      <h2>Main Button</h2>
      <div class="grid mb-4">
        <div>
          <label>Label</label>
          <input data-field="label" />
          <small>Shown on the main menu as the button text.</small>
        </div>
        <div>
          <label>Message (optional)</label>
          <input data-field="message" placeholder="Sent after photo on main click" />
        </div>
      </div>
      <div data-subwrap></div>
      <button data-add-sub class="mt-2">+ Add Sub-button</button>
    </div>
  </template>

  <template id="sub-template">
    <div class="card">
      <h3>Sub-button</h3>
      <div class="grid">
        <div>
          <label>Label</label>
          <input data-field="label" />
        </div>
        <div>
          <label>Image URL (optional)</label>
          <input data-field="imageUrl" placeholder="https://..." />
        </div>
      </div>
      <div class="mt-2">
        <label>Caption (optional)</label>
        <input data-field="caption" placeholder="Overrides default caption" />
      </div>
      <div class="mt-2">
        <button data-remove-sub class="btn-danger">Remove</button>
      </div>
    </div>
  </template>

  <script>
    const pass = ${JSON.stringify(pass)}
    let state = null

    function qs(sel, el = document) { return el.querySelector(sel) }
    function qsa(sel, el = document) { return Array.from(el.querySelectorAll(sel)) }

    async function load() {
      const res = await fetch('/api/config?pass=' + encodeURIComponent(pass))
      if (!res.ok) {
        alert('Failed to load config. Check ?pass=...')
        return
      }
      state = await res.json()
      render()
    }

    function render() {
      qs('#defaultImageUrl').value = state.defaultImageUrl || ''
      qs('#defaultCaption').value = state.defaultCaption || ''

      const wrap = qs('#mains')
      wrap.innerHTML = ''
      for (let i = 0; i < 5; i++) {
        const main = state.mainButtons[i] || { label: 'Button ' + (i+1), message: '', subButtons: [] }
        const t = document.importNode(qs('#main-template').content, true)
        const root = t.firstElementChild
        const inputs = qsa('[data-field]', root)
        for (const inp of inputs) {
          const field = inp.getAttribute('data-field')
          inp.value = main[field] || ''
          inp.addEventListener('input', () => {
            main[field] = inp.value
          })
        }

        const subwrap = qs('[data-subwrap]', root)
        function addSub(sub) {
          const st = document.importNode(qs('#sub-template').content, true)
          const sroot = st.firstElementChild
          const sinputs = qsa('[data-field]', sroot)
          for (const inp of sinputs) {
            const field = inp.getAttribute('data-field')
            inp.value = sub[field] || ''
            inp.addEventListener('input', () => {
              sub[field] = inp.value
            })
          }
          qs('[data-remove-sub]', sroot).addEventListener('click', () => {
            const idx = main.subButtons.indexOf(sub)
            if (idx >= 0) main.subButtons.splice(idx, 1)
            sroot.remove()
          })
          subwrap.appendChild(sroot)
        }

        qs('[data-add-sub]', root).addEventListener('click', () => {
          const sub = { label: 'New Sub', imageUrl: '', caption: '' }
          main.subButtons = main.subButtons || []
          main.subButtons.push(sub)
          addSub(sub)
        })

        main.subButtons = main.subButtons || []
        for (const sb of main.subButtons) addSub(sb)

        // Ensure state array slot exists
        state.mainButtons[i] = main
        wrap.appendChild(root)
      }
    }

    async function save() {
      // Collect top-level fields
      state.defaultImageUrl = qs('#defaultImageUrl').value.trim()
      state.defaultCaption = qs('#defaultCaption').value.trim()
      const res = await fetch('/api/config?pass=' + encodeURIComponent(pass), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state)
      })
      if (!res.ok) {
        const t = await res.text()
        alert('Failed to save: ' + t)
      } else {
        alert('Saved!')
      }
    }

    qs('#save').addEventListener('click', save)
    qs('#reload').addEventListener('click', load)
    load()
  </script>
</body>
</html>`
}

// Minimal router
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const { pathname, searchParams } = url

  // Admin UI
  if (pathname === "/admin") {
    const pass = searchParams.get("pass") || ""
    if (pass !== ADMIN_PASS) return new Response("Forbidden", { status: 403 })
    return new Response(adminHtml(pass), { headers: { "Content-Type": "text/html; charset=utf-8" } })
  }

  // Config API
  if (pathname === "/api/config") {
    const pass = searchParams.get("pass") || ""
    if (pass !== ADMIN_PASS) return new Response("Forbidden", { status: 403 })
    if (req.method === "GET") {
      return Response.json(config)
    }
    if (req.method === "POST") {
      const incoming = await req.json().catch(() => null)
      if (!incoming || !Array.isArray(incoming.mainButtons)) {
        return new Response("Invalid payload", { status: 400 })
      }
      config = incoming
      await saveConfig()
      return new Response("ok")
    }
    return new Response("Method Not Allowed", { status: 405 })
  }

  // Telegram webhook: POST /webhook/:token
  if (pathname.startsWith("/webhook/")) {
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 })
    const token = decodeURIComponent(pathname.split("/").pop() || "")
    if (!token || !BOT_TOKEN || token !== BOT_TOKEN) {
      return new Response("Forbidden", { status: 403 })
    }
    let update: any = null
    try {
      update = await req.json()
    } catch (e) {
      return new Response("Bad Request", { status: 400 })
    }

    // Handle message (/start -> show menu)
    if (update.message) {
      const msg = update.message
      const chatId = msg.chat?.id
      const text = (msg.text || "").trim().toLowerCase()
      if (!chatId) return new Response("ok")

      if (text === "/start" || text === "menu" || text === "/menu") {
        await sendMenu(token, chatId, "Choose a main option:")
        return new Response("ok")
      }

      // Optional: any other text can re-show the menu
      // await sendMenu(token, chatId, "Choose a main option:")
      return new Response("ok")
    }

    // Handle callback query (inline keyboard button clicks)
    if (update.callback_query) {
      const cq = update.callback_query
      const chatId = cq.message?.chat?.id
      const data = cq.data || ""
      const cqId = cq.id
      if (cqId) {
        // Acknowledge quickly to stop loader
        await tg(token, "answerCallbackQuery", { callback_query_id: cqId })
      }
      if (!chatId) return new Response("ok")

      // Any button click must send the image+caption (defaults or overrides)
      // main:i -> send default photo+caption, then show sub-menu (and optional main message)
      // sub:i:j -> send sub override photo+caption (or defaults)
      if (data.startsWith("main:")) {
        const idx = Number.parseInt(data.split(":")[1] || "0", 10) || 0
        const mainBtn = config.mainButtons[idx]
        await sendPhotoWithDefaults(token, chatId) // global default on main click
        if (mainBtn?.message) {
          await tg(token, "sendMessage", { chat_id: chatId, text: mainBtn.message })
        }
        await sendSubMenu(token, chatId, idx)
        return new Response("ok")
      }

      if (data.startsWith("sub:")) {
        const [, iStr, jStr] = data.split(":")
        const i = Number.parseInt(iStr || "0", 10) || 0
        const j = Number.parseInt(jStr || "0", 10) || 0
        const mainBtn = config.mainButtons[i]
        const subBtn = mainBtn?.subButtons?.[j]
        const img = subBtn?.imageUrl || undefined
        const cap = subBtn?.caption ?? undefined
        await sendPhotoWithDefaults(token, chatId, img, cap)
        return new Response("ok")
      }

      // Unknown callback, still follow rule: send default image
      await sendPhotoWithDefaults(token, chatId)
      return new Response("ok")
    }

    return new Response("ok")
  }

  // Root: quick pointer
  if (pathname === "/") {
    const tip = `
      <h1>Telegram Bot + Admin (Bun)</h1>
      <p>Use <code>/admin?pass=${ADMIN_PASS}</code> to edit the menu.</p>
      <p>Set Telegram webhook to <code>/webhook/${BOT_TOKEN || "{BOT_TOKEN}"}</code>.</p>
      <p>On any button click (main or sub), the bot sends the configured image with caption.</p>
    `
    return new Response(
      `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:16px">${tip}</body>`,
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    )
  }

  return new Response("Not Found", { status: 404 })
}

Bun.serve({
  port: Bun.env.PORT ? Number(Bun.env.PORT) : 3000,
  fetch: handleRequest,
})

console.log("[v0] Bun server running on http://localhost:3000")
console.log("[v0] Admin:", `http://localhost:3000/admin?pass=${ADMIN_PASS}`)
console.log("[v0] Webhook:", `http://localhost:3000/webhook/${BOT_TOKEN || "{BOT_TOKEN}"}`)
