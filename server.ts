// Bun Telegram Bot + Admin Dashboard (Menu with 5 main buttons and sub-buttons)
// - Admin UI at GET /?pass=admin123
// - Telegram webhook at POST /webhook/:token
// - Any button click (main or sub) sends default image + caption (editable) unless a sub-button overrides
// - Data stored in memory (NodeCache) and persisted to ./menu-config.json when updated

import { serve } from "bun"
import NodeCache from "node-cache"
import { file } from "bun"

// ----------------------------- Types -----------------------------
interface TelegramUpdate {
  update_id?: number
  message?: any
  edited_message?: any
  callback_query?: {
    id: string
    from: any
    message?: any
    data?: string
  }
  channel_post?: any
  edited_channel_post?: any
  my_chat_member?: any
  chat_member?: any
  chat_join_request?: any
}

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
  mainButtons: MainButton[] // exactly 5 items
}

// ----------------------------- State -----------------------------
const cache = new NodeCache()
const MENU_FILE = "menu-config.json"

function isValidTelegramBotToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token)
}

function loadMenuConfig(): MenuConfig {
  try {
    const filePromise = file(MENU_FILE)
    filePromise.then(async (file) => {
      if (file) {
        const text = await file.text()
        const parsed = JSON.parse(text)
        if (parsed?.defaultImageUrl && parsed?.defaultCaption && Array.isArray(parsed?.mainButtons)) {
          cache.set("menuConfig", parsed as MenuConfig)
        }
      }
    })
  } catch (_) {}
  // Defaults: prefill with your requested image + caption
  const defaults: MenuConfig = {
    defaultImageUrl: "https://i.ibb.co/pvpn8kDc/x.jpg",
    defaultCaption: "send payment and send ss",
    mainButtons: Array.from({ length: 5 }).map((_, i) => ({
      label: `Option ${i + 1}`,
      message: `You selected Option ${i + 1}`,
      subButtons: [{ label: "Sub 1" }, { label: "Sub 2" }],
    })),
  }
  return defaults
}

async function persistMenuConfig(cfg: MenuConfig) {
  try {
    await Bun.write(MENU_FILE, JSON.stringify(cfg, null, 2))
    appendLog("💾 Menu configuration persisted to disk.")
  } catch (err) {
    appendLog(`❌ Failed to persist menu config: ${err}`)
  }
}

cache.set("menuConfig", loadMenuConfig())

// Basic metrics/logs borrowed from the style of your reference file
function appendLog(line: string) {
  let log = (cache.get("log_bar") as string) || ""
  const timestamp = new Date().toISOString()
  const newLine = `${timestamp} | ${line}\n`
  log += newLine
  // Trim to 100KB
  if (log.length > 102400) {
    const targetSize = 81920
    log = log.slice(-targetSize)
    const firstNewline = log.indexOf("\n")
    if (firstNewline !== -1) log = log.slice(firstNewline + 1)
    log = `${timestamp} | [LOG TRIMMED - Keeping last 80KB]\n` + log
  }
  cache.set("log_bar", log)
}
function clearLogs() {
  cache.set("log_bar", "")
  appendLog("Logs cleared manually")
}
function getLogStats() {
  const log = (cache.get("log_bar") as string) || ""
  const lines = log.split("\n").filter((l) => l.trim())
  return { size: log.length, lines: lines.length, sizeKB: Math.round((log.length / 1024) * 100) / 100 }
}

// ----------------------------- Telegram helpers -----------------------------
async function tgSendMessage(botToken: string, chatId: number | string, text: string, replyMarkup?: any) {
  return fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  })
}

async function tgSendPhoto(
  botToken: string,
  chatId: number | string,
  photo: string,
  caption: string,
  replyMarkup?: any,
) {
  return fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo,
      caption,
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    }),
  })
}

async function tgAnswerCallback(botToken: string, callbackId: string, text?: string) {
  return fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  })
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Build main menu inline keyboard of exactly 5 buttons
function buildMainMenuKeyboard(cfg: MenuConfig) {
  const buttons = cfg.mainButtons.map((mb, idx) => ({
    text: mb.label || `Option ${idx + 1}`,
    callback_data: `main:${idx}`,
  }))
  const rows = chunk(buttons, 2) // 2 per row looks neat
  return { inline_keyboard: rows }
}

// Build sub menu for a given main index
function buildSubMenuKeyboard(cfg: MenuConfig, mainIdx: number) {
  const main = cfg.mainButtons[mainIdx]
  if (!main) return { inline_keyboard: [] }
  const subBtns = (main.subButtons || []).map((sb, j) => ({
    text: sb.label || `Sub ${j + 1}`,
    callback_data: `sub:${mainIdx}:${j}`,
  }))
  const rows = chunk(subBtns, 2)
  return { inline_keyboard: rows }
}

// Send main menu
async function sendMainMenu(botToken: string, chatId: number | string) {
  const cfg = cache.get("menuConfig") as MenuConfig
  const keyboard = buildMainMenuKeyboard(cfg)
  await tgSendMessage(botToken, chatId, "Please choose an option:", keyboard)
}

// ----------------------------- Server -----------------------------
serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method
    const pass = url.searchParams.get("pass")

    // Admin UI (GET / with ?pass=admin123)
    if (method === "GET" && path === "/") {
      if (pass !== "admin123") {
        return new Response(
          `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            body { background:#0f0f0f; color:white; font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; }
            .login { background:#1a1a1a; padding:24px; border-radius:10px; width:320px; box-shadow:0 8px 30px rgba(0,0,0,0.4); }
            h2 { margin:0 0 16px; color:#f97316; text-align:center; }
            input, button { width:100%; padding:12px; border-radius:8px; border:1px solid #333; background:#2a2a2a; color:white; margin-top:10px; }
            button { background:#f97316; border:none; font-weight:600; cursor:pointer; }
            button:hover { background:#ea580c; }
          </style></head><body>
            <form class="login">
              <h2>🔐 Admin Login</h2>
              <input type="password" name="pass" placeholder="Enter admin password" required />
              <button type="submit">Login</button>
            </form>
          </body></html>`,
          { headers: { "Content-Type": "text/html" } },
        )
      }

      // Clean token_responses with invalid tokens (parity with reference style)
      const tokenResponsesRaw = cache.get("token_responses") as string | undefined
      const tokenResponses = tokenResponsesRaw ? JSON.parse(tokenResponsesRaw) : {}
      let changed = false
      for (const token in tokenResponses) {
        if (!isValidTelegramBotToken(token)) {
          delete tokenResponses[token]
          changed = true
        }
      }
      if (changed) cache.set("token_responses", JSON.stringify(tokenResponses))

      const stats = {
        total: cache.get("total_messages") || 0,
        users: Array.from(new Set((cache.get("users") || []) as string[])),
        bots: Array.from(new Set((cache.get("bots") || []) as string[])),
        logBar: (cache.get("log_bar") as string) || "",
        logStats: getLogStats(),
        cfg: cache.get("menuConfig") as MenuConfig,
      }

      const sortedTokens = Object.entries(tokenResponses)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 100)
      const maxCount = Math.max(...sortedTokens.map(([, count]) => count as number), 1)

      const tokenBar = sortedTokens
        .map(([token, count]) => {
          const widthPercent = ((count as number) / maxCount) * 100
          const shortToken = `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
          return `
            <div style="margin:12px 0; padding: 12px; background:#1a1a1a; border-radius: 8px; border: 1px solid #333;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div style="font-family:monospace; color:#f97316; font-weight:600;">Token: ${shortToken}</div>
              </div>
              <div style="background:#333; width:100%; height:20px; border-radius:10px; overflow:hidden; margin:8px 0;">
                <div style="background:linear-gradient(90deg,#f97316,#fb923c); width:${widthPercent}%; height:100%;"></div>
              </div>
              <div style="color:#ccc; font-size: 14px;">
                <span>Responses: <b style="color:#f97316;">${count}</b></span>
                <span style="margin-left:20px;">Webhook: <code>/webhook/${token}</code></span>
              </div>
            </div>
          `
        })
        .join("")

      // Admin form
      const cfg = stats.cfg
      const mainForms = cfg.mainButtons
        .map((mb, i) => {
          const sbJson = JSON.stringify(mb.subButtons || [], null, 2)
          return `
            <div style="background:#111; border:1px solid #333; border-radius:10px; padding:16px; margin-top:16px;">
              <h4 style="margin:0 0 12px; color:#f97316;">Main Button ${i + 1}</h4>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                <div>
                  <label>Label</label>
                  <input name="main_label_${i}" value="${escapeHtml(mb.label || "")}" />
                </div>
                <div>
                  <label>Message (sent after click)</label>
                  <input name="main_message_${i}" value="${escapeHtml(mb.message || "")}" />
                </div>
              </div>
              <div style="margin-top:12px;">
                <label>Sub Buttons JSON (array of { "label": string, "imageUrl"?: string, "caption"?: string })</label>
                <textarea name="sb_${i}" rows="6" style="width:100%; font-family:monospace;">${escapeHtml(sbJson)}</textarea>
              </div>
            </div>
          `
        })
        .join("")

      return new Response(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
          body { background:#0f0f0f; color:white; font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding:24px; line-height:1.6; }
          h1,h2,h3 { color:#f97316; }
          input, textarea, button { width:100%; padding:10px; border-radius:8px; border:1px solid #333; background:#1f1f1f; color:white; }
          textarea { resize:vertical; }
          button { background:#f97316; border:none; font-weight:600; cursor:pointer; }
          button:hover { background:#ea580c; }
          .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px; }
          .card { background:#1a1a1a; border:1px solid #333; border-radius:10px; padding:16px; }
          .log { background:#131313; border:1px solid #333; border-radius:10px; padding:12px; max-height:380px; overflow:auto; }
          label { display:block; margin:8px 0 6px; color:#bbb; font-size:14px; }
        </style></head><body>
          <h1>🤖 Telegram Menu Bot Dashboard</h1>

          <div class="grid">
            <div class="card">
              <h3>📈 Stats</h3>
              <div>Total Messages: <b>${stats.total}</b></div>
              <div>Unique Users: <b>${stats.users.length}</b></div>
              <div>Active Bots: <b>${stats.bots.length}</b></div>
              <div>Log Size: <b>${stats.logStats.sizeKB} KB</b> (${stats.logStats.lines} lines)</div>
              <form method="POST" action="/clear-logs?pass=admin123" style="margin-top:12px;">
                <button type="submit">🧹 Clear Logs</button>
              </form>
            </div>

            <div class="card">
              <h3>⚙️ Webhook Tokens (Top 100)</h3>
              ${tokenBar || '<div style="color:#888;">No tokens yet.</div>'}
            </div>
          </div>

          <div class="card" style="margin-top:16px;">
            <h3>🧩 Menu Configuration</h3>
            <form method="POST" action="/update-menu?pass=admin123">
              <div class="grid">
                <div>
                  <label>Default Image URL (sent on any click unless overridden)</label>
                  <input name="defaultImageUrl" value="${escapeHtml(cfg.defaultImageUrl)}" />
                </div>
                <div>
                  <label>Default Caption</label>
                  <input name="defaultCaption" value="${escapeHtml(cfg.defaultCaption)}" />
                </div>
              </div>
              ${mainForms}
              <div style="margin-top:16px;">
                <button type="submit">💾 Save Menu</button>
              </div>
            </form>
          </div>

          <div class="card" style="margin-top:16px;">
            <h3>📜 System Logs</h3>
            <div class="log">${escapeHtml(stats.logBar).replace(/\\n/g, "<br>") || '<em style="color:#666;">No logs yet…</em>'}</div>
          </div>
        </body></html>`,
        { headers: { "Content-Type": "text/html" } },
      )
    }

    // Save menu config
    if (method === "POST" && path === "/update-menu" && pass === "admin123") {
      try {
        const form = await req.formData()
        const cfg = cache.get("menuConfig") as MenuConfig
        const next: MenuConfig = {
          defaultImageUrl: (form.get("defaultImageUrl")?.toString() || cfg.defaultImageUrl).trim(),
          defaultCaption: (form.get("defaultCaption")?.toString() || cfg.defaultCaption).trim(),
          mainButtons: Array.from({ length: 5 }).map((_, i) => {
            const label = form.get(`main_label_${i}`)?.toString()?.trim() || `Option ${i + 1}`
            const message = form.get(`main_message_${i}`)?.toString()?.trim() || ""
            const sbRaw = form.get(`sb_${i}`)?.toString() || "[]"
            let subButtons: SubButton[] = []
            try {
              const parsed = JSON.parse(sbRaw)
              if (Array.isArray(parsed)) {
                subButtons = parsed
                  .filter((x) => x && typeof x === "object" && typeof x.label === "string")
                  .map((x) => ({
                    label: String(x.label),
                    imageUrl: x.imageUrl ? String(x.imageUrl) : undefined,
                    caption: x.caption ? String(x.caption) : undefined,
                  }))
              } else {
                throw new Error("Sub buttons must be an array")
              }
            } catch (e) {
              appendLog(`❌ Invalid sub buttons JSON for main ${i + 1}: ${e}`)
              // keep previous if invalid
              subButtons = cfg.mainButtons[i]?.subButtons || []
            }
            return { label, message, subButtons }
          }),
        }
        cache.set("menuConfig", next)
        await persistMenuConfig(next)
        appendLog("✅ Menu updated via admin")
        return new Response(`<script>alert('✅ Menu saved');location.href='/?pass=admin123'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      } catch (err) {
        appendLog(`❌ Error updating menu: ${err}`)
        return new Response(`<script>alert('❌ Failed to save');location.href='/?pass=admin123'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }
    }

    // Clear logs
    if (method === "POST" && path === "/clear-logs" && pass === "admin123") {
      clearLogs()
      return new Response(`<script>alert('📜 Logs cleared');location.href='/?pass=admin123'</script>`, {
        headers: { "Content-Type": "text/html" },
      })
    }

    // Telegram webhook
    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "")
      if (!isValidTelegramBotToken(botToken)) {
        appendLog(`❌ Invalid token format: ${botToken.substring(0, 12)}...`)
        return new Response("Bad token", { status: 400 })
      }

      try {
        const update: TelegramUpdate = await req.json()

        // Track bot & token counts
        const bots = (cache.get("bots") || []) as string[]
        cache.set("bots", Array.from(new Set([...bots, botToken])))
        const tokenResponsesRaw = (cache.get("token_responses") as string) || "{}"
        const tokenResponses = JSON.parse(tokenResponsesRaw)
        tokenResponses[botToken] = (tokenResponses[botToken] || 0) + 1
        cache.set("token_responses", JSON.stringify(tokenResponses))
        const total = (cache.get("total_messages") as number) || 0
        cache.set("total_messages", total + 1)

        // Determine chat and user
        let chatId: number | string | undefined
        let fromId: string | undefined
        if (update.message?.chat?.id) chatId = update.message.chat.id
        if (!chatId && update.callback_query?.message?.chat?.id) chatId = update.callback_query.message.chat.id
        if (update.message?.from?.id) fromId = String(update.message.from.id)
        if (!fromId && update.callback_query?.from?.id) fromId = String(update.callback_query.from.id)
        if (fromId) {
          const users = (cache.get("users") || []) as string[]
          cache.set("users", Array.from(new Set([...users, fromId])))
        }

        const shortToken = `${botToken.substring(0, 8)}...${botToken.substring(botToken.length - 6)}`
        appendLog(`📨 Webhook ${shortToken} | Count: ${tokenResponses[botToken]}`)

        const cfg = cache.get("menuConfig") as MenuConfig

        // Handle commands/messages
        if (update.message && chatId) {
          const text: string = update.message.text || ""
          if (/^\/start\b/i.test(text) || /\bmenu\b/i.test(text)) {
            await sendMainMenu(botToken, chatId)
            return new Response("OK")
          }
          // Optional: respond to any other text with menu
          // await sendMainMenu(botToken, chatId)
          // return new Response("OK")
        }

        // Handle button clicks (callback_query)
        if (update.callback_query && chatId) {
          const cbId = update.callback_query.id
          const data = update.callback_query.data || ""

          // main button click: send default photo+caption, optional message, then show sub menu
          if (data.startsWith("main:")) {
            const idx = Number(data.split(":")[1] || "-1")
            const main = cfg.mainButtons[idx]
            if (main) {
              // Always send the default image+caption on click
              await tgSendPhoto(botToken, chatId, cfg.defaultImageUrl, cfg.defaultCaption)
              if (main.message) {
                await tgSendMessage(botToken, chatId, main.message)
              }
              // Then show sub buttons (if any)
              const subKb = buildSubMenuKeyboard(cfg, idx)
              if (subKb.inline_keyboard.length) {
                await tgSendMessage(botToken, chatId, "Choose an option:", subKb)
              }
              await tgAnswerCallback(botToken, cbId)
              return new Response("OK")
            }
          }

          // sub button click: use override image/caption if present, else default
          if (data.startsWith("sub:")) {
            const [_, mi, sj] = data.split(":")
            const mIdx = Number(mi),
              sIdx = Number(sj)
            const main = cfg.mainButtons[mIdx]
            const sub = main?.subButtons?.[sIdx]
            const photo = sub?.imageUrl || cfg.defaultImageUrl
            const caption = sub?.caption || cfg.defaultCaption
            await tgSendPhoto(botToken, chatId, photo, caption)
            await tgAnswerCallback(botToken, cbId)
            return new Response("OK")
          }

          // Unknown callback: just answer
          await tgAnswerCallback(botToken, cbId)
          return new Response("OK")
        }

        return new Response("OK")
      } catch (err) {
        appendLog(`❌ Webhook error: ${err}`)
        return new Response("Error", { status: 500 })
      }
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.log("✅ Telegram Menu Bot running on http://localhost:3000")
console.log("🔐 Admin UI: /?pass=admin123")
console.log("📩 Set webhook to: POST /webhook/{BOT_TOKEN}")

// ----------------------------- Utils -----------------------------
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      case "'":
        return "&#039;"
      default:
        return c
    }
  })
}
