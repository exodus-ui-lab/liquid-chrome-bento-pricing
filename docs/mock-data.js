/* Example API responses for the static demo (same shapes as the backend in backend/). */
window.MOCK_API_RESPONSES = {
  "GET /api/plans": {
    "status": 200,
    "body": {
      "currency": "USD",
      "yearlySavingsPercent": 20,
      "plans": [
        {
          "id": "solo",
          "recommended": false,
          "prices": {
            "monthly": 1900,
            "yearly": 18000
          }
        },
        {
          "id": "network",
          "recommended": true,
          "prices": {
            "monthly": 4900,
            "yearly": 46800
          }
        },
        {
          "id": "studio",
          "recommended": false,
          "prices": {
            "monthly": 12900,
            "yearly": 123600
          }
        }
      ]
    },
    "delayMs": 500
  },
  "POST /api/checkout-session": {
    "status": 201,
    "body": {
      "ok": true,
      "sessionId": "cs_wl_9k2fd7qa",
      "planId": "network",
      "interval": "yearly",
      "amountCents": 46800,
      "currency": "USD",
      "expiresAt": "2026-10-02T10:30:00.000Z",
      "checkoutUrl": "/checkout/cs_wl_9k2fd7qa",
      "message": "Nothing is charged until your 14 free days end."
    },
    "delayMs": 800
  }
};
