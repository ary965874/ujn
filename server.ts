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

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const pass = url.searchParams.get("pass");

    if (method === "GET" && path === "/") {
      if (pass !== "admin123") {
        return new Response(`<!DOCTYPE html><html><body><form method='GET'><input name='pass' /><button type='submit'>Login</button></form></body></html>`, { headers: { "Content-Type": "text/html" } });
      }

      const users = new Set((cache.get("users") || []) as string[]);
      const bots = new Set((cache.get("bots") || []) as string[]);
      const logs = (cache.get("logs") || []) as string[];
      const total = cache.get("total_messages") || 0;

      const renderLinks = (ad: any) => ad.actionLinks.map((l: any) => `<li><b>${l.linkText}</b> → <a href='${l.linkDestination}' target='_blank'>${l.linkDestination}</a></li>`).join("");

      return new Response(`<!DOCTYPE html><html><head><title>Bot Dashboard</title><style>
        body { background:#111; color:#fff; font-family:sans-serif; padding:2em; }
        .card { background:#1e1e1e; padding:2em; border-radius:10px; max-width:800px; margin:auto; }
        input, textarea, button { width:100%; margin:5px 0; padding:10px; border-radius:5px; border:none; }
        button { background:#f97316; color:white; cursor:pointer; }
        h2 { color:#f97316; }
        ul { padding-left: 20px; }
        .logs { background:#222; padding:1em; border-radius:8px; max-height:200px; overflow-y:auto; margin-top:1em; }
      </style></head><body><div class='card'>
        <h1>📊 Dashboard</h1>
        <p><b>✅ Messages:</b> ${total}</p>
        <p><b>👥 Users/Chats:</b> ${users.size}</p>
        <p><b>🤖 Bots:</b> ${bots.size}</p>

        <h2>📌 Permanent Ad</h2>
        <form method='POST' action='/edit-perm?pass=admin123'>
          <input name='imageSource' value='${PERMANENT_AD.imageSource}' placeholder='Image URL' />
          <textarea name='captionText' rows='5'>${PERMANENT_AD.captionText}</textarea>
          <button type='submit'>Save</button>
        </form>

        <ul>${renderLinks(PERMANENT_AD)}</ul>

        <h2>🕒 Temporary Ad</h2>
        <form method='POST' action='/edit-temp?pass=admin123'>
          <input name='imageSource' value='${TEMPORARY_AD.imageSource}' placeholder='Temp Image URL' />
          <textarea name='captionText' rows='5'>${TEMPORARY_AD.captionText}</textarea>
          <button type='submit'>Save</button>
        </form>

        <ul>${renderLinks(TEMPORARY_AD)}</ul>

        <div class='logs'><h3>📝 Logs</h3><ul>${logs.slice(-50).reverse().map(l => `<li>${l}</li>`).join("")}</ul></div>
      </div></body></html>`, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST" && path === "/edit-perm" && pass === "admin123") {
      const form = await req.formData();
      PERMANENT_AD.imageSource = form.get("imageSource")?.toString() || PERMANENT_AD.imageSource;
      PERMANENT_AD.captionText = form.get("captionText")?.toString() || PERMANENT_AD.captionText;
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path === "/edit-temp" && pass === "admin123") {
      const form = await req.formData();
      TEMPORARY_AD.imageSource = form.get("imageSource")?.toString() || TEMPORARY_AD.imageSource;
      TEMPORARY_AD.captionText = form.get("captionText")?.toString() || TEMPORARY_AD.captionText;
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken.match(/^[0-9]+:[A-Za-z0-9_-]+$/)) return new Response("Invalid token", { status: 403 });

      const update: TelegramUpdate = await req.json();
      const chat = update.message?.chat || update.channel_post?.chat;
      const userId = update.message?.from?.id?.toString() || chat?.id?.toString();
      const chatId = chat?.id;

      if (!chatId || !userId) return new Response("OK");

      const bots = cache.get("bots") || [];
      const users = cache.get("users") || [];
      cache.set("bots", Array.from(new Set([...bots as string[], botToken])));
      cache.set("users", Array.from(new Set([...users as string[], userId])));

      const total = (cache.get("total_messages") as number) || 0;
      cache.set("total_messages", total + 1);

      const logs = (cache.get("logs") || []) as string[];
      const text = update.message?.text || update.channel_post?.text || "<no text>";
      logs.push(`[${new Date().toLocaleTimeString()}] ${userId} - ${text}`);
      cache.set("logs", logs.slice(-100));

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
  }
});

console.log("✅ Bot server running at http://localhost:3000");
