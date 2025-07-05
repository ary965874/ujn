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
  imageSource: "https://i.ibb.co/69jxy9f/image.png",
  captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥

💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥

🎬 <i>Fresh leaked content daily</i>
🔞 <b>18+ Adult Material</b>
💎 <i>Premium quality videos & files</i>
🚀 <b>Instant access available</b>

⬇️ <b><u>Click any server below</u></b> ⬇️`,
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
    const pass = url.searchParams.get("pass");

    if (method === "GET" && path === "/") {
      if (pass !== "admin123") {
        return new Response(`
          <html><head><title>Login</title></head>
          <body style="font-family:sans-serif;padding:2em;text-align:center;">
            <h2>🔒 Admin Access</h2>
            <form method="GET">
              <input name='pass' placeholder='Enter Password' style='padding:10px;border:1px solid #ccc;' />
              <button type='submit' style='padding:10px 20px;'>Login</button>
            </form>
          </body></html>
        `, { headers: { "Content-Type": "text/html" } });
      }

      const totalMessages = cache.get("total_messages") || 0;
      const users = Array.from(new Set((cache.get("users") || []) as string[]));
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
      const links = EXCLUSIVE_CONTENT.actionLinks;

      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f9f9f9; margin: 0; padding: 0; }
          .container { max-width: 800px; margin: 2em auto; background: white; padding: 2em; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { margin-top: 0; }
          .stats p { margin: 5px 0; }
          .button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; margin-top: 1em; }
          .button:hover { background: #0056b3; }
          #addLinkForm { display: none; margin-top: 1em; }
          input { padding: 10px; width: 100%; margin-top: 0.5em; box-sizing: border-box; }
          .link-list li { margin: 4px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📊 Bot Dashboard</h1>
          <div class="stats">
            <p><b>✅ Total Messages Sent:</b> ${totalMessages}</p>
            <p><b>🤖 Bots Connected:</b> ${bots.length}</p>
            <ul>${bots.map(b => `<li>${b.slice(0, 12)}...</li>`).join("")}</ul>
            <p><b>👥 Unique Users:</b> ${users.length}</p>
            <ul>${users.map(u => `<li>${u}</li>`).join("")}</ul>
          </div>

          <img src="${EXCLUSIVE_CONTENT.imageSource}" width="100%" style="max-width:300px;margin:1em 0;" />

          <h3>🔗 Current Action Links:</h3>
          <ul class="link-list">
            ${links.map(l => `<li><b>${l.linkText}</b>: <a href="${l.linkDestination}" target="_blank">${l.linkDestination}</a></li>`).join("")}
          </ul>

          <button class="button" onclick="document.getElementById('addLinkForm').style.display='block'">➕ Add New Link</button>

          <form id="addLinkForm" method="POST" action="/add-link?pass=admin123">
            <input type="text" name="linkText" placeholder="Link Button Text" required />
            <input type="url" name="linkDestination" placeholder="Destination URL" required />
            <button type="submit" class="button">Add Link</button>
          </form>
        </div>
      </body>
      </html>
      `;

      return new Response(html, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST" && path === "/add-link") {
      if (pass !== "admin123") return new Response("Unauthorized", { status: 403 });

      const form = await req.formData();
      const linkText = form.get("linkText")?.toString();
      const linkDestination = form.get("linkDestination")?.toString();

      if (linkText && linkDestination) {
        EXCLUSIVE_CONTENT.actionLinks.push({ linkText, linkDestination });
      }

      return new Response(`<html><body><script>location.href='/?pass=admin123'</script></body></html>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) return new Response("Invalid token", { status: 403 });

      try {
        const update: TelegramUpdate = await req.json();
        const chatId = update.message?.chat?.id;
        const userId = update.message?.from?.id?.toString();

        if (!chatId || !userId) return new Response("Invalid update", { status: 200 });

        await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            photo: EXCLUSIVE_CONTENT.imageSource,
            caption: EXCLUSIVE_CONTENT.captionText,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: EXCLUSIVE_CONTENT.actionLinks.map(link => [
                { text: link.linkText, url: link.linkDestination },
              ]),
            },
          }),
        });

        // Stats tracking
        const prev = (cache.get("total_messages") as number) || 0;
        const users = new Set((cache.get("users") || []) as string[]);
        const bots = new Set((cache.get("bots") || []) as string[]);

        users.add(userId);
        bots.add(botToken);

        cache.set("total_messages", prev + 1);
        cache.set("users", Array.from(users));
        cache.set("bots", Array.from(bots));

        return new Response("Message sent", { status: 200 });
      } catch (e) {
        console.error("Webhook Error:", e);
        return new Response("Error", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("✅ Server running on http://localhost:3000");
