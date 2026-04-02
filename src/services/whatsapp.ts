const API_URL = (import.meta.env.VITE_WHATSAPP_SERVER_URL || "https://crm.zapzdelivery.com.br")
  .replace(/\/$/, "");

export const whatsappService = {
  async connect() {
    await fetch(`${API_URL}/start`, {
      method: "POST",
    });
  },

  async disconnect() {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
    });
  },

  async getStatus() {
    const res = await fetch(`${API_URL}/status`);
    return res.json();
  },

  getQrImage() {
    return `${API_URL}/qr-image`;
  },
};
