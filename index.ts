import { serve } from "bun";
import { request } from "undici";
import { readFileSync, writeFileSync, existsSync } from "fs";

// === Persistent Token Storage ===
const tokenFile = "tokens.json";
let tokens = new Set<string>();

if (existsSync(tokenFile)) {
  try {
    const stored: string[] = JSON.parse(readFileSync(tokenFile, "utf8"));
    if (Array.isArray(stored)) tokens = new Set(stored);
  } catch (e) {
    console.error("Failed to load tokens.json:", e);
  }
}

function saveTokens() {
  writeFileSync(tokenFile, JSON.stringify([...tokens]), "utf8");
}

// === Fixed Message Content ===
const PHOTO = "https://graph.org/file/81bfc92532eb6ce8f467a-4cdb9832784225218b.jpg";
const CAPTION = "<b>🔥 New MMS LEAKS ARE OUT!</b>\nClick any server below 👇";
const BUTTONS = [
  { text: "VIDEOS💦", url: "https://t.me/+NiLqtvjHQoFhZjQ1" },
  { text: "FILES🍑", url: "https://t.me/+fvFJeSbZEtc2Yjg1" }
];

// === Send Photo with Buttons ===
async function sendPhoto(token: string, chat_id: number | string) {
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
}

// === Web Server ===
serve({
  port: process.env.PORT || 3000,
  fetch: async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    // === Register Bot Token via /XYZ{token} ===
    if (path.startsWith("/XYZ")) {
      let raw = path.slice(4);
      const token = decodeURIComponent(raw.trim());

      console.log("Received token:", token);

      const tokenRegex = /^[0-9]{7,10}:[a-zA-Z0-9_-]{30,}$/;
      if (!tokenRegex.test(token)) {
        return new Response("❌ Invalid bot token format", { status: 400 });
      }

      tokens.add(token);
      saveTokens();

      const webhookUrl = `https://${url.host}/bot${token}`;
      await request(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: webhookUrl }).toString()
      });

      return new Response("✅ Bot registered & webhook set.");
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
      }
    }

    return new Response("Not Found", { status: 404 });
  }
});
