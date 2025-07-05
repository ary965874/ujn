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

const cache = new NodeCache({ stdTTL: 3600 });

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

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (method === "GET" && path === "/") {
      const total = cache.get("total_responses") || 0;
      const html = `
        <!DOCTYPE html>
        <html><head><title>Webhook Status</title></head>
        <body style="font-family: sans-serif; padding: 2em;">
          <h2>✅ Webhook root is live and running!</h2>
          <img src="${EXCLUSIVE_CONTENT.imageSource}" alt="ad" width="300" style="margin: 1em 0;"/>
          <p><b>Ad:</b></p>
          <pre>${EXCLUSIVE_CONTENT.captionText}</pre>
          <p><b>Links:</b></p>
          <ul>
            ${EXCLUSIVE_CONTENT.actionLinks.map(l => `<li><a href="${l.linkDestination}">${l.linkText}</a></li>`).join("")}
          </ul>
          <p><b>Total Bot Responses:</b> ${total}</p>
        </body></html>
      `;
      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "GET" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken || !botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
        return new Response("Invalid bot token format", { status: 403 });
      }
      return new Response(`✅ Webhook for bot ${botToken.slice(0, 8)}... is live!`, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken || !botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) {
        return new Response("Invalid bot token format", { status: 403 });
      }

      try {
        const update: TelegramUpdate = await req.json();
        if (!update.message || !update.message.chat?.id) {
          return new Response("Invalid Telegram update", { status: 200 });
        }

        const chatId = update.message.chat.id;
        const html = buildTelegramHTML(EXCLUSIVE_CONTENT);

        const telegramApi = `https://api.telegram.org/bot${botToken}/sendPhoto`;
        await fetch(telegramApi, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: EXCLUSIVE_CONTENT.imageSource,
            caption: html,
            parse_mode: "HTML",
          }),
        });

        const total = (cache.get("total_responses") as number) || 0;
        cache.set("total_responses", total + 1);

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
