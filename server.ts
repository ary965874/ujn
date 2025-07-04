import { serve } from "bun"
import NodeCache from "node-cache"

// Core Interfaces
interface TelegramAPIResponse {
  ok: boolean
  description?: string
  result?: any
  parameters?: { retry_after?: number }
}

interface LogEntry {
  id: string
  timestamp: string
  botToken: string
  status: "success" | "failed" | "rate_limited"
  responseTime: number
  errorMessage?: string
  botName?: string
  userAgent?: string
  clientIP?: string
}

interface SystemMetrics {
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

interface BotInfo {
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

interface Campaign {
  id: string
  type: "photo_with_buttons"
  active: boolean
  priority: number
  content: {
    photos: string[]
    caption: string
    buttons: Array<{
      text: string
      url: string
    }>
  }
  targeting: {
    chatTypes: string[]
  }
  metrics: {
    impressions: number
    clicks: number
    lastShown?: string
  }
}

interface UserInteraction {
  id: string
  timestamp: string
  botName: string
  botToken: string
  user: {
    id: number
    name: string
    username: string
    language?: string
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
    clientIP?: string
    responseTime: number
  }
}

// System Configuration
const SYSTEM_CONFIG = {
  MAX_INTERACTION_BUFFER: 15,
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

// Bot Configuration
const MAIN_BOT = {
  name: "primary",
  token: "5487595571:AAF9U10ETqOjNpVrEhT6MQONIta6PJUXSB0",
  health: 100,
  lastUsed: 0,
}

// Single Campaign Configuration
const ACTIVE_CAMPAIGNS: Campaign[] = [
  {
    id: "premium_content_campaign",
    type: "photo_with_buttons",
    active: true,
    priority: 1,
    content: {
      photos: ["https://i.ibb.co/69jxy9f/image.png"],
      caption: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥

💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥

🎬 <i>Fresh leaked content daily</i>
🔞 <b>18+ Adult Material</b>
💎 <i>Premium quality videos & files</i>
🚀 <b>Instant access available</b>

⬇️ <b><u>Click any server below</u></b> ⬇️

<blockquote>⚠️ <b>Limited time offer - Join now!</b></blockquote>`,
      buttons: [
        { text: "🎥 VIDEOS💦", url: "https://t.me/+NiLqtvjHQoFhZjQ1" },
        { text: "📁 FILES🍑", url: "https://t.me/+fvFJeSbZEtc2Yjg1" },
      ],
    },
    targeting: {
      chatTypes: ["private", "group"],
    },
    metrics: { impressions: 0, clicks: 0 },
  },
]

// Memory Cache
const memoryCache = new NodeCache({
  stdTTL: SYSTEM_CONFIG.CACHE_TTL,
  checkperiod: 600,
  useClones: false,
  maxKeys: 10000,
})

// System State Manager
class SystemStateManager {
  private static instance: SystemStateManager
  public startTime: number = Date.now()
  public interactionBuffer: UserInteraction[] = []
  public activeConnections = 0
  public rateLimitTracker: Map<string, { count: number; resetTime: number }> = new Map()

  static getInstance(): SystemStateManager {
    if (!SystemStateManager.instance) {
      SystemStateManager.instance = new SystemStateManager()
    }
    return SystemStateManager.instance
  }

  addConnection(): void {
    this.activeConnections++
  }

  removeConnection(): void {
    this.activeConnections = Math.max(0, this.activeConnections - 1)
  }

  logInteraction(interaction: UserInteraction): void {
    this.interactionBuffer.unshift(interaction)
    if (this.interactionBuffer.length > SYSTEM_CONFIG.MAX_INTERACTION_BUFFER * 2) {
      this.interactionBuffer = this.interactionBuffer.slice(0, SYSTEM_CONFIG.MAX_INTERACTION_BUFFER)
    }
  }

  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage()
    const uptime = Date.now() - this.startTime

    const totalRequests = (memoryCache.get("totalRequests") as number) || 0
    const successfulRequests = (memoryCache.get("successfulRequests") as number) || 0
    const failedRequests = (memoryCache.get("failedRequests") as number) || 0
    const rateLimitedRequests = (memoryCache.get("rateLimitedRequests") as number) || 0
    const totalResponseTime = (memoryCache.get("totalResponseTime") as number) || 0

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

const systemState = SystemStateManager.getInstance()

// Utility Helper Functions
class HelperUtils {
  static cleanText(text: string): string {
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

  static createUniqueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  static formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  static formatFileSize(bytes: number): string {
    const sizes = ["Bytes", "KB", "MB", "GB"]
    if (bytes === 0) return "0 Bytes"
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  static extractClientIP(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for")
    const realIP = req.headers.get("x-real-ip")
    const cfIP = req.headers.get("cf-connecting-ip")
    return cfIP || realIP || forwarded?.split(",")[0] || "unknown"
  }

  static checkRateLimit(identifier: string): boolean {
    const now = Date.now()
    const rateLimitData = systemState.rateLimitTracker.get(identifier)

    if (!rateLimitData || now > rateLimitData.resetTime) {
      systemState.rateLimitTracker.set(identifier, {
        count: 1,
        resetTime: now + SYSTEM_CONFIG.RATE_LIMIT_WINDOW,
      })
      return false
    }

    if (rateLimitData.count >= SYSTEM_CONFIG.RATE_LIMIT_MAX_REQUESTS) {
      return true
    }

    rateLimitData.count++
    return false
  }
}

// Request Logger
class RequestLogger {
  static saveLog(entry: Partial<LogEntry>): void {
    const logEntry: LogEntry = {
      id: HelperUtils.createUniqueId(),
      timestamp: new Date().toISOString(),
      botToken: entry.botToken || "unknown",
      status: entry.status || "failed",
      responseTime: entry.responseTime || 0,
      errorMessage: entry.errorMessage,
      botName: entry.botName,
      userAgent: entry.userAgent,
      clientIP: entry.clientIP,
    }

    const requestLog = (memoryCache.get("requestLog") as LogEntry[]) || []
    requestLog.unshift(logEntry)

    if (requestLog.length > 1000) {
      requestLog.splice(500)
    }

    memoryCache.set("requestLog", requestLog)

    // Update metrics
    const totalRequests = ((memoryCache.get("totalRequests") as number) || 0) + 1
    memoryCache.set("totalRequests", totalRequests)

    if (entry.status === "success") {
      const successfulRequests = ((memoryCache.get("successfulRequests") as number) || 0) + 1
      memoryCache.set("successfulRequests", successfulRequests)
    } else if (entry.status === "rate_limited") {
      const rateLimitedRequests = ((memoryCache.get("rateLimitedRequests") as number) || 0) + 1
      memoryCache.set("rateLimitedRequests", rateLimitedRequests)
    } else {
      const failedRequests = ((memoryCache.get("failedRequests") as number) || 0) + 1
      memoryCache.set("failedRequests", failedRequests)
    }

    if (entry.responseTime) {
      const totalResponseTime = ((memoryCache.get("totalResponseTime") as number) || 0) + entry.responseTime
      memoryCache.set("totalResponseTime", totalResponseTime)
    }
  }

  static formatInteractionLogs(interactions: UserInteraction[]): string {
    return interactions
      .map((interaction, index) => {
        const user = interaction.user
        const chat = interaction.chat

        return `${index + 1}. <b>Bot:</b> @${HelperUtils.cleanText(interaction.botName)}
<b>User:</b> ${HelperUtils.cleanText(user.name)} (@${HelperUtils.cleanText(user.username)})
<b>User ID:</b> <code>${user.id}</code>
<b>Chat Type:</b> <code>${HelperUtils.cleanText(chat.type)}</code>
<b>Update Type:</b> <code>${HelperUtils.cleanText(interaction.updateType)}</code>
<b>Time:</b> <code>${new Date(interaction.timestamp).toLocaleString()}</code>
<b>Response Time:</b> <code>${interaction.metadata.responseTime.toFixed(2)}ms</code>
<b>Token:</b> <code>${interaction.botToken.substring(0, 10)}...</code>`
      })
      .join("\n\n")
  }
}

// Telegram API Client
class TelegramClient {
  private static circuitBreaker: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map()

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = SYSTEM_CONFIG.RETRY_ATTEMPTS,
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
  ): Promise<TelegramAPIResponse> {
    const messageData = {
      chat_id: chatId,
      text: text.substring(0, 4096),
      parse_mode: options.parse_mode || "HTML",
      disable_web_page_preview: options.disable_web_page_preview || false,
      ...options,
    }

    return this.makeAPIRequest(botToken, "sendMessage", messageData)
  }

  static async sendPhotoMessage(
    botToken: string,
    chatId: string | number,
    photo: string,
    options: {
      caption?: string
      parse_mode?: "HTML" | "Markdown"
      reply_markup?: any
    } = {},
  ): Promise<TelegramAPIResponse> {
    const messageData = {
      chat_id: chatId,
      photo,
      caption: options.caption?.substring(0, 1024),
      parse_mode: options.parse_mode || "HTML",
      ...options,
    }

    return this.makeAPIRequest(botToken, "sendPhoto", messageData)
  }

  static async getBotInformation(botToken: string): Promise<BotInfo> {
    return this.makeAPIRequest(botToken, "getMe", {}) as Promise<BotInfo>
  }

  static async answerInlineQuery(
    botToken: string,
    inlineQueryId: string,
    results: any[],
    options: { cache_time?: number } = {},
  ): Promise<TelegramAPIResponse> {
    const queryData = {
      inline_query_id: inlineQueryId,
      results: results.slice(0, 50),
      cache_time: options.cache_time || 1,
    }

    return this.makeAPIRequest(botToken, "answerInlineQuery", queryData)
  }

  private static async makeAPIRequest(botToken: string, method: string, data: any): Promise<TelegramAPIResponse> {
    const circuitKey = `${botToken}_${method}`
    const circuit = this.circuitBreaker.get(circuitKey)

    if (circuit?.isOpen && Date.now() - circuit.lastFailure < 60000) {
      throw new Error("Circuit breaker is open")
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), SYSTEM_CONFIG.REQUEST_TIMEOUT)

    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const result = (await response.json()) as TelegramAPIResponse

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

// Campaign Manager
class CampaignManager {
  static getActiveCampaigns(chatType?: string, userLanguage?: string, userId?: number): Campaign[] {
    return ACTIVE_CAMPAIGNS.filter((campaign) => {
      if (!campaign.active) return false

      if (campaign.targeting?.chatTypes && chatType) {
        if (!campaign.targeting.chatTypes.includes(chatType)) return false
      }

      return true
    }).sort((a, b) => a.priority - b.priority)
  }

  static trackCampaignMetric(campaignId: string, metricType: "impression" | "click"): void {
    const campaign = ACTIVE_CAMPAIGNS.find((c) => c.id === campaignId)
    if (!campaign) return

    switch (metricType) {
      case "impression":
        campaign.metrics.impressions++
        campaign.metrics.lastShown = new Date().toISOString()
        break
      case "click":
        campaign.metrics.clicks++
        break
    }

    const metricsKey = `campaign_metrics_${campaignId}`
    memoryCache.set(metricsKey, campaign.metrics)
  }

  static getCampaignAnalytics(): Array<{ id: string; metrics: any }> {
    return ACTIVE_CAMPAIGNS.map((campaign) => ({
      id: campaign.id,
      metrics: {
        ...campaign.metrics,
        ctr:
          campaign.metrics.impressions > 0
            ? ((campaign.metrics.clicks / campaign.metrics.impressions) * 100).toFixed(2) + "%"
            : "0%",
      },
    }))
  }

  static async deliverCampaigns(
    botToken: string,
    chatId: string | number,
    chatType: string,
    userLanguage?: string,
    userId?: number,
  ): Promise<void> {
    const campaigns = this.getActiveCampaigns(chatType, userLanguage, userId)
    const promises: Promise<any>[] = []

    for (const campaign of campaigns) {
      CampaignManager.trackCampaignMetric(campaign.id, "impression")

      if (campaign.type === "photo_with_buttons" && campaign.content.photos?.length) {
        const randomPhoto = campaign.content.photos[Math.floor(Math.random() * campaign.content.photos.length)]
        const buttons = campaign.content.buttons?.map((button) => [button]) || []

        promises.push(
          TelegramClient.executeWithRetry(() =>
            TelegramClient.sendPhotoMessage(botToken, chatId, randomPhoto, {
              caption: campaign.content.caption,
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
    const activeCampaigns = this.getActiveCampaigns()

    activeCampaigns.forEach((campaign, index) => {
      if (campaign.type === "photo_with_buttons" && campaign.content.photos?.length) {
        const randomPhoto = campaign.content.photos[Math.floor(Math.random() * campaign.content.photos.length)]
        const buttons = campaign.content.buttons?.map((button) => [button]) || []

        results.push({
          type: "photo",
          id: `campaign_${campaign.id}_${index}`,
          photo_url: randomPhoto,
          thumb_url: randomPhoto,
          caption: campaign.content.caption,
          parse_mode: "HTML",
          reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : undefined,
        })
      }
    })

    return results.slice(0, 10)
  }
}

// Log Bot Manager
class LogBotManager {
  private static botCooldownUntil = 0

  static async sendInteractionLogs(): Promise<void> {
    if (systemState.interactionBuffer.length < SYSTEM_CONFIG.MAX_INTERACTION_BUFFER) return
    if (Date.now() < this.botCooldownUntil) return

    const logsToSend = systemState.interactionBuffer.slice(0, SYSTEM_CONFIG.MAX_INTERACTION_BUFFER)
    const message = RequestLogger.formatInteractionLogs(logsToSend)

    try {
      await TelegramClient.executeWithRetry(() =>
        TelegramClient.sendTextMessage(MAIN_BOT.token, SYSTEM_CONFIG.LOG_CHANNEL_ID, message),
      )

      MAIN_BOT.health = Math.min(100, MAIN_BOT.health + 5)
      MAIN_BOT.lastUsed = Date.now()

      console.log(`✅ Logs sent successfully using ${MAIN_BOT.name} bot`)

      systemState.interactionBuffer.splice(0, SYSTEM_CONFIG.MAX_INTERACTION_BUFFER)
    } catch (error: any) {
      MAIN_BOT.health = Math.max(0, MAIN_BOT.health - 10)

      if (error.message?.includes("Too Many Requests")) {
        const retryAfter = error.parameters?.retry_after || 60
        this.botCooldownUntil = Date.now() + retryAfter * 1000
        console.warn(`⚠️ ${MAIN_BOT.name} bot rate limited for ${retryAfter}s`)
      } else {
        console.error(`❌ Failed to send logs with ${MAIN_BOT.name} bot:`, error.message)
      }
    }
  }

  static getBotHealthInfo(): Array<{ name: string; health: number; lastUsed: number; inCooldown: boolean }> {
    const now = Date.now()
    return [
      {
        name: MAIN_BOT.name,
        health: MAIN_BOT.health,
        lastUsed: MAIN_BOT.lastUsed,
        inCooldown: this.botCooldownUntil > now,
      },
    ]
  }
}

// Update Processor
async function processIncomingUpdate(
  update: TelegramUpdate,
  botToken: string,
  userAgent: string,
  clientIP: string,
  startTime: number,
): Promise<void> {
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

  const botInfo = await TelegramClient.getBotInformation(botToken)
  const botName = botInfo.ok && botInfo.result ? botInfo.result.username : "unknown"

  if (user) {
    const interaction: UserInteraction = {
      id: HelperUtils.createUniqueId(),
      timestamp: new Date().toISOString(),
      botName,
      botToken,
      user: {
        id: user.id,
        name: user.last_name ? `${user.first_name} ${user.last_name}` : user.first_name,
        username: user.username || "none",
        language: user.language_code,
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
        clientIP,
        responseTime: performance.now() - startTime,
      },
    }

    systemState.logInteraction(interaction)

    if (systemState.interactionBuffer.length >= SYSTEM_CONFIG.MAX_INTERACTION_BUFFER) {
      LogBotManager.sendInteractionLogs().catch((error) => console.error("❌ Background log sending failed:", error))
    }
  }

  if (updateType === "inline_query" && update.inline_query?.id) {
    const results = CampaignManager.generateInlineResults()
    await TelegramClient.answerInlineQuery(botToken, update.inline_query.id, results)
    return
  }

  if (chatId && chat) {
    const userId = user?.id
    CampaignManager.deliverCampaigns(botToken, chatId, chat.type, user?.language_code, userId).catch((error) =>
      console.error("❌ Campaign delivery failed:", error),
    )
  }
}

// Status Page Handler
function generateStatusPage(): Response {
  const metrics = systemState.getSystemMetrics()
  const uptime = HelperUtils.formatDuration(metrics.uptime)

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bot Server Status</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .status-container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(15px);
            border-radius: 25px;
            padding: 50px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
            text-align: center;
            max-width: 600px;
            width: 100%;
        }
        .status-icon {
            font-size: 5rem;
            margin-bottom: 25px;
            animation: bounce 2s infinite;
        }
        @keyframes bounce {
            0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-10px); }
            60% { transform: translateY(-5px); }
        }
        h1 {
            color: #2d3748;
            margin-bottom: 35px;
            font-size: 2.5rem;
            font-weight: 800;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 25px;
            margin-bottom: 35px;
        }
        .metric-card {
            background: #f8fafc;
            padding: 25px;
            border-radius: 15px;
            border-left: 5px solid #4299e1;
            transition: transform 0.3s ease;
        }
        .metric-card:hover {
            transform: translateY(-5px);
        }
        .metric-value {
            font-size: 1.8rem;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 8px;
        }
        .metric-label {
            color: #718096;
            font-size: 1rem;
            font-weight: 600;
        }
        .status-indicator {
            display: inline-block;
            background: #48bb78;
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-weight: 700;
            margin-bottom: 25px;
            font-size: 1.1rem;
        }
        .footer-info {
            color: #718096;
            font-size: 0.9rem;
            margin-top: 25px;
        }
    </style>
</head>
<body>
    <div class="status-container">
        <div class="status-icon">🚀</div>
        <h1>System Status</h1>
        <div class="status-indicator">🟢 Online & Operational</div>
        
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${uptime}</div>
                <div class="metric-label">System Uptime</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.totalRequests.toLocaleString()}</div>
                <div class="metric-label">Total Requests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.activeConnections}</div>
                <div class="metric-label">Active Connections</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.averageResponseTime.toFixed(1)}ms</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
        </div>
        
        <div class="footer-info">
            <p>🤖 Advanced Telegram Bot Server</p>
            <p>Last updated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  })
}

// Dashboard Handler
function generateDashboard(url: URL): Response {
  const password = url.searchParams.get("pass")

  if (password !== SYSTEM_CONFIG.DASHBOARD_PASSWORD) {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Access</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .access-container {
            background: white;
            padding: 50px;
            border-radius: 25px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
            text-align: center;
            max-width: 450px;
            width: 100%;
        }
        .lock-icon {
            font-size: 4rem;
            margin-bottom: 25px;
            color: #4299e1;
        }
        h1 {
            color: #2d3748;
            margin-bottom: 35px;
            font-size: 2rem;
            font-weight: 700;
        }
        .input-group {
            margin-bottom: 25px;
            text-align: left;
        }
        label {
            display: block;
            margin-bottom: 10px;
            color: #4a5568;
            font-weight: 700;
        }
        input[type="password"] {
            width: 100%;
            padding: 15px 20px;
            border: 2px solid #e2e8f0;
            border-radius: 10px;
            font-size: 1.1rem;
            transition: border-color 0.3s;
        }
        input[type="password"]:focus {
            outline: none;
            border-color: #4299e1;
        }
        .access-btn {
            width: 100%;
            padding: 15px;
            background: #4299e1;
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        .access-btn:hover {
            background: #3182ce;
        }
        .error-message {
            color: #e53e3e;
            margin-top: 20px;
            font-size: 1rem;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="access-container">
        <div class="lock-icon">🔒</div>
        <h1>Dashboard Access</h1>
        <form method="GET" action="/status">
            <div class="input-group">
                <label for="password">Enter Access Password:</label>
                <input type="password" id="password" name="pass" required>
            </div>
            <button type="submit" class="access-btn">Access Dashboard</button>
        </form>
        ${password ? '<div class="error-message">❌ Invalid password. Please try again.</div>' : ""}
    </div>
</body>
</html>`

    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    })
  }

  const metrics = systemState.getSystemMetrics()
  const requestLog = (memoryCache.get("requestLog") as LogEntry[]) || []
  const recentLogs = requestLog.slice(0, 20)
  const botHealthInfo = LogBotManager.getBotHealthInfo()

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
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f1f5f9;
            color: #1e293b;
            line-height: 1.6;
        }
        .dashboard-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 3rem;
            text-align: center;
        }
        .dashboard-header h1 {
            font-size: 3rem;
            margin-bottom: 0.5rem;
            font-weight: 800;
        }
        .dashboard-header p {
            opacity: 0.9;
            font-size: 1.2rem;
        }
        .dashboard-container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 3rem;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }
        .metric-card {
            background: white;
            padding: 2rem;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
            border-left: 5px solid #4299e1;
            transition: transform 0.3s ease;
        }
        .metric-card:hover {
            transform: translateY(-5px);
        }
        .metric-card.success { border-left-color: #10b981; }
        .metric-card.warning { border-left-color: #f59e0b; }
        .metric-card.error { border-left-color: #ef4444; }
        .metric-value {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 0.5rem;
        }
        .metric-label {
            color: #64748b;
            font-size: 1rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .dashboard-section {
            background: white;
            border-radius: 15px;
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
            margin-bottom: 3rem;
            overflow: hidden;
        }
        .section-header {
            background: #f8fafc;
            padding: 1.5rem 2rem;
            border-bottom: 1px solid #e2e8f0;
            font-weight: 700;
            font-size: 1.2rem;
        }
        .section-content {
            padding: 2rem;
        }
        .data-table {
            width: 100%;
            border-collapse: collapse;
        }
        .data-table th,
        .data-table td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        .data-table th {
            background: #f8fafc;
            font-weight: 700;
            color: #475569;
        }
        .status-success { color: #10b981; font-weight: 700; }
        .status-failed { color: #ef4444; font-weight: 700; }
        .status-rate_limited { color: #f59e0b; font-weight: 700; }
        .health-indicator {
            width: 100%;
            height: 10px;
            background: #e2e8f0;
            border-radius: 5px;
            overflow: hidden;
        }
        .health-fill {
            height: 100%;
            transition: width 0.3s ease;
        }
        .health-excellent { background: #10b981; }
        .health-good { background: #f59e0b; }
        .health-poor { background: #ef4444; }
        .refresh-button {
            position: fixed;
            bottom: 3rem;
            right: 3rem;
            background: #4299e1;
            color: white;
            border: none;
            padding: 1.2rem;
            border-radius: 50%;
            font-size: 1.5rem;
            cursor: pointer;
            box-shadow: 0 8px 25px rgba(66, 153, 225, 0.4);
            transition: transform 0.2s;
        }
        .refresh-button:hover {
            transform: scale(1.1);
        }
        @media (max-width: 768px) {
            .dashboard-container { padding: 1.5rem; }
            .metrics-grid { grid-template-columns: 1fr; }
            .data-table { font-size: 0.9rem; }
        }
    </style>
</head>
<body>
    <div class="dashboard-header">
        <h1>🚀 Advanced Bot Dashboard</h1>
        <p>Real-time monitoring and comprehensive analytics</p>
    </div>

    <div class="dashboard-container">
        <!-- System Metrics -->
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${metrics.totalRequests.toLocaleString()}</div>
                <div class="metric-label">Total Requests</div>
            </div>
            <div class="metric-card success">
                <div class="metric-value">${metrics.successfulRequests.toLocaleString()}</div>
                <div class="metric-label">Successful</div>
            </div>
            <div class="metric-card error">
                <div class="metric-value">${metrics.failedRequests.toLocaleString()}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric-card warning">
                <div class="metric-value">${metrics.rateLimitedRequests.toLocaleString()}</div>
                <div class="metric-label">Rate Limited</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.averageResponseTime.toFixed(1)}ms</div>
                <div class="metric-label">Avg Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${HelperUtils.formatDuration(metrics.uptime)}</div>
                <div class="metric-label">System Uptime</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.activeConnections}</div>
                <div class="metric-label">Active Connections</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${HelperUtils.formatFileSize(metrics.memoryUsage.heapUsed)}</div>
                <div class="metric-label">Memory Usage</div>
            </div>
        </div>

        <!-- Bot Health Status -->
        <div class="dashboard-section">
            <div class="section-header">🤖 Bot Health Status</div>
            <div class="section-content">
                <div class="metrics-grid">
                    ${botHealthInfo
                      .map(
                        (bot) => `
                        <div class="metric-card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                                <strong style="font-size: 1.1rem;">${bot.name}</strong>
                                <span style="color: ${bot.inCooldown ? "#f59e0b" : "#10b981"}; font-weight: 700;">
                                    ${bot.inCooldown ? "⏸️ Cooldown" : "✅ Active"}
                                </span>
                            </div>
                            <div class="health-indicator">
                                <div class="health-fill ${bot.health >= 70 ? "health-excellent" : bot.health >= 40 ? "health-good" : "health-poor"}" 
                                     style="width: ${bot.health}%"></div>
                            </div>
                            <div style="margin-top: 1rem; font-size: 0.9rem; color: #64748b;">
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
        <div class="dashboard-section">
            <div class="section-header">📊 Recent Request Logs (Last 20)</div>
            <div class="section-content">
                <div style="overflow-x: auto;">
                    <table class="data-table">
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
                                    <td><code>${log.botToken.substring(0, 10)}...</code></td>
                                    <td class="status-${log.status}">${log.status.toUpperCase()}</td>
                                    <td>${log.responseTime.toFixed(2)}ms</td>
                                    <td><code>${log.clientIP || "unknown"}</code></td>
                                    <td>${log.errorMessage || "-"}</td>
                                </tr>
                            `,
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Recent User Interactions -->
        <div class="dashboard-section">
            <div class="section-header">💬 Recent User Interactions (${systemState.interactionBuffer.length} in buffer)</div>
            <div class="section-content">
                <div style="overflow-x: auto;">
                    <table class="data-table">
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
                            ${systemState.interactionBuffer
                              .slice(0, 15)
                              .map(
                                (interaction) => `
                                <tr>
                                    <td>${new Date(interaction.timestamp).toLocaleTimeString()}</td>
                                    <td>@${interaction.botName}</td>
                                    <td>
                                        <div>${interaction.user.name}</div>
                                        <small style="color: #64748b;">@${interaction.user.username} (${interaction.user.id})</small>
                                    </td>
                                    <td><span style="background: #e2e8f0; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem;">${interaction.chat.type}</span></td>
                                    <td><span style="background: #dbeafe; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem;">${interaction.updateType}</span></td>
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

    <button class="refresh-button" onclick="window.location.reload()" title="Refresh Dashboard">
        🔄
    </button>

    <script>
        setTimeout(() => {
            window.location.reload();
        }, 30000);
        
        document.addEventListener('DOMContentLoaded', function() {
            const refreshBtn = document.querySelector('.refresh-button');
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

// API Stats Handler
function generateStatsAPI(): Response {
  const metrics = systemState.getSystemMetrics()
  const botHealth = LogBotManager.getBotHealthInfo()
  const campaignAnalytics = CampaignManager.getCampaignAnalytics()

  return new Response(
    JSON.stringify({
      metrics,
      botHealth,
      campaignAnalytics,
      interactionBufferSize: systemState.interactionBuffer.length,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  )
}

// Main Server
serve({
  port: process.env.PORT || 3000,

  async fetch(req: Request): Promise<Response> {
    const startTime = performance.now()
    const url = new URL(req.url)
    const method = req.method
    const pathname = url.pathname
    const userAgent = req.headers.get("user-agent") || "unknown"
    const clientIP = HelperUtils.extractClientIP(req)

    systemState.addConnection()

    try {
      if (HelperUtils.checkRateLimit(clientIP)) {
        return new Response("Rate limit exceeded", {
          status: 429,
          headers: { "Retry-After": "60" },
        })
      }

      if (method === "POST" && pathname.startsWith("/bot/")) {
        const botToken = pathname.split("/bot/")[1]

        if (!botToken || !botToken.includes(":")) {
          RequestLogger.saveLog({
            botToken: botToken || "invalid",
            status: "failed",
            responseTime: performance.now() - startTime,
            errorMessage: "Invalid bot token format",
            userAgent,
            clientIP,
          })
          return new Response("Invalid bot token format", { status: 400 })
        }

        try {
          const update = (await req.json()) as TelegramUpdate

          await processIncomingUpdate(update, botToken, userAgent, clientIP, startTime)

          RequestLogger.saveLog({
            botToken,
            status: "success",
            responseTime: performance.now() - startTime,
            userAgent,
            clientIP,
          })

          return new Response("OK", { status: 200 })
        } catch (error: any) {
          RequestLogger.saveLog({
            botToken,
            status: "failed",
            responseTime: performance.now() - startTime,
            errorMessage: error.message,
            userAgent,
            clientIP,
          })

          console.error("❌ Webhook processing error:", error)
          return new Response("OK", { status: 200 })
        }
      }

      if (method === "GET" && pathname === "/") {
        return generateStatusPage()
      }

      if (method === "GET" && pathname === "/status") {
        return generateDashboard(url)
      }

      if (method === "GET" && pathname === "/api/stats") {
        return generateStatsAPI()
      }

      return new Response("Not Found", { status: 404 })
    } finally {
      systemState.removeConnection()
    }
  },
})

console.log(`🚀 Advanced Telegram Bot Server started on port ${process.env.PORT || 3000}`)
console.log(`📊 Dashboard available at: /status?pass=${SYSTEM_CONFIG.DASHBOARD_PASSWORD}`)
console.log(`🔧 API endpoint available at: /api/stats`)
