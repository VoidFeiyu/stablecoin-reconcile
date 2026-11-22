"use strict";

const Ledger = (() => {
  const localization = typeof module !== "undefined" ? require("./i18n") : I18n;
  const t = localization.t;
  const addressPattern = /^0x[0-9a-f]{40}$/i;
  const hashPattern = /^0x[0-9a-f]{64}$/i;
  const networks = Object.freeze({
    base: Object.freeze({
      key: "base", id: 8453, name: "Base", usdc: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      receiptRpc: "https://mainnet.base.org", scanRpc: "https://base.drpc.org",
      fallbackRpc: "https://base-rpc.publicnode.com", explorer: "https://basescan.org"
    }),
    ethereum: Object.freeze({
      key: "ethereum", id: 1, name: "Ethereum", usdc: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      scanRpc: "https://eth.drpc.org", fallbackRpc: "https://ethereum-rpc.publicnode.com", explorer: "https://etherscan.io"
    }),
    arbitrum: Object.freeze({
      key: "arbitrum", id: 42161, name: "Arbitrum One", usdc: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      scanRpc: "https://arbitrum.drpc.org", fallbackRpc: "https://arb1.arbitrum.io/rpc", explorer: "https://arbiscan.io"
    }),
    optimism: Object.freeze({
      key: "optimism", id: 10, name: "OP Mainnet", usdc: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      scanRpc: "https://optimism.drpc.org", fallbackRpc: "https://optimism-rpc.publicnode.com", explorer: "https://optimistic.etherscan.io"
    }),
    polygon: Object.freeze({
      key: "polygon", id: 137, name: "Polygon PoS", usdc: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
      scanRpc: "https://polygon.drpc.org", fallbackRpc: "https://polygon-bor-rpc.publicnode.com", explorer: "https://polygonscan.com"
    }),
    avalanche: Object.freeze({
      key: "avalanche", id: 43114, name: "Avalanche C-Chain", usdc: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e",
      receiptRpc: "https://api.avax.network/ext/bc/C/rpc", scanRpc: "https://avalanche.drpc.org",
      explorer: "https://snowtrace.io"
    }),
    bsc: Object.freeze({
      key: "bsc", id: 56, name: "BNB Smart Chain", native: {symbol: "BNB", contract: "native", decimals: 18},
      receiptRpc: "https://bsc-dataseed.bnbchain.org", scanRpc: "https://bsc-rpc.publicnode.com",
      fallbackRpc: "https://bsc.drpc.org", explorer: "https://bscscan.com"
    }),
    solana: Object.freeze({
      key: "solana", id: "solana-mainnet", family: "solana", name: "Solana",
      native: {symbol: "SOL", contract: "native", decimals: 9},
      scanRpc: "https://solana-rpc.publicnode.com", fallbackRpc: "https://api.mainnet-beta.solana.com", explorer: "https://solscan.io"
    })
  });
  const standardAssets = {
    base: [{symbol: "EURC", contract: "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42", decimals: 6}],
    ethereum: [
      {symbol: "USDT", contract: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6},
      {symbol: "DAI", contract: "0x6b175474e89094c44da98b954eedeac495271d0f", decimals: 18},
      {symbol: "EURC", contract: "0x1abaea1f7c830bd89acc67ec4af516284b1bc33c", decimals: 6}
    ],
    avalanche: [
      {symbol: "USDT", contract: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", decimals: 6},
      {symbol: "EURC", contract: "0xc891eb4cbdeff6e073e859e987815ed1505c2acd", decimals: 6}
    ],
    bsc: [
      {symbol: "USDT", label: "USDT（Binance-Peg）", contract: "0x55d398326f99059ff775485246999027b3197955", decimals: 18}
    ]
  };
  let configuration = {networks: [], nodes: [], assets: []};
  const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const demoAddress = "0x81d1111111111111111111111111111111110ca9";
  const demoHash = "0x" + "a1".repeat(32);
  const demoPaidHash = "0x" + "c3".repeat(32);
  const demoTransfer = {hash: demoHash, index: 0, address: demoAddress, units: "500000000", time: "2026-11-22T02:15:00.000Z", demo: true};
  const demoTransfers = [
    demoTransfer,
    {...demoTransfer, hash: "0x" + "d4".repeat(32), units: "800000000"},
    {...demoTransfer, hash: "0x" + "e5".repeat(32), units: "950000000"},
    {...demoTransfer, hash: "0x" + "f6".repeat(32), units: "450000000"}
  ];
  const splitDemoTransfers = [
    {...demoTransfer, hash: "0x" + "a2".repeat(32), units: "300000000"},
    {...demoTransfer, hash: "0x" + "b2".repeat(32), units: "200000000"}
  ];

  function networkCatalog() {
    return {...networks, ...Object.fromEntries(configuration.networks.map(network => [network.key, network]))};
  }

  function getNetwork(key) {
    const catalog = networkCatalog();
    if (!Object.hasOwn(catalog, key)) throw new Error(t("请选择受支持的网络。"));
    return catalog[key];
  }

  function assetsForNetwork(key) {
    const network = getNetwork(key);
    return [
      ...(network.native ? [network.native] : []),
      ...(network.usdc ? [{symbol: "USDC", contract: network.usdc, decimals: 6}] : []),
      ...(standardAssets[key] ?? []),
      ...configuration.assets.filter(asset => asset.network === key)
    ];
  }

  // Keep the original USDC workspace keys so existing data and backups remain readable.
  function networkForWorkspace(workspace) {
    if (workspace === "demo" || workspace === "live") return networks.base;
    const parsed = /^live:([^:]+)(?::(native|0x[0-9a-f]{40}))?$/.exec(workspace);
    if (!parsed) throw new Error(t("未知的主网工作区。"));
    return getNetwork(parsed[1]);
  }

  function workspaceForNetwork(key, contract) {
    const network = getNetwork(key);
    const assets = assetsForNetwork(key);
    const asset = contract ? assets.find(candidate => candidate.contract === contract) : assets[0];
    if (!asset) throw new Error(t("请先添加此网络的币种。"));
    if (asset.contract === network.usdc) return key === "base" ? "live" : "live:" + key;
    return "live:" + key + ":" + asset.contract;
  }

  function assetForWorkspace(workspace) {
    const network = networkForWorkspace(workspace);
    const contract = workspace.split(":")[2] ?? network.usdc;
    const asset = assetsForNetwork(network.key).find(candidate => candidate.contract === contract);
    if (!asset) throw new Error(t("此工作区的代币尚未配置。"));
    return asset;
  }

  function nodeUrl(value, explorer = false) {
    let url;
    try { url = new URL(value.trim()); }
    catch { throw new Error(t("请输入有效的 HTTPS 地址。")); }
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.hash || (explorer && url.search) ||
      (url.protocol !== "https:" && (explorer || url.protocol !== "http:" || !loopback))) {
      throw new Error(t("请输入 HTTPS 地址、本机 RPC 地址或不含认证信息的浏览器地址。"));
    }
    return explorer ? url.href.replace(/\/$/, "") : url.href;
  }

  function customNetwork(name, id, rpc, explorer) {
    const title = name.trim();
    if (!title || title.length > 40 || !Number.isSafeInteger(id) || id < 1) throw new Error(t("请输入网络名称和有效的链 ID。"));
    return {key: "evm-" + id, name: title, id, scanRpc: nodeUrl(rpc), explorer: explorer.trim() ? nodeUrl(explorer, true) : ""};
  }

  function customAsset(network, symbol, contract, decimals) {
    const ticker = symbol.trim();
    if (!/^[a-z0-9._+\-]{1,14}$/i.test(ticker)) throw new Error(t("币种简称须为 1 至 14 个字母、数字或 . _ + -。"));
    if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error(t("合约返回了无效的代币精度。"));
    return {network, symbol: ticker, contract: normalizeAddress(contract), decimals};
  }

  function configure(data) {
    const networksIn = data.networks.map(network => customNetwork(network.name, network.id, network.scanRpc, network.explorer));
    const chainIds = new Set(Object.values(networks).map(network => network.id));
    const keys = new Set(Object.keys(networks));
    for (const network of networksIn) {
      if (chainIds.has(network.id)) throw new Error(t("链 ID 已存在。要添加 RPC 请使用节点表单。"));
      chainIds.add(network.id);
      keys.add(network.key);
    }
    const checkNetwork = key => {
      if (!keys.has(key)) throw new Error(t("请先添加所属网络。"));
      return key;
    };
    const nodes = data.nodes.map(node => ({network: checkNetwork(node.network), url: nodeUrl(node.url)}));
    const assets = data.assets.map(asset => customAsset(checkNetwork(asset.network), asset.symbol, asset.contract, asset.decimals));
    if (new Set(nodes.map(node => node.network + ":" + node.url)).size !== nodes.length ||
      new Set(assets.map(asset => asset.network + ":" + asset.contract)).size !== assets.length) {
      throw new Error(t("已有相同的节点或代币合约。"));
    }
    configuration = {networks: networksIn, nodes, assets};
  }

  function getConfiguration() {
    return structuredClone(configuration);
  }

  const base58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

  function validBase58(value, bytes) {
    if (typeof value !== "string" || !value || value.length > Math.ceil(bytes * 1.366)) return false;
    let number = 0n;
    for (const char of value) {
      const digit = base58.indexOf(char);
      if (digit === -1) return false;
      number = number * 58n + BigInt(digit);
    }
    const prefix = /^1*/.exec(value)[0].length;
    const size = number ? Math.ceil(number.toString(16).length / 2) : 0;
    return prefix + size === bytes;
  }

  function validTransactionId(workspace, value) {
    return networkForWorkspace(workspace).family === "solana" ? validBase58(value, 64) : hashPattern.test(value);
  }

  function normalizedTransactionId(workspace, value) {
    return networkForWorkspace(workspace).family === "solana" ? value : value.toLowerCase();
  }

  function parseHashes(value, workspace = "live") {
    const entries = value.split(/[\s,，;；]+/u).filter(Boolean).map(hash => normalizedTransactionId(workspace, hash));
    const hashes = [...new Set(entries)];
    if (!hashes.length) throw new Error(t("请输入至少一个交易哈希。"));
    if (hashes.length > 10) throw new Error(t("每次最多核验 10 个不同的交易哈希。"));
    return {hashes, duplicates: entries.length - hashes.length};
  }

  function parseAmount(value, decimals) {
    if (!/^\d{1,78}(?:\.\d{1,255})?$/.test(value)) throw new Error(t("请输入正数金额。"));
    const [whole, cents = ""] = value.split(".");
    if (cents.length > decimals) throw new Error(t("该币种最多支持 {0} 位小数。", decimals));
    const units = BigInt(whole + cents.padEnd(decimals, "0"));
    if (units === 0n || units >= 2n ** 256n) throw new Error(t("金额须大于零，且在合约支持的范围内。"));
    return units.toString();
  }

  function decimal(units, decimals = 6) {
    const value = BigInt(units).toString();
    if (!decimals) return value;
    const digits = value.padStart(decimals + 1, "0");
    return (digits.slice(0, -decimals) + "." + digits.slice(-decimals)).replace(/\.?0+$/, "");
  }

  function displayAmount(units, decimals = 6) {
    const [whole, fraction = ""] = decimal(units, decimals).split(".");
    return BigInt(whole).toLocaleString("en-US") + "." + fraction.padEnd(2, "0");
  }

  function bill(mode, [rawId, rawCustomer, rawAmount, rawAddress]) {
    const [id, customer, amount] = [rawId, rawCustomer, rawAmount].map(value => value.trim());
    if (!id || id.length > 40 || !customer || customer.length > 80) {
      throw new Error(t("请输入账单号和客户，长度上限分别为 40 和 80 个字符。"));
    }
    return {mode, id, customer, address: normalizeAddress(rawAddress, mode),
      units: parseAmount(amount, assetForWorkspace(mode).decimals), created: new Date().toISOString()};
  }

  function normalizeAddress(value, workspace = "live") {
    const address = value.trim();
    if (networkForWorkspace(workspace).family === "solana") {
      if (!validBase58(address, 32) || address === "11111111111111111111111111111111") throw new Error(t("请输入有效的 Solana 收款地址。"));
      return address;
    }
    if (!addressPattern.test(address) || /^0x0{40}$/i.test(address)) throw new Error(t("请输入有效的收款地址。"));
    return address.toLowerCase();
  }

  function canMatch(item, transfer) {
    return inWorkspace(item.mode, transfer) && item.address === transfer.address && BigInt(transfer.units) > 0n;
  }

  function paymentsFor(item) {
    return item.payments ?? (item.payment ? [item.payment] : []);
  }

  function billTotals(item) {
    const expected = BigInt(item.units);
    const received = paymentsFor(item).reduce((sum, payment) => sum + BigInt(payment.units), 0n);
    const difference = expected - received;
    return {
      received, remaining: difference > 0n ? difference : 0n, overpaid: difference < 0n ? -difference : 0n,
      state: difference < 0n ? "overpaid" : difference === 0n ? "paid" : received > 0n ? "partial" : "open"
    };
  }

  function canSuggest(item, transfer) {
    return canMatch(item, transfer) && billTotals(item).remaining === BigInt(transfer.units);
  }

  function inWorkspace(mode, transfer) {
    const network = networkForWorkspace(mode);
    return (mode === "demo") === transfer.demo && network.key === (transfer.network ?? "base") &&
      assetForWorkspace(mode).contract === (transfer.asset ?? network.usdc);
  }

  function paymentKey(mode, transfer) {
    return [mode, networkForWorkspace(mode).id, transfer.hash, transfer.index].join(":");
  }

  function assignmentFor(item, transfer) {
    return {key: paymentKey(item.mode, transfer), invoice: item.id, mode: item.mode};
  }

  function suggestMatches(bills, transfers, mode, knownTransfers = transfers) {
    const used = new Set(bills.flatMap(item => paymentsFor(item).map(transfer => paymentKey(mode, transfer))));
    const excluded = new Set(knownTransfers.filter(transfer => transfer.exception).map(transfer => paymentKey(mode, transfer)));
    const eligible = transfer => !used.has(paymentKey(mode, transfer)) && !excluded.has(paymentKey(mode, transfer));
    const unmatched = [...transfers, ...knownTransfers].filter(eligible);
    return transfers.flatMap(transfer => {
      const key = paymentKey(mode, transfer);
      if (!eligible(transfer)) return [];
      const candidates = bills.filter(item => canSuggest(item, transfer));
      if (candidates.length !== 1) return [];
      const [item] = candidates;
      const competing = unmatched.some(other => paymentKey(mode, other) !== key && canSuggest(item, other));
      return competing ? [] : [{item, transfer}];
    });
  }

  function linkPayment(item, transfer) {
    return {...item, payments: [...paymentsFor(item), transfer]};
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("usdc-reconcile", 5);
      request.onupgradeneeded = event => {
        const invoices = event.oldVersion === 0
          ? request.result.createObjectStore("invoices", {keyPath: ["mode", "id"]})
          : request.transaction.objectStore("invoices");
        if (event.oldVersion === 0) {
          invoices.createIndex("mode", "mode");
          const paid = {...demoTransfer, hash: demoPaidHash, units: "1250000000", time: "2026-11-21T05:26:00.000Z"};
          invoices.add(bill("demo", ["INV-1044", "山岚工作室", "500", demoAddress]));
          invoices.add(bill("demo", ["INV-1043", "Northline Studio", "500", demoAddress]));
          invoices.add(linkPayment(bill("demo", ["INV-1042", "松墨设计", "1250", demoAddress]), paid));
        }
        if (event.oldVersion < 2) {
          const batchSamples = [
            bill("demo", ["DEMO-800", "方舟影像", "800", demoAddress]),
            bill("demo", ["DEMO-950", "松海工作室", "950", demoAddress])
          ];
          for (const sample of batchSamples) {
            const existing = invoices.get([sample.mode, sample.id]);
            existing.onsuccess = () => {
              if (!existing.result) invoices.add(sample);
            };
          }
        }
        if (event.oldVersion < 3) {
          request.result.createObjectStore("receipts", {keyPath: ["mode", "hash", "index"]}).createIndex("mode", "mode");
        }
        if (event.oldVersion < 4) {
          request.result.createObjectStore("activity", {keyPath: "id"}).createIndex("modeTime", ["mode", "at", "id"]);
        }
        const assignments = request.result.createObjectStore("assignments", {keyPath: "key"});
        if (invoices.indexNames.contains("paymentKey")) invoices.deleteIndex("paymentKey");
        const existing = invoices.openCursor();
        existing.onsuccess = () => {
          const cursor = existing.result;
          if (!cursor) return;
          const item = cursor.value;
          for (const payment of paymentsFor(item)) assignments.add(assignmentFor(item, payment));
          if (item.payment) {
            item.payments = [item.payment];
            delete item.payment;
            delete item.paymentKey;
            cursor.update(item);
          }
          cursor.continue();
        };
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => reject(new Error(t("无法打开本地账单库。请检查浏览器的存储设置。")));
      request.onblocked = () => reject(new Error(t("账单库正被另一个窗口占用。关闭其他对账台窗口后重试。")));
    });
  }

  function recordActivity(transaction, mode, description) {
    transaction.objectStore("activity").add({id: crypto.randomUUID(), mode, at: new Date().toISOString(), description});
  }

  function readActivity(db, mode) {
    return new Promise((resolve, reject) => {
      const list = [];
      const store = db.transaction("activity").objectStore("activity");
      const range = IDBKeyRange.bound([mode], [mode, []]);
      const request = store.index("modeTime").openCursor(range, "prev");
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || list.length === 50) resolve(list);
        else {
          list.push(cursor.value);
          cursor.continue();
        }
      };
      request.onerror = () => reject(new Error(t("无法读取操作记录。")));
    });
  }

  function sortBills(items) {
    return items.sort((a, b) => b.created.localeCompare(a.created) || b.id.localeCompare(a.id));
  }

  function readBills(db, mode) {
    return new Promise((resolve, reject) => {
      const request = db.transaction("invoices").objectStore("invoices").index("mode").getAll(mode);
      request.onsuccess = () => resolve(sortBills(request.result));
      request.onerror = () => reject(new Error(t("无法读取账单。")));
    });
  }

  function readWorkspace(db, mode) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["invoices", "receipts"]);
      const invoices = transaction.objectStore("invoices").index("mode").getAll(mode);
      const receipts = transaction.objectStore("receipts").index("mode").getAll(mode);
      transaction.oncomplete = () => {
        const bills = sortBills(invoices.result);
        const matched = new Set(bills.flatMap(item => paymentsFor(item).map(transfer => paymentKey(mode, transfer))));
        const unlinked = receipts.result.filter(transfer => !matched.has(paymentKey(mode, transfer)))
          .sort((a, b) => b.time.localeCompare(a.time) || a.hash.localeCompare(b.hash) || a.index - b.index);
        resolve({bills, pending: unlinked.filter(transfer => !transfer.exception),
          exceptions: unlinked.filter(transfer => transfer.exception)});
      };
      transaction.onabort = () => reject(new Error(t("无法读取账单和待匹配入账。")));
    });
  }

  function saveReceipts(db, mode, transfers) {
    if (transfers.some(transfer => !inWorkspace(mode, transfer))) {
      return Promise.reject(new Error(t("转账所属网络与当前工作区不一致。")));
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("receipts", "readwrite");
      const receipts = transaction.objectStore("receipts");
      const unique = new Map(transfers.map(transfer => [paymentKey(mode, transfer), transfer]));
      for (const transfer of unique.values()) {
        const existing = receipts.get([mode, transfer.hash, transfer.index]);
        existing.onsuccess = () => {
          if (!existing.result) receipts.add({...transfer, mode});
        };
      }
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(new Error(t("未能保存这批转账，请重新核验。")));
    });
  }

  function saveBills(db, bills) {
    if (!bills.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["invoices", "activity"], "readwrite");
      const invoices = transaction.objectStore("invoices");
      bills.forEach(item => invoices.add(item));
      recordActivity(transaction, bills[0].mode, bills.length === 1
        ? "新增账单 " + bills[0].id : "导入 " + bills.length + " 张账单");
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(new Error(transaction.error?.name === "ConstraintError"
        ? t("账单号已存在。本次保存未写入任何账单。")
        : t("保存失败。本次保存未写入任何账单。")));
    });
  }

  function updateBill(db, original, fields) {
    return new Promise((resolve, reject) => {
      const {mode, id} = original;
      const {customer, units, address} = bill(mode, [id, ...fields]);
      const transaction = db.transaction(["invoices", "activity"], "readwrite");
      const invoices = transaction.objectStore("invoices");
      let reason = "";
      let changed = false;
      const request = invoices.get([mode, id]);
      request.onsuccess = () => {
        const current = request.result;
        if (!current || current.customer !== original.customer ||
          current.units !== original.units || current.address !== original.address) {
          reason = t("账单已更新。请关闭编辑窗口后重新打开。");
          transaction.abort();
          return;
        }
        const paymentDetailsChanged = current.units !== units || current.address !== address;
        if (paymentDetailsChanged && paymentsFor(current).length) {
          reason = t("账单已有付款关联，金额和收款地址已锁定。");
          transaction.abort();
          return;
        }
        changed = paymentDetailsChanged || current.customer !== customer;
        if (changed) {
          invoices.put({...current, customer, units, address});
          recordActivity(transaction, mode, "已编辑账单 " + id);
        }
      };
      transaction.oncomplete = () => resolve(changed);
      transaction.onabort = () => reject(new Error(reason || t("账单编辑未保存，请重试。")));
    });
  }

  function matchBill(db, mode, id, transfer, expectedReceived, expectedUnits) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["invoices", "receipts", "assignments", "activity"], "readwrite");
      const invoices = transaction.objectStore("invoices");
      let reason = "";
      const request = invoices.get([mode, id]);
      const receipt = transaction.objectStore("receipts").get([mode, transfer.hash, transfer.index]);
      receipt.onsuccess = () => {
        const item = request.result;
        if (!item || !canMatch(item, transfer) || receipt.result?.exception ||
          (expectedUnits !== undefined && item.units !== expectedUnits) ||
          (expectedReceived !== undefined && billTotals(item).received.toString() !== expectedReceived)) {
          reason = t("账单状态已改变，或地址和金额不一致。请重新核验。");
          transaction.abort();
          return;
        }
        invoices.put(linkPayment(item, transfer));
        transaction.objectStore("assignments").add(assignmentFor(item, transfer));
        const asset = assetForWorkspace(mode);
        recordActivity(transaction, mode, "关联账单 " + id + " · " + displayAmount(transfer.units, asset.decimals) + " " + asset.symbol);
      };
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(new Error(reason || (transaction.error?.name === "ConstraintError"
        ? t("这笔转账已经关联到其他账单。") : t("关联失败，请重试。"))));
    });
  }

  function matchBatch(db, mode, transfers, reviewed) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["invoices", "receipts", "assignments", "activity"], "readwrite");
      const invoices = transaction.objectStore("invoices");
      let changed = false;
      const bills = invoices.index("mode").getAll(mode);
      const receipts = transaction.objectStore("receipts").index("mode").getAll(mode);
      receipts.onsuccess = () => {
        const current = suggestMatches(bills.result, transfers, mode, receipts.result);
        changed = current.length !== reviewed.length || current.some(({item, transfer}, index) =>
          item.id !== reviewed[index].item.id || paymentKey(mode, transfer) !== paymentKey(mode, reviewed[index].transfer));
        if (changed) {
          transaction.abort();
          return;
        }
        current.forEach(({item, transfer}) => {
          invoices.put(linkPayment(item, transfer));
          transaction.objectStore("assignments").add(assignmentFor(item, transfer));
        });
        if (current.length) recordActivity(transaction, mode, "批量关联 " + current.map(({item}) => item.id).join("、"));
      };
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(new Error(changed
        ? t("账单或转账状态已改变，本次未写入。请核对更新后的匹配建议。")
        : t("批量关联未写入，请重试。")));
    });
  }

  function unmatchBill(db, mode, id, expectedKey) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["invoices", "receipts", "assignments", "activity"], "readwrite");
      const invoices = transaction.objectStore("invoices");
      let changed = false;
      const request = invoices.get([mode, id]);
      request.onsuccess = () => {
        const item = request.result;
        const payment = item && paymentsFor(item).find(entry => paymentKey(mode, entry) === expectedKey);
        if (!payment) {
          changed = true;
          transaction.abort();
          return;
        }
        invoices.put({...item, payments: paymentsFor(item).filter(entry => paymentKey(mode, entry) !== expectedKey)});
        transaction.objectStore("assignments").delete(expectedKey);
        transaction.objectStore("receipts").put({...payment, mode});
        recordActivity(transaction, mode, "撤销账单 " + id + " 的关联");
      };
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(new Error(changed
        ? t("这张账单的关联已改变，请查看当前状态。")
        : t("撤销未写入，请重试。")));
    });
  }

  function setException(db, mode, transfer, reason) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["receipts", "assignments", "activity"], "readwrite");
      const receipts = transaction.objectStore("receipts");
      const existing = receipts.get([mode, transfer.hash, transfer.index]);
      const linked = transaction.objectStore("assignments").getKey(paymentKey(mode, transfer));
      let changed = false;
      linked.onsuccess = () => {
        if (!existing.result || linked.result || existing.result.exception !== transfer.exception) {
          changed = true;
          transaction.abort();
          return;
        }
        const item = existing.result;
        if (reason) item.exception = reason;
        else delete item.exception;
        receipts.put(item);
        const label = transfer.hash.slice(0, 10) + "…" + transfer.hash.slice(-6) + " #" + transfer.index;
        recordActivity(transaction, mode, reason ? "标记异常 " + label + " · " + reason : "恢复待匹配 " + label);
      };
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(new Error(changed
        ? t("转账状态已改变，请查看最新记录。") : t("异常状态未保存，请重试。")));
    });
  }

  class RpcUnavailable extends Error {}

  function networkRpc(fetchRpc, endpoint, unavailable, network) {
    return async function rpc(method, params = []) {
      try {
        const response = await fetchRpc(endpoint, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({jsonrpc: "2.0", id: 1, method, params}),
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: AbortSignal.timeout(12000)
        });
        if (!response.ok) throw new Error();
        const body = network.family === "solana" && method === "getTransaction"
          ? JSON.parse(await response.text(), (key, value, context) =>
            key === "lamports" && typeof value === "number" && !Number.isSafeInteger(value) ? context?.source ?? value : value)
          : await response.json();
        if (body.error || !("result" in body)) throw new Error();
        return body.result;
      } catch {
        throw new RpcUnavailable(unavailable);
      }
    };
  }

  function endpointsForNetwork(key, primary) {
    const network = getNetwork(key);
    const custom = configuration.nodes.filter(node => node.network === key).reverse().map(node => node.url);
    return [...new Set([...custom, primary, network.scanRpc, network.receiptRpc, network.fallbackRpc].filter(Boolean))];
  }

  async function checkNode(rpc, network) {
    if (network.family === "solana") {
      const genesis = await rpc("getGenesisHash");
      if (genesis !== "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d") {
        throw new RpcUnavailable(t("节点与 Solana 主网不一致。"));
      }
      return;
    }
    const chain = await rpc("eth_chainId");
    if (typeof chain !== "string" || !/^0x[0-9a-f]+$/i.test(chain) || BigInt(chain) !== BigInt(network.id)) {
      throw new RpcUnavailable(t("节点链 ID 与 {0} 不一致。", network.name));
    }
  }

  async function useNetwork(network, primary, fetchRpc, action) {
    const unavailable = t("暂时无法查询 {0} 的节点，请稍后重试。", network.name);
    for (const endpoint of endpointsForNetwork(network.key, primary)) {
      const rpc = networkRpc(fetchRpc, endpoint, unavailable, network);
      try {
        await checkNode(rpc, network);
        return await action(rpc);
      } catch (error) {
        if (!(error instanceof RpcUnavailable)) throw error;
      }
    }
    throw new Error(unavailable);
  }

  async function validateEndpoint(network, url, fetchRpc) {
    const rpc = networkRpc(fetchRpc, url, t("节点无法连接，或没有允许当前网页访问。"), network);
    await checkNode(rpc, network);
    if (network.family === "solana") {
      const slot = await rpc("getSlot", [{commitment: "finalized"}]);
      if (!Number.isSafeInteger(slot)) throw new Error(t("节点未返回最终确认的 Solana slot。"));
      return;
    }
    const block = await rpc("eth_getBlockByNumber", ["finalized", false]);
    if (!block?.number || !hashPattern.test(block.hash)) throw new Error(t("节点未返回最终确认区块。"));
  }

  async function inspectNetwork({name, id, rpc, explorer}, fetchRpc = fetch) {
    const network = customNetwork(name, Number(id), rpc, explorer);
    if (Object.values(networkCatalog()).some(item => item.id === network.id)) {
      throw new Error(t("链 ID 已存在。要添加 RPC 请使用节点表单。"));
    }
    await validateEndpoint(network, network.scanRpc, fetchRpc);
    return network;
  }

  async function inspectNode(key, address, fetchRpc = fetch) {
    const network = getNetwork(key);
    const url = nodeUrl(address);
    if (endpointsForNetwork(key).some(other => nodeUrl(other) === url)) throw new Error(t("此网络已有相同的节点。"));
    await validateEndpoint(network, url, fetchRpc);
    return {network: key, url};
  }

  async function inspectAsset(key, symbol, address, fetchRpc = fetch) {
    const network = getNetwork(key);
    if (network.family === "solana") throw new Error(t("自定义 ERC-20 适用于 EVM 网络。"));
    const contract = normalizeAddress(address);
    if (assetsForNetwork(key).some(item => item.contract === contract)) throw new Error(t("此网络已有相同的代币合约。"));
    customAsset(key, symbol, contract, 0);
    return useNetwork(network, network.scanRpc, fetchRpc, async rpc => {
      const code = await rpc("eth_getCode", [contract, "finalized"]);
      if (typeof code !== "string" || /^0x0*$/i.test(code)) throw new Error(t("这个地址没有已确认的合约。"));
      const result = await rpc("eth_call", [{to: contract, data: "0x313ce567"}, "finalized"]);
      if (typeof result !== "string" || !hashPattern.test(result)) throw new Error(t("无法读取 ERC-20 代币精度。"));
      return customAsset(key, symbol, contract, Number(BigInt(result)));
    });
  }

  function isAssetTransfer(log, asset) {
    return !log.removed && log.address?.toLowerCase() === asset.contract && log.topics?.length === 3 &&
      log.topics[0].toLowerCase() === transferTopic && hashPattern.test(log.topics[2]) &&
      hashPattern.test(log.data) && BigInt(log.data) > 0n;
  }

  function unpackTransfer(log, hash, time, network, asset) {
    return {
      hash, index: Number(BigInt(log.logIndex)), address: "0x" + log.topics[2].slice(-40).toLowerCase(),
      units: BigInt(log.data).toString(), time, demo: false, network: network.key, asset: asset.contract
    };
  }

  async function queryTransaction(workspace, hash, fetchRpc = fetch) {
    const network = networkForWorkspace(workspace);
    const asset = assetForWorkspace(workspace);
    if (!validTransactionId(workspace, hash)) throw new Error(t("交易哈希或签名格式无效。"));
    hash = normalizedTransactionId(workspace, hash);
    if (network.family === "solana") {
      return useNetwork(network, network.scanRpc, fetchRpc, async rpc => {
        const transfers = await readSolanaTransaction(rpc, hash);
        if (!transfers.length) throw new Error(t("交易已确认，未发现 SOL 原生转账。"));
        return transfers;
      });
    }
    return useNetwork(network, network.receiptRpc ?? network.scanRpc, fetchRpc, rpc => readReceipt(rpc, network, asset, hash));
  }

  async function readReceipt(rpc, network, asset, hash) {
    const receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (!receipt) throw new Error(t("{0} 没有找到交易回执。请核对网络、哈希或稍后重试。", network.name));
    if (receipt.transactionHash?.toLowerCase() !== hash) throw new Error(t("节点返回的交易与查询不一致。"));
    if (receipt.status !== "0x1") throw new Error(t("这笔交易未成功。"));
    const [finalized, block] = await Promise.all([
      rpc("eth_getBlockByNumber", ["finalized", false]),
      rpc("eth_getBlockByNumber", [receipt.blockNumber, false])
    ]);
    if (!finalized?.number || !block?.timestamp || !block.hash || block.hash !== receipt.blockHash) {
      throw new Error(t("暂时无法确认交易所在区块，请稍后重试。"));
    }
    if (BigInt(finalized.number) < BigInt(receipt.blockNumber)) {
      throw new Error(t("交易已入块，仍在等待最终确认。请稍后重新核验。"));
    }
    const time = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString();
    if (asset.contract === "native") {
      const transaction = await rpc("eth_getTransactionByHash", [hash]);
      if (transaction?.hash?.toLowerCase() !== hash || transaction.blockHash !== receipt.blockHash ||
        transaction.to?.toLowerCase() !== receipt.to?.toLowerCase()) throw new Error(t("无法核对原生转账的区块或收款地址。"));
      const payment = nativeEvmTransfer(transaction, time, network);
      if (!payment) throw new Error(t("交易已确认，未发现可核验的原生 {0} 转账。", asset.symbol));
      return [payment];
    }
    const transfers = receipt.logs.filter(log => isAssetTransfer(log, asset)).map(log => unpackTransfer(log, hash, time, network, asset));
    if (!transfers.length) throw new Error(t("交易已确认，未发现当前合约的 {0} 转账。", asset.symbol));
    return transfers;
  }

  async function scanAddress(workspace, address, firstText, lastText, fetchRpc = fetch) {
    const network = networkForWorkspace(workspace);
    const asset = assetForWorkspace(workspace);
    const normalized = normalizeAddress(address, workspace);
    if (network.family === "solana") {
      return useNetwork(network, network.scanRpc, fetchRpc, rpc => readSolanaAddress(rpc, normalized));
    }
    const validBlock = value => !value || /^\d{1,16}$/.test(value);
    if (!validBlock(firstText) || !validBlock(lastText)) throw new Error(t("请输入十进制区块高度。"));
    return useNetwork(network, network.scanRpc, fetchRpc,
      rpc => readAddress(rpc, workspace, network, asset, normalized, firstText, lastText));
  }

  async function readAddress(rpc, workspace, network, asset, address, firstText, lastText) {
    const finalized = await rpc("eth_getBlockByNumber", ["finalized", false]);
    if (!finalized?.number) throw new RpcUnavailable(t("节点未返回最终确认区块。"));
    const top = BigInt(finalized.number);
    const end = lastText ? BigInt(lastText) : top;
    const size = asset.contract === "native" ? 20n : 1000n;
    const start = firstText ? BigInt(firstText) : end >= size ? end - size + 1n : 0n;
    if (start > end || end - start >= size || end > top) {
      throw new Error(t("请输入最多 {0} 个区块的范围，结束高度须小于或等于 {1}。", size, top));
    }
    const hex = number => "0x" + number.toString(16);
    if (asset.contract === "native") {
      return readNativeEvmAddress(rpc, network, address, start, end);
    }
    const recipient = "0x" + address.slice(2).padStart(64, "0");
    const byBlock = new Map();
    for (let first = start; first <= end; first += 100n) {
      const last = first + 99n < end ? first + 99n : end;
      const logs = await rpc("eth_getLogs", [{
        fromBlock: hex(first), toBlock: hex(last), address: asset.contract, topics: [transferTopic, null, recipient]
      }]);
      if (!Array.isArray(logs)) throw new Error(t("节点返回的转账列表无效，请重试。"));
      for (const log of logs) {
        if (!isAssetTransfer(log, asset) || log.topics[2].toLowerCase() !== recipient) continue;
        if (!hashPattern.test(log.transactionHash) || !hashPattern.test(log.blockHash) ||
          !/^0x[0-9a-f]+$/i.test(log.logIndex) || !/^0x[0-9a-f]+$/i.test(log.blockNumber) ||
          BigInt(log.blockNumber) < first || BigInt(log.blockNumber) > last) {
          throw new Error(t("节点返回了无法核验的日志，请重试。"));
        }
        const number = hex(BigInt(log.blockNumber));
        if (!byBlock.has(number)) byBlock.set(number, []);
        byBlock.get(number).push(log);
      }
    }
    const transfers = [];
    const seen = new Set();
    for (const [number, logs] of byBlock) {
      const block = await rpc("eth_getBlockByNumber", [number, false]);
      if (!block?.timestamp || block.number !== number || logs.some(log => log.blockHash !== block.hash)) {
        throw new Error(t("无法核验转账所在区块，请重试。"));
      }
      const time = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString();
      for (const log of logs) {
        const transfer = unpackTransfer(log, log.transactionHash.toLowerCase(), time, network, asset);
        const key = paymentKey(workspace, transfer);
        if (seen.has(key)) continue;
        seen.add(key);
        transfers.push(transfer);
      }
    }
    return {start: start.toString(), end: end.toString(), transfers};
  }

  function nativeEvmTransfer(transaction, time, network) {
    if (!hashPattern.test(transaction.hash) || !addressPattern.test(transaction.to ?? "") ||
      transaction.from?.toLowerCase() === transaction.to.toLowerCase() ||
      !/^0x[0-9a-f]+$/i.test(transaction.value) || BigInt(transaction.value) <= 0n) return null;
    return {hash: transaction.hash.toLowerCase(), index: 0, address: transaction.to.toLowerCase(),
      units: BigInt(transaction.value).toString(), time, demo: false, network: network.key, asset: "native"};
  }

  async function readNativeEvmAddress(rpc, network, address, start, end) {
    const transfers = [];
    for (let height = start; height <= end; height += 1n) {
      const number = "0x" + height.toString(16);
      const block = await rpc("eth_getBlockByNumber", [number, true]);
      if (block?.number !== number || !block.timestamp || !hashPattern.test(block.hash) || !Array.isArray(block.transactions)) {
        throw new RpcUnavailable(t("节点未返回完整区块。"));
      }
      const time = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString();
      for (const tx of block.transactions) {
        if (tx.to?.toLowerCase() !== address) continue;
        const payment = nativeEvmTransfer(tx, time, network);
        if (!payment) continue;
        const receipt = await rpc("eth_getTransactionReceipt", [payment.hash]);
        if (receipt?.status === "0x0") continue;
        if (receipt?.status !== "0x1" || receipt.blockHash !== block.hash || receipt.blockNumber !== number ||
          receipt.to?.toLowerCase() !== address || receipt.transactionHash?.toLowerCase() !== payment.hash) {
          throw new RpcUnavailable(t("节点未返回有效的转账回执。"));
        }
        transfers.push(payment);
      }
    }
    return {start: start.toString(), end: end.toString(), transfers};
  }

  async function readSolanaTransaction(rpc, signature, address) {
    const transaction = await rpc("getTransaction", [signature, {
      encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 1
    }]);
    if (!transaction || transaction.transaction?.signatures?.[0] !== signature || !transaction.meta) {
      throw new RpcUnavailable(t("节点未返回可核验的 Solana 交易。"));
    }
    if (transaction.meta.err) {
      if (address) return [];
      throw new Error(t("这笔 Solana 交易未成功。"));
    }
    if (!Number.isSafeInteger(transaction.blockTime)) throw new RpcUnavailable(t("节点未返回交易时间。"));
    const instructions = transaction.transaction.message?.instructions;
    if (!Array.isArray(instructions)) throw new RpcUnavailable(t("节点未返回已解码的交易指令。"));
    const inner = new Map((transaction.meta.innerInstructions ?? []).map(row => [row.index, row.instructions]));
    const ordered = instructions.flatMap((instruction, index) => [instruction, ...(inner.get(index) ?? [])]);
    const time = new Date(transaction.blockTime * 1000).toISOString();
    return ordered.flatMap((instruction, index) => {
      const parsed = instruction.parsed;
      if (instruction.programId !== "11111111111111111111111111111111" ||
        !["transfer", "transferWithSeed"].includes(parsed?.type)) return [];
      const {destination, lamports, source} = parsed.info ?? {};
      if (source === destination || (address && destination !== address)) return [];
      if (!validBase58(destination, 32)) throw new RpcUnavailable(t("节点未返回有效的收款地址。"));
      const amount = typeof lamports === "string" && /^\d+$/.test(lamports) ? BigInt(lamports)
        : Number.isSafeInteger(lamports) ? BigInt(lamports) : -1n;
      if (amount < 0n || amount >= 2n ** 64n) throw new RpcUnavailable(t("节点返回的 SOL 金额无法精确读取。"));
      return amount === 0n ? [] : [{
        hash: signature, index, address: destination, units: amount.toString(), time,
        demo: false, network: "solana", asset: "native"
      }];
    });
  }

  async function readSolanaAddress(rpc, address) {
    const signatures = await rpc("getSignaturesForAddress", [address, {limit: 10, commitment: "finalized"}]);
    if (!Array.isArray(signatures)) throw new RpcUnavailable(t("节点未返回地址交易列表。"));
    const success = signatures.filter(item => !item.err && validBase58(item.signature, 64));
    const transfers = [];
    for (const {signature} of success) {
      transfers.push(...await readSolanaTransaction(rpc, signature, address));
    }
    return {transactions: signatures.length, transfers};
  }

  const headers = ["账单号", "客户", "金额", "收款地址"];
  const csvHeaders = localization.supported.map(language => {
    const translate = localization.translator(language, localization.messages);
    return headers.map(header => translate(header));
  });

  function csvField(value) {
    let field = String(value ?? "");
    if (/^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(field)) field = "'" + field;
    return '"' + field.replaceAll('"', '""') + '"';
  }

  function makeCsv(rows) {
    return "\uFEFF" + rows.map(row => row.map(csvField).join(",")).join("\r\n");
  }

  function importCsv(source, mode) {
    const csv = source.replace(/^\uFEFF/, "");
    const records = [];
    let row = [];
    const fields = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/y;
    while (fields.lastIndex < csv.length) {
      const match = fields.exec(csv);
      if (!match) throw new Error(t("CSV 格式有误。请检查字段引号和分隔符。"));
      row.push(match[1] === undefined ? match[2] : match[1].replaceAll('""', '"'));
      if (match[3] === ",") continue;
      if (row.some(value => value.trim())) records.push(row);
      row = [];
    }
    if (row.length) records.push([...row, ""]);
    const header = records.shift();
    if (!header || header.length !== headers.length ||
      !csvHeaders.some(names => names.every((name, index) => header[index].trim() === name))) {
      throw new Error(t("CSV 列顺序须为：账单号、客户、金额、收款地址。"));
    }
    if (!records.length || records.length > 1000) throw new Error(t("每次可导入 1 至 1000 张账单。"));
    return records.map((record, index) => {
      try {
        if (record.length !== headers.length) throw new Error(t("字段数量有误。"));
        return bill(mode, record);
      } catch (error) {
        throw new Error(t("第 {0} 条账单：{1}", index + 1, error.message));
      }
    });
  }

  return {assetForWorkspace, assetsForNetwork, assignmentFor, bill, billTotals, canMatch, canSuggest, configure, decimal, demoAddress, demoHash, demoTransfers,
    displayAmount, endpointsForNetwork, getConfiguration, hashPattern, headers, importCsv, inspectAsset, inspectNetwork,
    inspectNode, makeCsv, matchBatch, matchBill, networkCatalog, networkForWorkspace, networks, openDatabase, parseHashes,
    normalizeAddress, normalizedTransactionId, paymentKey, paymentsFor, queryTransaction, readActivity, readBills, readWorkspace,
    recordActivity, saveBills, saveReceipts, scanAddress, validTransactionId,
    setException, splitDemoTransfers, suggestMatches, unmatchBill, updateBill, workspaceForNetwork};
})();

if (typeof module !== "undefined") module.exports = Ledger;
