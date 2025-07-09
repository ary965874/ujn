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

// Ad data
let PERMANENT_AD = {
  imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
  captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥\n\n💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥\n\n🎬 <i>Fresh leaked content daily</i>\n🔞 <b>18+ Adult Material</b>\n💎 <i>Premium quality videos & files</i>\n🚀 <b>Instant access available</b>\n\n⬇️ <b><u>Click any server below</u></b> ⬇️`,
  actionLinks: [
    { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+fvFJeSbZEtc2Yjg1" },
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

    // Dashboard
    if (method === "GET" && path === "/") {
      if (pass !== "admin123") {
        return new Response(`<!DOCTYPE html><html><head><title>Login</title><style>
          body { background:#0e0e0e; color:white; text-align:center; padding:3em; font-family:sans-serif; }
          input,button { padding:10px; margin:10px; border:none; border-radius:5px; font-size:16px; }
        </style></head><body>
          <h2>🔐 Admin Login</h2>
          <form method='GET'><input name='pass' placeholder='Enter Password' />
          <br/><button type='submit'>Login</button></form>
        </body></html>`, { headers: { "Content-Type": "text/html" } });
      }

      const total = cache.get("total_messages") || 0;
      const users = Array.from(new Set((cache.get("users") || []) as string[]));
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
      const logs = (cache.get("logs") || []) as string[];

      const renderLinks = (ad: any) =>
        ad.actionLinks.map((link: any) =>
          `<li><b>${link.linkText}</b>: <a href="${link.linkDestination}" target="_blank">${link.linkDestination}</a></li>`
        ).join("");

      return new Response(`<!DOCTYPE html><html><head><title>Dashboard</title><style>
        body { font-family: Arial, sans-serif; background: #121212; color: #fff; padding: 2em; }
        .card { background: #1e1e1e; padding: 2em; border-radius: 10px; max-width: 900px; margin: auto; box-shadow: 0 0 20px rgba(0,0,0,0.3); }
        h1, h2 { color: #f97316; }
        input, textarea, button { width: 100%; margin: 10px 0; padding: 10px; border-radius: 5px; border: none; font-size: 14px; }
        button { background: #f97316; color: white; cursor: pointer; font-weight: bold; }
        ul { list-style-type: none; padding-left: 0; }
        li { margin: 5px 0; }
        .logs { background: #252525; padding: 1em; border-radius: 8px; max-height: 200px; overflow-y: auto; margin-top: 2em; }
        form { border-top: 1px solid #333; padding-top: 1em; margin-top: 1em; }
      </style></head><body><div class="card">
        <h1>📊 Bot Dashboard</h1>
        <p><b>Total Messages:</b> ${total}</p>
        <p><b>Bots:</b> ${bots.length}</p>
        <p><b>Users:</b> ${users.length}</p>

        <h2>📌 Permanent Ad</h2>
        <form method="POST" action="/edit-content?pass=admin123">
          <input name="imageSource" value="${PERMANENT_AD.imageSource}" placeholder="Image URL" required />
          <textarea name="captionText" rows="5">${PERMANENT_AD.captionText}</textarea>
          <button type="submit">Update</button>
        </form>
        <form method="POST" action="/add-link?pass=admin123">
          <input name="linkText" placeholder="Button Text" required />
          <input name="linkDestination" placeholder="Destination URL" required />
          <button type="submit">Add Button</button>
        </form>
        <ul>${renderLinks(PERMANENT_AD)}</ul>

        <h2>🕒 Temporary Ad</h2>
        <form method="POST" action="/edit-temp?pass=admin123">
          <input name="imageSource" value="${TEMPORARY_AD.imageSource}" placeholder="Image URL" />
          <textarea name="captionText" rows="4">${TEMPORARY_AD.captionText}</textarea>
          <button type="submit">Update Temp Ad</button>
        </form>
        <form method="POST" action="/add-temp-link?pass=admin123">
          <input name="linkText" placeholder="Button Text" />
          <input name="linkDestination" placeholder="Destination URL" />
          <button type="submit">Add Temp Button</button>
        </form>
        <ul>${renderLinks(TEMPORARY_AD)}</ul>

        <h2>📣 Broadcast</h2>
        <form method="POST" action="/send-broadcast?pass=admin123">
          <input name="imageSource" placeholder="Image URL" />
          <textarea name="captionText" rows="4"></textarea>
          <input name="linkText" placeholder="Button Text (optional)" />
          <input name="linkDestination" placeholder="Button URL (optional)" />
          <button type="submit">Send</button>
        </form>

        <div class="logs"><h3>📝 Logs</h3><ul>${logs.slice(-10).reverse().map(log => `<li>${log}</li>`).join("")}</ul></div>
      </div></body></html>`, { headers: { "Content-Type": "text/html" } });
    }

    // Admin Routes (same as before)
    if (method === "POST" && path === "/edit-content" && pass === "admin123") {
      const form = await req.formData();
      PERMANENT_AD.imageSource = form.get("imageSource")?.toString() || "";
      PERMANENT_AD.captionText = form.get("captionText")?.toString() || "";
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path === "/add-link" && pass === "admin123") {
      const form = await req.formData();
      const linkText = form.get("linkText")?.toString();
      const linkDestination = form.get("linkDestination")?.toString();
      if (linkText && linkDestination) PERMANENT_AD.actionLinks.push({ linkText, linkDestination });
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path === "/edit-temp" && pass === "admin123") {
      const form = await req.formData();
      TEMPORARY_AD.imageSource = form.get("imageSource")?.toString() || "";
      TEMPORARY_AD.captionText = form.get("captionText")?.toString() || "";
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path === "/add-temp-link" && pass === "admin123") {
      const form = await req.formData();
      const linkText = form.get("linkText")?.toString();
      const linkDestination = form.get("linkDestination")?.toString();
      if (linkText && linkDestination) TEMPORARY_AD.actionLinks.push({ linkText, linkDestination });
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path === "/send-broadcast" && pass === "admin123") {
      const form = await req.formData();
      const imageSource = form.get("imageSource")?.toString();
      const captionText = form.get("captionText")?.toString();
      const linkText = form.get("linkText")?.toString();
      const linkDestination = form.get("linkDestination")?.toString();

      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
      const users = Array.from(new Set((cache.get("users") || []) as string[]));
      const keyboard = linkText && linkDestination ? { inline_keyboard: [[{ text: linkText, url: linkDestination }]] } : undefined;

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

      return new Response(`<html><body><script>alert("✅ Broadcast Sent");location.href='/?pass=admin123'</script></body></html>`);
    }

    // Telegram webhook
    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken.match(/^[0-9]+:[A-Za-z0-9_-]+$/)) return new Response("Invalid token", { status: 403 });

      const update: TelegramUpdate = await req.json();
      let chatId: number | undefined;
      let userId: string | undefined;
      let activityLog = "";

      if (update.message) {
        chatId = update.message.chat.id;
        userId = update.message.from?.id.toString();
        activityLog = `Message: ${update.message.text}`;
      } else if (update.edited_message) {
        chatId = update.edited_message.chat.id;
        userId = update.edited_message.from?.id.toString();
        activityLog = `Edited Message: ${update.edited_message.text}`;
      } else if (update.channel_post) {
        chatId = update.channel_post.chat.id;
        activityLog = `Channel Post: ${update.channel_post.text}`;
      } else if (update.edited_channel_post) {
        chatId = update.edited_channel_post.chat.id;
        activityLog = `Edited Channel Post: ${update.edited_channel_post.text}`;
      } else if (update.my_chat_member) {
        chatId = update.my_chat_member.chat.id;
        userId = update.my_chat_member.from.id.toString();
        activityLog = `Status Update: ${JSON.stringify(update.my_chat_member.new_chat_member)}`;
      } else if (update.chat_join_request) {
        chatId = update.chat_join_request.chat.id;
        userId = update.chat_join_request.from.id.toString();
        activityLog = `Join Request from @${update.chat_join_request.from.username}`;
      }

      if (!chatId) return new Response("OK");
      const bots = cache.get("bots") || [];
      const users = cache.get("users") || [];
      if (userId) cache.set("users", Array.from(new Set([...users as string[], userId])));
      cache.set("bots", Array.from(new Set([...bots as string[], botToken])));

      const total = (cache.get("total_messages") as number) || 0;
      cache.set("total_messages", total + 1);

      const logs = (cache.get("logs") || []) as string[];
      logs.push(`[${new Date().toLocaleTimeString()}] ${userId || "?"} - ${activityLog}`);
      cache.set("logs", logs.slice(-100));

      // No longer sending activity message (as requested)

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

      // Send temporary ad (if set)
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

      return new Response("OK");
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("✅ Combined bot server running on http://localhost:3000");
