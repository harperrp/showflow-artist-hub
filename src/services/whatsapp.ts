const API_URL = (import.meta.env.VITE_WHATSAPP_SERVER_URL || "https://crm.zapzdelivery.com.br")
  .replace(/\/+$/, "");

export const whatsappService = {
  async connect() {
    try {
      const res = await fetch(`${API_URL}/start`, { method: "POST" });
      if (!res.ok) throw new Error(`Erro ao conectar: ${res.status}`);
      return res.json();
    } catch (err) {
      console.error("[WhatsApp] connect error:", err);
      throw err;
    }
  },

  async disconnect() {
    try {
      const res = await fetch(`${API_URL}/logout`, { method: "POST" });
      if (!res.ok) throw new Error(`Erro ao desconectar: ${res.status}`);
      return res.json();
    } catch (err) {
      console.error("[WhatsApp] disconnect error:", err);
      throw err;
    }
  },

  async getStatus() {
    try {
      const res = await fetch(`${API_URL}/status`);
      if (!res.ok) return { status: "disconnected" };
      return res.json();
    } catch {
      return { status: "disconnected" };
    }
  },

  getQrImage() {
    return `${API_URL}/qr-image`;
  },
};
