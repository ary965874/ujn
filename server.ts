// Combined Telegram Bot Server with Ad & Channel Tracking
import { serve } from "bun";
import NodeCache from "node-cache";

// Interfaces
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

// Ads
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

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const pass = url.searchParams.get("pass");

    // Admin Dashboard
    if (method === "GET" && path === "/") {
      if (pass !== "admin123") {
        return new Response(`<!DOCTYPE html><html><body><h2>🔐 Access Denied</h2></body></html>`, {
          headers: { "Content-Type": "text/html" },
        });
      }

      const total = cache.get("total_messages") || 0;
      const users = Array.from(new Set((cache.get("users") || []) as string[]));
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
      const logs = (cache.get("logs") || []) as string[];
      const channels = cache.get("channels") || [];
      const sentChannels = cache.get("sent_channels") || [];

      const renderLinks = (ad: any) =>
        ad.actionLinks.map((link: any) =>
          `<li><b>${link.linkText}</b>: <a href="${link.linkDestination}" target="_blank">${link.linkDestination}</a></li>`
        ).join("");

      const renderChannels = (channels as { id: string; link: string }[]).map(
        c => `<li><a href="${c.link}" target="_blank">${c.link}</a> (ID: ${c.id})</li>`
      ).join("");

      return new Response(`<!DOCTYPE html><html><head><title>Dashboard</title><style>
        body { font-family: sans-serif; background: #121212; color: #fff; padding: 2em; }
        .card { max-width: 900px; margin: auto; padding: 2em; background: #1f1f1f; border-radius: 10px; }
        input, textarea, button { width: 100%; padding: 10px; margin: 10px 0; border: none; border-radius: 5px; }
        button { background: #f97316; color: white; font-weight: bold; cursor: pointer; }
        ul { padding-left: 1em; }
      </style></head><body><div class="card">
        <h1>📊 Bot Dashboard</h1>
        <p><b>Total Messages:</b> ${total}</p>
        <p><b>Bots:</b> ${bots.length}</p>
        <p><b>Users:</b> ${users.length}</p>

        <h2>📡 Channels Detected</h2><ul>${renderChannels}</ul>
        <h2>📤 Channels Sent</h2><ul>${(sentChannels as any[]).map(c => `<li><a href="${c.link}" target="_blank">${c.link}</a> (ID: ${c.id})</li>`).join("")}</ul>

        <h2>📌 Permanent Ad</h2>
        <form method="POST" action="/edit-content?pass=admin123">
          <input name="imageSource" value="${PERMANENT_AD.imageSource}" />
          <textarea name="captionText">${PERMANENT_AD.captionText}</textarea>
          <button>Update</button>
        </form>
        <form method="POST" action="/add-link?pass=admin123">
          <input name="linkText" placeholder="Link Text" />
          <input name="linkDestination" placeholder="Destination URL" />
          <button>Add Link</button>
        </form>
        <ul>${renderLinks(PERMANENT_AD)}</ul>

        <h2>🕒 Temporary Ad</h2>
        <form method="POST" action="/edit-temp?pass=admin123">
          <input name="imageSource" value="${TEMPORARY_AD.imageSource}" />
          <textarea name="captionText">${TEMPORARY_AD.captionText}</textarea>
          <button>Update</button>
        </form>
        <form method="POST" action="/add-temp-link?pass=admin123">
          <input name="linkText" placeholder="Temp Link Text" />
          <input name="linkDestination" placeholder="Temp Destination" />
          <button>Add Temp Link</button>
        </form>
        <ul>${renderLinks(TEMPORARY_AD)}</ul>

        <h2>📣 Broadcast</h2>
        <form method="POST" action="/send-broadcast?pass=admin123">
          <input name="imageSource" placeholder="Image URL" />
          <textarea name="captionText" placeholder="Caption"></textarea>
          <input name="linkText" placeholder="Link Text (optional)" />
          <input name="linkDestination" placeholder="Link URL (optional)" />
          <button>Send</button>
        </form>

        <h3>📝 Logs</h3>
        <ul>${logs.slice(-10).reverse().map(log => `<li>${log}</li>`).join("")}</ul>
      </div></body></html>`, { headers: { "Content-Type": "text/html" } });
    }

    // Admin Actions
    if (method === "POST") {
      const form = await req.formData();

      if (path === "/edit-content" && pass === "admin123") {
        PERMANENT_AD.imageSource = form.get("imageSource")?.toString() || "";
        PERMANENT_AD.captionText = form.get("captionText")?.toString() || "";
      }

      if (path === "/add-link" && pass === "admin123") {
        const linkText = form.get("linkText")?.toString();
        const linkDestination = form.get("linkDestination")?.toString();
        if (linkText && linkDestination) PERMANENT_AD.actionLinks.push({ linkText, linkDestination });
      }

      if (path === "/edit-temp" && pass === "admin123") {
        TEMPORARY_AD.imageSource = form.get("imageSource")?.toString() || "";
        TEMPORARY_AD.captionText = form.get("captionText")?.toString() || "";
      }

      if (path === "/add-temp-link" && pass === "admin123") {
        const linkText = form.get("linkText")?.toString();
        const linkDestination = form.get("linkDestination")?.toString();
        if (linkText && linkDestination) TEMPORARY_AD.actionLinks.push({ linkText, linkDestination });
      }

      if (path === "/send-broadcast" && pass === "admin123") {
        const imageSource = form.get("imageSource")?.toString();
        const captionText = form.get("captionText")?.toString();
        const linkText = form.get("linkText")?.toString();
        const linkDestination = form.get("linkDestination")?.toString();
        const keyboard = linkText && linkDestination ? { inline_keyboard: [[{ text: linkText, url: linkDestination }]] } : undefined;
        const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
        const users = Array.from(new Set((cache.get("users") || []) as string[]));
        for (const bot of bots) {
          for (const user of users) {
            await fetch(`https://api.telegram.org/bot${bot}/sendPhoto`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: user, photo: imageSource, caption: captionText, parse_mode: "HTML", reply_markup: keyboard }),
            });
            await sleep(300);
          }
        }
      }

      return Response.redirect("/?pass=admin123");
    }

    // Webhook Handler
    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken.match(/^[0-9]+:[A-Za-z0-9_-]+$/)) return new Response("Invalid token", { status: 403 });

      const update: TelegramUpdate = await req.json();
      let chatId: number | undefined;
      let userId: string | undefined;
      let chatLink: string | undefined;
      let activityLog = "";

      const storeChat = (chat: TelegramChat) => {
        if (chat.type === "channel") {
          chatLink = chat.username ? `https://t.me/${chat.username}` : `https://t.me/c/${String(chat.id).substring(4)}`;
          const channels = cache.get("channels") || [];
          const entry = { id: chat.id.toString(), link: chatLink };
          const updated = Array.from(new Map([...(channels as any[]), entry].map(c => [c.id, c])).values());
          cache.set("channels", updated);
        } else {
          userId = chat.id.toString();
        }
      };

      const bots = cache.get("bots") || [];
      const users = cache.get("users") || [];

      if (update.message) {
        chatId = update.message.chat.id;
        storeChat(update.message.chat);
        activityLog = `Message: ${update.message.text}`;
      } else if (update.channel_post) {
        chatId = update.channel_post.chat.id;
        storeChat(update.channel_post.chat);
        activityLog = `Channel Post: ${update.channel_post.text}`;
      }

      if (!chatId) return new Response("OK");
      if (userId) cache.set("users", Array.from(new Set([...users as string[], userId])));
      cache.set("bots", Array.from(new Set([...bots as string[], botToken])));
      const total = (cache.get("total_messages") as number) || 0;
      cache.set("total_messages", total + 1);
      const logs = (cache.get("logs") || []) as string[];
      logs.push(`[${new Date().toLocaleTimeString()}] ${userId || "?"} - ${activityLog}`);
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
            inline_keyboard: PERMANENT_AD.actionLinks.map(link => [{ text: link.linkText, url: link.linkDestination }]),
          },
        }),
      });

      // Send temp ad if exists
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

      // If message was in a channel, mark as sent
      if (chatLink) {
        const sent = cache.get("sent_channels") || [];
        const entry = { id: chatId.toString(), link: chatLink };
        const updated = Array.from(new Map([...(sent as any[]), entry].map(c => [c.id, c])).values());
        cache.set("sent_channels", updated);
      }

      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("✅ Combined bot server running on http://localhost:3000");
