import { serve } from "bun";
import { writeFile, readFile } from "fs/promises";

interface SubButton {
  label: string;
  imageUrl?: string;
  caption?: string;
}

interface MainButton {
  label: string;
  message: string;
  subButtons?: SubButton[];
}

interface MenuConfig {
  defaultImageUrl: string;
  defaultCaption: string;
  mainButtons: MainButton[];
}

const CATALOG_MESSAGE = `🔞 MMS 50K+ VIDEOS :- 199/-
💦 SUPER HARD COLLECTION :- 159/-
🔥 C-:P AND R:-P COMBO :- 399/-
🤫 C-:P :- 229/-
🫣 R:-P :- 199/-
😇 VIDEOS AND FILES ONLY`;

const defaults: MenuConfig = {
  defaultImageUrl: "https://i.ibb.co/pvpn8kDc/x.jpg",
  defaultCaption: "Send payment and send screenshot",
  mainButtons: [
    { label: "🔞 MMS 50K+ VIDEOS :- 199/-", message: "You selected 🔞 MMS 50K+ VIDEOS :- 199/-" },
    { label: "💦 SUPER HARD COLLECTION :- 159/-", message: "You selected 💦 SUPER HARD COLLECTION :- 159/-" },
    { label: "🔥 C-:P AND R:-P COMBO :- 399/-", message: "You selected 🔥 C-:P AND R:-P COMBO :- 399/-" },
    { label: "🤫 C-:P :- 229/-", message: "You selected 🤫 C-:P :- 229/-" },
    { label: "🫣 R:-P :- 199/-", message: "You selected 🫣 R:-P :- 199/-" },
    { label: "😇 VIDEOS AND FILES ONLY", message: "You selected 😇 VIDEOS AND FILES ONLY" },
  ],
};

let menuConfig: MenuConfig = defaults;
try {
  menuConfig = JSON.parse(await readFile("menu-config.json", "utf8"));
} catch {
  await writeFile("menu-config.json", JSON.stringify(defaults, null, 2));
}

// Logs for admin dashboard
const logs: { chatId: number; action: string; timestamp: number }[] = [];

// Track catalog clicks
const catalogClicks: { chatId: number; timestamp: number }[] = [];

function logUser(chatId: number, action: string) {
  logs.push({ chatId, action, timestamp: Date.now() });
  if (logs.length > 1000) logs.shift();
}

function inlineKeyboard(buttons: MainButton[]) {
  return {
    inline_keyboard: buttons.map(b => [{ text: b.label, callback_data: b.label }]),
  };
}

// Single "Catalog" button
function catalogButton() {
  return {
    inline_keyboard: [[{ text: "📜 Catalog", callback_data: "catalog" }]],
  };
}

async function sendPayMessage(botToken: string, chatId: number) {
  const baseUrl = `https://api.telegram.org/bot${botToken}`;
  await fetch(`${baseUrl}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: menuConfig.defaultImageUrl,
      caption: menuConfig.defaultCaption,
      reply_markup: catalogButton(), // show catalog button
    }),
  });
}

async function sendCatalog(botToken: string, chatId: number) {
  const baseUrl = `https://api.telegram.org/bot${botToken}`;
  await fetch(`${baseUrl}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: CATALOG_MESSAGE,
      reply_markup: inlineKeyboard(menuConfig.mainButtons),
    }),
  });
  catalogClicks.push({ chatId, timestamp: Date.now() });
}

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Admin dashboard: /admin → shows logs and catalog clicks
    if (url.pathname === "/admin10882") {
      return new Response(
        JSON.stringify({ logs, catalogClicks }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Webhook for bots
    if (url.pathname.startsWith("/webhook/")) {
      const botToken = url.pathname.split("/")[2];
      const update = await req.json().catch(() => ({}));
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (!chatId) return new Response("ok");

      // Handle callback query
      if (update.callback_query) {
        const data = update.callback_query.data;
        logUser(chatId, `callback: ${data}`);
        if (data === "catalog") {
          await sendCatalog(botToken, chatId);
        }
      } else {
        // Any message → send pay message with catalog button
        logUser(chatId, "sent pay message");
        await sendPayMessage(botToken, chatId);
      }

      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log("Bot server running at http://localhost:3000");
