// server.ts

import { serve } from "bun";
import NodeCache from "node-cache";

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

interface TelegramUpdate {
  message?: {
    chat: TelegramChat;
    from?: TelegramUser;
  };
}

const cache = new NodeCache({ stdTTL: 0 });

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
};

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "GET" && path === "/") {
      const pass = url.searchParams.get("pass");
      if (pass !== "admin123") {
        return new Response("<h2>Unauthorized</h2><form><input name='pass' placeholder='Password' /><button type='submit'>Login</button></form>", {
          headers: { "Content-Type": "text/html" },
        });
      }

      const totalMessages = cache.get("total_messages") || 0;
      const users = Array.from(new Set((cache.get("users") || []) as string[]));
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));

      const html = `
        <!DOCTYPE html>
        <html><head><title>Dashboard</title></head>
        <body style="font-family:sans-serif;padding:2em;max-width:700px;margin:auto;">
          <h1>📊 Bot Dashboard</h1>
          <p><b>🟢 Total Messages Sent:</b> ${totalMessages}</p>
          <p><b>🤖 Bots Connected:</b> ${bots.length}</p>
          <ul>${bots.map(b => `<li>${b.slice(0, 12)}...</li>`).join("")}</ul>
          <p><b>👥 Unique Users:</b> ${users.length}</p>
          <ul>${users.map(u => `<li>${u}</li>`).join("")}</ul>
          <img src="${EXCLUSIVE_CONTENT.imageSource}" alt="ad" width="300"/>
        </body></html>
      `;

      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken || !botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
        return new Response("Invalid bot token format", { status: 403 });
      }

      try {
        const update: TelegramUpdate = await req.json();
        if (!update.message || !update.message.chat?.id || !update.message.from?.id) {
          return new Response("Invalid Telegram update", { status: 200 });
        }

        const chatId = update.message.chat.id;
        const userId = update.message.from.id.toString();

        const telegramApi = `https://api.telegram.org/bot${botToken}/sendPhoto`;
        await fetch(telegramApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: EXCLUSIVE_CONTENT.imageSource,
            caption: EXCLUSIVE_CONTENT.captionText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: EXCLUSIVE_CONTENT.actionLinks.map(link => [{ text: link.linkText, url: link.linkDestination }])
            }
          }),
        });

        // Update stats
        const prev = (cache.get("total_messages") as number) || 0;
        const users = new Set((cache.get("users") || []) as string[]);
        const bots = new Set((cache.get("bots") || []) as string[]);

        users.add(userId);
        bots.add(botToken);

        cache.set("total_messages", prev + 1);
        cache.set("users", Array.from(users));
        cache.set("bots", Array.from(bots));

        return new Response("Message sent", { status: 200 });
      } catch (err) {
        console.error("Error:", err);
        return new Response("Internal Server Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("Bot server running on port 3000");
