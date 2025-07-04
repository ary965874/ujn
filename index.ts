import { serve } from "bun";
import { request } from "undici";

const sendPhotoWithButtons = async (
  token: string,
  chat_id: number | string,
  photo_url: string,
  caption: string,
  buttons: { text: string; url: string }[]
) => {
  return request(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id,
      photo: photo_url,
      caption,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [[
          { text: buttons[0].text, url: buttons[0].url },
          { text: buttons[1].text, url: buttons[1].url }
        ]]
      }
    }),
  });
};

serve({
  port: process.env.PORT || 3000,
  fetch: async (req) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Only allow POST /send
    if (pathname === "/send" && req.method === "POST") {
      const { token, chat_id, caption, photo, buttons } = await req.json();

      if (!token || !chat_id || !caption || !photo || !buttons?.length) {
        return new Response("Missing data", { status: 400 });
      }

      const resp = await sendPhotoWithButtons(token, chat_id, photo, caption, buttons);
      return new Response("Sent with status " + resp.status);
    }

    return new Response("Use POST /send", { status: 404 });
  }
});
