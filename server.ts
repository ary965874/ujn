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
}

interface LogEntry {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS"
  message: string
  details?: any
}

const cache = new NodeCache()

cache.set("logs", [] as LogEntry[])

const logger = {
  // Calculate approximate size of logs in bytes
  getLogsSize(): number {
    const logs = (cache.get("logs") as LogEntry[]) || []
    return JSON.stringify(logs).length * 2 // Rough estimate (UTF-16)
  },

  // Clear logs if size exceeds 1MB
  checkAndClearLogs() {
    const sizeInBytes = this.getLogsSize()
    const sizeInMB = sizeInBytes / (1024 * 1024)

    if (sizeInMB > 1) {
      cache.set("logs", [])
      this.log("WARN", `Logs cleared - size exceeded 1MB (${sizeInMB.toFixed(2)}MB)`, {
        previousSize: `${sizeInMB.toFixed(2)}MB`,
        clearedAt: new Date().toISOString(),
      })
    }
  },

  log(level: LogEntry["level"], message: string, details?: any) {
    // Check and clear logs if needed before adding new entry
    this.checkAndClearLogs()

    const timestamp = new Date().toISOString()
    const logEntry: LogEntry = { timestamp, level, message, details }

    // Console output with colors
    const colors = {
      INFO: "\x1b[36m", // Cyan
      WARN: "\x1b[33m", // Yellow
      ERROR: "\x1b[31m", // Red
      SUCCESS: "\x1b[32m", // Green
    }
    const reset = "\x1b[0m"

    console.log(`${colors[level]}[${level}] ${timestamp} - ${message}${reset}`)
    if (details) console.log(`${colors[level]}Details:${reset}`, details)

    // Store in cache (keep last 200 logs instead of 100 for better visibility)
    const logs = (cache.get("logs") as LogEntry[]) || []
    logs.unshift(logEntry)
    if (logs.length > 200) logs.pop()
    cache.set("logs", logs)
  },

  info(message: string, details?: any) {
    this.log("INFO", message, details)
  },
  warn(message: string, details?: any) {
    this.log("WARN", message, details)
  },
  error(message: string, details?: any) {
    this.log("ERROR", message, details)
  },
  success(message: string, details?: any) {
    this.log("SUCCESS", message, details)
  },
}

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

async function broadcastInBatches(bots: string[], chatIds: string[], ad: any, batchSize = 5, delayMs = 1000) {
  logger.info(`Starting batch broadcast to ${chatIds.length} chats using ${bots.length} bots`)

  let totalSent = 0
  let totalErrors = 0

  for (const bot of bots) {
    logger.info(`Broadcasting with bot: ${bot.substring(0, 10)}...`)

    // Process chats in batches
    for (let i = 0; i < chatIds.length; i += batchSize) {
      const batch = chatIds.slice(i, i + batchSize)
      logger.info(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chatIds.length / batchSize)} (${batch.length} chats)`,
      )

      // Send to all chats in current batch simultaneously
      const promises = batch.map(async (chatId) => {
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
            totalSent++
            return { success: true, chatId }
          } else {
            const error = await response.text()
            totalErrors++
            logger.warn(`Failed to send to chat ${chatId}`, { error })
            return { success: false, chatId, error }
          }
        } catch (error) {
          totalErrors++
          logger.error(`Error sending to chat ${chatId}`, { error })
          return { success: false, chatId, error }
        }
      })

      await Promise.allSettled(promises)

      // Delay between batches to avoid rate limits
      if (i + batchSize < chatIds.length) {
        logger.info(`Waiting ${delayMs}ms before next batch...`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    // Delay between bots
    if (bots.indexOf(bot) < bots.length - 1) {
      logger.info(`Waiting 2s before switching to next bot...`)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  logger.success(`Broadcast completed! Sent: ${totalSent}, Errors: ${totalErrors}`)
  return { totalSent, totalErrors }
}

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname
    const method = req.method
    const pass = url.searchParams.get("pass")

    if (method === "GET" && path === "/") {
      if (pass !== "admin123") {
        return new Response(`<form><input name='pass'><button>Login</button></form>`, {
          headers: { "Content-Type": "text/html" },
        })
      }

      const stats = {
        total: cache.get("total_messages") || 0,
        users: Array.from(new Set((cache.get("users") || []) as string[])),
        bots: Array.from(new Set((cache.get("bots") || []) as string[])),
        chatLinks: cache.get("chat_links") || {},
        ads: cache.get("ads") || {},
        logs: (cache.get("logs") as LogEntry[]) || [],
      }

      const channelLinks = Object.entries(stats.chatLinks)
        .map(([_, link]: any) => `<li><a target="_blank" href="${link}">${link}</a></li>`)
        .join("")

      const logsHtml = stats.logs
        .map((log, index) => {
          const levelColors = {
            INFO: "#3b82f6",
            WARN: "#f59e0b",
            ERROR: "#ef4444",
            SUCCESS: "#10b981",
          }
          const levelBgColors = {
            INFO: "#1e3a8a20",
            WARN: "#92400e20",
            ERROR: "#7f1d1d20",
            SUCCESS: "#14532d20",
          }
          const time = new Date(log.timestamp).toLocaleString()
          const timeAgo = Math.floor((Date.now() - new Date(log.timestamp).getTime()) / 1000)
          const timeAgoText =
            timeAgo < 60
              ? `${timeAgo}s ago`
              : timeAgo < 3600
                ? `${Math.floor(timeAgo / 60)}m ago`
                : `${Math.floor(timeAgo / 3600)}h ago`

          return `
          <div class="log-entry" data-level="${log.level}" style="
            margin: 8px 0; 
            padding: 12px; 
            border-left: 4px solid ${levelColors[log.level]}; 
            background: linear-gradient(90deg, ${levelBgColors[log.level]}, transparent);
            border-radius: 0 8px 8px 0;
            transition: all 0.2s ease;
          " onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform='translateX(0)'">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="
                color: ${levelColors[log.level]}; 
                font-weight: bold; 
                font-size: 0.9em;
                padding: 2px 8px;
                background: ${levelColors[log.level]}20;
                border-radius: 12px;
              ">${log.level}</span>
              <div style="font-size: 0.8em; color: #888;">
                <span title="${time}">${timeAgoText}</span>
                <span style="margin-left: 8px; color: #666;">#${index + 1}</span>
              </div>
            </div>
            <div style="color: #e5e5e5; font-size: 0.95em; line-height: 1.4; margin-bottom: 4px;">
              ${log.message}
            </div>
            ${
              log.details
                ? `
              <details style="margin-top: 8px;">
                <summary style="color: #999; cursor: pointer; font-size: 0.85em;">📋 Details</summary>
                <pre style="
                  margin: 8px 0 0 0; 
                  font-size: 0.8em; 
                  color: #ccc; 
                  background: #0a0a0a; 
                  padding: 8px; 
                  border-radius: 4px;
                  overflow-x: auto;
                  border: 1px solid #333;
                ">${JSON.stringify(log.details, null, 2)}</pre>
              </details>
            `
                : ""
            }
          </div>
        `
        })
        .join("")

      const logsSizeInfo = `
        <div style="background: #1a1a1a; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 0.9em;">
          📊 Logs: ${stats.logs.length} entries | Size: ${(logger.getLogsSize() / 1024).toFixed(1)}KB | 
          <span style="color: #10b981;">Auto-clear at 1MB</span>
        </div>
        <div style="margin-bottom: 10px;">
          <input type="text" id="logSearch" placeholder="🔍 Search logs..." style="
            width: 100%; 
            padding: 8px 12px; 
            background: #1a1a1a; 
            border: 1px solid #333; 
            border-radius: 6px; 
            color: white;
          " oninput="filterLogs(this.value)">
          <div style="margin-top: 6px; font-size: 0.85em;">
            <button onclick="filterByLevel('INFO')" style="margin: 2px; padding: 4px 8px; font-size: 0.8em; background: #3b82f6;">INFO</button>
            <button onclick="filterByLevel('WARN')" style="margin: 2px; padding: 4px 8px; font-size: 0.8em; background: #f59e0b;">WARN</button>
            <button onclick="filterByLevel('ERROR')" style="margin: 2px; padding: 4px 8px; font-size: 0.8em; background: #ef4444;">ERROR</button>
            <button onclick="filterByLevel('SUCCESS')" style="margin: 2px; padding: 4px 8px; font-size: 0.8em; background: #10b981;">SUCCESS</button>
            <button onclick="filterByLevel('')" style="margin: 2px; padding: 4px 8px; font-size: 0.8em; background: #666;">ALL</button>
          </div>
        </div>
      `

      const form = (type: string, ad: any) => `
        <h3>${type.toUpperCase()} AD</h3>
        <form method='POST' action='/update-ad?type=${type}&pass=admin123'>
          <input name='imageSource' placeholder='Image URL' value="${ad?.imageSource || ""}" style='width:100%'><br>
          <textarea name='captionText' placeholder='Caption' rows=6 style='width:100%'>${ad?.captionText || ""}</textarea><br>
          <textarea name='actionLinks' placeholder='[{\"linkText\":\"Text\", \"linkDestination\":\"URL\"}]' style='width:100%'>${JSON.stringify(ad?.actionLinks || [], null, 2)}</textarea><br>
          <button>Update ${type} Ad</button>
        </form>`

      return new Response(
        `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { background:black; color:white; font-family:sans-serif; padding:2em; }
        h1, h2, h3 { color: #f97316; }
        button { padding: 10px 20px; margin: 10px 0; background: #f97316; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer; }
        textarea, input { margin: 5px 0; padding: 10px; border-radius: 5px; border: none; }
        pre { background: #1e1e1e; padding: 1em; border-radius: 8px; max-height: 300px; overflow-y: auto; }
        ul { padding-left: 1.2em; }
        .batch-controls { background: #1a1a1a; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .logs-container { background: #0a0a0a; padding: 15px; border-radius: 8px; max-height: 500px; overflow-y: auto; border: 1px solid #333; }
        .log-entry { transition: all 0.2s ease; }
        .log-entry.hidden { display: none; }
      </style></head><body>
        <h1>📊 Bot Dashboard</h1>
        <p><b>Total Messages:</b> ${stats.total}</p>
        <p><b>Users:</b> ${stats.users.length}</p>
        <p><b>Bots:</b> ${stats.bots.length}</p>
        
        <div class="batch-controls">
          <h3>📢 Batch Broadcasting</h3>
          <form method='POST' action='/send-to-channels?pass=admin123' style="display: inline-block; margin-right: 10px;">
            <input type="hidden" name="batchSize" value="5">
            <input type="hidden" name="delayMs" value="1000">
            <button type='submit'>🚀 Send Ads (Batch: 5, Delay: 1s)</button>
          </form>
          <form method='POST' action='/send-to-channels?pass=admin123' style="display: inline-block; margin-right: 10px;">
            <input type="hidden" name="batchSize" value="10">
            <input type="hidden" name="delayMs" value="500">
            <button type='submit'>⚡ Fast Send (Batch: 10, Delay: 0.5s)</button>
          </form>
          <form method='POST' action='/send-to-channels?pass=admin123' style="display: inline-block;">
            <input type="hidden" name="batchSize" value="3">
            <input type="hidden" name="delayMs" value="2000">
            <button type='submit'>🐌 Safe Send (Batch: 3, Delay: 2s)</button>
          </form>
        </div>
        
        <h2>📂 Channels / Groups / Users</h2>
        <ul>${channelLinks}</ul>
        
        ${form("permanent", stats.ads.permanent)}
        ${form("temporary", stats.ads.temporary)}
        
        <h2>📋 System Logs</h2>
        <div class="logs-container">
          ${logsSizeInfo}
          <div id="logsContent">
            ${logsHtml || '<p style="color: #888;">No logs yet...</p>'}
          </div>
        </div>
        
        <script>
          function filterLogs(searchTerm) {
            const logs = document.querySelectorAll('.log-entry');
            logs.forEach(log => {
              const text = log.textContent.toLowerCase();
              if (text.includes(searchTerm.toLowerCase()) || searchTerm === '') {
                log.classList.remove('hidden');
              } else {
                log.classList.add('hidden');
              }
            });
          }
          
          function filterByLevel(level) {
            const logs = document.querySelectorAll('.log-entry');
            logs.forEach(log => {
              if (level === '' || log.dataset.level === level) {
                log.classList.remove('hidden');
              } else {
                log.classList.add('hidden');
              }
            });
            document.getElementById('logSearch').value = '';
          }
          
          // Auto-refresh logs every 15 seconds (increased from 10s)
          setTimeout(() => location.reload(), 15000);
        </script>
      </body></html>`,
        { headers: { "Content-Type": "text/html" } },
      )
    }

    if (method === "POST" && path === "/send-to-channels" && pass === "admin123") {
      const formData = await req.formData()
      const batchSize = Number.parseInt(formData.get("batchSize")?.toString() || "5")
      const delayMs = Number.parseInt(formData.get("delayMs")?.toString() || "1000")

      const bots = Array.from(new Set((cache.get("bots") || []) as string[]))
      const chatLinks = cache.get("chat_links") || {}
      const ads = cache.get("ads") || {}
      const ad = ads.temporary || ads.permanent

      if (!ad) {
        logger.error("No ad configured for broadcasting")
        return new Response(`<script>alert('❌ No ad configured');location.href='/?pass=admin123'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }

      const chatIds = Object.keys(chatLinks)
      logger.info(`Starting broadcast with batch size: ${batchSize}, delay: ${delayMs}ms`)

      // Run broadcast in background
      broadcastInBatches(bots, chatIds, ad, batchSize, delayMs).catch((error) => {
        logger.error("Broadcast failed", { error })
      })

      return new Response(
        `<script>alert('✅ Batch broadcast started! Check logs for progress.');location.href='/?pass=admin123'</script>`,
        { headers: { "Content-Type": "text/html" } },
      )
    }

    if (method === "POST" && path === "/update-ad" && pass === "admin123") {
      const formData = await req.formData()
      const type = url.searchParams.get("type")!
      const imageSource = formData.get("imageSource")?.toString()
      const captionText = formData.get("captionText")?.toString()
      const actionLinksRaw = formData.get("actionLinks")?.toString()
      try {
        const ads = cache.get("ads") || {}
        ads[type] = {
          imageSource,
          captionText,
          actionLinks: JSON.parse(actionLinksRaw || "[]"),
        }
        cache.set("ads", ads)
        logger.success(`${type.toUpperCase()} ad updated successfully`)
        return new Response(
          `<script>alert('✅ ${type.toUpperCase()} ad updated');location.href='/?pass=admin123'</script>`,
          { headers: { "Content-Type": "text/html" } },
        )
      } catch (error) {
        logger.error(`Failed to update ${type} ad`, { error })
        return new Response(`<script>alert('❌ Invalid input');location.href='/?pass=admin123'</script>`, {
          headers: { "Content-Type": "text/html" },
        })
      }
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "")
      const update: TelegramUpdate = await req.json()

      const bots = cache.get("bots") || []
      cache.set("bots", Array.from(new Set([...(bots as string[]), botToken])))

      const activity =
        update.message ||
        update.edited_message ||
        update.channel_post ||
        update.edited_channel_post ||
        update.my_chat_member ||
        update.chat_member ||
        update.chat_join_request

      if (!activity) {
        logger.warn("Webhook received but no recognizable activity found", { update })
        return new Response("No Activity")
      }

      const chatId = activity.chat?.id || activity.chat?.chat?.id || activity.from?.id
      const userId = activity.from?.id?.toString()
      const userName = activity.from?.username || activity.from?.first_name || "Unknown"
      const chatType = activity.chat?.type || "unknown"
      const chatTitle = activity.chat?.title || activity.chat?.username || "Private Chat"

      const users = cache.get("users") || []
      if (userId) {
        cache.set("users", Array.from(new Set([...(users as string[]), userId])))
      }

      const activityType = Object.keys(update)[0]
      const messageText = activity.text || activity.caption || "No text content"

      logger.info(`📨 Activity detected: ${activityType}`, {
        botToken: `${botToken.substring(0, 10)}...`,
        chatId,
        chatType: chatType.toUpperCase(),
        chatTitle,
        userId,
        userName,
        messagePreview: messageText.substring(0, 100),
        timestamp: new Date().toISOString(),
      })

      const chatLinks = cache.get("chat_links") || {}

      if (!chatLinks[chatId]) {
        logger.info(`🔍 Discovering new chat: ${chatTitle} (${chatType})`, { chatId })

        fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId }),
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.ok) {
              const info = result.result
              const link = info.username
                ? `https://t.me/${info.username}`
                : info.invite_link || `https://t.me/c/${String(chatId).replace("-100", "")}`

              chatLinks[chatId] = link
              cache.set("chat_links", chatLinks)

              logger.success(`✅ New ${info.type} discovered: ${info.title || info.username || "Private Chat"}`, {
                link,
                chatType: info.type,
                memberCount: info.member_count || "Unknown",
              })
            } else {
              logger.warn(`❌ Failed to get chat info for ${chatId}`, {
                error: result.description,
                chatType,
                chatTitle,
              })
            }
          })
          .catch((error) => {
            logger.error(`🚨 Error getting chat info for ${chatId}`, {
              error: error.message,
              chatType,
              chatTitle,
            })
          })
      }

      const ads = cache.get("ads") || {}
      const ad = ads.temporary || ads.permanent

      if (ad) {
        logger.info(`📤 Sending ad to ${chatType}: ${chatTitle}`, {
          chatId,
          adType: ads.temporary ? "temporary" : "permanent",
        })

        fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
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
          .then(async (response) => {
            if (response.ok) {
              logger.success(`✅ Ad sent successfully to ${chatType}: ${chatTitle}`, { chatId })
            } else {
              const errorText = await response.text()
              logger.error(`❌ Failed to send ad to ${chatType}: ${chatTitle}`, {
                chatId,
                error: errorText,
                statusCode: response.status,
              })
            }
          })
          .catch((error) => {
            logger.error(`🚨 Network error sending ad to ${chatType}: ${chatTitle}`, {
              chatId,
              error: error.message,
            })
          })
      } else {
        logger.warn(`⚠️ No ad configured - skipping send to ${chatType}: ${chatTitle}`, { chatId })
      }

      const total = (cache.get("total_messages") as number) || 0
      cache.set("total_messages", total + 1)

      return new Response("OK")
    }

    return new Response("Not Found", { status: 404 })
  },
})

logger.success("✅ Enhanced bot dashboard with auto-clearing logs is live on http://localhost:3000")
