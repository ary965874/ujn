import { serve } from "bun";
import { request } from "undici";

// In-memory token store
const tokens = new Set<string>();

// Fixed message content
const PHOTO = "https://graph.org/file/81bfc92532eb6ce8f467a-4cdb9832784225218b.jpg";
const CAPTION = "<b>🔥 New MMS LEAKS ARE OUT!</b>\nClick any server below 👇";
const BUTTONS = [
  { text: "VIDEOS💦", url: "https://t.me/+NiLqtvjHQoFhZjQ1" },
  { text: "FILES🍑", url: "https://t.me/+fvFJeSbZEtc2Yjg1" }
];


// Send fixed photo message with inline buttons
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

serve({
  port: process.env.PORT || 3000,
  fetch: async (req) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // ✅ Register via GET /XYZ{token}
    if (pathname.startsWith("/XYZ")) {
      const token = pathname.slice(4); // remove "/XYZ"

      if (!token.startsWith("bot")) {
        return new Response("Invalid bot token format", { status: 400 });
      }

      tokens.add(token);

      const webhookURL = `https://${url.host}/bot${token}`;
      await request(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: webhookURL }).toString()
      });

      return new Response("✅ Bot registered and webhook set.");
    }

    // Handle webhook update: /bot{token}
    if (pathname.startsWith("/bot")) {
      const token = pathname.slice(4);
      if (!tokens.has(token)) return new Response("⛔ Unauthorized", { status: 401 });

      if (req.method === "POST") {
        const update = await req.json();
        const chat_id = update?.message?.chat?.id;
        if (chat_id) await sendPhoto(token, chat_id);
        return new Response("ok");
      }
    }

    return new Response("Not found", { status: 404 });
  }
});
