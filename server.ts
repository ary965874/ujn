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

let EXCLUSIVE_CONTENT = {
  imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
",
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

    // Dashboard
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
      const actionLinks = EXCLUSIVE_CONTENT.actionLinks;

      const html = `
        <!DOCTYPE html><html><head><title>Bot Dashboard</title>
        <style>
          body { background:#121212; color:#fff; font-family:sans-serif; padding:2em; }
          .card { background:#1e1e1e; padding:2em; border-radius:10px; max-width:900px; margin:auto; box-shadow:0 0 15px rgba(0,0,0,0.4); }
          h1, h2 { color:#f97316; }
          ul { padding-left:1.5em; }
          input, button, textarea { width:100%; margin:5px 0; padding:10px; border-radius:6px; border:none; }
          button { background:#f97316; color:white; cursor:pointer; }
          .url-form, .edit-form { margin-top:2em; border-top:1px solid #333; padding-top:1em; }
          .logs { margin-top: 2em; background: #222; padding: 1em; border-radius: 8px; max-height: 200px; overflow-y: auto; }
        </style></head><body>
          <div class="card">
            <h1>📊 Bot Dashboard</h1>
            <p><b>✅ Total Messages Sent:</b> ${totalMessages}</p>
            <p><b>🤖 Bots Connected:</b> ${bots.length}</p>
            <ul>${bots.map(b => `<li>${b.slice(0, 12)}...</li>`).join("")}</ul>
            <p><b>👥 Unique Users:</b> ${users.length}</p>
            <ul>${users.map(u => `<li>${u}</li>`).join("")}</ul>
            <img src="${EXCLUSIVE_CONTENT.imageSource}" alt="ad" width="100%" style="max-width:300px; margin-top:1em;" />
            
            <div class="edit-form">
              <h3>🖼️ Edit Image & Caption</h3>
              <form method="POST" action="/edit-content?pass=admin123">
                <input name="imageSource" value="${EXCLUSIVE_CONTENT.imageSource}" placeholder="Image URL" required />
                <textarea name="captionText" rows="6">${EXCLUSIVE_CONTENT.captionText}</textarea>
                <button type="submit">Update Content</button>
              </form>
            </div>

            <div class="url-form">
              <h3>➕ Add New Action Link</h3>
              <form method="POST" action="/add-link?pass=admin123">
                <input name="linkText" placeholder="Button Text" required />
                <input name="linkDestination" placeholder="Destination URL" required />
                <button type="submit">Add Link</button>
              </form>
              <ul><h4>🔗 Current Links:</h4>
                ${actionLinks.map(link => `<li><b>${link.linkText}</b> ➜ <a href="${link.linkDestination}" target="_blank">${link.linkDestination}</a></li>`).join("")}
              </ul>
            </div>

            <div class="logs"><h4>📝 Recent Logs:</h4><ul>
              ${logs.slice(-10).reverse().map(log => `<li>${log}</li>`).join("")}
            </ul></div>
          </div>
        </body></html>
      `;
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // Edit caption/image
    if (method === "POST" && path === "/edit-content" && pass === "admin123") {
      const formData = await req.formData();
      const img = formData.get("imageSource")?.toString();
      const caption = formData.get("captionText")?.toString();
      if (img && caption) {
        EXCLUSIVE_CONTENT.imageSource = img;
        EXCLUSIVE_CONTENT.captionText = caption;
      }
      return new Response(`<html><body><script>location.href='/?pass=admin123'</script></body></html>`);
    }

    // Add new action link
    if (method === "POST" && path === "/add-link" && pass === "admin123") {
      const formData = await req.formData();
      const linkText = formData.get("linkText")?.toString();
      const linkDestination = formData.get("linkDestination")?.toString();
      if (linkText && linkDestination) {
        EXCLUSIVE_CONTENT.actionLinks.push({ linkText, linkDestination });
      }
      return new Response(`<html><body><script>location.href='/?pass=admin123'</script></body></html>`);
    }

    // Webhook handler
    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      if (!botToken.match(/^\d+:[A-Za-z0-9_-]+$/)) return new Response("Invalid bot token", { status: 403 });

      try {
        const update: TelegramUpdate = await req.json();
        const chatId = update.message?.chat?.id;
        const userId = update.message?.from?.id?.toString();
        const userText = update.message?.text?.normalize("NFKC");

        if (!chatId || !userId) return new Response("OK");

        const sendContent = async () => {
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
        };

        await sendContent(); // immediate
        setTimeout(sendContent, 5000); // repeat after 5s

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
