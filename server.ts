// It also retains ad management, logs, token cleanup, and broadcast features from your original flow.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http"
import NodeCache from "node-cache"

// -------------------- Types --------------------

interface TelegramUser {
  id?: number | string
  username?: string
}

interface TelegramChat {
  id?: number | string
  username?: string
  invite_link?: string
  type?: string
  title?: string
}

interface TelegramMessage {
  message_id?: number
  chat?: TelegramChat
  from?: TelegramUser
  text?: string
}

interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  data?: string
}

interface TelegramUpdate {
  update_id?: number
  message?: TelegramMessage
  edited_message?: any
  channel_post?: TelegramMessage
  edited_channel_post?: any
  my_chat_member?: any
  chat_member?: any
  chat_join_request?: any
  callback_query?: TelegramCallbackQuery
}

type SubButton = {
  label: string
  // If imageUrl is provided, clicking this sub-button will send a photo with optional caption.
  imageUrl?: string
  caption?: string
  // Optional: If url is provided (and no imageUrl), we will send a message with an inline URL button to open it.
  url?: string
  // Optional: fallback plain text if neither image nor url is provided
  text?: string
}

type MainButton = {
  id: string
  label: string
  messageText: string
  subButtons: SubButton[]
}

type MenuConfig = {
  introText: string
  mainButtons: MainButton[] // must be length 5 by requirement
}

type AdConfig = {
  imageSource: string
  captionText: string
  actionLinks: { linkText: string; linkDestination: string }[]
}

type AdsState = {
  permanent: AdConfig | null
  temporary: AdConfig | null
}

// -------------------- In-memory Cache --------------------

const cache = new NodeCache()

// Default Ads (kept from your original example)
function setDefaultAds() {
  cache.set<AdsState>("ads", {
    permanent: {
      imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
      captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥

💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥

🎬 <i>Fresh leaked content daily</i>
🔞 <b>18+ Adult Material</b>
💎 <i>Premium quality videos & files</i>
🚀 <b>Instant access available</b>

⬇️ <b><u>Click any server below</u></b> ⬇️`,
      actionLinks: [
        { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+Go8FEdh9M8Y3ZWU1" },
        { linkText: "📁 FILES🍑", linkDestination: "https://t.me/+06bZb-fbn4kzNjll" },
      ],
    },
    temporary: null,
  })
}

if (!cache.get("ads")) setDefaultAds()

// Default Menu with 5 main buttons, each with sample sub-buttons
function setDefaultMenu() {
  const defaultMenu: MenuConfig = {
    introText: "Please choose an option below:",
    mainButtons: [
      {
        id: "btn1",
        label: "Button 1",
        messageText: "You clicked Button 1. Choose a sub-option:",
        subButtons: [
          {
            label: "Photo A",
            imageUrl: "https://picsum.photos/seed/a/800/500",
            caption: "This is Photo A",
          },
          {
            label: "Open Website",
            url: "https://example.com",
          },
          { label: "Text Only", text: "This is a text-only sub-button response for Button 1." },
        ],
      },
      {
        id: "btn2",
        label: "Button 2",
        messageText: "You clicked Button 2. Choose a sub-option:",
        subButtons: [
          {
            label: "Photo B",
            imageUrl: "https://picsum.photos/seed/b/800/500",
            caption: "This is Photo B",
          },
          { label: "Text B", text: "Text response for Button 2." },
        ],
      },
      {
        id: "btn3",
        label: "Button 3",
        messageText: "Button 3 selected. Choose a sub-option:",
        subButtons: [
          {
            label: "Photo C",
            imageUrl: "https://picsum.photos/seed/c/800/500",
            caption: "This is Photo C",
          },
        ],
      },
      {
        id: "btn4",
        label: "Button 4",
        messageText: "Button 4 selected. Choose a sub-option:",
        subButtons: [{ label: "Text D", text: "Simple text response from Button 4." }],
      },
      {
        id: "btn5",
        label: "Button 5",
        messageText: "Button 5 selected. Choose a sub-option:",
        subButtons: [
          {
            label: "Photo E",
            imageUrl: "https://picsum.photos/seed/e/800/500",
            caption: "This is Photo E",
          },
        ],
      },
    ],
  }
  cache.set<MenuConfig>("menu", defaultMenu)
}

if (!cache.get("menu")) setDefaultMenu()

// -------------------- Utilities --------------------

function isValidTelegramBotToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token)
}

function nowISO() {
  return new Date().toISOString()
}

function appendLog(line: string) {
  let log = (cache.get("log_bar") as string) || ""
  const timestamp = nowISO()
  const newLine = `${timestamp} | ${line}\n`
  log += newLine

  // Trim at 100KB
  if (log.length > 102400) {
    const targetSize = 81920
    log = log.slice(-targetSize)
    const firstNewline = log.indexOf("\n")
    if (firstNewline !== -1) {
      log = log.slice(firstNewline + 1)
    }
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
  const lines = log.split("\n").filter((line) => line.trim())
  return {
    size: log.length,
    lines: lines.length,
    sizeKB: Math.round((log.length / 1024) * 100) / 100,
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req
      .on("data", (c) => chunks.push(Buffer.from(c)))
      .on("end", () => resolve(Buffer.concat(chunks).toString("utf8")))
      .on("error", reject)
  })
}

function writeHTML(res: ServerResponse, html: string, status = 200) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" })
  res.end(html)
}

function writeJSON(res: ServerResponse, data: any, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(data))
}

function redirect(res: ServerResponse, location: string) {
  res.statusCode = 302
  res.setHeader("Location", location)
  res.end()
}

// -------------------- Telegram API Helpers --------------------

async function tgFetch(botToken: string, method: string, payload: any) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return resp
}

async function sendMessage(botToken: string, chatId: number | string, text: string, reply_markup?: any) {
  return tgFetch(botToken, "sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    reply_markup,
  })
}

async function sendPhoto(
  botToken: string,
  chatId: number | string,
  photo: string,
  caption?: string,
  reply_markup?: any,
) {
  return tgFetch(botToken, "sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    parse_mode: "HTML",
    reply_markup,
  })
}

async function editMessageText(
  botToken: string,
  chatId: number | string,
  messageId: number,
  text: string,
  reply_markup?: any,
) {
  return tgFetch(botToken, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    reply_markup,
  })
}

async function answerCallback(botToken: string, callbackQueryId: string, text?: string) {
  return tgFetch(botToken, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  })
}

async function getChatInfo(botToken: string, chatId: number | string) {
  return tgFetch(botToken, "getChat", { chat_id: chatId })
}

// -------------------- Menu Rendering --------------------

function getMenu(): MenuConfig {
  return (cache.get("menu") as MenuConfig) || { introText: "Menu", mainButtons: [] }
}

function mainMenuKeyboard(menu: MenuConfig) {
  return {
    inline_keyboard: menu.mainButtons.map((btn, idx) => [{ text: btn.label, callback_data: `main:${idx}` }]),
  }
}

function subMenuKeyboard(menu: MenuConfig, mainIdx: number) {
  const main = menu.mainButtons[mainIdx]
  const rows: any[] = []
  if (!main) return { inline_keyboard: [] }
  const subs = main.subButtons || []
  for (let i = 0; i < subs.length; i++) {
    rows.push([{ text: subs[i].label, callback_data: `sub:${mainIdx}:${i}` }])
  }
  // Back to Home row
  rows.push([{ text: "⬅️ Back to main menu", callback_data: "back:home" }])
  return { inline_keyboard: rows }
}

async function sendMainMenu(botToken: string, chatId: number | string) {
  const menu = getMenu()
  return sendMessage(botToken, chatId, menu.introText, mainMenuKeyboard(menu))
}

// -------------------- Dashboard HTML --------------------

function renderTokenBars(tokenResponses: Record<string, number>) {
  const sorted = Object.entries(tokenResponses)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 100)
  const maxCount = Math.max(...sorted.map(([, count]) => count as number), 1)

  return sorted
    .map(([token, count]) => {
      const widthPercent = ((count as number) / maxCount) * 100
      const shortToken = `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
      return `
        <div style="margin:12px 0; padding: 12px; background:#1a1a1a; border-radius: 8px; border: 1px solid #333;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-family: monospace; color:#f97316; font-weight: bold;">
              Token: ${shortToken}
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="copyToken('${token}')" style="background:#10b981; padding: 4px 8px; font-size: 12px;">📋 Copy</button>
              <form method="POST" action="/remove-token?token=${encodeURIComponent(
                token,
              )}&pass=admin123" style="margin:0;" onsubmit="return confirm('Delete this webhook token?')">
                <button type="submit" style="background:#e11d48; padding: 4px 8px; font-size: 12px;">🗑 Delete</button>
              </form>
            </div>
          </div>
          <div style="background:#333; width:100%; height:20px; border-radius:10px; overflow:hidden; margin: 8px 0;">
            <div style="background:linear-gradient(90deg, #f97316, #fb923c); width:${widthPercent}%; height:100%; transition: width 0.3s ease;"></div>
          </div>
          <div style="color:#ccc; font-size: 14px;">
            <span>Responses: <b style="color:#f97316;">${count}</b></span>
            <span style="margin-left: 20px;">Webhook: <code>/webhook/${token}</code></span>
          </div>
        </div>
      `
    })
    .join("")
}

function adForm(type: "permanent" | "temporary", ad: AdConfig | null) {
  return `
    <div style="background:#1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #333;">
      <h3 style="color:#f97316; margin-top:0;">${type.toUpperCase()} AD</h3>
      <form method='POST' action='/update-ad?type=${type}&pass=admin123'>
        <div style="margin: 10px 0;">
          <label style="display: block; margin-bottom: 5px; color: #ccc;">Image URL:</label>
          <input name='imageSource' placeholder='https://example.com/image.jpg' value="${ad?.imageSource || ""}" style='width:100%; padding: 10px; border-radius: 5px; border: 1px solid #555; background: #2a2a2a; color: white;'>
        </div>
        <div style="margin: 10px 0;">
          <label style="display: block; margin-bottom: 5px; color: #ccc;">Caption Text:</label>
          <textarea name='captionText' placeholder='Your ad caption here...' rows=6 style='width:100%; padding: 10px; border-radius: 5px; border: 1px solid #555; background: #2a2a2a; color: white; resize: vertical;'>${ad?.captionText || ""}</textarea>
        </div>
        <div style="margin: 10px 0;">
          <label style="display: block; margin-bottom: 5px; color: #ccc;">Action Links (JSON):</label>
          <textarea name='actionLinks' placeholder='[{"linkText":"Button Text", "linkDestination":"https://example.com"}]' rows=4 style='width:100%; padding: 10px; border-radius: 5px; border: 1px solid #555; background: #2a2a2a; color: white; font-family: monospace; resize: vertical;'>${JSON.stringify(
            ad?.actionLinks || [],
            null,
            2,
          )}</textarea>
        </div>
        <button type="submit" style="background: #f97316; padding: 12px 24px; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer;">Update ${type} Ad</button>
      </form>
    </div>
  `
}

function menuForm(menu: MenuConfig) {
  return `
    <div style="background:#1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #333;">
      <h3 style="color:#f97316; margin-top:0;">🧭 Menu Configuration (5 main buttons)</h3>
      <p style="color:#aaa; margin-top: 0;">Edit the full JSON below. Sub-buttons can include images via "imageUrl" and optional "caption".</p>
      <form method='POST' action='/update-menu?pass=admin123'>
        <textarea name='menuJson' rows=18 style='width:100%; padding: 10px; border-radius: 5px; border: 1px solid #555; background: #2a2a2a; color: white; font-family: monospace; resize: vertical;'>${JSON.stringify(
          menu,
          null,
          2,
        )}</textarea>
        <div style="margin-top:10px;">
          <button type="submit" style="background: #f97316; padding: 12px 24px; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer;">Save Menu</button>
          <button type="button" onclick="resetMenu()" style="background:#334155; padding: 12px 24px; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer; margin-left:10px;">Reset to Default</button>
        </div>
      </form>
    </div>
  `
}

function renderDashboard(stats: {
  total: number
  users: string[]
  bots: string[]
  ads: AdsState
  tokenResponses: Record<string, number>
  logBar: string
  logStats: { size: number; lines: number; sizeKB: number }
  menu: MenuConfig
}) {
  const tokenBar = renderTokenBars(stats.tokenResponses)
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Telegram Bot Webhook Dashboard</title>
  <style>
    body { background:#0f0f0f; color:white; font-family:-apple-system,BlinkMacSystemFont,sans-serif; padding:2em; line-height: 1.6; }
    h1, h2, h3 { color: #f97316; }
    h1 { border-bottom: 2px solid #f97316; padding-bottom: 10px; }
    button { padding: 10px 20px; margin: 10px 5px; background: #f97316; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer; transition: all 0.2s; }
    button:hover { background: #ea580c; transform: translateY(-1px); }
    textarea, input { margin: 5px 0; padding: 10px; border-radius: 5px; border: 1px solid #555; background: #2a2a2a; color: white; }
    pre { background: #1e1e1e; padding: 1em; border-radius: 8px; max-height: 300px; overflow-y: auto; }
    .log-bar { background: #1a1a1a; color: #fafafa; font-family: 'Courier New', monospace; border-radius: 8px; margin-top: 2em; padding:1em; max-height:400px; overflow-y:auto; font-size: 0.9em; border: 1px solid #333;}
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .stat-card { background: #1a1a1a; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #333; }
    .stat-number { font-size: 2em; font-weight: bold; color: #f97316; }
    .control-panel { background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #333; }
    .control-panel h3 { margin-top: 0; }
    .button-group { display: flex; gap: 10px; flex-wrap: wrap; }
  </style>
  <script>
    function copyToken(token) { navigator.clipboard.writeText(token).then(() => { alert('Token copied to clipboard!'); }); }
    function confirmClearCache() { return confirm('Are you sure you want to clear all cache data? This will remove all tokens, users, and statistics.'); }
    function confirmClearLogs() { return confirm('Are you sure you want to clear all logs?'); }
    function resetMenu() {
      if (!confirm('Reset menu to defaults?')) return;
      fetch('/reset-menu?pass=admin123', { method: 'POST' }).then(()=> location.reload());
    }
  </script>
  </head><body>
    <h1>🤖 Telegram Bot Webhook Dashboard</h1>

    <div class="stats-grid">
      <div class="stat-card"><div class="stat-number">${stats.total}</div><div>Total Messages</div></div>
      <div class="stat-card"><div class="stat-number">${stats.users.length}</div><div>Unique Users</div></div>
      <div class="stat-card"><div class="stat-number">${stats.bots.length}</div><div>Active Bots</div></div>
      <div class="stat-card"><div class="stat-number">${stats.logStats.sizeKB} KB</div><div>Log Size (${stats.logStats.lines} lines)</div></div>
    </div>

    <div class="control-panel">
      <h3>🎛️ Control Panel</h3>
      <div class="button-group">
        <form method='POST' action='/clear-cache?pass=admin123' style="margin:0;">
          <button type='submit' onclick="return confirmClearCache()" style="background:#e11d48;">🗑 Clear All Cache</button>
        </form>
        <form method='POST' action='/clear-logs?pass=admin123' style="margin:0;">
          <button type='submit' onclick="return confirmClearLogs()" style="background:#dc2626;">📜 Clear Logs Only</button>
        </form>
        <form method='POST' action='/send-to-channels?pass=admin123' style="margin:0;">
          <button type='submit'>📢 Send Ads to All Channels</button>
        </form>
      </div>
    </div>

    <h2>🧭 Menu & Buttons</h2>
    ${menuForm(stats.menu)}

    <h2>🔗 Active Webhooks (Top 100 by Activity)</h2>
    <p style="color:#888; margin-bottom:20px;">
      Each bot token creates a webhook endpoint at <code>/webhook/{token}</code>.
      Logs auto-trim at 100KB to maintain performance.
    </p>
    ${tokenBar || '<p style="color:#888;">No active webhooks found.</p>'}

    ${adForm("permanent", stats.ads.permanent)}
    ${adForm("temporary", stats.ads.temporary)}

    <h2>📜 System Logs 
      <span style="font-size:0.8em;font-weight:normal;color:#888;">(${stats.logStats.sizeKB} KB / 100 KB max, ${stats.logStats.lines} lines)</span>
    </h2>
    <div class="log-bar">${(stats.logBar || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\n/g, "<br>").replace(/\n/g, "<br>") || '<em style="color:#666;">No logs yet...</em>'}</div>
  </body></html>`
}

// -------------------- HTTP Server --------------------

const ADMIN_PASS = "admin123"

const server = createServer(async (req, res) => {
  const host = req.headers.host || "localhost:3000"
  const url = new URL(req.url || "/", `http://${host}`)
  const path = url.pathname
  const method = req.method || "GET"
  const pass = url.searchParams.get("pass")

  try {
    // Dashboard (GET /)
    if (method === "GET" && path === "/") {
      if (pass !== ADMIN_PASS) {
        return writeHTML(
          res,
          `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { background: #0f0f0f; color: white; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
              .login-form { background: #1a1a1a; padding: 2rem; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
              input { padding: 12px; margin: 10px 0; border: none; border-radius: 5px; width: 200px; }
              button { padding: 12px 24px; background: #f97316; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer; width: 100%; }
              h2 { color: #f97316; text-align: center; }
            </style>
          </head>
          <body>
            <div class="login-form">
              <h2>🔐 Admin Login</h2>
              <form>
                <input name='pass' type='password' placeholder='Enter admin password' required>
                <button type='submit'>Login</button>
              </form>
            </div>
          </body>
          </html>
        `,
        )
      }

      // Clean invalid tokens
      const tokenResponsesRaw = (cache.get("token_responses") as string) || "{}"
      const tokenResponses = JSON.parse(tokenResponsesRaw)
      let changed = false
      for (const token in tokenResponses) {
        if (!isValidTelegramBotToken(token)) {
          delete tokenResponses[token]
          changed = true
        }
      }
      if (changed) cache.set("token_responses", JSON.stringify(tokenResponses))

      const stats = {
        total: (cache.get("total_messages") as number) || 0,
        users: Array.from(new Set(((cache.get("users") as string[]) || []) as string[])),
        bots: Array.from(new Set(((cache.get("bots") as string[]) || []) as string[])),
        ads: (cache.get("ads") as AdsState) || { permanent: null, temporary: null },
        tokenResponses,
        logBar: (cache.get("log_bar") as string) || "",
        logStats: getLogStats(),
        menu: getMenu(),
      }

      return writeHTML(res, renderDashboard(stats))
    }

    // Remove token
    if (method === "POST" && path === "/remove-token" && pass === ADMIN_PASS) {
      const token = url.searchParams.get("token")
      if (!token)
        return writeHTML(res, `<script>alert('❌ No token specified');location.href='/?pass=${ADMIN_PASS}'</script>`)

      if (!isValidTelegramBotToken(token)) {
        return writeHTML(res, `<script>alert('❌ Invalid token format');location.href='/?pass=${ADMIN_PASS}'</script>`)
      }

      const tokenResponsesRaw = (cache.get("token_responses") as string) || "{}"
      const tokenResponses = JSON.parse(tokenResponsesRaw)
      const wasPresent = token in tokenResponses
      delete tokenResponses[token]
      cache.set("token_responses", JSON.stringify(tokenResponses))

      const bots = ((cache.get("bots") as string[]) || []).filter((t) => t !== token)
      cache.set("bots", bots)

      if (wasPresent) {
        appendLog(`✅ Removed webhook token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`)
        return writeHTML(
          res,
          `<script>alert('✅ Webhook deleted successfully');location.href='/?pass=${ADMIN_PASS}'</script>`,
        )
      } else {
        appendLog(
          `⚠️ Attempted to remove non-existent token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`,
        )
        return writeHTML(res, `<script>alert('⚠️ Token was not found');location.href='/?pass=${ADMIN_PASS}'</script>`)
      }
    }

    // Clear logs
    if (method === "POST" && path === "/clear-logs" && pass === ADMIN_PASS) {
      clearLogs()
      return writeHTML(
        res,
        `<script>alert('📜 Logs cleared successfully');location.href='/?pass=${ADMIN_PASS}'</script>`,
      )
    }

    // Clear all cache (then reset ads + menu)
    if (method === "POST" && path === "/clear-cache" && pass === ADMIN_PASS) {
      cache.flushAll()
      setDefaultAds()
      setDefaultMenu()
      appendLog(`🗑️ All cache data cleared and reset`)
      return writeHTML(
        res,
        `<script>alert('🗑️ All cache cleared and reset');location.href='/?pass=${ADMIN_PASS}'</script>`,
      )
    }

    // Reset menu to defaults
    if (method === "POST" && path === "/reset-menu" && pass === ADMIN_PASS) {
      setDefaultMenu()
      appendLog("🔄 Menu reset to default")
      return writeJSON(res, { ok: true })
    }

    // Update ads
    if (method === "POST" && path === "/update-ad" && pass === ADMIN_PASS) {
      const type = url.searchParams.get("type")
      if (!type || !["permanent", "temporary"].includes(type)) {
        return writeHTML(res, `<script>alert('❌ Invalid ad type');location.href='/?pass=${ADMIN_PASS}'</script>`)
      }
      const body = await readBody(req)
      const params = new URLSearchParams(body)
      const imageSource = (params.get("imageSource") || "").trim()
      const captionText = (params.get("captionText") || "").trim()
      const actionLinksRaw = (params.get("actionLinks") || "").trim()

      if (!imageSource || !captionText) {
        return writeHTML(
          res,
          `<script>alert('❌ Image URL and caption are required');location.href='/?pass=${ADMIN_PASS}'</script>`,
        )
      }

      try {
        const actionLinks = actionLinksRaw ? JSON.parse(actionLinksRaw) : []
        if (!Array.isArray(actionLinks)) throw new Error("Action links must be an array")
        actionLinks.forEach((l: any) => {
          if (!l.linkText || !l.linkDestination)
            throw new Error("Each action link requires linkText and linkDestination")
        })

        const ads: AdsState = (cache.get("ads") as AdsState) || { permanent: null, temporary: null }
        ;(ads as any)[type] = { imageSource, captionText, actionLinks }
        cache.set("ads", ads)

        appendLog(`✅ Updated "${type}" ad configuration`)
        return writeHTML(
          res,
          `<script>alert('✅ ${type.toUpperCase()} ad updated');location.href='/?pass=${ADMIN_PASS}'</script>`,
        )
      } catch (e) {
        appendLog(`❌ Error updating ${type} ad: ${e}`)
        return writeHTML(
          res,
          `<script>alert('❌ Invalid JSON format in action links');location.href='/?pass=${ADMIN_PASS}'</script>`,
        )
      }
    }

    // Send ads to all known chats in cache
    if (method === "POST" && path === "/send-to-channels" && pass === ADMIN_PASS) {
      const bots = Array.from(new Set(((cache.get("bots") as string[]) || []) as string[]))
      const chatLinks = (cache.get("chat_links") as Record<string, string>) || {}
      const ads = (cache.get("ads") as AdsState) || { permanent: null, temporary: null }
      const ad = ads.temporary || ads.permanent

      if (!ad || !ad.imageSource || !ad.captionText) {
        appendLog(`❌ Cannot send ads: Missing ad configuration`)
        return writeHTML(res, `<script>alert('❌ No ad configured');location.href='/?pass=${ADMIN_PASS}'</script>`)
      }

      let sentCount = 0
      let errorCount = 0

      for (const bot of bots) {
        for (const chatId of Object.keys(chatLinks)) {
          try {
            const response = await sendPhoto(bot, chatId, ad.imageSource, ad.captionText, {
              inline_keyboard: ad.actionLinks.map((l) => [{ text: l.linkText, url: l.linkDestination }]),
            })
            if (response.ok) sentCount++
            else errorCount++
          } catch {
            errorCount++
          }
        }
      }

      appendLog(`📢 Sent ads to ${sentCount} chats, ${errorCount} errors`)
      return writeHTML(
        res,
        `<script>alert('📢 Sent to ${sentCount} chats (${errorCount} errors)');location.href='/?pass=${ADMIN_PASS}'</script>`,
      )
    }

    // Update Menu JSON (5 buttons + sub-buttons with optional images)
    if (method === "POST" && path === "/update-menu" && pass === ADMIN_PASS) {
      const body = await readBody(req)
      const params = new URLSearchParams(body)
      const menuJson = params.get("menuJson") || ""

      try {
        const menu = JSON.parse(menuJson) as MenuConfig
        if (!menu || !Array.isArray(menu.mainButtons) || menu.mainButtons.length !== 5) {
          throw new Error("Menu must have exactly 5 mainButtons")
        }
        // Basic validation
        menu.mainButtons.forEach((btn, i) => {
          if (!btn.label || !btn.messageText || !Array.isArray(btn.subButtons)) {
            throw new Error(`Invalid main button at index ${i}`)
          }
          btn.subButtons.forEach((sb, j) => {
            if (!sb.label) throw new Error(`Sub-button at main[${i}].subButtons[${j}] requires a label`)
          })
        })

        cache.set("menu", menu)
        appendLog("✅ Menu configuration updated")
        return writeHTML(res, `<script>alert('✅ Menu saved');location.href='/?pass=${ADMIN_PASS}'</script>`)
      } catch (e: any) {
        appendLog(`❌ Error updating menu: ${e?.message || e}`)
        return writeHTML(
          res,
          `<script>alert('❌ Invalid Menu JSON: ${String(e?.message || e)}');location.href='/?pass=${ADMIN_PASS}'</script>`,
        )
      }
    }

    // Webhook receiver
    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "")
      if (!isValidTelegramBotToken(botToken)) {
        appendLog(`❌ Invalid webhook token format: ${botToken.substring(0, 20)}...`)
        res.statusCode = 400
        return res.end("Ignored: Invalid token format")
      }

      try {
        const raw = await readBody(req)
        const update: TelegramUpdate = JSON.parse(raw)

        // Track bot
        const bots = new Set<string>(((cache.get("bots") as string[]) || []) as string[])
        bots.add(botToken)
        cache.set("bots", Array.from(bots))

        // Update token response count
        const tokenResponsesRaw = (cache.get("token_responses") as string) || "{}"
        const tokenResponses = JSON.parse(tokenResponsesRaw)
        tokenResponses[botToken] = (tokenResponses[botToken] || 0) + 1
        cache.set("token_responses", JSON.stringify(tokenResponses))

        // Update total messages
        const total = ((cache.get("total_messages") as number) || 0) + 1
        cache.set("total_messages", total)

        const shortToken = `${botToken.substring(0, 10)}...${botToken.substring(botToken.length - 10)}`
        appendLog(`📨 Webhook ${shortToken} | Count: ${tokenResponses[botToken]}`)

        // Determine activity
        const activity =
          update.message ||
          update.edited_message ||
          update.channel_post ||
          update.edited_channel_post ||
          update.my_chat_member ||
          update.chat_member ||
          update.chat_join_request ||
          undefined

        const chatId =
          (activity as any)?.chat?.id ||
          (activity as any)?.chat?.chat?.id ||
          update.callback_query?.message?.chat?.id ||
          update.message?.from?.id ||
          undefined

        const userId =
          (activity as any)?.from?.id?.toString() || update.callback_query?.from?.id?.toString() || undefined

        if (userId) {
          const users = new Set<string>(((cache.get("users") as string[]) || []) as string[])
          users.add(userId)
          cache.set("users", Array.from(users))
        }

        // Cache chat link
        const chatLinks = ((cache.get("chat_links") as Record<string, string>) || {}) as Record<string, string>
        if (chatId && !chatLinks[String(chatId)]) {
          try {
            const resp = await getChatInfo(botToken, chatId)
            if (resp.ok) {
              const result = await resp.json()
              if (result.ok) {
                const info = result.result
                const link = info.username
                  ? `https://t.me/${info.username}`
                  : info.invite_link || `https://t.me/c/${String(chatId).replace("-100", "")}`
                chatLinks[String(chatId)] = link
                cache.set("chat_links", chatLinks)
                appendLog(`🔗 Cached chat link for ${chatId}`)
              }
            }
          } catch (e) {
            appendLog(`❌ Error fetching chat info: ${e}`)
          }
        }

        // Handle callbacks (main buttons / sub buttons / back)
        if (update.callback_query?.id && chatId) {
          const cq = update.callback_query
          const data = cq.data || ""
          await answerCallback(botToken, cq.id)

          // main:<idx> -> show sub-menu for that main button and replace message text
          if (data.startsWith("main:")) {
            const idx = Number.parseInt(data.split(":")[1] || "-1", 10)
            const menu = getMenu()
            const mainBtn = menu.mainButtons[idx]
            if (mainBtn && cq.message?.message_id != null) {
              await editMessageText(
                botToken,
                chatId,
                cq.message.message_id!,
                mainBtn.messageText,
                subMenuKeyboard(menu, idx),
              )
            }
            res.end("OK")
            return
          }

          // sub:<mainIdx>:<subIdx> -> send photo/text/url
          if (data.startsWith("sub:")) {
            const parts = data.split(":")
            const mainIdx = Number.parseInt(parts[1] || "-1", 10)
            const subIdx = Number.parseInt(parts[2] || "-1", 10)
            const menu = getMenu()
            const mainBtn = menu.mainButtons[mainIdx]
            const sub = mainBtn?.subButtons?.[subIdx]
            if (sub) {
              // image first
              if (sub.imageUrl) {
                await sendPhoto(botToken, chatId, sub.imageUrl, sub.caption || "", {
                  inline_keyboard: [[{ text: "⬅️ Back to main menu", callback_data: "back:home" }]],
                })
              } else if (sub.url) {
                await sendMessage(botToken, chatId, `Open the link below:`, {
                  inline_keyboard: [
                    [{ text: "🔗 Open", url: sub.url }],
                    [{ text: "⬅️ Back to main menu", callback_data: "back:home" }],
                  ],
                })
              } else {
                await sendMessage(botToken, chatId, sub.text || "Selected.", {
                  inline_keyboard: [[{ text: "⬅️ Back to main menu", callback_data: "back:home" }]],
                })
              }
            }
            res.end("OK")
            return
          }

          // back:home -> show main menu again
          if (data === "back:home") {
            const menu = getMenu()
            if (cq.message?.message_id != null) {
              await editMessageText(botToken, chatId, cq.message.message_id!, menu.introText, mainMenuKeyboard(menu))
            } else {
              await sendMainMenu(botToken, chatId)
            }
            res.end("OK")
            return
          }
        }

        // For any standard message, send the main menu (instead of ad)
        if (update.message && chatId) {
          const menu = getMenu()
          await sendMessage(botToken, chatId, menu.introText, mainMenuKeyboard(menu))
          appendLog(`📤 Sent main menu to chat ${chatId} via ${shortToken}`)
        }

        res.end("OK")
        return
      } catch (e) {
        appendLog(`❌ Webhook processing error: ${e}`)
        res.statusCode = 500
        return res.end("Error processing webhook")
      }
    }

    // Fallback
    res.statusCode = 404
    res.end("Not Found")
  } catch (e) {
    appendLog(`❌ Server error: ${e}`)
    res.statusCode = 500
    res.end("Internal Server Error")
  }
})

const PORT = 3000
server.listen(PORT, () => {
  console.log(`✅ Telegram bot webhook dashboard is live on http://localhost:${PORT}`)
  console.log(`🔐 Admin password: ${ADMIN_PASS}`)
  console.log(`🪪 Admin: open http://localhost:${PORT}/?pass=${ADMIN_PASS}`)
})
