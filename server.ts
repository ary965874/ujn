import { serve } from "bun";
import { writeFile, readFile } from "fs/promises";

interface MainButton {
  label: string;
  message: string;
}

interface MenuConfig {
  defaultImageUrl: string;
  defaultCaption: string;
  mainButtons: MainButton[];
}

// Catalog text with proper spacing
const CATALOG_MESSAGE = `🔞 MMS 50K+ VIDEOS :- 199/-

💦 SUPER HARD COLLECTION :- 159/-

🔥 C-:P AND R:-P COMBO :- 399/-

🤫 C-:P :- 229/-

🫣 R:-P :- 199/-

😇 VIDEOS AND FILES ONLY

support @Seller_babuji`;

const defaults: MenuConfig = {
  defaultImageUrl: "https://i.ibb.co/pvpn8kDc/x.jpg",
  defaultCaption: "Send payment and send screenshot",
  mainButtons: [
    { label: "🔞 MMS 50K+ VIDEOS :- 199/-", message: "You selected - 199/-" },
    { label: "💦 SUPER HARD COLLECTION :- 159/-", message: "You selected  159/-" },
    { label: "🔥 C-:P AND R:-P COMBO :- 399/-", message: "You selected  399/-" },
    { label: "🤫 C-:P :- 229/-", message: "You selected 229/-" },
    { label: "🫣 R:-P :- 199/-", message: "You selected 199/-" },

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

// Track button clicks
const buttonClicks: { chatId: number; label: string; timestamp: number }[] = [];

function logUser(chatId: number, action: string) {
  logs.push({ chatId, action, timestamp: Date.now() });
  if (logs.length > 1000) logs.shift();
}

// Create inline keyboard
function inlineKeyboard(buttons: MainButton[]) {
  return {
    inline_keyboard: buttons.map(b => [{ text: b.label, callback_data: b.label }]),
  };
}

// Send catalog message first
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
  logUser(chatId, "catalog sent");
}

// Send image + “send ss” message when user clicks a button
async function sendPayMessage(botToken: string, chatId: number, label: string) {
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  // Optional: send acknowledgment of button clicked
  await fetch(`${baseUrl}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: `You clicked: ${label}`,
    }),
  });

  // Send pay image + caption
  await fetch(`${baseUrl}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: menuConfig.defaultImageUrl,
      caption: menuConfig.defaultCaption,
    }),
  });
}

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Admin dashboard
    if (url.pathname === "/admin") {
      return new Response(
        JSON.stringify({ logs, buttonClicks }, null, 2),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Webhook handler
    if (url.pathname.startsWith("/webhook/")) {
      const botToken = url.pathname.split("/")[2];
      const update = await req.json().catch(() => ({}));
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (!chatId) return new Response("ok");

      // If user clicked a button
      if (update.callback_query) {
        const label = update.callback_query.data;
        logUser(chatId, `button clicked: ${label}`);
        buttonClicks.push({ chatId, label, timestamp: Date.now() });

        // Send image + "send ss" message
        await sendPayMessage(botToken, chatId, label);
      } else {
        // Any message → send catalog only
        await sendCatalog(botToken, chatId);
      }

      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log("Bot server running at http://localhost:3000");
