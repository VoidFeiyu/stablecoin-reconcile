"use strict";

const Payment = (() => {
  const address = /^0x[0-9a-f]{40}$/i;
  const hash = /^0x[0-9a-f]{64}$/i;
  const receiptPrefix = "LEDGER-RECEIPT-1.";
  const style = `
    :root{font-family:system-ui,"Microsoft YaHei",sans-serif;color:#132b29;background:#f2f6f5;color-scheme:light}
    *{box-sizing:border-box}body{margin:0;padding:clamp(14px,5vw,60px)}
    main{margin:auto;max-width:570px;background:#fff;border:1px solid #dce7e4;border-radius:14px;padding:clamp(18px,5vw,35px)}
    h1,h2,p{margin:0} h1{font-size:2rem} h2{font-size:1.12rem} p{line-height:1.55}
    .meta{color:#4e6661;margin-top:7px}.amount{display:block;margin:19px 0;font-size:clamp(1.5rem,5vw,2.5rem);overflow-wrap:anywhere}
    .fields{display:grid;gap:8px}label{font-weight:650;font-size:.93rem}
    input,textarea,button{font:inherit}input,textarea{width:100%;border:1px solid #abc6be;padding:9px;border-radius:7px;overflow-wrap:anywhere}
    button{width:fit-content;border:1px solid #006557;border-radius:8px;background:#006557;color:white;padding:8px 12px;cursor:pointer}
    button:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid #118b79;outline-offset:3px}
    .copy-section{border-top:1px solid #dce7e4;margin-top:19px;padding-top:17px}
    .feedback{color:#28675c;min-height:1.45rem;overflow-wrap:anywhere}.demo{color:#824c10}
    [hidden]{display:none!important}
  `;

  function encode(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  }

  function decode(value) {
    if (!/^[a-z0-9_-]{1,3072}$/i.test(value)) throw new Error("账单或凭证格式有误。");
    try {
      const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
      return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(Uint8Array.from(atob(base64), char => char.charCodeAt(0))));
    } catch {
      throw new Error("账单或凭证格式有误。");
    }
  }

  function scope(value) {
    const solana = value?.family === "solana";
    return value && typeof value.id === "string" && value.id.length > 0 && value.id.length <= 40 &&
      (solana ? value.chainId === "solana-mainnet" : Number.isSafeInteger(value.chainId) && value.chainId > 0) &&
      typeof value.demo === "boolean" &&
      (value.contract === "native" || (!solana && typeof value.contract === "string" && address.test(value.contract)));
  }

  function validSolanaValue(text, bytes) {
    if (typeof text !== "string" || !text || text.length > Math.ceil(bytes * 1.366)) return false;
    const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let number = 0n;
    for (const char of text) {
      const digit = alphabet.indexOf(char);
      if (digit < 0) return false;
      number = number * 58n + BigInt(digit);
    }
    return /^1*/.exec(text)[0].length + (number ? Math.ceil(number.toString(16).length / 2) : 0) === bytes;
  }

  function readable(value) {
    const acceptedAddress = value?.family === "solana" ? validSolanaValue(value.address, 32)
      : typeof value?.address === "string" && address.test(value.address) && !/^0x0{40}$/i.test(value.address);
    if (!scope(value) || typeof value.network !== "string" || !value.network || value.network.length > 40 ||
      typeof value.symbol !== "string" || !/^[a-z0-9._+\-]{1,14}$/i.test(value.symbol) ||
      typeof value.amount !== "string" || !/^\d{1,78}(?:\.\d{1,255})?$/.test(value.amount) || !/[1-9]/.test(value.amount) ||
      !acceptedAddress ||
      typeof value.created !== "string" || !Number.isFinite(Date.parse(value.created))) {
      throw new Error("付款账单信息不完整或格式有误。");
    }
    return value;
  }

  async function copyText(text) {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // Try copying from a selected field in browsers that restrict Clipboard API access.
      }
    }
    const field = document.createElement("textarea");
    const focus = document.activeElement;
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    (document.querySelector("dialog[open]") ?? document.body).append(field);
    field.select();
    try {
      return !!document.execCommand?.("copy");
    } catch {
      return false;
    } finally {
      field.remove();
      focus?.focus();
    }
  }

  function payer(root, request, encodeData, copy, validSolana) {
    root.innerHTML = `<h1>付款账单</h1><p id="pay-ref" class="meta"></p>
      <p id="demo-message" class="demo" hidden>这是演示账单，请勿转账。</p>
      <strong id="pay-amount" class="amount"></strong>
      <div class="fields">
        <p id="pay-network"></p>
        <label for="pay-token" id="pay-token-label">代币合约</label><input id="pay-token" readonly>
        <label for="pay-wallet">收款地址</label><input id="pay-wallet" readonly>
        <button id="copy-wallet" type="button">复制收款地址</button>
        <p class="meta">付款前，请核对收款方给你的最新金额和地址。</p>
      </div>
      <form class="fields copy-section">
        <h2>生成付款凭证</h2>
        <label for="paid-hash" id="paid-hash-label">付款交易哈希</label>
        <input id="paid-hash" maxlength="88" placeholder="0x…" spellcheck="false" required>
        <button type="submit">生成凭证</button>
        <div class="fields" id="proof-output" hidden>
          <label for="proof-text">付款凭证</label><textarea id="proof-text" rows="3" readonly></textarea>
          <button type="button" id="copy-proof">复制凭证</button>
          <p class="meta">将凭证发送给收款方，由对方核验和确认入账。</p>
        </div>
      </form>
      <p class="feedback" id="pay-status" role="status"></p>`;
    const find = selector => root.querySelector(selector);
    const feedback = find("#pay-status");
    find("#pay-ref").textContent = "账单 " + request.id + " · " + new Date(request.created).toLocaleString("zh-CN");
    find("#demo-message").hidden = !request.demo;
    find("#pay-amount").textContent = request.amount + " " + request.symbol;
    const solana = request.family === "solana";
    find("#pay-network").textContent = solana ? request.network + " 主网" : request.network + "（链 ID " + request.chainId + "）";
    find("#pay-token-label").textContent = request.contract === "native" ? "资产类型" : "代币合约";
    find("#pay-token").value = request.contract === "native" ? "原生 " + request.symbol : request.contract;
    find("#pay-wallet").value = request.address;
    if (solana) {
      find("#paid-hash-label").textContent = "付款交易签名";
      find("#paid-hash").placeholder = "Solana 交易签名";
    }
    find("#copy-wallet").addEventListener("click", async () => {
      feedback.textContent = await copy(request.address) ? "已复制收款地址。" : "请在收款地址栏手动复制。";
    });
    find("#paid-hash").addEventListener("input", () => {
      find("#proof-output").hidden = true;
      feedback.textContent = "";
    });
    find("form").addEventListener("submit", event => {
      event.preventDefault();
      const provided = find("#paid-hash").value.trim();
      const value = solana ? provided : provided.toLowerCase();
      if (solana ? !validSolana(value, 64) : !/^0x[0-9a-f]{64}$/.test(value)) {
        feedback.textContent = solana ? "请输入完整的 Solana 交易签名。" : "请输入完整的付款交易哈希。";
        return;
      }
      find("#proof-text").value = "LEDGER-RECEIPT-1." + encodeData({
        id: request.id, chainId: request.chainId, contract: request.contract, demo: request.demo, hash: value,
        ...(solana ? {family: "solana"} : {})
      });
      find("#proof-output").hidden = false;
      feedback.textContent = "凭证已生成。";
    });
    find("#copy-proof").addEventListener("click", async () => {
      feedback.textContent = await copy(find("#proof-text").value) ? "已复制付款凭证。" : "请在凭证栏手动复制。";
    });
  }

  function fromBill(item, ledger) {
    const network = ledger.networkForWorkspace(item.mode);
    const asset = ledger.assetForWorkspace(item.mode);
    return readable({id: item.id, chainId: network.id, network: network.name, demo: item.mode === "demo",
      ...(network.family ? {family: network.family} : {}),
      symbol: asset.symbol, contract: asset.contract, address: item.address,
      amount: ledger.decimal(ledger.billTotals(item).remaining, asset.decimals), created: new Date().toISOString()});
  }

  function readReceipt(value) {
    const input = value.trim();
    if (!input.startsWith(receiptPrefix)) return null;
    const receipt = decode(input.slice(receiptPrefix.length));
    const solana = receipt?.family === "solana";
    const validHash = solana ? validSolanaValue(receipt.hash, 64) : typeof receipt?.hash === "string" && hash.test(receipt.hash);
    if (!scope(receipt) || !validHash) {
      throw new Error("付款凭证缺少账单信息或交易标识。");
    }
    return {...receipt, hash: solana ? receipt.hash : receipt.hash.toLowerCase(), contract: receipt.contract.toLowerCase()};
  }

  function hostedLink(request, location) {
    if (location.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) return "";
    const url = new URL("pay.html", location.href);
    url.hash = encode(request);
    return url.href;
  }

  function standalone(request) {
    const payload = encode(request);
    return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>付款账单</title><style>' + style + '</style><main id="payer"></main><script>' +
      'const request = (' + decode.toString() + ')("' + payload + '");' +
      '(' + payer.toString() + ')(document.getElementById("payer"), request, ' + encode.toString() + ', ' +
      copyText.toString() + ', ' + validSolanaValue.toString() + ');<\/script></html>';
  }

  function openHosted(root, fragment) {
    const styles = document.createElement("style");
    styles.textContent = style;
    document.head.append(styles);
    try { payer(root, readable(decode(fragment.slice(1))), encode, copyText, validSolanaValue); }
    catch (error) { root.textContent = error.message; }
  }

  return {copyText, fromBill, hostedLink, openHosted, readReceipt, standalone};
})();

if (typeof module !== "undefined") module.exports = Payment;
else {
  const root = document.getElementById("payer");
  if (root) Payment.openHosted(root, location.hash);
}
