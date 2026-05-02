import "dotenv/config";

export const config = {
  whatsappApiUrl: process.env.WHATSAPP_API_URL ?? "https://graph.facebook.com/v19.0",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
  whatsappToken: process.env.WHATSAPP_TOKEN ?? "",
  whatsappWebhookVerifyToken:
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "fit_dev_verify_token"
};
