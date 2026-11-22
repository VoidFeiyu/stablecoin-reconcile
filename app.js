"use strict";

const byId = id => document.getElementById(id);
const modeButtons = document.querySelectorAll("[data-mode]");
const networkSelect = byId("network-select");
const assetSelect = byId("asset-select");
const assetShortcuts = document.querySelectorAll("[data-network][data-asset]");
const filters = document.querySelectorAll("[data-filter]");
const viewButtons = document.querySelectorAll("[data-view]");
const rows = byId("rows");
const transferList = byId("transfers");
const failuresList = byId("check-failures");
const batchMatch = byId("batch-match");
const hashInput = byId("hash");
const hashStatus = byId("check-status");
const lookupForm = byId("lookup-form");
const billDialog = byId("bill-dialog");
const importDialog = byId("import-dialog");
const undoDialog = byId("undo-dialog");
const paymentDialog = byId("payment-dialog");
const exceptionDialog = byId("exception-dialog");
const backupDialog = byId("backup-dialog");
const settingsDialog = byId("settings-dialog");
const database = Ledger.openDatabase();
const workspacePreference = "usdc-reconcile-workspace";
const settingsPreference = "usdc-reconcile-network-settings";
const hongKongTime = new Intl.DateTimeFormat("zh-HK", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Hong_Kong"
});
let mode = "demo";
let lastLiveWorkspace = "live";
let filter = "all";
let items = [];
let transfers = [];
let pending = [];
let exceptions = [];
let failures = [];
let queryVersion = 0;
let view = "batch";
const inboxPageSize = 20;
let inboxLimit = inboxPageSize;
let undoItem;
let paymentRequest;
let receiptBill = "";
let exceptionItem;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function feedback(node, text, error = false) {
  node.hidden = !text;
  node.textContent = text;
  node.classList.toggle("error", error);
}

function announce(text, error = false) {
  feedback(byId("message"), text, error);
}

function transactionLink(hash) {
  const link = element("a", "链上记录");
  link.href = transactionUrl(mode, hash);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function transactionUrl(workspace, hash) {
  const explorer = Ledger.networkForWorkspace(workspace).explorer;
  return explorer ? explorer + "/tx/" + hash : "";
}

function formatAmount(units, workspace = mode) {
  return Ledger.displayAmount(units, Ledger.assetForWorkspace(workspace).decimals);
}

function moneyLabel(units, workspace = mode) {
  return formatAmount(units, workspace) + " " + Ledger.assetForWorkspace(workspace).symbol;
}

function renderBills() {
  const bills = items.map(item => ({item, total: Ledger.billTotals(item)}));
  const open = bills.filter(({total}) => total.remaining > 0n);
  const paid = bills.filter(({total}) => !total.remaining);
  const sum = field => bills.reduce((value, {total}) => value + total[field], 0n);
  byId("total").textContent = formatAmount(items.reduce((value, item) => value + BigInt(item.units), 0n));
  byId("open-total").textContent = formatAmount(sum("remaining"));
  byId("paid-total").textContent = formatAmount(sum("received"));
  byId("overpaid-total").textContent = formatAmount(sum("overpaid"));
  byId("count").textContent = items.length + " 张账单 · " + open.length + " 张待对账";

  const filtered = filter === "all" ? bills : filter === "open" ? open : paid;
  rows.replaceChildren();
  if (!filtered.length) {
    const cell = element("td", filter === "all" ? "暂无账单。可以新建账单或导入 CSV。" : "该状态暂无账单。", "empty");
    cell.colSpan = 4;
    rows.appendChild(element("tr")).append(cell);
    return;
  }
  for (const {item, total} of filtered) {
    const tr = element("tr");
    const title = element("td");
    title.append(element("strong", item.id), element("small", item.customer));
    const status = element("td");
    const states = {open: "待对账", partial: "部分收款", paid: "已结清", overpaid: "多收"};
    const badge = total.state === "paid" ? "badge paid" : total.state === "overpaid" ? "badge overpaid" : "badge";
    status.append(element("span", states[total.state], badge));
    if (total.state === "partial") status.append(element("small", "余 " + formatAmount(total.remaining)));
    if (total.overpaid) status.append(element("small", "多 " + formatAmount(total.overpaid)));
    const action = element("td");
    const actions = element("div", undefined, "row-actions");
    if (total.received > 0n) {
      const undo = element("button", "付款记录", "text-btn");
      undo.type = "button";
      undo.setAttribute("aria-label", "账单 " + item.id + " 的付款记录");
      undo.addEventListener("click", () => openPayments(item));
      actions.append(undo);
    }
    if (total.remaining > 0n) {
      const share = element("button", "付款页", "text-btn");
      share.type = "button";
      share.setAttribute("aria-label", "分享账单 " + item.id + " 的付款页");
      share.addEventListener("click", () => openPaymentPage(item));
      actions.append(share);
      const button = element("button", "核验", "text-btn");
      button.type = "button";
      button.setAttribute("aria-label", "核验账单 " + item.id);
      button.addEventListener("click", () => {
        openVerificationPage();
        const choices = Array.from(transferList.querySelectorAll("select"))
          .filter(select => Array.from(select.options).some(option => option.value === item.id));
        if (choices.length === 1) {
          choices[0].value = item.id;
          choices[0].focus();
        } else {
          selectView("batch");
          hashInput.focus();
        }
      });
      actions.append(button);
    }
    action.append(actions);
    tr.append(title, element("td", formatAmount(item.units)), status, action);
    rows.append(tr);
  }
}

function renderTransfers(visible) {
  const previous = new Map(Array.from(transferList.querySelectorAll("select"), select => [select.id, select.value]));
  transferList.replaceChildren();
  for (const transfer of visible) {
    const card = element("section", undefined, "transfer");
    card.append(element("strong", moneyLabel(transfer.units)),
      element("div", "交易 " + transfer.hash, "token-details"),
      element("div", "收款地址 " + transfer.address, "token-details"),
      element("div", hongKongTime.format(new Date(transfer.time)) + "（香港时间）", "token-details"));
    if (!transfer.demo && transactionUrl(mode, transfer.hash)) card.append(transactionLink(transfer.hash));

    const key = Ledger.paymentKey(mode, transfer);
    const used = items.find(item => Ledger.paymentsFor(item).some(payment => Ledger.paymentKey(mode, payment) === key));
    const exception = exceptions.find(item => Ledger.paymentKey(mode, item) === key);
    const candidates = items.filter(item => Ledger.canMatch(item, transfer))
      .sort((a, b) => Number(Ledger.billTotals(b).remaining > 0n) - Number(Ledger.billTotals(a).remaining > 0n));
    if (exception) {
      card.append(element("p", "异常说明：" + exception.exception, "feedback exception-note"));
      const restore = element("button", "恢复待匹配", "text-btn");
      restore.type = "button";
      restore.addEventListener("click", async () => {
        const selectedMode = mode;
        restore.disabled = true;
        try {
          await Ledger.setException(await database, selectedMode, exception, "");
          if (mode === selectedMode) announce("转账已恢复为待匹配。");
        } catch (error) {
          if (mode === selectedMode) announce(error.message, true);
        } finally {
          if (mode === selectedMode) await refresh();
          restore.disabled = false;
        }
      });
      card.append(restore);
    } else if (used || !candidates.length) {
      const note = used ? "已匹配至 " + used.id :
        "当前账本没有收款地址相同的账单。";
      card.append(element("p", note, "feedback"));
    } else {
      const form = element("form");
      const label = element("label", "关联账单");
      const select = element("select");
      select.id = "transfer-" + transfer.hash + "-" + transfer.index;
      select.required = true;
      label.htmlFor = select.id;
      const placeholder = element("option", "请选择账单");
      placeholder.value = "";
      select.append(placeholder);
      for (const item of candidates) {
        const balance = Ledger.billTotals(item).remaining;
        const option = element("option", item.id + " · " + item.customer +
          (balance ? " · 待收 " + formatAmount(balance) : " · 已结清"));
        option.value = item.id;
        select.append(option);
      }
      const chosen = previous.get(select.id) || receiptBill;
      if (candidates.some(item => item.id === chosen)) select.value = chosen;
      const submit = element("button", "确认关联", "button primary");
      const status = element("p", "", "feedback");
      status.setAttribute("role", "status");
      const preview = () => {
        const item = candidates.find(candidate => candidate.id === select.value);
        if (!item) return feedback(status, "");
        const total = Ledger.billTotals(item);
        const units = BigInt(transfer.units);
        if (units > total.remaining) feedback(status, "关联后多收 " + moneyLabel(total.overpaid + units - total.remaining) + "。");
        else if (units < total.remaining) feedback(status, "关联后还需收 " + moneyLabel(total.remaining - units) + "。");
        else feedback(status, "关联后结清账单。");
      };
      select.addEventListener("change", preview);
      preview();
      form.append(label, select, submit, status);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        const selectedMode = mode;
        const id = select.value;
        const item = candidates.find(candidate => candidate.id === id);
        if (!item) return;
        submit.disabled = true;
        try {
          await Ledger.matchBill(await database, selectedMode, id, transfer, Ledger.billTotals(item).received.toString());
          if (mode !== selectedMode) return;
          await refresh();
          announce("已将这笔转账关联到 " + id + "。");
        } catch (error) {
          if (mode === selectedMode) feedback(status, error.message, true);
        } finally {
          submit.disabled = false;
        }
      });
      if (candidates.length > 1) card.append(element("p", "有多张账单使用此地址，请核对付款归属。", "feedback"));
      else if (pending.some(other => Ledger.paymentKey(mode, other) !== Ledger.paymentKey(mode, transfer) &&
        Ledger.canSuggest(candidates[0], other) && Ledger.canSuggest(candidates[0], transfer))) {
        card.append(element("p", "同一账单对应多笔同金额转账，请核对付款方。", "feedback"));
      }
      card.append(form);
    }
    if (!used && !exception) {
      const mark = element("button", "记录异常", "text-btn");
      mark.type = "button";
      mark.addEventListener("click", () => {
        if (!openForm(exceptionDialog)) return;
        exceptionItem = {mode, transfer};
        byId("exception-details").textContent = moneyLabel(transfer.units) + " · " +
          transfer.hash.slice(0, 10) + "…" + transfer.hash.slice(-6) + " #" + transfer.index;
      });
      card.append(mark);
    }
    transferList.append(card);
  }
}

function renderBatchMatch(visible) {
  batchMatch.replaceChildren();
  if (view === "exceptions" || (view === "batch" && failures.length) || visible.length < 2) return;
  const suggestions = Ledger.suggestMatches(items, visible, mode, [...pending, ...exceptions]);
  if (!suggestions.length) return;
  const heading = element("h3", "可确认的匹配");
  const details = element("p", "以下转账各自只有一张收款地址和待收金额均一致的账单。请确认归属。", "feedback");
  const list = element("ul");
  for (const {item, transfer} of suggestions) {
    const abbreviated = transfer.hash.slice(0, 10) + "…" + transfer.hash.slice(-6);
    list.append(element("li", item.id + " · " + item.customer + " · " + moneyLabel(transfer.units) +
      " · " + abbreviated + " #" + transfer.index));
  }
  const confirm = element("button", "确认关联 " + suggestions.length + " 笔", "button primary");
  confirm.type = "button";
  confirm.addEventListener("click", async () => {
    const selectedMode = mode;
    confirm.disabled = true;
    try {
      await Ledger.matchBatch(await database, selectedMode, visible, suggestions);
      if (mode !== selectedMode) return;
      await refresh();
      announce("已关联 " + suggestions.length + " 笔转账。");
    } catch (error) {
      if (selectedMode !== mode) return;
      await refresh();
      announce(error.message, true);
    } finally {
      confirm.disabled = false;
    }
  });
  batchMatch.append(heading, details, list, confirm);
}

function renderVerificationResults() {
  const isBatch = view === "batch";
  const list = view === "exceptions" ? exceptions : pending;
  const visible = isBatch ? transfers : list.slice(0, inboxLimit);
  byId("batch-controls").hidden = !isBatch;
  byId("inbox-count").textContent = pending.length;
  byId("exceptions-count").textContent = exceptions.length;
  const intro = list.length
    ? "显示 " + visible.length + " / " + list.length + " 笔。记录保存在当前浏览器。"
    : view === "exceptions" ? "暂无异常记录。" : "暂无待匹配入账。核验成功且尚未关联的转账会保存在这里。";
  feedback(byId("inbox-info"), isBatch ? "" : intro);
  byId("inbox-more").hidden = isBatch || visible.length >= list.length;
  failuresList.replaceChildren();
  for (const {hash, reason} of failures) {
    const row = element("li");
    row.append(element("code", hash), element("span", reason));
    failuresList.append(row);
  }
  renderBatchMatch(visible);
  renderTransfers(visible);
}

async function refresh() {
  const requestedMode = mode;
  try {
    const result = await Ledger.readWorkspace(await database, requestedMode);
    if (requestedMode !== mode) return;
    items = result.bills;
    pending = result.pending;
    exceptions = result.exceptions;
    renderBills();
    renderVerificationResults();
  } catch (error) {
    announce(error.message, true);
  }
}

function selectView(selectedView) {
  if (view !== selectedView) inboxLimit = inboxPageSize;
  view = selectedView;
  for (const button of viewButtons) button.setAttribute("aria-pressed", String(button.dataset.view === view));
  renderVerificationResults();
}

for (const button of viewButtons) button.addEventListener("click", () => {
  selectView(button.dataset.view);
  if (view !== "batch") void refresh();
});

byId("inbox-more").addEventListener("click", () => {
  inboxLimit += inboxPageSize;
  renderVerificationResults();
});

function selectMode(selectedMode) {
  mode = selectedMode;
  try {
    localStorage.setItem(workspacePreference, mode);
  } catch {
    // Workspace selection still works when browser storage preferences are disabled.
  }
  const network = Ledger.networkForWorkspace(mode);
  const asset = Ledger.assetForWorkspace(mode);
  const isDemo = mode === "demo";
  const solana = network.family === "solana";
  if (!isDemo) lastLiveWorkspace = mode;
  networkSelect.value = network.key;
  populateAssets(network.key, asset.contract);
  for (const symbol of document.querySelectorAll(".asset-symbol")) symbol.textContent = asset.symbol;
  byId("rail-network").textContent = network.name;
  byId("lookup-address-label").textContent = network.name + " 收款地址";
  byId("hash-label").textContent = solana ? "交易签名" : "交易哈希";
  byId("hash-help").textContent = solana ? "粘贴付款凭证，或逐行输入最多 10 个交易签名。"
    : "粘贴付款凭证，或逐行输入最多 10 个交易哈希。";
  hashInput.placeholder = solana ? "Solana 交易签名…" : "0x…";
  byId("lookup-address").placeholder = solana ? "Solana 收款地址…" : "0x…";
  billDialog.querySelector('[name="address"]').placeholder = solana ? "Solana 收款地址…" : "0x…";
  queryVersion += 1;
  items = [];
  transfers = [];
  pending = [];
  exceptions = [];
  failures = [];
  receiptBill = "";
  inboxLimit = inboxPageSize;
  filters[0].click();
  selectView("batch");
  hashInput.value = "";
  lookupForm.reset();
  byId("lookup-address").value = isDemo ? Ledger.demoAddress : "";
  byId("lookup-range").hidden = isDemo || solana;
  const tip = lookupForm.querySelector(".lookup-tip");
  tip.hidden = isDemo;
  tip.textContent = solana ? "查看该地址最近 10 笔最终确认交易中的 SOL 入账。" :
    asset.contract === "native" ? "每次查看最多 20 个最终确认区块的原生直转。"
      : "每次最多查询 1,000 个最终确认区块。";
  setChecking(false);
  feedback(hashStatus, "");
  announce("");
  byId("examples").hidden = !isDemo;
  byId("mode-info").textContent = isDemo
    ? "演示数据 · 可试用单笔或批量样例。记录保存在当前浏览器。"
    : network.name + " · " + (asset.label ?? asset.symbol) + " · " +
      (asset.contract === "native" ? "原生币" : "合约 " + asset.contract) +
      "。仅核验最终确认的转账，账单保存在当前浏览器。";
  for (const button of modeButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === (isDemo ? "demo" : "live")));
  }
  for (const button of assetShortcuts) {
    button.setAttribute("aria-pressed", String(!isDemo && network.key === button.dataset.network && asset.contract === button.dataset.asset));
  }
  void refresh();
}

function setChecking(checking) {
  byId("check").disabled = checking;
  lookupForm.querySelector('[type="submit"]').disabled = checking;
}

for (const button of modeButtons) button.addEventListener("click", () => {
  const selected = button.dataset.mode === "demo" ? "demo" : lastLiveWorkspace;
  if (selected !== mode) selectMode(selected);
});

function fillNetworkOptions(select, current) {
  select.replaceChildren();
  for (const network of Object.values(Ledger.networkCatalog())) {
    if (select.closest("#custom-asset") && network.family === "solana") continue;
    const option = element("option", network.name);
    option.value = network.key;
    select.append(option);
  }
  if (Array.from(select.options).some(option => option.value === current)) select.value = current;
}

function populateAssets(network, current) {
  assetSelect.replaceChildren();
  for (const asset of Ledger.assetsForNetwork(network)) {
    const detail = asset.network ? " · " + asset.contract.slice(0, 8) + "…" : "";
    const option = element("option", (asset.label ?? asset.symbol) + detail);
    option.value = asset.contract;
    assetSelect.append(option);
  }
  assetSelect.value = current;
}

networkSelect.addEventListener("change", () => {
  const requested = networkSelect.value;
  if (!Ledger.assetsForNetwork(requested).length) {
    networkSelect.value = Ledger.networkForWorkspace(mode).key;
    openSettings(requested, "custom-asset");
    return;
  }
  const previous = Ledger.assetForWorkspace(mode).symbol.toUpperCase();
  const same = Ledger.assetsForNetwork(requested).find(asset => asset.symbol.toUpperCase() === previous);
  selectMode(Ledger.workspaceForNetwork(requested, same?.contract));
});

assetSelect.addEventListener("change", () => {
  selectMode(Ledger.workspaceForNetwork(networkSelect.value, assetSelect.value));
});

for (const button of assetShortcuts) {
  button.addEventListener("click", () => {
    const target = Ledger.workspaceForNetwork(button.dataset.network, button.dataset.asset);
    if (target !== mode) selectMode(target);
  });
}

for (const button of filters) button.addEventListener("click", () => {
  filter = button.dataset.filter;
  for (const option of filters) option.setAttribute("aria-pressed", String(option === button));
  renderBills();
});

hashInput.addEventListener("input", () => {
  queryVersion += 1;
  transfers = [];
  failures = [];
  receiptBill = "";
  renderVerificationResults();
  feedback(hashStatus, "");
  setChecking(false);
});

byId("example").addEventListener("click", () => {
  hashInput.value = Ledger.demoHash;
  byId("verify-form").requestSubmit();
});

byId("batch-example").addEventListener("click", () => {
  hashInput.value = Ledger.demoTransfers.map(transfer => transfer.hash).join("\n");
  byId("verify-form").requestSubmit();
});

byId("split-example").addEventListener("click", () => {
  hashInput.value = Ledger.splitDemoTransfers.map(transfer => transfer.hash).join("\n");
  byId("verify-form").requestSubmit();
});

function startVerification() {
  const version = ++queryVersion;
  transfers = [];
  failures = [];
  receiptBill = "";
  renderVerificationResults();
  setChecking(true);
  return version;
}

async function keepVerified(version, requestedMode, checked, rejected, summary, isError) {
  if (version !== queryVersion) return;
  const db = await database;
  if (version !== queryVersion) return;
  if (checked.length) await Ledger.saveReceipts(db, requestedMode, checked);
  const updated = await Ledger.readWorkspace(db, requestedMode);
  if (version !== queryVersion) return;
  items = updated.bills;
  pending = updated.pending;
  exceptions = updated.exceptions;
  transfers = checked;
  failures = rejected;
  renderBills();
  renderVerificationResults();
  feedback(hashStatus, summary, isError);
}

byId("verify-form").addEventListener("submit", async event => {
  event.preventDefault();
  const requestedMode = mode;
  const version = startVerification();
  try {
    const receipt = Payment.readReceipt(hashInput.value);
    if (receipt) {
      const network = Ledger.networkForWorkspace(requestedMode);
      const asset = Ledger.assetForWorkspace(requestedMode);
      if (receipt.chainId !== network.id || receipt.contract !== asset.contract || receipt.demo !== (requestedMode === "demo")) {
        throw new Error("凭证的网络、币种或工作模式与当前账本不同。请切换到付款账单上的设置后再核验。");
      }
    }
    const isSolana = Ledger.networkForWorkspace(requestedMode).family === "solana";
    const identifier = isSolana ? "签名" : "哈希";
    const {hashes, duplicates} = receipt ? {hashes: [receipt.hash], duplicates: 0} : Ledger.parseHashes(hashInput.value, requestedMode);
    const checked = [];
    const rejected = [];
    for (const [index, hash] of hashes.entries()) {
      if (version !== queryVersion) return;
      feedback(hashStatus, "正在核验第 " + (index + 1) + " / " + hashes.length + " 个" + identifier + "…");
      try {
        if (!Ledger.validTransactionId(requestedMode, hash)) throw new Error("交易" + identifier + "格式无效。");
        if (requestedMode === "demo") {
          const example = [...Ledger.demoTransfers, ...Ledger.splitDemoTransfers].find(transfer => transfer.hash === hash);
          if (!example) throw new Error("演示模式只核验样例交易。真实交易请切换至链上模式。");
          checked.push(example);
        } else {
          checked.push(...await Ledger.queryTransaction(requestedMode, hash));
        }
      } catch (error) {
        rejected.push({hash, reason: error.message});
      }
    }
    if (version !== queryVersion) return;
    if (receipt) receiptBill = receipt.id;
    const summary = ["核验 " + (hashes.length - rejected.length) + " / " + hashes.length + " 个" + identifier,
      checked.length + " 笔 " + Ledger.assetForWorkspace(requestedMode).symbol + " 转账"];
    if (receipt) summary.push("凭证账单 " + receipt.id);
    if (rejected.length) summary.push(rejected.length + " 个" + identifier + "未通过");
    if (duplicates) summary.push("已跳过 " + duplicates + " 个重复" + identifier);
    await keepVerified(version, requestedMode, checked, rejected, summary.join(" · "), !checked.length);
  } catch (error) {
    if (version === queryVersion) feedback(hashStatus, error.message, true);
  } finally {
    if (version === queryVersion) setChecking(false);
  }
});

lookupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const requestedMode = mode;
  const version = startVerification();
  const address = byId("lookup-address").value.trim();
  feedback(hashStatus, "正在查询所选地址的最终确认入账…");
  try {
    if (requestedMode === "demo") {
      if (address.toLowerCase() !== Ledger.demoAddress) throw new Error("演示模式请使用预填的样例地址。");
      const sample = Ledger.demoTransfers;
      await keepVerified(version, requestedMode, sample, [], "查到 " + sample.length + " 笔样例入账。", false);
    } else {
      const result = await Ledger.scanAddress(requestedMode, address, byId("lookup-start").value, byId("lookup-end").value);
      const scope = result.transactions === undefined ? "区块 " + result.start + "–" + result.end
        : "最近 " + result.transactions + " 笔交易";
      await keepVerified(version, requestedMode, result.transfers, [],
        scope + " · " + result.transfers.length + " 笔已确认的 " +
        Ledger.assetForWorkspace(requestedMode).symbol + " 入账", false);
    }
  } catch (error) {
    if (version === queryVersion) feedback(hashStatus, error.message, true);
  } finally {
    if (version === queryVersion) setChecking(false);
  }
});

for (const dialog of [billDialog, importDialog, undoDialog, paymentDialog, exceptionDialog, backupDialog]) {
  for (const button of dialog.querySelectorAll("[data-close]")) button.addEventListener("click", () => dialog.close());
}

function openForm(dialog) {
  const form = dialog.querySelector("form");
  if (form.querySelector('[type="submit"]').disabled) return false;
  form.reset();
  feedback(form.querySelector(".feedback"), "");
  dialog.showModal();
  return true;
}

function openPaymentPage(item) {
  paymentRequest = Payment.fromBill(item, Ledger);
  byId("payment-summary").textContent = item.id + " · 待收 " +
    moneyLabel(Ledger.billTotals(item).remaining, item.mode);
  const linkButton = byId("copy-payment-link");
  linkButton.hidden = !Payment.hostedLink(paymentRequest, location);
  feedback(byId("payment-status"), "");
  paymentDialog.showModal();
}

byId("download-payment").addEventListener("click", () => {
  if (!paymentRequest) return;
  const fileId = paymentRequest.id.replace(/[^\p{L}\p{N}_.-]/gu, "-");
  downloadBlob("付款账单-" + fileId + ".html", new Blob([Payment.standalone(paymentRequest)], {type: "text/html;charset=utf-8"}));
  feedback(byId("payment-status"), "付款页已下载。");
});

byId("copy-payment-link").addEventListener("click", async () => {
  if (!paymentRequest) return;
  const url = Payment.hostedLink(paymentRequest, location);
  if (!url) return;
  const copied = await Payment.copyText(url);
  feedback(byId("payment-status"), copied ? "已复制链接。打开权限取决于站点的访问设置。" : "复制未成功，可以下载付款页。");
});

function openPayments(item) {
  if (!openForm(undoDialog)) return;
  undoItem = item;
  const select = byId("undo-payment");
  const payments = Ledger.paymentsFor(item);
  select.replaceChildren();
  if (payments.length > 1) {
    const placeholder = element("option", "请选择一笔付款");
    placeholder.value = "";
    select.append(placeholder);
  }
  for (const payment of payments) {
    const text = moneyLabel(payment.units, item.mode) + " · " + payment.hash.slice(0, 10) + "… #" + payment.index;
    const option = element("option", text);
    option.value = Ledger.paymentKey(item.mode, payment);
    select.append(option);
  }
  renderSelectedPayment();
}

function renderSelectedPayment() {
  const key = byId("undo-payment").value;
  const payment = undoItem && Ledger.paymentsFor(undoItem).find(entry => Ledger.paymentKey(undoItem.mode, entry) === key);
  const explorer = byId("undo-explorer");
  explorer.replaceChildren();
  byId("undo-details").textContent = payment
    ? undoItem.id + " · 撤销这笔 " + moneyLabel(payment.units, undoItem.mode) + "，转账将回到待匹配入账。"
    : "本账单共收到 " + moneyLabel(Ledger.billTotals(undoItem).received, undoItem.mode) + "。";
  if (payment && !payment.demo && transactionUrl(undoItem.mode, payment.hash)) explorer.append(transactionLink(payment.hash));
}

byId("undo-payment").addEventListener("change", renderSelectedPayment);

byId("undo-form").addEventListener("submit", async event => {
  event.preventDefault();
  const item = undoItem;
  const key = byId("undo-payment").value;
  if (!item || !key) return;
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await Ledger.unmatchBill(await database, item.mode, item.id, key);
    undoDialog.close();
    if (mode !== item.mode) return;
    inboxLimit = inboxPageSize;
    openVerificationPage();
    selectView("inbox");
    await refresh();
    announce("已撤销 " + item.id + " 的一笔付款，转账已回到待匹配入账。");
  } catch (error) {
    feedback(form.querySelector(".feedback"), error.message, true);
    await refresh();
  } finally {
    submit.disabled = false;
  }
});

byId("exception-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  const notice = form.querySelector(".feedback");
  const entry = exceptionItem;
  if (!entry) return;
  const reason = new FormData(form).get("reason").trim();
  if (!reason || reason.length > 160) {
    feedback(notice, "请输入 1 至 160 个字符的处理说明。", true);
    return;
  }
  submit.disabled = true;
  try {
    await Ledger.setException(await database, entry.mode, entry.transfer, reason);
    exceptionDialog.close();
    if (mode !== entry.mode) return;
    selectView("exceptions");
    await refresh();
    announce("已保存异常说明。");
  } catch (error) {
    feedback(notice, error.message, true);
    await refresh();
  } finally {
    submit.disabled = false;
  }
});

byId("new").addEventListener("click", () => {
  openForm(billDialog);
  if (mode === "demo") billDialog.querySelector('[name="address"]').value = Ledger.demoAddress;
});

byId("import").addEventListener("click", () => openForm(importDialog));

function connectSaveDialog(dialog, makeBills) {
  const form = dialog.querySelector("form");
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const currentMode = mode;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      const bills = await makeBills(new FormData(form), currentMode);
      await Ledger.saveBills(await database, bills);
      if (currentMode !== mode) return;
      dialog.close();
      filters[0].click();
      await refresh();
      announce("已保存 " + bills.length + " 张账单。");
    } catch (error) {
      feedback(form.querySelector(".feedback"), error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
}

connectSaveDialog(billDialog, (data, selectedMode) => [
  Ledger.bill(selectedMode, ["id", "customer", "amount", "address"].map(key => data.get(key)))
]);

connectSaveDialog(importDialog, async (data, selectedMode) => {
  const file = data.get("file");
  if (!file || !file.size || file.size > 1024 * 1024) throw new Error("请选择 1 MB 以内的非空 CSV 文件。");
  return Ledger.importCsv(await file.text(), selectedMode);
});

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function download(filename, data) {
  downloadBlob(filename, new Blob([Ledger.makeCsv(data)], {type: "text/csv;charset=utf-8"}));
}

async function renderActivity() {
  const selectedMode = mode;
  const log = byId("activity-log");
  const label = selectedMode === "demo" ? "演示" : Ledger.networkForWorkspace(selectedMode).name +
    " " + Ledger.assetForWorkspace(selectedMode).symbol;
  byId("activity-title").textContent = label + " · 最近 50 条操作";
  log.replaceChildren(element("li", "正在读取操作记录…"));
  try {
    const entries = await Ledger.readActivity(await database, selectedMode);
    if (mode !== selectedMode) return;
    log.replaceChildren();
    for (const entry of entries) {
      const item = element("li");
      const time = element("time", hongKongTime.format(new Date(entry.at)));
      time.dateTime = entry.at;
      item.append(time, element("span", entry.description));
      log.append(item);
    }
    if (!entries.length) log.append(element("li", "暂无操作记录。"));
  } catch (error) {
    if (mode === selectedMode) log.replaceChildren(element("li", error.message));
  }
}

byId("workspace-settings").addEventListener("click", () => {
  if (!openForm(backupDialog)) return;
  const name = Ledger.networkForWorkspace(mode).name;
  const symbol = Ledger.assetForWorkspace(mode).symbol;
  byId("download-backup").textContent = "导出 " + name + " " + symbol + " 备份";
  byId("backup-help").textContent = "恢复 " + name + " " + symbol + " 工作区的可信备份时，会合并缺少的记录。已有记录有冲突时会停止写入。";
  void renderActivity();
});

byId("download-backup").addEventListener("click", async event => {
  const button = event.currentTarget;
  const notice = byId("backup-form").querySelector(".feedback");
  const workspace = mode === "demo" ? "live" : mode;
  button.disabled = true;
  try {
    const data = await Backup.exportWorkspace(await database, workspace);
    downloadBlob(Ledger.networkForWorkspace(workspace).name + "-" + Ledger.assetForWorkspace(workspace).symbol +
      "-备份-" + data.exportedAt.slice(0, 10) + ".json",
      new Blob([JSON.stringify(data, null, 2) + "\n"], {type: "application/json"}));
    feedback(notice, "已导出当前币种的备份。");
  } catch (error) {
    feedback(notice, error.message, true);
  } finally {
    button.disabled = false;
  }
});

byId("backup-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const notice = form.querySelector(".feedback");
  const submit = form.querySelector('[type="submit"]');
  const workspace = mode === "demo" ? "live" : mode;
  const file = new FormData(form).get("backup");
  if (!file?.size) {
    feedback(notice, "请选择非空备份文件。", true);
    return;
  }
  submit.disabled = true;
  try {
    const count = await Backup.restoreWorkspace(await database, await file.text(), workspace);
    feedback(notice, count ? "已恢复 " + count + " 条记录。" : "备份中的记录已全部存在。");
    await refresh();
    await renderActivity();
  } catch (error) {
    feedback(notice, error.message, true);
  } finally {
    submit.disabled = false;
  }
});

byId("template").addEventListener("click", () => {
  download("账单导入模板.csv", [Ledger.headers, ["INV-1045", "示例客户", "500", mode === "demo" ? Ledger.demoAddress : "请替换为自己的收款地址"]]);
});

byId("export").addEventListener("click", async () => {
  const currentMode = mode;
  try {
    const records = await Ledger.readBills(await database, currentMode);
    if (currentMode !== mode) return;
    if (!records.length) {
      announce("暂无可导出的账单。");
      return;
    }
    const network = Ledger.networkForWorkspace(currentMode);
    const asset = Ledger.assetForWorkspace(currentMode);
    const decimal = units => Ledger.decimal(units, asset.decimals);
    const exported = records.map(item => {
      const total = Ledger.billTotals(item);
      const payments = Ledger.paymentsFor(item);
      const values = key => payments.map(payment => payment[key]).join("\n");
      const statuses = {open: "待对账", partial: "部分收款", paid: "已结清", overpaid: "多收"};
      return [item.id, item.customer, decimal(item.units), item.address,
        currentMode === "demo" ? "演示" : "链上", statuses[total.state], decimal(total.received),
        values("time"), values("hash"), values("index"),
        payments.map(payment => payment.demo ? "" : transactionUrl(currentMode, payment.hash)).join("\n"),
        network.name, asset.symbol, asset.contract === "native" ? "原生币" : asset.contract,
        decimal(total.remaining), decimal(total.overpaid),
        payments.length, payments.map(payment => decimal(payment.units)).join("\n")];
    });
    download(currentMode === "demo" ? "演示对账.csv" : network.name + "-" + asset.symbol + "-对账.csv", [
      [...Ledger.headers, "模式", "状态", "实收金额", "到账时间（UTC）", network.family === "solana" ? "交易签名" : "交易哈希",
        network.family === "solana" ? "指令索引" : asset.contract === "native" ? "转账索引" : "日志索引",
        "交易链接", "网络", "币种", "代币合约",
        "剩余应收", "多收金额", "付款笔数", "每笔实收金额"],
      ...exported
    ]);
    announce("已导出 " + records.length + " 张账单。");
  } catch (error) {
    announce(error.message, true);
  }
});
function renderPage() {
  const verify = location.hash === "#verify";
  const title = verify ? "交易核验" : "账单对账";
  byId("page-title").textContent = title;
  byId("page-crumb").textContent = title;
  byId("page-description").textContent = verify ? "核验链上交易，处理待匹配入账和异常。"
    : "管理账单、查看已收和待收金额，导出对账记录。";
  byId("invoice-stats").hidden = verify;
  byId("invoice-panel").hidden = verify;
  byId("import").hidden = verify;
  byId("new").hidden = verify;
  byId("verification-panel").hidden = !verify;
  for (const link of document.querySelectorAll("nav a")) {
    const current = link.hash === (verify ? "#verify" : "#invoices");
    if (current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

function openVerificationPage() {
  if (location.hash !== "#verify") location.hash = "#verify";
  renderPage();
}

window.addEventListener("hashchange", renderPage);
renderPage();

function initialWorkspace() {
  try {
    const saved = localStorage.getItem(workspacePreference);
    if (saved) {
      Ledger.assetForWorkspace(saved);
      return saved;
    }
  } catch {
    // A fresh session can safely start in the demo workspace.
  }
  return "demo";
}

function loadSettings() {
  const saved = localStorage.getItem(settingsPreference);
  if (saved) Ledger.configure(JSON.parse(saved));
}

function commitSettings(update) {
  const change = () => {
    loadSettings();
    const previous = Ledger.getConfiguration();
    Ledger.configure(update(Ledger.getConfiguration()));
    try {
      localStorage.setItem(settingsPreference, JSON.stringify(Ledger.getConfiguration()));
    } catch {
      Ledger.configure(previous);
      throw new Error("浏览器未能保存自定义配置。");
    }
  };
  return navigator.locks ? navigator.locks.request(settingsPreference, change) : Promise.resolve().then(change);
}

function listNodes() {
  const network = byId("custom-node").elements.namedItem("network").value;
  const configured = Ledger.getConfiguration().nodes.filter(node => node.network === network);
  const list = byId("rpc-nodes");
  const statuses = byId("custom-node").querySelector(".feedback");
  list.replaceChildren();
  for (const endpoint of Ledger.endpointsForNetwork(network)) {
    const row = element("li");
    const custom = configured.find(node => node.url === endpoint);
    row.append(document.createTextNode(new URL(endpoint).hostname + (custom ? " · 自定义 " : "")));
    if (custom) {
      const remove = element("button", "移除", "text-btn");
      remove.type = "button";
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        try {
          await commitSettings(settings => {
            settings.nodes = settings.nodes.filter(node => node.url !== custom.url || node.network !== custom.network);
            return settings;
          });
          listNodes();
          feedback(statuses, "已移除此节点。");
        } catch (error) {
          feedback(statuses, error.message, true);
          remove.disabled = false;
        }
      });
      row.append(remove);
    }
    list.append(row);
  }
}

function openSettings(network = Ledger.networkForWorkspace(mode).key, section = "custom-node") {
  for (const select of settingsDialog.querySelectorAll(".settings-network")) fillNetworkOptions(select, network);
  byId(section).closest("details").open = true;
  listNodes();
  settingsDialog.showModal();
}

byId("network-settings").addEventListener("click", () => openSettings());
settingsDialog.querySelector("[data-close]").addEventListener("click", () => settingsDialog.close());
byId("custom-node").elements.namedItem("network").addEventListener("change", listNodes);

function connectSettingsForm(id, kind, inspect, saved) {
  const form = byId(id);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const notice = form.querySelector(".feedback");
    submit.disabled = true;
    feedback(notice, "正在验证…");
    try {
      const fields = Object.fromEntries(new FormData(form));
      const item = await inspect(fields);
      await commitSettings(settings => {
        settings[kind].push(item);
        return settings;
      });
      form.reset();
      const network = item.network ?? item.key;
      fillNetworkOptions(networkSelect, Ledger.networkForWorkspace(mode).key);
      for (const select of settingsDialog.querySelectorAll(".settings-network")) fillNetworkOptions(select, network);
      saved(item);
      listNodes();
      feedback(notice, "已验证并保存。");
    } catch (error) {
      feedback(notice, error.message, true);
    } finally {
      submit.disabled = false;
    }
  });
}

connectSettingsForm("custom-network", "networks", fields => Ledger.inspectNetwork(fields), () => {
  byId("custom-asset").closest("details").open = true;
  feedback(byId("custom-asset").querySelector(".feedback"), "添加一个 ERC-20 代币即可开始对账。");
});
connectSettingsForm("custom-node", "nodes", fields => Ledger.inspectNode(fields.network, fields.url), () => {});
connectSettingsForm("custom-asset", "assets",
  fields => Ledger.inspectAsset(fields.network, fields.symbol, fields.address),
  asset => selectMode(Ledger.workspaceForNetwork(asset.network, asset.contract)));

try {
  loadSettings();
} catch {
  queueMicrotask(() => announce("无法读取此前保存的自定义配置。", true));
}
fillNetworkOptions(networkSelect, "base");
selectMode(initialWorkspace());

window.addEventListener("storage", event => {
  if (event.key !== settingsPreference || !event.newValue) return;
  try {
    Ledger.configure(JSON.parse(event.newValue));
    const network = Ledger.networkForWorkspace(mode);
    const asset = Ledger.assetForWorkspace(mode);
    fillNetworkOptions(networkSelect, network.key);
    populateAssets(network.key, asset.contract);
  } catch {
    announce("无法同步其他窗口的网络配置。", true);
  }
});
