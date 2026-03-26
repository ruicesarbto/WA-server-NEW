const axios = require("axios");

function Zarinpal(merchantId, sandbox = false) {
  if (typeof merchantId !== "string") {
    throw new Error("The provided merchantId is invalid.");
  }
  if (merchantId.length !== 36) {
    throw new Error("The provided merchantId is invalid.");
  }

  const webGateSandboxUrl = "https://sandbox.zarinpal.com/pg/rest/WebGate/";
  const webGateHttpsUrl = "https://www.zarinpal.com/pg/rest/WebGate/";

  const startPaySandboxUrl = "https://sandbox.zarinpal.com/pg/StartPay/";
  const startPayHttpsUrl = "https://www.zarinpal.com/pg/StartPay/";

  this.merchantId = merchantId;
  this.webGateUrl = sandbox === true ? webGateSandboxUrl : webGateHttpsUrl;
  this.startPayUrl = sandbox === true ? startPaySandboxUrl : startPayHttpsUrl;
}

Zarinpal.prototype.requestPayment = async function ({
  amount,
  callbackUrl,
  description,
  email,
  phoneNumber,
}) {
  let gateway = this;

  let json = {
    MerchantID: gateway.merchantId,
    Amount: amount,
    CallbackURL: callbackUrl,
    Description: description,
    Email: email,
    Mobile: phoneNumber,
  };

  const response = await axios.post(`${gateway.webGateUrl}/PaymentRequest.json`, json, {
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/json",
    }
  });

  const body = response.data;

  if (!(body.Status == 100 && body.Authority.length === 36)) {
    throw new Error("An error occurred during the payment process.");
  }

  return body.Authority;
};

Zarinpal.prototype.verifyPayment = async function ({ amount, authority }) {
  let gateway = this;

  let json = {
    MerchantID: gateway.merchantId,
    Amount: amount,
    Authority: authority,
  };

  const response = await axios.post(`${gateway.webGateUrl}/PaymentVerification.json`, json, {
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/json",
    }
  });

  const body = response.data;

  if (body.Status !== 100) {
    throw new Error("Transition failed.");
  }

  return body.RefID;
};

function setting(merchantId, sandbox) {
  return new Zarinpal(merchantId, sandbox);
}

module.exports = {
  Zarinpal,
  setting,
};
