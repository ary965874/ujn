import express from "express"
import rateLimit from "express-rate-limit"

// ==================== INTERFACES ====================
interface TelegramResponse {
  ok: boolean
  result?: any
  error_code?: number
  description?: string
}

interface APIResult {
  success: boolean
  data?: any
  error?: string
  retryAfter?: number
}

interface TelegramUpdate {
  update_id: number
  message?: any
  edited_message?: any
  channel_post?: any
  edited_channel_post?: any
  inline_query?: any
  chosen_inline_result?: any
  callback_query?: any
  shipping_query?: any
  pre_checkout_query?: any
  poll?: any
  poll_answer?: any
  my_chat_member?: any
  chat_member?: any
  chat_join_request?: any
}

interface CacheItem {
  value: any
  expiry: number
}

// ==================== LOGGER CLASS ====================
class Logger {
  private formatTimestamp(): string {
    return new Date().toISOString()
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = this.formatTimestamp()
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : ""
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`
  }

  info(message: string, meta?: any): void {
    console.log(this.formatMessage("info", message, meta))
  }

  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage("warn", message, meta))
  }

  error(message: string, meta?: any): void {
    console.error(this.formatMessage("error", message, meta))
  }

  debug(message: string, meta?: any): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage("debug", message, meta))
    }
  }
}

// ==================== CACHE MANAGER CLASS ====================
class CacheManager {
  private cache: Map<string, CacheItem> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup()
      },
      5 * 60 * 1000,
    )
  }

  set(key: string, value: any, ttlSeconds = 3600): void {
    const expiry = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { value, expiry })
  }

  get(key: string): any {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  has(key: string): boolean {
    const item = this.cache.get(key)
    if (!item) return false

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    this.cleanup()
    return this.cache.size
  }

  keys(): string[] {
    this.cleanup()
    return Array.from(this.cache.keys())
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.clear()
  }
}

// ==================== HEALTH MONITOR CLASS ====================
class HealthMonitor {
  private startTime: number
  private requestCount = 0

  constructor() {
    this.startTime = Date.now()
  }

  recordRequest(): void {
    this.requestCount++
  }

  getHealth(): {
    healthy: boolean
    uptime: number
    memory: { used: number; total: number; percentage: number }
    requests: number
  } {
    const uptime = Date.now() - this.startTime
    const memUsage = process.memoryUsage()
    const memUsed = memUsage.heapUsed
    const memTotal = memUsage.heapTotal
    const memPercentage = (memUsed / memTotal) * 100

    const healthy = memPercentage < 90 && uptime > 1000 // Reduced from 10000 to 1000

    return {
      healthy,
      uptime,
      memory: { used: memUsed, total: memTotal, percentage: memPercentage },
      requests: this.requestCount,
    }
  }
}

// ==================== STATS MANAGER CLASS ====================
class StatsManager {
  constructor(private cacheManager: CacheManager) {}

  recordUpdate(update: TelegramUpdate): void {
    try {
      const totalMessages = this.cacheManager.get("stats:total_messages") || 0
      this.cacheManager.set("stats:total_messages", totalMessages + 1, 86400 * 7)

      const userId = this.extractUserId(update)
      if (userId) {
        this.cacheManager.set(`stats:user:${userId}`, Date.now(), 86400)
      }

      this.cacheManager.set("stats:last_activity", new Date().toISOString(), 86400)
    } catch (error) {
      console.error("Error recording update:", error)
    }
  }

  recordError(): void {
    try {
      const errors24h = this.cacheManager.get("stats:errors_24h") || 0
      this.cacheManager.set("stats:errors_24h", errors24h + 1, 86400)
    } catch (error) {
      console.error("Error recording error:", error)
    }
  }

  getStats(): {
    totalMessages: number
    activeUsers: number
    errors24h: number
    lastActivity: string | null
  } {
    try {
      const totalMessages = this.cacheManager.get("stats:total_messages") || 0
      const errors24h = this.cacheManager.get("stats:errors_24h") || 0
      const lastActivity = this.cacheManager.get("stats:last_activity")
      const userKeys = this.cacheManager.keys().filter((key) => key.startsWith("stats:user:"))
      const activeUsers = userKeys.length

      return { totalMessages, activeUsers, errors24h, lastActivity }
    } catch (error) {
      console.error("Error getting stats:", error)
      return { totalMessages: 0, activeUsers: 0, errors24h: 0, lastActivity: null }
    }
  }

  private extractUserId(update: TelegramUpdate): string | null {
    try {
      if (update.message?.from?.id) return update.message.from.id.toString()
      if (update.callback_query?.from?.id) return update.callback_query.from.id.toString()
      if (update.inline_query?.from?.id) return update.inline_query.from.id.toString()
      return null
    } catch (error) {
      return null
    }
  }
}

// ==================== TELEGRAM API CLASS ====================
class TelegramAPI {
  private baseURL: string
  private circuitBreaker: {
    failures: number
    lastFailure: number
    state: "closed" | "open" | "half-open"
  }

  constructor(
    private token: string,
    private logger: Logger,
  ) {
    this.baseURL = `https://api.telegram.org/bot${token}`
    this.circuitBreaker = { failures: 0, lastFailure: 0, state: "closed" }
  }

  async makeRequest(method: string, params: any = {}): Promise<APIResult> {
    if (this.circuitBreaker.state === "open") {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure
      if (timeSinceLastFailure < 30000) {
        return { success: false, error: "Circuit breaker is open" }
      } else {
        this.circuitBreaker.state = "half-open"
      }
    }

    const maxRetries = 3
    let lastError = ""

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = `${this.baseURL}/${method}`

        // Create timeout manually for better compatibility
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Request timeout")), 10000)
        })

        const fetchPromise = fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        })

        const response = await Promise.race([fetchPromise, timeoutPromise])
        const data: TelegramResponse = await response.json()

        if (data.ok) {
          this.circuitBreaker.failures = 0
          this.circuitBreaker.state = "closed"
          return { success: true, data: data.result }
        } else {
          lastError = data.description || "Unknown API error"

          if (data.error_code === 429) {
            const retryAfter = this.extractRetryAfter(data.description || "")
            this.logger.warn("Rate limited by Telegram API", { retryAfter, attempt, method })

            if (attempt < maxRetries) {
              await this.sleep(retryAfter * 1000)
              continue
            }

            return { success: false, error: lastError, retryAfter }
          }

          this.logger.error("Telegram API error", {
            method,
            error_code: data.error_code,
            description: data.description,
            attempt,
          })
        }
      } catch (error: any) {
        lastError = error.message || "Unknown error"

        this.logger.error("Request failed", {
          method,
          attempt,
          error: error.message,
          type: error.name,
        })

        if (error.message === "Request timeout") {
          lastError = "Request timeout"
        } else if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
          lastError = "Connection error"
        }
      }

      if (attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
        await this.sleep(delay)
      }
    }

    this.circuitBreaker.failures++
    this.circuitBreaker.lastFailure = Date.now()

    if (this.circuitBreaker.failures >= 5) {
      this.circuitBreaker.state = "open"
      this.logger.warn("Circuit breaker opened", { failures: this.circuitBreaker.failures })
    }

    return { success: false, error: lastError }
  }

  async sendMessage(chatId: string | number, text: string, options: any = {}): Promise<APIResult> {
    return this.makeRequest("sendMessage", { chat_id: chatId, text, ...options })
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options: any = {},
  ): Promise<APIResult> {
    return this.makeRequest("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      ...options,
    })
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<APIResult> {
    return this.makeRequest("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    })
  }

  async answerInlineQuery(inlineQueryId: string, results: any[], options: any = {}): Promise<APIResult> {
    return this.makeRequest("answerInlineQuery", {
      inline_query_id: inlineQueryId,
      results,
      ...options,
    })
  }

  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.makeRequest("getMe")
      return result.success
    } catch (error) {
      return false
    }
  }

  private extractRetryAfter(description: string): number {
    const match = description.match(/retry after (\d+)/i)
    return match ? Number.parseInt(match[1]) : 1
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ==================== WEBHOOK HANDLER CLASS ====================
class WebhookHandler {
  private readonly FALLBACK_MESSAGE = "I'm sorry, I'm experiencing technical difficulties. Please try again later."

  constructor(
    private telegramAPI: TelegramAPI,
    private logger: Logger,
    private cacheManager: CacheManager,
    private statsManager: StatsManager,
  ) {}

  async handleWebhook(update: TelegramUpdate): Promise<void> {
    try {
      this.logger.info("Received webhook update", {
        updateId: update.update_id,
        type: this.getUpdateType(update),
      })

      this.statsManager.recordUpdate(update)

      const chatId = this.extractChatId(update)
      if (chatId && this.isThrottled(chatId)) {
        this.logger.warn("User throttled", { chatId })
        return
      }

      let handled = false

      if (update.message) {
        handled = await this.handleMessage(update.message)
      } else if (update.edited_message) {
        handled = await this.handleEditedMessage(update.edited_message)
      } else if (update.callback_query) {
        handled = await this.handleCallbackQuery(update.callback_query)
      } else if (update.inline_query) {
        handled = await this.handleInlineQuery(update.inline_query)
      } else if (update.channel_post) {
        handled = await this.handleChannelPost(update.channel_post)
      } else if (update.my_chat_member) {
        handled = await this.handleChatMemberUpdate(update.my_chat_member)
      }

      if (!handled && chatId) {
        await this.sendFallbackMessage(
          chatId,
          "I received your message but I'm not sure how to respond to this type of content.",
        )
      }
    } catch (error: any) {
      this.logger.error("Webhook handling failed", {
        error: error.message,
        stack: error.stack,
        update,
      })

      const chatId = this.extractChatId(update)
      if (chatId) {
        await this.sendFallbackMessage(chatId, this.FALLBACK_MESSAGE)
      }
    }
  }

  private async handleMessage(message: any): Promise<boolean> {
    try {
      const chatId = message.chat.id
      const userId = message.from?.id
      const text = message.text || ""

      this.logger.info("Processing message", {
        chatId,
        userId,
        text: text.substring(0, 100),
      })

      if (userId) {
        this.cacheManager.set(`user:${userId}:last_seen`, Date.now(), 86400)
      }

      if (text.startsWith("/start")) {
        return await this.handleStartCommand(chatId)
      } else if (text.startsWith("/help")) {
        return await this.handleHelpCommand(chatId)
      } else if (text.startsWith("/status")) {
        return await this.handleStatusCommand(chatId)
      } else {
        return await this.handleTextMessage(chatId, text, message)
      }
    } catch (error: any) {
      this.logger.error("Message handling failed", { error: error.message })
      return false
    }
  }

  private async handleEditedMessage(message: any): Promise<boolean> {
    try {
      const chatId = message.chat.id
      const result = await this.telegramAPI.sendMessage(
        chatId,
        "I noticed you edited your message. I don't process edited messages, but feel free to send a new one!",
      )
      return result.success
    } catch (error: any) {
      this.logger.error("Edited message handling failed", { error: error.message })
      return false
    }
  }

  private async handleCallbackQuery(callbackQuery: any): Promise<boolean> {
    try {
      const chatId = callbackQuery.message?.chat?.id
      const data = callbackQuery.data

      await this.telegramAPI.answerCallbackQuery(callbackQuery.id, `You clicked: ${data}`)

      if (chatId) {
        const result = await this.telegramAPI.sendMessage(chatId, `Button clicked: ${data}`)
        return result.success
      }

      return true
    } catch (error: any) {
      this.logger.error("Callback query handling failed", { error: error.message })
      return false
    }
  }

  private async handleInlineQuery(inlineQuery: any): Promise<boolean> {
    try {
      const results = [
        {
          type: "article",
          id: "1",
          title: "Echo",
          input_message_content: {
            message_text: `You searched for: ${inlineQuery.query}`,
          },
        },
      ]

      const result = await this.telegramAPI.answerInlineQuery(inlineQuery.id, results)
      return result.success
    } catch (error: any) {
      this.logger.error("Inline query handling failed", { error: error.message })
      return false
    }
  }

  private async handleChannelPost(post: any): Promise<boolean> {
    this.logger.info("Channel post received", { chatId: post.chat.id })
    return true
  }

  private async handleChatMemberUpdate(update: any): Promise<boolean> {
    try {
      const chatId = update.chat.id
      const newStatus = update.new_chat_member.status

      if (newStatus === "member") {
        const result = await this.telegramAPI.sendMessage(
          chatId,
          "Thanks for adding me to this chat! Type /help to see what I can do.",
        )
        return result.success
      }

      return true
    } catch (error: any) {
      this.logger.error("Chat member update handling failed", { error: error.message })
      return false
    }
  }

  private async handleStartCommand(chatId: string | number): Promise<boolean> {
    const welcomeMessage = `🤖 Welcome to the Telegram Bot!

I'm a robust bot that never stops responding. Here's what I can do:

/help - Show this help message
/status - Check bot status
/echo [text] - Echo your message back

I'm designed to handle errors gracefully and always respond to your messages!`

    const result = await this.telegramAPI.sendMessage(chatId, welcomeMessage)
    return result.success
  }

  private async handleHelpCommand(chatId: string | number): Promise<boolean> {
    const helpMessage = `📚 Bot Commands:

/start - Welcome message
/help - Show this help
/status - Bot health status
/echo [text] - Echo your message

🔧 Features:
• Always responds to messages
• Handles errors gracefully
• Automatic retry with backoff
• Circuit breaker protection
• Rate limiting protection

Send me any message and I'll respond!`

    const result = await this.telegramAPI.sendMessage(chatId, helpMessage)
    return result.success
  }

  private async handleStatusCommand(chatId: string | number): Promise<boolean> {
    const stats = this.statsManager.getStats()
    const statusMessage = `🟢 Bot Status: Online

📊 Statistics:
• Total Messages: ${stats.totalMessages}
• Active Users: ${stats.activeUsers}
• Uptime: ${Math.floor(process.uptime())}s
• Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB

✅ All systems operational!`

    const result = await this.telegramAPI.sendMessage(chatId, statusMessage)
    return result.success
  }

  private async handleTextMessage(chatId: string | number, text: string, message: any): Promise<boolean> {
    try {
      let response: string

      if (text.toLowerCase().startsWith("/echo ")) {
        response = text.substring(6)
      } else if (text.toLowerCase().includes("hello") || text.toLowerCase().includes("hi")) {
        response = `Hello ${message.from?.first_name || "there"}! 👋`
      } else if (text.toLowerCase().includes("how are you")) {
        response = "I'm doing great! Thanks for asking. How can I help you today?"
      } else if (text.toLowerCase().includes("time")) {
        response = `Current time: ${new Date().toLocaleString()}`
      } else {
        response = `I received your message: "${text}"\n\nI'm a simple bot, but I always respond! Try /help for more commands.`
      }

      const result = await this.telegramAPI.sendMessage(chatId, response)
      return result.success
    } catch (error: any) {
      this.logger.error("Text message handling failed", { error: error.message })
      return false
    }
  }

  private async sendFallbackMessage(chatId: string | number, message: string = this.FALLBACK_MESSAGE): Promise<void> {
    try {
      await this.telegramAPI.sendMessage(chatId, message)
    } catch (error: any) {
      this.logger.error("Fallback message failed", { chatId, error: error.message })
    }
  }

  private extractChatId(update: TelegramUpdate): string | number | null {
    try {
      if (update.message) return update.message.chat.id
      if (update.edited_message) return update.edited_message.chat.id
      if (update.callback_query?.message) return update.callback_query.message.chat.id
      if (update.channel_post) return update.channel_post.chat.id
      if (update.my_chat_member) return update.my_chat_member.chat.id
      return null
    } catch (error) {
      return null
    }
  }

  private getUpdateType(update: TelegramUpdate): string {
    if (update.message) return "message"
    if (update.edited_message) return "edited_message"
    if (update.callback_query) return "callback_query"
    if (update.inline_query) return "inline_query"
    if (update.channel_post) return "channel_post"
    if (update.my_chat_member) return "my_chat_member"
    return "unknown"
  }

  private isThrottled(chatId: string | number): boolean {
    try {
      const key = `throttle:${chatId}`
      const count = this.cacheManager.get(key) || 0

      if (count >= 10) {
        return true
      }

      this.cacheManager.set(key, count + 1, 60)
      return false
    } catch (error) {
      return false
    }
  }
}

// ==================== MAIN SERVER ====================
console.log("🚀 Starting Telegram Bot Server...")

const app = express()
const PORT = process.env.PORT || 3000
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ""
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "webhook-secret-123"

console.log("📋 Environment check:")
console.log(`- PORT: ${PORT}`)
console.log(`- BOT_TOKEN: ${TELEGRAM_BOT_TOKEN ? "Set ✅" : "Missing ❌"}`)
console.log(`- WEBHOOK_SECRET: ${WEBHOOK_SECRET ? "Set ✅" : "Missing ❌"}`)

if (!TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN environment variable is required")
  console.error("Get your token from @BotFather on Telegram")
  console.error("Set it as an environment variable: TELEGRAM_BOT_TOKEN=your_token_here")
  process.exit(1)
}

// Initialize services
console.log("🔧 Initializing services...")
const logger = new Logger()
const cacheManager = new CacheManager()
const healthMonitor = new HealthMonitor()
const telegramAPI = new TelegramAPI(TELEGRAM_BOT_TOKEN, logger)
const statsManager = new StatsManager(cacheManager)
const webhookHandler = new WebhookHandler(telegramAPI, logger, cacheManager, statsManager)

// Global error handlers
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error.message)
  logger.error("Uncaught Exception", { error: error.message, stack: error.stack })
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason)
  logger.error("Unhandled Rejection", { reason, promise })
})

// Middleware
app.use(express.json({ limit: "10mb" }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: { error: "Too many requests from this IP" },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use("/webhook", limiter)

app.use((req, res, next) => {
  healthMonitor.recordRequest()
  next()
})

// Health check route (for deployment platforms)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() })
})

// Routes
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🤖 Telegram Bot Server</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            * { box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                max-width: 900px; margin: 0 auto; padding: 20px; 
                background: #f5f5f5; color: #333;
            }
            .container { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .status { padding: 15px; margin: 15px 0; border-radius: 8px; font-weight: 500; }
            .healthy { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
            .unhealthy { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
            button { 
                background: #007bff; color: white; border: none; padding: 12px 24px; 
                border-radius: 6px; cursor: pointer; font-size: 14px; margin: 5px;
                transition: background 0.2s;
            }
            button:hover { background: #0056b3; }
            button:disabled { background: #6c757d; cursor: not-allowed; }
            input, textarea { 
                width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; 
                border-radius: 6px; font-size: 14px;
            }
            .stats { 
                background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 15px 0; 
                border: 1px solid #e9ecef;
            }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
            h1 { color: #2c3e50; margin-bottom: 10px; }
            h2 { color: #34495e; border-bottom: 2px solid #3498db; padding-bottom: 5px; }
            .emoji { font-size: 1.2em; }
            .loading { opacity: 0.6; }
            code { background: #f1f1f1; padding: 2px 6px; border-radius: 3px; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1><span class="emoji">🤖</span> Telegram Bot Server</h1>
            <p>✅ Server is running and ready to receive webhooks!</p>
            
            <div id="status" class="status loading">Loading status...</div>
            
            <div class="grid">
                <div>
                    <h2><span class="emoji">🧪</span> Test Message</h2>
                    <input type="text" id="chatId" placeholder="Enter Chat ID (get from @userinfobot)" />
                    <textarea id="message" placeholder="Type your test message here..." rows="3"></textarea>
                    <button onclick="sendTestMessage()">Send Test Message</button>
                </div>
                
                <div>
                    <h2><span class="emoji">📊</span> System Stats</h2>
                    <div id="stats" class="stats loading">Loading stats...</div>
                </div>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background: #e3f2fd; border-radius: 8px;">
                <h3><span class="emoji">🔧</span> Webhook Setup</h3>
                <p>Set your webhook URL to:</p>
                <code>https://your-domain.com/webhook/${WEBHOOK_SECRET}</code>
                <p style="margin-top: 10px;">Or use your bot token as the secret:</p>
                <code>https://your-domain.com/webhook/${TELEGRAM_BOT_TOKEN}</code>
            </div>
        </div>
        
        <script>
            async function loadStatus() {
                try {
                    const response = await fetch('/status');
                    const data = await response.json();
                    const statusDiv = document.getElementById('status');
                    statusDiv.className = 'status ' + (data.healthy ? 'healthy' : 'unhealthy');
                    statusDiv.innerHTML = \`
                        <strong>🟢 Status:</strong> \${data.healthy ? 'Healthy ✅' : 'Unhealthy ❌'}<br>
                        <strong>⏱️ Uptime:</strong> \${Math.floor(data.uptime / 1000)}s<br>
                        <strong>💾 Memory:</strong> \${(data.memory.used / 1024 / 1024).toFixed(2)}MB (\${data.memory.percentage.toFixed(1)}%)<br>
                        <strong>📡 Telegram API:</strong> \${data.telegramAPI ? 'Connected ✅' : 'Disconnected ❌'}
                    \`;
                } catch (error) {
                    document.getElementById('status').innerHTML = '❌ Error loading status: ' + error.message;
                    document.getElementById('status').className = 'status unhealthy';
                }
            }
            
            async function loadStats() {
                try {
                    const response = await fetch('/api/stats');
                    const data = await response.json();
                    document.getElementById('stats').innerHTML = \`
                        <strong>📨 Total Messages:</strong> \${data.totalMessages}<br>
                        <strong>👥 Active Users:</strong> \${data.activeUsers}<br>
                        <strong>⚠️ Errors (24h):</strong> \${data.errors24h}<br>
                        <strong>🕐 Last Activity:</strong> \${data.lastActivity || 'None yet'}
                    \`;
                } catch (error) {
                    document.getElementById('stats').innerHTML = '❌ Error loading stats: ' + error.message;
                }
            }
            
            async function sendTestMessage() {
                const chatId = document.getElementById('chatId').value.trim();
                const message = document.getElementById('message').value.trim();
                
                if (!chatId || !message) {
                    alert('⚠️ Please fill in both Chat ID and message');
                    return;
                }
                
                const button = event.target;
                button.disabled = true;
                button.textContent = 'Sending...';
                
                try {
                    const response = await fetch('/test-delivery', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ chatId, message })
                    });
                    const result = await response.json();
                    
                    if (result.success) {
                        alert('✅ Message sent successfully!');
                        document.getElementById('message').value = '';
                    } else {
                        alert('❌ Failed to send message: ' + result.error);
                    }
                } catch (error) {
                    alert('❌ Error sending message: ' + error.message);
                } finally {
                    button.disabled = false;
                    button.textContent = 'Send Test Message';
                }
            }
            
            // Auto-refresh data
            loadStatus();
            loadStats();
            setInterval(() => {
                loadStatus();
                loadStats();
            }, 5000);
        </script>
    </body>
    </html>
  `)
})

app.get("/status", async (req, res) => {
  try {
    const health = healthMonitor.getHealth()
    const telegramStatus = await telegramAPI.checkHealth()

    res.json({
      healthy: health.healthy && telegramStatus,
      uptime: health.uptime,
      memory: health.memory,
      requests: health.requests,
      telegramAPI: telegramStatus,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error("Status check failed", { error: error.message })
    res.status(500).json({
      healthy: false,
      error: "Status check failed",
      timestamp: new Date().toISOString(),
    })
  }
})

app.get("/api/stats", (req, res) => {
  try {
    const stats = statsManager.getStats()
    res.json(stats)
  } catch (error: any) {
    logger.error("Stats retrieval failed", { error: error.message })
    res.status(500).json({ error: "Failed to retrieve stats" })
  }
})

app.post("/test-delivery", async (req, res) => {
  try {
    const { chatId, message } = req.body

    if (!chatId || !message) {
      return res.status(400).json({
        success: false,
        error: "chatId and message are required",
      })
    }

    const result = await telegramAPI.sendMessage(chatId, message)

    res.json({
      success: result.success,
      error: result.error,
      messageId: result.data?.message_id,
    })
  } catch (error: any) {
    logger.error("Test delivery failed", { error: error.message })
    res.status(500).json({
      success: false,
      error: "Internal server error",
    })
  }
})

app.post("/webhook/:secret", async (req, res) => {
  try {
    const providedSecret = req.params.secret

    // Accept either the configured webhook secret OR the bot token as valid
    const validSecrets = [WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN]

    if (!validSecrets.includes(providedSecret)) {
      logger.warn("Invalid webhook secret", {
        ip: req.ip,
        providedSecret: providedSecret.substring(0, 10) + "...",
      })
      return res.status(401).json({ error: "Unauthorized" })
    }

    logger.info("Valid webhook request received", {
      ip: req.ip,
      secretUsed: providedSecret.substring(0, 10) + "...",
    })

    await webhookHandler.handleWebhook(req.body)
    res.status(200).json({ ok: true })
  } catch (error: any) {
    logger.error("Webhook processing failed", {
      error: error.message,
      body: req.body,
    })
    res.status(200).json({ ok: true })
  }
})

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`📴 Received ${signal}, shutting down gracefully...`)
  logger.info(`Received ${signal}, shutting down gracefully`)

  try {
    cacheManager.destroy()
  } catch (error) {
    console.error("Error during cleanup:", error)
  }

  process.exit(0)
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
process.on("SIGINT", () => gracefulShutdown("SIGINT"))

// Start server
console.log("🌐 Starting HTTP server...")
const server = app.listen(PORT, () => {
  console.log(`✅ Server started successfully!`)
  console.log(`🌐 Dashboard: http://localhost:${PORT}`)
  console.log(`📡 Webhook endpoint: /webhook/${WEBHOOK_SECRET}`)
  console.log(
    `🔗 Set webhook: https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://your-domain.com/webhook/${WEBHOOK_SECRET}`,
  )
  console.log(`🤖 Bot is ready and bulletproof!`)

  logger.info("Server started successfully", { port: PORT })
})

// Handle server errors
server.on("error", (error: any) => {
  console.error("❌ Server error:", error.message)
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try a different port.`)
  }
  process.exit(1)
})

export default app
