import { serve } from "bun"
import NodeCache from "node-cache"

interface TelegramUpdate {
  message?: any
  edited_message?: any
  channel_post?: any
  edited_channel_post?: any
  my_chat_member?: any
  chat_member?: any
  chat_join_request?: any
  callback_query?: any
  inline_query?: any
  chosen_inline_result?: any
  shipping_query?: any
  pre_checkout_query?: any
  poll?: any
  poll_answer?: any
  message_reaction?: any
  message_reaction_count?: any
  chat_boost?: any
  removed_chat_boost?: any
}

const cache = new NodeCache()

cache.set("ads", {
  permanent: {
    imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
    captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥\n\n💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥\n\n🎬 <i>Fresh leaked content daily</i>\n🔞 <b>18+ Adult Material</b>\n💎 <i>Premium quality videos & files</i>\n🚀 <b>Instant access available</b>\n\n⬇️ <b><u>Click any server below</u></b> ⬇️`,
    actionLinks: [
      { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+Go8FEdh9M8Y3ZWU1" },
      { linkText: "📁 FILES🍑", linkDestination: "https://t.me/+06bZb-fbn4kzNjll" },
    ],
  },
  temporary: null,
})

const BAN_TTL_SECONDS = 315360000 // ~10 years
const FAIL_WINDOW_SECONDS = 3600 // 1 hour rolling window
const FAIL_THRESHOLD = 8 // ban after 8 invalid hits in window

function getClientIP(req: Request, server?: any): string {
  const h = req.headers
  const fwd = h.get("cf-connecting-ip") || h.get("x-real-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim()
  // Bun's direct connection helper when not behind a proxy
  // @ts-ignore - Bun server object
  const direct = server?.requestIP?.(req)?.address
  return fwd || direct || "unknown"
}

function isBannedIP(ip: string): boolean {
  return cache.get(`ban:${ip}`) === true
}

function registerInvalidHit(ip: string) {
  if (!ip || ip === "unknown") return
  const key = `fail:${ip}`
  const count = ((cache.get(key) as number) || 0) + 1
  cache.set(key, count, FAIL_WINDOW_SECONDS)
  if (count >= FAIL_THRESHOLD) {
    cache.set(`ban:${ip}`, true, BAN_TTL_SECONDS)
    appendLog(`🚫 Permanently banned IP ${ip} after ${count} invalid webhook hits`)
  }
}

function isValidTelegramBotToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token)
}

function appendLog(line: string) {
  let log = (cache.get("log_bar") as string) || ""
  const timestamp = new Date().toISOString()
  const newLine = `${timestamp} | ${line}\n`

  log += newLine

  // Auto-delete when exceeding 100KB (102400 bytes)
  if (log.length > 102400) {
    // Keep only the last 80KB to prevent frequent trimming
    const targetSize = 81920 // 80KB
    log = log.slice(-targetSize)

    // Find the first complete line to avoid cutting mid-line
    const firstNewline = log.indexOf("\n")
    if (firstNewline !== -1) {
      log = log.slice(firstNewline + 1)
    }

    // Add a marker to show logs were trimmed
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

function getUpdateContext(update: TelegramUpdate): { chatId?: string | number; summary: string } {
  // message-like
  if (update.message?.chat?.id) {
    const t = update.message
    const text = t.text || t.caption || "[message]"
    return {
      chatId: t.chat.id,
      summary: `Message from ${t.from?.username || t.from?.id || "user"}: ${String(text).slice(0, 120)}`,
    }
  }
  if (update.edited_message?.chat?.id) {
    const t = update.edited_message
    return { chatId: t.chat.id, summary: `Edited message by ${t.from?.username || t.from?.id || "user"}` }
  }
  if (update.channel_post?.chat?.id) {
    const t = update.channel_post
    const text = t.text || t.caption || "[channel post]"
    return { chatId: t.chat.id, summary: `Channel post: ${String(text).slice(0, 120)}` }
  }
  if (update.edited_channel_post?.chat?.id) {
    const t = update.edited_channel_post
    return { chatId: t.chat.id, summary: `Edited channel post` }
  }

  // membership / admin changes
  if (update.my_chat_member?.chat?.id) {
    const t = update.my_chat_member
    const status = t.new_chat_member?.status || t.old_chat_member?.status
    return { chatId: t.chat.id, summary: `My chat member update: ${status || "status changed"}` }
  }
  if (update.chat_member?.chat?.id) {
    const t = update.chat_member
    const status = t.new_chat_member?.status || t.old_chat_member?.status
    return { chatId: t.chat.id, summary: `Chat member update: ${status || "status changed"}` }
  }
  if (update.chat_join_request?.chat?.id) {
    const t = update.chat_join_request
    return { chatId: t.chat.id, summary: `Join request from ${t.from?.username || t.from?.id}` }
  }

  // buttons / reactions
  if (update.callback_query?.message?.chat?.id) {
    const q = update.callback_query
    const data = q.data ? `data="${String(q.data).slice(0, 120)}"` : "button tapped"
    return { chatId: q.message.chat.id, summary: `Callback query by ${q.from?.username || q.from?.id}: ${data}` }
  }
  if (update.message_reaction?.chat?.id) {
    const t = update.message_reaction
    return { chatId: t.chat.id, summary: `Reaction on message ${t.message_id}` }
  }
  if (update.message_reaction_count?.chat?.id) {
    const t = update.message_reaction_count
    return { chatId: t.chat.id, summary: `Reaction count updated on message ${t.message_id}` }
  }

  // Other updates without a reliable chatId (inline, polls, payments, boosts)
  // We can't send a message without a chat id; we'll still count/log them upstream.
  return { summary: "Non-chat update (no chat_id)" }
}

// Small helper to always attempt sending a text summary when we have a chatId
async function sendText(botToken: string, chatId: string | number, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      appendLog(`❌ Failed to send text message: ${errText}`)
    }
  } catch (err) {
    appendLog(`❌ Error sending text message: ${err}`)
  }
}

serve({
  port: 3000,
  async fetch(req, server) {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method
    const pass = url.searchParams.get("pass")
    const ip = getClientIP(req, server)

    if (ip !== "unknown" && isBannedIP(ip)) {
      return new Response("Forbidden", { status: 403 })
    }

    // Dashboard
    if (method === "GET" && path === "/") {
      if (pass !== "admin10082") {
        return new Response(
          `<!DOCTYPE html>
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
          </html>`,
          {
            headers: { "Content-Type": "text/html" },
          },
        )
      }

      // Parse data & clean irrelevant tokens
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

      // Build dashboard data
      const stats = {
        total: cache.get("total_messages") || 0,
        users: Array.from(new Set((cache.get("users") || []) as string[])),
        bots: Array.from(new Set((cache.get("bots") || []) as string[])),
        ads: cache.get("ads") || {},
        tokenResponses,
        logBar: (cache.get("log_bar") as string) || "",
        logStats: getLogStats(), // Added log statistics
      }

      const sortedTokens = Object.entries(stats.tokenResponses)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 100)

      const maxCount = Math.max(...sortedTokens.map(([_, count]) => count as number), 1)

      const tokenBar = sortedTokens
        .map(([token, count]) => {
          const widthPercent = ((count as number) / maxCount) * 100
          const shortToken = `${token.substring(0, 10)}...${token.substring(token.length - 10)}`
          return `<!DOCTYPE html>
          <div style="margin:12px 0; padding: 12px; background:#1a1a1a; border-radius: 8px; border: 1px solid #333;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-family: monospace; color:#f97316; font-weight: bold;">
                Token: ${shortToken}
              </div>
              <div style="display: flex; gap: 8px;">
                <button onclick="copyToken('${token}')" style="background:#10b981; padding: 4px 8px; font-size: 12px;">📋 Copy</button>
                <form method="POST" action="/remove-token?token=${encodeURIComponent(token)}&pass=admin10082" style="margin:0;" onsubmit="return confirm('Delete this webhook token?')">
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

      const form = (type: string, ad: any) => `<!DOCTYPE html>
        <div style="background:#1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #333;">
          <h3 style="color:#f97316; margin-top:0;">${type.toUpperCase()} AD</h3>
          <form method='POST' action='/update-ad?type=${type}&pass=admin10082'>
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
              <textarea name='actionLinks' placeholder='[{"linkText":"Button Text", "linkDestination":"https://example.com"}]' rows=4 style='width:100%; padding: 10px; border-radius: 5px; border: 1px solid #555; background: #2a2a2a; color: white; font-family: monospace; resize: vertical;'>${JSON.stringify(ad?.actionLinks || [], null, 2)}</textarea>
            </div>
            <button type="submit" style="background: #f97316; padding: 12px 24px; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer;">Update ${type} Ad</button>
          </form>
        </div>`

      return new Response(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { background:#0f0f0f; color:white; font-family:-apple-system,BlinkMacSystemFont,sans-serif; padding:2em; line-height: 1.6; }
        h1, h2, h3 { color: #f97316; }
        h1 { border-bottom: 2px solid #f97316; padding-bottom: 10px; }
        button { padding: 10px 20px; margin: 10px 5px; background: #f97316; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer; transition: all 0.2s; }
        button:hover { background: #ea580c; transform: translateY(-1px); }
        button[style*="background:#e11d48"] { background: #e11d48 !important; }
        button[style*="background:#e11d48"]:hover { background: #be123c !important; }
        button[style*="background:#10b981"] { background: #10b981 !important; }
        button[style*="background:#10b981"]:hover { background: #059669 !important; }
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
        function copyToken(token) {
          navigator.clipboard.writeText(token).then(() => {
            alert('Token copied to clipboard!');
          });
        }
        
        function confirmClearCache() {
          return confirm('Are you sure you want to clear all cache data? This will remove all tokens, users, and statistics.');
        }
        
        function confirmClearLogs() {
          return confirm('Are you sure you want to clear all logs?');
        }
      </script>
      </head><body>
        <h1>🤖 Telegram Bot Webhook Dashboard</h1>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">${stats.total}</div>
            <div>Total Messages</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.users.length}</div>
            <div>Unique Users</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.bots.length}</div>
            <div>Active Bots</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">${stats.logStats.sizeKB} KB</div>
            <div>Log Size (${stats.logStats.lines} lines)</div>
          </div>
        </div>

        <div class="control-panel">
          <h3>🎛️ Control Panel</h3>
          <div class="button-group">
            <form method='POST' action='/clear-cache?pass=admin10082' style="margin:0;">
              <button type='submit' onclick="return confirmClearCache()" style="background:#e11d48;">🗑 Clear All Cache</button>
            </form>
            <form method='POST' action='/clear-logs?pass=admin10082' style="margin:0;">
              <button type='submit' onclick="return confirmClearLogs()" style="background:#dc2626;">📜 Clear Logs Only</button>
            </form>
            <form method='POST' action='/send-to-channels?pass=admin10082' style="margin:0;">
              <button type='submit'>📢 Send Ads to All Channels</button>
            </form>
          </div>
        </div>

        <h2>🔗 Active Webhooks (Top 100 by Activity)</h2>
        <p style="color:#888; margin-bottom:20px;">
          Webhooks are automatically managed. Each bot token creates a webhook endpoint at <code>/webhook/{token}</code>
          <br>Logs auto-trim at 100KB to maintain performance.
        </p>
        ${tokenBar || '<p style="color:#888;">No active webhooks found.</p>'}

        ${form("permanent", stats.ads.permanent)}
        ${form("temporary", stats.ads.temporary)}

        <h2>📜 System Logs 
          <span style="font-size:0.8em;font-weight:normal;color:#888;">
            (${stats.logStats.sizeKB} KB / 100 KB max, ${stats.logStats.lines} lines)
          </span>
        </h2>
        <div class="log-bar">${stats.logBar.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>") || '<em style="color:#666;">No logs yet...</em>'}</div>
      </body></html>`,
        { headers: { "Content-Type": "text/html" } },
      )
    }

    if (method === "POST" && path === "/remove-token" && pass === "admin10082") {
      const token = url.searchParams.get("token")
      if (!token) {
        return new Response(`<script>alert('❌ No token specified');location.href='/?pass=admin10082'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }

      if (!isValidTelegramBotToken(token)) {
        return new Response(`<script>alert('❌ Invalid token format');location.href='/?pass=admin10082'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }

      try {
        // Remove from token_responses
        const tokenResponsesRaw = cache.get("token_responses") as string | undefined
        const tokenResponses = tokenResponsesRaw ? JSON.parse(tokenResponsesRaw) : {}
        const wasPresent = token in tokenResponses
        delete tokenResponses[token]
        cache.set("token_responses", JSON.stringify(tokenResponses))

        // Remove from bots list
        const bots = (cache.get("bots") || []) as string[]
        const filteredBots = bots.filter((t: string) => t !== token)
        cache.set("bots", filteredBots)

        if (wasPresent) {
          appendLog(`✅ Removed webhook token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`)
          return new Response(
            `<script>alert('✅ Webhook deleted successfully');location.href='/?pass=admin10082'</script>`,
            { headers: { "Content-Type": "text/html" } },
          )
        } else {
          appendLog(
            `⚠️ Attempted to remove non-existent token: ${token.substring(0, 10)}...${token.substring(token.length - 10)}`,
          )
          return new Response(`<script>alert('⚠️ Token was not found');location.href='/?pass=admin10082'</script>`, {
            headers: { "Content-Type": "text/html" },
          })
        }
      } catch (error) {
        appendLog(`❌ Error removing token: ${error}`)
        return new Response(`<script>alert('❌ Error removing token');location.href='/?pass=admin10082'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }
    }

    if (method === "POST" && path === "/clear-logs" && pass === "admin10082") {
      clearLogs()
      return new Response(`<script>alert('📜 Logs cleared successfully');location.href='/?pass=admin10082'</script>`, {
        headers: { "Content-Type": "text/html" },
      })
    }

    if (method === "POST" && path === "/send-to-channels" && pass === "admin10082") {
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]))
      const chatLinks = cache.get("chat_links") || {}
      const ads = cache.get("ads") || {}
      const ad = ads.temporary || ads.permanent

      if (!ad || !ad.imageSource || !ad.captionText) {
        appendLog(`❌ Cannot send ads: Missing ad configuration`)
        return new Response(`<script>alert('❌ No ad configured');location.href='/?pass=admin10082'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }

      let sentCount = 0
      let errorCount = 0

      for (const bot of bots) {
        for (const chatId of Object.keys(chatLinks)) {
          try {
            const response = await fetch(`https://api.telegram.org/bot${bot}/sendPhoto`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                photo: ad.imageSource,
                caption: ad.captionText,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: ad.actionLinks.map((l: any) => [{ text: l.linkText, url: l.linkDestination }]),
                },
              }),
            })

            if (response.ok) {
              sentCount++
            } else {
              errorCount++
            }
          } catch (error) {
            errorCount++
          }
        }
      }

      appendLog(`📢 Sent ads to ${sentCount} chats, ${errorCount} errors`)
      return new Response(
        `<script>alert('📢 Sent to ${sentCount} chats (${errorCount} errors)');location.href='/?pass=admin10082'</script>`,
        { headers: { "Content-Type": "text/html" } },
      )
    }

    if (method === "POST" && path === "/update-ad" && pass === "admin10082") {
      const formData = await req.formData()
      const type = url.searchParams.get("type")

      if (!type || !["permanent", "temporary"].includes(type)) {
        return new Response(`<script>alert('❌ Invalid ad type');location.href='/?pass=admin10082'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }

      const imageSource = formData.get("imageSource")?.toString()?.trim()
      const captionText = formData.get("captionText")?.toString()?.trim()
      const actionLinksRaw = formData.get("actionLinks")?.toString()?.trim()

      if (!imageSource || !captionText) {
        return new Response(
          `<script>alert('❌ Image URL and caption are required');location.href='/?pass=admin10082'</script>`,
          { headers: { "Content-Type": "text/html" } },
        )
      }

      try {
        const actionLinks = actionLinksRaw ? JSON.parse(actionLinksRaw) : []

        // Validate action links structure
        if (!Array.isArray(actionLinks)) {
          throw new Error("Action links must be an array")
        }

        for (const link of actionLinks) {
          if (!link.linkText || !link.linkDestination) {
            throw new Error("Each action link must have linkText and linkDestination")
          }
        }

        const ads = cache.get("ads") || {}
        ads[type] = {
          imageSource,
          captionText,
          actionLinks,
        }
        cache.set("ads", ads)

        appendLog(`✅ Updated "${type}" ad configuration`)
        return new Response(
          `<script>alert('✅ ${type.toUpperCase()} ad updated successfully');location.href='/?pass=admin10082'</script>`,
          { headers: { "Content-Type": "text/html" } },
        )
      } catch (error) {
        appendLog(`❌ Error updating ${type} ad: ${error}`)
        return new Response(
          `<script>alert('❌ Invalid JSON format in action links');location.href='/?pass=admin10082'</script>`,
          { headers: { "Content-Type": "text/html" } },
        )
      }
    }

    if (path.startsWith("/webhook/")) {
      // Only allow POST and token paths that match Telegram token shape
      const m = path.match(/^\/webhook\/(\d{6,}:[A-Za-z0-9_-]{30,})$/)
      if (method !== "POST" || !m) {
        registerInvalidHit(ip)
        return new Response("Not Found", { status: 404 })
      }

      const botToken = m[1]

      try {
        const update: TelegramUpdate = await req.json()

        // Track bot
        const bots = cache.get("bots") || []
        cache.set("bots", Array.from(new Set([...(bots as string[]), botToken])))

        // Update token response count
        const tokenResponsesRaw = cache.get("token_responses") as string | undefined
        const tokenResponses = tokenResponsesRaw ? JSON.parse(tokenResponsesRaw) : {}
        tokenResponses[botToken] = (tokenResponses[botToken] || 0) + 1
        cache.set("token_responses", JSON.stringify(tokenResponses))

        // Always count total messages for every valid update
        const total = (cache.get("total_messages") as number) || 0
        cache.set("total_messages", total + 1)

        const shortToken = `${botToken.substring(0, 10)}...${botToken.substring(botToken.length - 10)}`
        appendLog(`📨 Webhook ${shortToken} | Count: ${tokenResponses[botToken]}`)

        // Derive chat and summary for more update types
        const { chatId, summary } = getUpdateContext(update)

        // Expanded user tracking across more update types
        const userId =
          update.message?.from?.id?.toString() ||
          update.edited_message?.from?.id?.toString() ||
          update.callback_query?.from?.id?.toString() ||
          update.inline_query?.from?.id?.toString() ||
          update.chat_member?.from?.id?.toString() ||
          update.my_chat_member?.from?.id?.toString() ||
          update.chat_join_request?.from?.id?.toString()

        if (userId) {
          const users = cache.get("users") || []
          cache.set("users", Array.from(new Set([...(users as string[]), userId])))
        }

        // Cache chat link when we have a chatId
        const chatLinks = cache.get("chat_links") || {}
        if (chatId && !chatLinks[chatId]) {
          try {
            const chatResponse = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId }),
            })

            if (chatResponse.ok) {
              const result = await chatResponse.json()
              if (result.ok) {
                const info = result.result
                const link = info.username
                  ? `https://t.me/${info.username}`
                  : info.invite_link || `https://t.me/c/${String(chatId).replace("-100", "")}`
                chatLinks[chatId] = link
                cache.set("chat_links", chatLinks)
                appendLog(`🔗 Cached chat link for ${chatId}`)
              }
            }
          } catch (error) {
            appendLog(`❌ Error fetching chat info: ${error}`)
          }
        }

        // Send a concise text message for any chat-scoped update
        if (chatId) {
          await sendText(botToken, chatId, `📝 ${summary}`)

          // Existing ad response logic preserved
          const ads = cache.get("ads") || {}
          const ad = ads.temporary || ads.permanent

          if (ad && ad.imageSource && ad.captionText) {
            try {
              const adResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  photo: ad.imageSource,
                  caption: ad.captionText,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: ad.actionLinks.map((l: any) => [{ text: l.linkText, url: l.linkDestination }]),
                  },
                }),
              })

              if (adResponse.ok) {
                appendLog(`📤 Sent ad to chat ${chatId} via ${shortToken}`)
              } else {
                const errorText = await adResponse.text()
                appendLog(`❌ Failed to send ad: ${errorText}`)
              }
            } catch (error) {
              appendLog(`❌ Error sending ad: ${error}`)
            }
          }
        } else {
          // No chat context (inline_query, poll, etc.) — counted above; nothing to send
          appendLog(`ℹ️ Non-chat update received (no chat_id).`)
        }

        return new Response("OK")
      } catch (error) {
        appendLog(`❌ Webhook processing error: ${error}`)
        return new Response("Error processing webhook", { status: 500 })
      }
    }

    if (method === "POST" && path === "/clear-cache" && pass === "admin10082") {
      try {
        cache.flushAll()
        // Reinitialize ads after clearing cache
        cache.set("ads", {
          permanent: {
            imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
            captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥\n\n💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥\n\n🎬 <i>Fresh leaked content daily</i>\n🔞 <b>18+ Adult Material</b>\n💎 <i>Premium quality videos & files</i>\n🚀 <b>Instant access available</b>\n\n⬇️ <b><u>Click any server below</u></b> ⬇️`,
            actionLinks: [
              { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+Go8FEdh9M8Y3ZWU1" },
              { linkText: "📁 FILES🍑", linkDestination: "https://t.me/+06bZb-fbn4kzNjll" },
            ],
          },
          temporary: null,
        })
        appendLog(`🗑️ All cache data cleared and reset`)
        return new Response(
          `<script>alert('🗑️ All cache cleared and reset');location.href='/?pass=admin10082'</script>`,
          {
            headers: { "Content-Type": "text/html" },
          },
        )
      } catch (error) {
        appendLog(`❌ Error clearing cache: ${error}`)
        return new Response(`<script>alert('❌ Error clearing cache');location.href='/?pass=admin10082'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }
    }

    return new Response("Not Found", { status: 404 })
  },
})

console.log("✅ Enhanced Telegram bot webhook dashboard is live on http://localhost:3000")
console.log("🔐 Admin password: admin10082")
console.log("📊 Features: Auto-log trimming at 100KB, Enhanced webhook management, Better error handling, IP banning")
