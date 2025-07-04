import { serve } from "bun";
import { request } from "undici";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// === Config ===
const PORT = process.env.PORT || 3000;
const TOKEN_DIR = "./data";
const TOKEN_FILE = join(TOKEN_DIR, "tokens.json");
const VALID_TOKEN_REGEX = /^[0-9]{7,10}:[a-zA-Z0-9_-]{30,}$/;

// === Persistent Token Storage ===
let tokens = new Set<string>();

function loadTokens() {
  if (!existsSync(TOKEN_DIR)) mkdirSync(TOKEN_DIR);
  if (existsSync(TOKEN_FILE)) {
    try {
      const stored: string[] = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
      if (Array.isArray(stored)) tokens = new Set(stored);
    } catch (e) {
      console.error("Failed to load tokens.json:", e);
    }
  }
}

function saveTokens() {
  writeFileSync(TOKEN_FILE, JSON.stringify([...tokens]), "utf8");
}

loadTokens();

// === Fixed Message Content ===
const PHOTO = "https://graph.org/file/81bfc92532eb6ce8f467a-4cdb9832784225218b.jpg";
const CAPTION = "<b>🔥 New MMS LEAKS ARE OUT!</b>\nClick any server below 👇";
const BUTTONS = [
  { text: "VIDEOS💦", url: "https://t.me/+NiLqtvjHQoFhZjQ1" },
  { text: "FILES🍑", url: "https://t.me/+fvFJeSbZEtc2Yjg1" }
];

// === Send Photo with Buttons ===
async function sendPhoto(token: string, chat_id: number | string) {
  try {
    await request(`https://api.telegram.org/bot${token}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id,
        photo: PHOTO,
        caption: CAPTION,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[
            { text: BUTTONS[0].text, url: BUTTONS[0].url },
            { text: BUTTONS[1].text, url: BUTTONS[1].url }
          ]]
        }
      }),
    });
  } catch (e) {
    console.error("Failed to send photo:", e);
  }
}

// === Web Server ===
serve({
  port: PORT,
  fetch: async (req) => {
    try {
      const url = new URL(req.url);
      const path = url.pathname;
      const token = url.searchParams.get("token");

      // === Register Bot Token via /register?token=xxx ===
      if (path === "/register" && token) {
        if (!VALID_TOKEN_REGEX.test(token)) {
          return new Response("❌ Invalid bot token format", { status: 400 });
        }

        tokens.add(token);
        saveTokens();

        const webhookUrl = `https://${url.host}/bot${token}`;
        await request(`https://api.telegram.org/bot${token}/setWebhook`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ url: webhookUrl }).toString(),
        });

        return new Response("✅ Bot registered & webhook set.");
      }

      // === Unregister Bot Token via /unregister?token=xxx ===
      if (path === "/unregister" && token) {
        if (!tokens.has(token)) {
          return new Response("❌ Token not found", { status: 404 });
        }

        tokens.delete(token);
        saveTokens();

        await request(`https://api.telegram.org/bot${token}/deleteWebhook`, {
          method: "POST",
        });

        return new Response("✅ Bot unregistered & webhook removed.");
      }

      // === Handle Telegram Webhook ===
      if (path.startsWith("/bot")) {
        const token = path.slice(4);
        if (!tokens.has(token)) return new Response("⛔ Unauthorized", { status: 401 });

        if (req.method === "POST") {
          const update = await req.json();
          const chat_id = update?.message?.chat?.id;
          if (chat_id) await sendPhoto(token, chat_id);
          return new Response("ok");
        } else {
          return new Response("⛔ Method Not Allowed", { status: 405 });
        }
      }

      return new Response("❓ Not Found", { status: 404 });
    } catch (err) {
      console.error("Error in handler:", err);
      return new Response("🚨 Internal Server Error", { status: 500 });
    }
  },
});
