import { serve } from "bun";
import NodeCache from "node-cache";

// Types
interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
}

interface TelegramUpdate {
  message?: {
    chat: TelegramChat;
    from?: TelegramUser;
    text?: string;
  };
  channel_post?: {
    chat: TelegramChat;
    text?: string;
  };
}

// In-memory cache
const cache = new NodeCache({ stdTTL: 0 });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Ad data
let PERMANENT_AD = {
  imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
  captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥\n\n💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥\n\n🎬 <i>Fresh leaked content daily</i>\n🔞 <b>18+ Adult Material</b>\n💎 <i>Premium quality videos & files</i>\n🚀 <b>Instant access available</b>\n\n⬇️ <b><u>Click any server below</u></b> ⬇️`,
  actionLinks: [
    { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+Go8FEdh9M8Y3ZWU1" },
    { linkText: "📁 FILES🍑", linkDestination: "https://t.me/+06bZb-fbn4kzNjll" },
  ],
};

let TEMPORARY_AD = {
  imageSource: "",
  captionText: "",
  actionLinks: [] as { linkText: string; linkDestination: string }[],
};

// Server
serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken.match(/^[0-9]+:[A-Za-z0-9_-]+$/)) return new Response("Invalid token", { status: 403 });

      const update: TelegramUpdate = await req.json();

      const chat = update.message?.chat || update.channel_post?.chat;
      const userId = update.message?.from?.id?.toString() || chat?.id?.toString();
      const chatId = chat?.id;

      if (!chatId || !userId) return new Response("OK");

      // Save bot and user/channel ID
      const bots = cache.get("bots") || [];
      const users = cache.get("users") || [];
      cache.set("bots", Array.from(new Set([...bots as string[], botToken])));
      cache.set("users", Array.from(new Set([...users as string[], userId])));

      // Increase count
      let total = (cache.get("total_messages") as number) || 0;
      cache.set("total_messages", total + 1);

      // Log
      const logs = (cache.get("logs") || []) as string[];
      const text = update.message?.text || update.channel_post?.text || "<no text>";
      logs.push(`[${new Date().toLocaleTimeString()}] ${userId} - ${text}`);
      cache.set("logs", logs.slice(-100));

      // Send permanent ad
      await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: PERMANENT_AD.imageSource,
          caption: PERMANENT_AD.captionText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: PERMANENT_AD.actionLinks.map(link => [{ text: link.linkText, url: link.linkDestination }])
          }
        })
      });

      // Send temporary ad (if available)
      if (TEMPORARY_AD.imageSource && TEMPORARY_AD.captionText) {
        await sleep(500);
        await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: TEMPORARY_AD.imageSource,
            caption: TEMPORARY_AD.captionText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: TEMPORARY_AD.actionLinks.map(link => [{ text: link.linkText, url: link.linkDestination }])
            }
          })
        });
      }

      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("✅ Bot server running at http://localhost:3000");
