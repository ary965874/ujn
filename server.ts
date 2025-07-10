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
  username?: string;
  title?: string;
  invite_link?: string;
}
interface TelegramUpdate {
  message?: any;
  edited_message?: any;
  channel_post?: any;
  edited_channel_post?: any;
  my_chat_member?: any;
  chat_join_request?: any;
}

const cache = new NodeCache({ stdTTL: 0 });
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

const CHAT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour per chat cooldown

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const pass = url.searchParams.get("pass");

    if (method === "GET" && path === "/") {
      if (pass !== "admin123") {
        return new Response(`<form><input name='pass'><button>Login</button></form>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      const total = cache.get("total_messages") || 0;
      const users = Array.from(new Set((cache.get("users") || []) as string[]));
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
      const chatLinks = cache.get("chat_links") || {};
      const logs = (cache.get("logs") || []) as string[];

      const channelLinks = Object.entries(chatLinks).map(([id, link]: any) => `<li><a target="_blank" href="${link}">${link}</a></li>`).join("");

      return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { background:black; color:white; font-family:sans-serif; padding:2em; }
        h1, h2 { color: #f97316; }
        button { padding: 10px 20px; margin: 10px 0; background: #f97316; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer; }
        pre { background: #1e1e1e; padding: 1em; border-radius: 8px; max-height: 300px; overflow-y: auto; }
        ul { padding-left: 1.2em; }
      </style></head><body>
        <h1>📊 Bot Dashboard</h1>
        <p><b>Total Messages:</b> ${total}</p>
        <p><b>Users:</b> ${users.length}</p>

        <p><b>Bots:</b> ${bots.length}</p>
        <form method='POST' action='/send-to-channels?pass=admin123'>
          <button type='submit'>📢 Send Ads to All Channels</button>
        </form>

        <h2>📂 Channels Posting Ad Links</h2>
        <ul>${channelLinks}</ul>

        <h2>📝 Recent Logs</h2>
        <pre>${logs.slice(-20).reverse().join("\n")}</pre>
      </body></html>`, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST" && path === "/send-to-channels" && pass === "admin123") {
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
      const chatLinks = cache.get("chat_links") || {};

      for (const bot of bots) {
        for (const chatId of Object.keys(chatLinks)) {
          await fetch(`https://api.telegram.org/bot${bot}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: PERMANENT_AD.imageSource,
              caption: PERMANENT_AD.captionText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: PERMANENT_AD.actionLinks.map(link => [{ text: link.linkText, url: link.linkDestination }]),
              },
            }),
          });
          await sleep(300);
        }
      }
      return new Response(`<html><body><script>alert("✅ Sent to Channels");location.href='/?pass=admin123'</script></body></html>`);
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      const update: TelegramUpdate = await req.json();

      const bots = cache.get("bots") || [];
      cache.set("bots", Array.from(new Set([...bots as string[], botToken])));

      let chatId: number | undefined = undefined;
      let userId: string | undefined = undefined;
      let activityLog = "";

      const chatActivity = update.message || update.edited_message || update.channel_post || update.edited_channel_post;
      if (chatActivity) {
        chatId = chatActivity.chat.id;
        userId = chatActivity.from?.id?.toString();
        activityLog = `Activity from chat ${chatId}`;

        const now = Date.now();
        const lastSent = cache.get(`sent_${chatId}`) as number | undefined;
        if (!lastSent || now - lastSent > CHAT_COOLDOWN_MS) {
          const photoPayload = {
            chat_id: chatId,
            photo: PERMANENT_AD.imageSource,
            caption: PERMANENT_AD.captionText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: PERMANENT_AD.actionLinks.map(link => [{ text: link.linkText, url: link.linkDestination }]),
            },
          };
          await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(photoPayload),
          });

          cache.set(`sent_${chatId}`, now);

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
                  inline_keyboard: TEMPORARY_AD.actionLinks.map(link => [{ text: link.linkText, url: link.linkDestination }]),
                },
              }),
            });
          }
        }

        const users = cache.get("users") || [];
        const chatLinks = cache.get("chat_links") || {};
        if (userId) cache.set("users", Array.from(new Set([...users as string[], userId])));

        // Fetch readable link
        if (!chatLinks[chatId]) {
          const resp = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId })
          });
          const result = await resp.json();
          if (result.ok) {
            const info = result.result;
            const link = info.username
              ? `https://t.me/${info.username}`
              : info.invite_link || `https://t.me/c/${String(chatId).replace("-100", "")}`;
            chatLinks[chatId] = link;
            cache.set("chat_links", chatLinks);
          }
        }

        const total = (cache.get("total_messages") as number) || 0;
        cache.set("total_messages", total + 1);

        const logs = (cache.get("logs") || []) as string[];
        logs.push(`[${new Date().toLocaleTimeString()}] ${chatId} - ${activityLog}`);
        cache.set("logs", logs.slice(-100));
      }

      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("✅ Bot server running on http://localhost:3000");
