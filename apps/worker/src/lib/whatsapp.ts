import { config } from "../config";

interface WhatsAppMessage {
  to: string; // phone number with country code e.g. 919876543210
  template_name: string;
  language_code: string;
  components?: object[];
}

interface SendResult {
  message_id: string;
  status: "sent" | "mocked";
}

export async function sendWhatsAppTemplate(
  msg: WhatsAppMessage
): Promise<SendResult> {
  // Mock mode when credentials not set
  if (!config.whatsappToken || !config.whatsappPhoneNumberId) {
    console.log(
      "[whatsapp:mock] Would send template:",
      msg.template_name,
      "to:",
      msg.to
    );
    return { message_id: `mock_${Date.now()}`, status: "mocked" };
  }

  const url = `${config.whatsappApiUrl}/${config.whatsappPhoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsappToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: msg.to,
      type: "template",
      template: {
        name: msg.template_name,
        language: { code: msg.language_code },
        components: msg.components ?? []
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
  }

  const data = (await response.json()) as { messages: Array<{ id: string }> };
  return { message_id: data.messages[0].id, status: "sent" };
}
