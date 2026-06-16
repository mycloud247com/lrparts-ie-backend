const Routes = [
  {
    path: "/settings/public",
    method: "GET",
    controller: class {
      constructor(context) { this.db = context.db; }
      async getPublic() {
        const rows = await this.db.Setting.findAll();
        const s = {};
        for (const r of rows) s[r.key] = r.value;
        return {
          companyName: s.companyName || "LR Parts Ireland",
          companyEmail: s.companyEmail || "info@lrparts.ie",
          companyPhone: s.companyPhone || "+353 1 XXX XXXX",
          shippingCost: s.shippingCost || "7.95",
          freeShippingThreshold: s.freeShippingThreshold || "100",
        };
      }
    },
    action: "getPublic",
    middlewares: [],
  },
];

export default Routes;
