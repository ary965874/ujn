// Combined Telegram Bot Server with Ad & Channel Tracking (Improved & Enhanced Dashboard)
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
const escapeHTML = (text: string) => text?.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;") || "";

const ADMIN_PASS = "admin123";

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

    const renderLinks = (ad: any) =>
      ad.actionLinks.map((link: any) =>
        `<li><b>${escapeHTML(link.linkText)}</b>: <a href="${link.linkDestination}" target="_blank">${link.linkDestination}</a></li>`
      ).join("");

    const renderChannels = (channels: { id: string; link: string }[]) =>
      channels.length === 0 ? '<li><i>No data</i></li>' :
      channels.map((c) => `<li><a href="${c.link}" target="_blank">${c.link}</a> <small>(ID: ${c.id})</small></li>`).join("");

    if (method === "GET" && path === "/") {
      if (pass !== ADMIN_PASS) {
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

      return new Response(
        `<!DOCTYPE html><html><head><title>Dashboard</title><style>
        body { font-family: sans-serif; background: #111; color: #eee; padding: 2em; }
        .card { max-width: 960px; margin: auto; padding: 2em; background: #222; border-radius: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.3); }
        input, textarea, button { width: 100%; padding: 10px; margin: 8px 0; border: none; border-radius: 6px; font-size: 15px; }
        button { background: #f97316; color: white; font-weight: bold; cursor: pointer; }
        ul { padding-left: 1.2em; margin: 1em 0; }
        h1, h2, h3 { color: #f97316; }
        small { color: #aaa; }
      </style></head><body><div class="card">
        <h1>📊 Telegram Bot Dashboard</h1>
        <p><b>Total Messages:</b> ${total}</p>
        <p><b>Total Bots Used:</b> ${bots.length}</p>
        <p><b>Total Users:</b> ${users.length}</p>

        <h2>📡 Channels Detected</h2><ul>${renderChannels(channels as any)}</ul>
        <h2>📤 Channels Sent</h2><ul>${renderChannels(sentChannels as any)}</ul>

        <h2>📌 Permanent Ad</h2>
        <form method="POST" action="/edit-content?pass=${ADMIN_PASS}">
          <input name="imageSource" value="${PERMANENT_AD.imageSource}" placeholder="Image URL" />
          <textarea name="captionText" rows="5">${escapeHTML(PERMANENT_AD.captionText)}</textarea>
          <button>Update</button>
        </form>
        <form method="POST" action="/add-link?pass=${ADMIN_PASS}">
          <input name="linkText" placeholder="Button Text" />
          <input name="linkDestination" placeholder="Destination URL" />
          <button>Add Button</button>
        </form>
        <ul>${renderLinks(PERMANENT_AD)}</ul>

        <h2>🕒 Temporary Ad</h2>
        <form method="POST" action="/edit-temp?pass=${ADMIN_PASS}">
          <input name="imageSource" value="${TEMPORARY_AD.imageSource}" placeholder="Temp Image URL" />
          <textarea name="captionText" rows="4">${escapeHTML(TEMPORARY_AD.captionText)}</textarea>
          <button>Update</button>
        </form>
        <form method="POST" action="/add-temp-link?pass=${ADMIN_PASS}">
          <input name="linkText" placeholder="Temp Link Text" />
          <input name="linkDestination" placeholder="Temp Destination URL" />
          <button>Add Temp Button</button>
        </form>
        <ul>${renderLinks(TEMPORARY_AD)}</ul>

        <h2>📣 Broadcast Message</h2>
        <form method="POST" action="/send-broadcast?pass=${ADMIN_PASS}">
          <input name="imageSource" placeholder="Image URL" />
          <textarea name="captionText" placeholder="Message caption"></textarea>
          <input name="linkText" placeholder="Button Text (optional)" />
          <input name="linkDestination" placeholder="Button URL (optional)" />
          <button>Send Broadcast</button>
        </form>

        <h3>📝 Recent Logs</h3>
        <ul>${logs.slice(-15).reverse().map((log) => `<li>${escapeHTML(log)}</li>`).join("")}</ul>
      </div></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("✅ Combined bot server running on http://localhost:3000");
