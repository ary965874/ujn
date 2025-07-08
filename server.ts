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
    text?: string;
  };
}

const cache = new NodeCache({ stdTTL: 0 });

let PERMANENT_AD = {
  imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
  captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥\n\n💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥\n\n🎬 <i>Fresh leaked content daily</i>\n🔞 <b>18+ Adult Material</b>\n💎 <i>Premium quality videos & files</i>\n🚀 <b>Instant access available</b>\n\n⬇️ <b><u>Click any server below</u></b> ⬇️`,
  actionLinks: [
    { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+NiLqtvjHQoFhZjQ1" },
    { linkText: "📁 FILES🍑", linkDestination: "https://t.me/+fvFJeSbZEtc2Yjg1" },
  ],
};

let TEMPORARY_AD = {
  imageSource: "",
  captionText: "",
  actionLinks: [],
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
        return new Response(`<!DOCTYPE html><html><head><title>Login</title><style>
          body { font-family:sans-serif;background:#0e0e0e;color:white;text-align:center;padding:3em }
          input,button { padding:10px;margin:10px;border:none;border-radius:5px }
        </style></head><body>
          <h2>🔒 Admin Access</h2>
          <form method='GET'><input name='pass' placeholder='Enter Password' /><br/>
          <button type='submit'>Login</button></form>
        </body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }

      const totalMessages = cache.get("total_messages") || 0;
      const users = Array.from(new Set((cache.get("users") || []) as string[]));
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
      const logs = (cache.get("logs") || []) as string[];

      const renderLinks = (ad) => ad.actionLinks.map(link => `<li><b>${link.linkText}</b> ➜ <a href="${link.linkDestination}" target="_blank">${link.linkDestination}</a></li>`).join("");

      const html = `<!DOCTYPE html><html><head><title>Dashboard</title><style>
        body { background:#121212; color:#fff; font-family:sans-serif; padding:2em; }
        .card { background:#1e1e1e; padding:2em; border-radius:10px; max-width:900px; margin:auto; box-shadow:0 0 15px rgba(0,0,0,0.4); }
        h1, h2 { color:#f97316; }
        input, textarea, button { width:100%; margin:5px 0; padding:10px; border-radius:5px; border:none; }
        button { background:#f97316; color:white; cursor:pointer; }
        .logs { margin-top:2em; background:#222; padding:1em; border-radius:8px; max-height:200px; overflow-y:auto; }
        .edit-form, .url-form { margin-top:2em; border-top:1px solid #333; padding-top:1em; }
      </style></head><body><div class="card">
        <h1>📊 Bot Dashboard</h1>
        <p><b>✅ Total Messages Sent:</b> ${totalMessages}</p>
        <p><b>🤖 Bots Connected:</b> ${bots.length}</p>
        <p><b>👥 Unique Users:</b> ${users.length}</p>

        <h2>📌 Permanent Ad</h2>
        <form class="edit-form" method="POST" action="/edit-content?pass=admin123">
          <input name="imageSource" value="${PERMANENT_AD.imageSource}" placeholder="Image URL" required />
          <textarea name="captionText" rows="6">${PERMANENT_AD.captionText}</textarea>
          <button type="submit">Update Permanent Ad</button>
        </form>
        <form class="url-form" method="POST" action="/add-link?pass=admin123">
          <input name="linkText" placeholder="Button Text" required />
          <input name="linkDestination" placeholder="Destination URL" required />
          <button type="submit">Add Button</button>
        </form>
        <ul>${renderLinks(PERMANENT_AD)}</ul>

        <h2>🕒 Temporary Ad</h2>
        <form class="edit-form" method="POST" action="/edit-temp?pass=admin123">
          <input name="imageSource" value="${TEMPORARY_AD.imageSource}" placeholder="Image URL" />
          <textarea name="captionText" rows="6">${TEMPORARY_AD.captionText}</textarea>
          <button type="submit">Update Temporary Ad</button>
        </form>
        <form class="url-form" method="POST" action="/add-temp-link?pass=admin123">
          <input name="linkText" placeholder="Button Text" />
          <input name="linkDestination" placeholder="Destination URL" />
          <button type="submit">Add Temp Button</button>
        </form>
        <ul>${renderLinks(TEMPORARY_AD)}</ul>

        <h2>📣 Broadcast to All Bots</h2>
        <form class="edit-form" method="POST" action="/send-broadcast?pass=admin123">
          <input name="imageSource" placeholder="Broadcast Image URL" />
          <textarea name="captionText" rows="6" placeholder="Broadcast Message (HTML allowed)"></textarea>
          <input name="linkText" placeholder="Button Text (optional)" />
          <input name="linkDestination" placeholder="Button URL (optional)" />
          <button type="submit">Send Broadcast</button>
        </form>

        <div class="logs"><h4>📝 Logs:</h4><ul>${logs.slice(-10).reverse().map(log => `<li>${log}</li>`).join("")}</ul></div>
      </div></body></html>`;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    if (method === "POST" && path === "/edit-content" && pass === "admin123") {
      const formData = await req.formData();
      PERMANENT_AD.imageSource = formData.get("imageSource")?.toString() || PERMANENT_AD.imageSource;
      PERMANENT_AD.captionText = formData.get("captionText")?.toString() || PERMANENT_AD.captionText;
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path === "/edit-temp" && pass === "admin123") {
      const formData = await req.formData();
      TEMPORARY_AD.imageSource = formData.get("imageSource")?.toString() || TEMPORARY_AD.imageSource;
      TEMPORARY_AD.captionText = formData.get("captionText")?.toString() || TEMPORARY_AD.captionText;
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path === "/add-link" && pass === "admin123") {
      const formData = await req.formData();
      const linkText = formData.get("linkText")?.toString();
      const linkDestination = formData.get("linkDestination")?.toString();
      if (linkText && linkDestination) PERMANENT_AD.actionLinks.push({ linkText, linkDestination });
      return Response.redirect("/?pass=admin123");
    }

    if (method === "POST" && path === "/add-temp-link" && pass === "admin123") {
      const formData = await req.formData();
      const linkText = formData.get("linkText")?.toString();
      const linkDestination = formData.get("linkDestination")?.toString();
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

      const inlineKeyboard = linkText && linkDestination ? {
        inline_keyboard: [[{ text: linkText, url: linkDestination }]]
      } : undefined;

      for (const bot of bots) {
        for (const user of users) {
          try {
            await fetch(`https://api.telegram.org/bot${bot}/sendPhoto`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: user,
                photo: imageSource,
                caption: captionText,
                parse_mode: "HTML",
                reply_markup: inlineKeyboard,
              }),
            });
          } catch (e) {
            console.log(`❌ Failed to send to ${user} on ${bot}`);
          }
        }
      }

      return new Response(`<html><body><script>alert('✅ Broadcast Sent');location.href='/?pass=admin123'</script></body></html>`);
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) return new Response("Invalid bot token", { status: 403 });

      try {
        const update: TelegramUpdate = await req.json();
        const chatId = update.message?.chat?.id;
        const userId = update.message?.from?.id?.toString();
        const userText = update.message?.text?.normalize("NFKC");

        if (!chatId || !userId) return new Response("OK");

        const sendAd = async (ad) => {
          if (!ad.imageSource || !ad.captionText) return;
          await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: ad.imageSource,
              caption: ad.captionText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: ad.actionLinks.map(link => [{ text: link.linkText, url: link.linkDestination }]),
              },
            }),
          });
        };

        await sendAd(PERMANENT_AD);
        setTimeout(() => sendAd(TEMPORARY_AD), 5000);

        const total = (cache.get("total_messages") as number) || 0;
        const users = new Set((cache.get("users") || []) as string[]);
        const bots = new Set((cache.get("bots") || []) as string[]);
        const logs = (cache.get("logs") || []) as string[];

        users.add(userId);
        bots.add(botToken);
        logs.push(`[${new Date().toLocaleString()}] ${userId} in ${chatId}: ${userText || "[no text]"}`);

        cache.set("total_messages", total + 1);
        cache.set("users", Array.from(users));
        cache.set("bots", Array.from(bots));
        cache.set("logs", logs.slice(-100));

        return new Response("Message sent", { status: 200 });
      } catch (err) {
        console.error("❌ Error:", err);
        return new Response("Internal Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("✅ Bot server running at http://localhost:3000");
