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

// Initialize default ads
if (!cache.get("ads")) {
  cache.set("ads", {
    permanent: {
      imageSource: "https://i.ibb.co/J66PqCQ/x.jpg",
      captionText: `🔥 <b>NEW MMS LEAKS ARE OUT!</b> 🔥\n\n💥 <b><u>EXCLUSIVE PREMIUM CONTENT</u></b> 💥\n\n🎬 <i>Fresh leaked content daily</i>\n🔞 <b>18+ Adult Material</b>\n💎 <i>Premium quality videos & files</i>\n🚀 <b>Instant access available</b>\n\n⬇️ <b><u>Click any server below</u></b> ⬇️`,
      actionLinks: [
        { linkText: "🎥 VIDEOS💦", linkDestination: "https://t.me/+Go8FEdh9M8Y3ZWU1" },
        { linkText: "📁 FILES🍑", linkDestination: "https://t.me/+06bZb-fbn4kzNjll" },
      ],
    },
    temporary: null,
  });
}

// Initialize blocked IPs
if (!cache.get("blocked_ips")) cache.set("blocked_ips", []);

// Helpers
function isValidTelegramBotToken(token: string): boolean {
  return /^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(token);
}

function appendLog(line: string) {
  let log = (cache.get("log_bar") as string) || "";
  const timestamp = new Date().toISOString();
  const newLine = `${timestamp} | ${line}\n`;
  log += newLine;

  if (log.length > 102400) {
    const targetSize = 81920;
    log = log.slice(-targetSize);
    const firstNewline = log.indexOf("\n");
    if (firstNewline !== -1) log = log.slice(firstNewline + 1);
    log = `${timestamp} | [LOG TRIMMED - Keeping last 80KB]\n` + log;
  }

  cache.set("log_bar", log);
}

function clearLogs() {
  cache.set("log_bar", "");
  appendLog("Logs cleared manually");
}

function getLogStats() {
  const log = (cache.get("log_bar") as string) || "";
  const lines = log.split("\n").filter((line) => line.trim());
  return {
    size: log.length,
    lines: lines.length,
    sizeKB: Math.round((log.length / 1024) * 100) / 100,
  };
}

// IP helpers
function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function blockIp(ip: string) {
  const blocked = (cache.get("blocked_ips") as string[]) || [];
  if (!blocked.includes(ip)) {
    blocked.push(ip);
    cache.set("blocked_ips", blocked);
    appendLog(`🚫 Blocked IP: ${ip}`);
  }
}

function unblockIp(ip: string) {
  const blocked = (cache.get("blocked_ips") as string[]) || [];
  const filtered = blocked.filter((b) => b !== ip);
  cache.set("blocked_ips", filtered);
  appendLog(`✅ Unblocked IP: ${ip}`);
}

// Serve function
serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;
    const pass = url.searchParams.get("pass");

    // DASHBOARD LOGIN
    if (method === "GET" && path === "/") {
      if (pass !== "admin10082") {
        return new Response(
          `
          <!DOCTYPE html>
          <html>
          <head>
          <meta charset="UTF-8">
          <style>
            body { background:#0f0f0f; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; margin:0; }
            .login-form { background:#1a1a1a; padding:2rem; border-radius:10px; box-shadow:0 4px 20px rgba(0,0,0,0.5); }
            input { padding:12px; margin:10px 0; border:none; border-radius:5px; width:200px; }
            button { padding:12px 24px; background:#f97316; border:none; border-radius:5px; color:white; font-weight:bold; cursor:pointer; width:100%; }
            h2 { color:#f97316; text-align:center; }
          </style>
          </head>
          <body>
            <div class="login-form">
              <h2>🔐 Admin Login</h2>
              <form>
                <input name='pass' type='password' placeholder='Enter admin password' required>
                <button type='submit'>Login</button>
              </form>
            </div>
          </body>
          </html>
          `,
          { headers: { "Content-Type": "text/html" } }
        );
      }

      // Fetch dashboard stats
      const tokenResponsesRaw = cache.get("token_responses") as string | undefined;
      const tokenResponses = tokenResponsesRaw ? JSON.parse(tokenResponsesRaw) : {};
      const stats = {
        total: cache.get("total_messages") || 0,
        users: Array.from(new Set((cache.get("users") || []) as string[])),
        bots: Array.from(new Set((cache.get("bots") || []) as string[])),
        ads: cache.get("ads") || {},
        tokenResponses,
        logBar: (cache.get("log_bar") as string) || "",
        logStats: getLogStats(),
        blockedIps: (cache.get("blocked_ips") as string[]) || [],
      };

      const blockedIpHtml = stats.blockedIps
        .map(
          (ip) => `<div style="margin:5px 0; display:flex; justify-content:space-between; align-items:center; padding:5px 10px; background:#1a1a1a; border-radius:5px; border:1px solid #333;">
            <span>${ip}</span>
            <form method="POST" action="/unblock-ip?ip=${ip}&pass=admin10082" style="margin:0;">
              <button type="submit" style="background:#10b981; padding:2px 8px; font-size:12px;">Unblock</button>
            </form>
          </div>`
        )
        .join("") || "<em style='color:#888;'>No blocked IPs</em>";

      return new Response(
        `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { background:#0f0f0f; color:white; font-family:sans-serif; padding:2em; line-height:1.6; }
            h1,h2,h3 { color:#f97316; }
            pre { background:#1e1e1e; padding:1em; border-radius:8px; max-height:300px; overflow-y:auto; }
            textarea,input { margin:5px 0; padding:10px; border-radius:5px; border:1px solid #555; background:#2a2a2a; color:white; }
            .blocked-ip-section { margin-top:2em; }
          </style>
        </head>
        <body>
          <h1>🤖 Telegram Bot Dashboard</h1>
          <p>Total Messages: ${stats.total}</p>
          <p>Unique Users: ${stats.users.length}</p>
          <p>Active Bots: ${stats.bots.length}</p>
          <p>Log Size: ${stats.logStats.sizeKB} KB / ${stats.logStats.lines} lines</p>

          <div class="blocked-ip-section">
            <h3>🚫 Blocked IPs</h3>
            ${blockedIpHtml}
          </div>

          <h3>📜 System Logs</h3>
          <pre>${stats.logBar.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </body>
        </html>
        `,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    // UNBLOCK IP
    if (method === "POST" && path === "/unblock-ip" && pass === "admin10082") {
      const ip = url.searchParams.get("ip");
      if (ip) {
        unblockIp(ip);
        return new Response(
          `<script>alert('✅ Unblocked IP: ${ip}');location.href='/?pass=admin10082'</script>`,
          { headers: { "Content-Type": "text/html" } }
        );
      }
    }

    // BLOCK WEBHOOK
    if (method === "POST" && path.startsWith("/webhook/")) {
      const ip = getClientIp(req);
      const blocked = (cache.get("blocked_ips") as string[]) || [];
      if (blocked.includes(ip)) {
        appendLog(`⛔ Dropped request from blocked IP ${ip}`);
        return new Response("Blocked", { status: 403 });
      }

      const botToken = path.replace("/webhook/", "");
      if (!isValidTelegramBotToken(botToken)) {
        appendLog(`❌ Invalid webhook token format from ${ip}: ${botToken.substring(0, 20)}...`);
        return new Response("Ignored: Invalid token format", { status: 400 });
      }

      try {
        const update: TelegramUpdate = await req.json();

        // Track bot
        const bots = cache.get("bots") || [];
        cache.set("bots", Array.from(new Set([...(bots as string[]), botToken])));

        // Update token response count
        const tokenResponsesRaw = cache.get("token_responses") as string | undefined;
        const tokenResponses = tokenResponsesRaw ? JSON.parse(tokenResponsesRaw) : {};
        tokenResponses[botToken] = (tokenResponses[botToken] || 0) + 1;
        cache.set("token_responses", JSON.stringify(tokenResponses));

        // Update total messages
        const total = (cache.get("total_messages") as number) || 0;
        cache.set("total_messages", total + 1);

        const shortToken = `${botToken.substring(0, 10)}...${botToken.substring(botToken.length - 10)}`;
        appendLog(`📨 Webhook ${shortToken} from IP ${ip} | Count: ${tokenResponses[botToken]}`);

        return new Response("OK");
      } catch (error) {
        appendLog(`❌ Webhook processing error from ${ip}: ${error}`);
        return new Response("Error processing webhook", { status: 500 });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("✅ Telegram bot webhook dashboard live on http://localhost:3000");
console.log("🔐 Admin password: admin10082");
