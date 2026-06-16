import axios from "axios";

class RidexService {
  constructor() {
    this.baseUrl = process.env.RIDEX_BASE_URL || "https://www.ridex.eu";
    this.token = null;
  }

  async ensureAuth() {
    if (this.token) return;
    const res = await axios.post(`${this.baseUrl}/api/login`, {
      email: process.env.RIDEX_EMAIL,
      password: process.env.RIDEX_PASSWORD,
    }, { headers: { Accept: "application/json", "Content-Type": "application/json" } });
    this.token = res.data?.data?.token || res.data?.token;
  }

  async apiRequest(method, path, body = null) {
    const headers = { Accept: "application/json", "Content-Type": "application/json" };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    try {
      const res = await axios({ method, url: `${this.baseUrl}${path}`, data: body, headers });
      return res.data;
    } catch (err) {
      if (err.response?.status === 401) {
        this.token = null;
        await this.ensureAuth();
        headers.Authorization = `Bearer ${this.token}`;
        const res = await axios({ method, url: `${this.baseUrl}${path}`, data: body, headers });
        return res.data;
      }
      throw err;
    }
  }

  // v1: basic info (price, quantity, name, articleId)
  async getArticles(articleNos) {
    await this.ensureAuth();
    const result = await this.apiRequest("POST", "/api/v1/articles", { articleNo: articleNos });
    return result?.data || [];
  }

  // v2: detailed info (specs, OEM, photos)
  async getArticleInfo(articleNos) {
    await this.ensureAuth();
    const result = await this.apiRequest("POST", "/api/v2/articles/info", { articleNo: articleNos });
    const data = result?.data || [];
    return data.filter(d => !d.error);
  }
}

// Singleton
export default new RidexService();
