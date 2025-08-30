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
  defaultCaption: "send payment and send ss",
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

const logs: { botToken: string; data: any }[] = [];

function log(botToken: string, data: any) {
  logs.push({ botToken, data });
  if (logs.length > 1000) logs.shift();
}

function inlineKeyboard(buttons: MainButton[]) {
  return {
    inline_keyboard: buttons.map(b => [{ text: b.label, callback_data: b.label }]),
  };
}

async function sendCatalog(botToken: string, chatId: number) {
  const baseUrl = `https://api.telegram.org/bot${botToken}`;
  // send pay image + caption
  await fetch(`${baseUrl}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: menuConfig.defaultImageUrl,
      caption: menuConfig.defaultCaption,
    }),
  });
  // send catalog message with buttons
  await fetch(`${baseUrl}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: CATALOG_MESSAGE,
      reply_markup: inlineKeyboard(menuConfig.mainButtons),
    }),
  });
}

serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Webhook handler
    if (url.pathname.startsWith("/webhook/")) {
      const botToken = url.pathname.split("/")[2];
      const update = await req.json().catch(() => ({}));
      log(botToken, update);

      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (!chatId) return new Response("ok");

      // Whenever ANY message or callback received → send catalog
      await sendCatalog(botToken, chatId);

      return new Response("ok");
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log("Bot server running at http://localhost:3000");
