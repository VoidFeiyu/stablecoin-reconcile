"use strict";

const Backup = (ledger => {
  const t = (typeof module !== "undefined" ? require("./i18n") : I18n).t;
  const format = "usdc-ledger";
  const storeNames = ["invoices", "receipts", "activity"];
  const entryKey = (transfer, mode) => ledger.paymentKey(mode, transfer);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function date(value) {
    if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
      throw new Error(t("备份里包含无效时间。"));
    }
    return value;
  }

  function transfer(record, mode) {
    const network = ledger.networkForWorkspace(mode);
    const asset = ledger.assetForWorkspace(mode);
    if (!record || typeof record.hash !== "string" || !ledger.validTransactionId(mode, record.hash) ||
      !Number.isSafeInteger(record.index) || record.index < 0 || record.demo !== false ||
      (record.network ?? "base") !== network.key || (record.asset ?? network.usdc) !== asset.contract ||
      typeof record.address !== "string" ||
      typeof record.units !== "string" || !/^[1-9]\d{0,77}$/.test(record.units) || BigInt(record.units) >= 2n ** 256n) {
      throw new Error(t("备份里包含无效的主网转账。"));
    }
    return {hash: ledger.normalizedTransactionId(mode, record.hash), index: record.index, address: ledger.normalizeAddress(record.address, mode),
      units: record.units, time: date(record.time), demo: false, network: network.key, asset: asset.contract};
  }

  function invoice(record, mode) {
    if (record?.mode !== mode || typeof record.id !== "string" || typeof record.customer !== "string" ||
      typeof record.address !== "string" || typeof record.units !== "string" || !/^[1-9]\d{0,77}$/.test(record.units)) {
      throw new Error(t("备份里包含无效的主网账单。"));
    }
    const amount = ledger.decimal(record.units, ledger.assetForWorkspace(mode).decimals);
    const bill = ledger.bill(mode, [record.id, record.customer, amount, record.address]);
    bill.created = date(record.created);
    if (record.payments !== undefined && (!Array.isArray(record.payments) || record.payment !== undefined)) {
      throw new Error(t("备份里有无效的账单付款列表。"));
    }
    const payments = (record.payments ?? (record.payment === undefined ? [] : [record.payment]))
      .map(payment => transfer(payment, mode));
    if (!payments.every(payment => ledger.canMatch(bill, payment))) {
      throw new Error(t("备份里有账单与已关联转账不一致。"));
    }
    return {...bill, payments};
  }

  function receipt(record, mode) {
    if (record?.mode !== mode) throw new Error(t("备份里包含无效的主网转账。"));
    const item = {...transfer(record, mode), mode};
    if (record.exception === undefined) return item;
    if (typeof record.exception !== "string" || !record.exception.trim() || record.exception.length > 160) {
      throw new Error(t("备份里包含无效的异常说明。"));
    }
    return {...item, exception: record.exception};
  }

  function activity(record, mode) {
    if (record?.mode !== mode || typeof record.id !== "string" ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(record.id) ||
      typeof record.description !== "string" || !record.description.trim() || record.description.length > 2000) {
      throw new Error(t("备份里包含无效的操作记录。"));
    }
    return {id: record.id.toLowerCase(), mode, at: date(record.at), description: record.description};
  }

  const normalizers = [invoice, receipt, activity];
  const keys = [item => item.id, entryKey, item => item.id];

  function checkAssociations(invoices, receipts, mode) {
    const seen = new Set();
    for (const item of invoices.values()) {
      for (const payment of item.payments) {
        const key = entryKey(payment, mode);
        const known = receipts.get(key);
        if (seen.has(key) || (known && (known.exception || !same(transfer(known, mode), payment)))) {
          throw new Error(t("备份里有冲突的付款关联。"));
        }
        seen.add(key);
      }
    }
  }

  function decode(text, mode) {
    let data;
    try { data = JSON.parse(text.replace(/^\uFEFF/, "")); }
    catch { throw new Error(t("文件不是有效的 JSON 备份。")); }
    const versionOne = data?.format === "base-usdc-ledger" && data.version === 1;
    const versionTwo = data?.format === format && data.version === 2;
    const versionThree = data?.format === format && data.version === 3;
    const versionFour = data?.format === format && data.version === 4;
    if ((!versionOne && !versionTwo && !versionThree && !versionFour) || !storeNames.every(name => Array.isArray(data[name]))) {
      throw new Error(t("请选择此对账台生成的主网备份文件。"));
    }
    const source = versionOne ? "base" : data.network;
    const current = ledger.networkForWorkspace(mode);
    if (source !== current.key) {
      throw new Error(t("这份备份与当前的 {0} 工作区不匹配。请先切换到备份所属网络。", current.name));
    }
    const asset = ledger.assetForWorkspace(mode);
    const hasAssetMetadata = versionThree || versionFour;
    if (asset.contract !== (hasAssetMetadata ? data.asset : current.usdc) || asset.decimals !== (hasAssetMetadata ? data.decimals : 6)) {
      throw new Error(t("备份币种的合约或精度与当前工作区不一致。"));
    }
    const sets = storeNames.map((name, index) => {
      const items = new Map();
      for (const raw of data[name]) {
        const item = normalizers[index](raw, mode);
        const key = keys[index](item, mode);
        if (items.has(key)) throw new Error(t("备份里有重复记录。"));
        items.set(key, item);
      }
      return items;
    });
    checkAssociations(sets[0], sets[1], mode);
    return sets;
  }

  function requestRecords(transaction, mode) {
    return storeNames.map(name => {
      const store = transaction.objectStore(name);
      if (name === "activity") return store.index("modeTime").getAll(IDBKeyRange.bound([mode], [mode, []]));
      return store.index("mode").getAll(mode);
    });
  }

  function exportWorkspace(db, mode = "live") {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames);
      const requests = requestRecords(transaction, mode);
      const network = ledger.networkForWorkspace(mode).key;
      const asset = ledger.assetForWorkspace(mode);
      transaction.oncomplete = () => resolve({format, version: 4, network, asset: asset.contract, decimals: asset.decimals,
        exportedAt: new Date().toISOString(),
        ...Object.fromEntries(storeNames.map((name, index) => [name, requests[index].result]))});
      transaction.onabort = () => reject(new Error(t("无法导出主网备份。")));
    });
  }

  async function restoreWorkspace(db, text, mode = "live") {
    const incoming = decode(text, mode);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([...storeNames, "assignments"], "readwrite");
      const requests = requestRecords(transaction, mode);
      let reason = "";
      let added = 0;
      requests.at(-1).onsuccess = () => {
        try {
          const records = requests.map((request, index) => new Map(request.result.map(raw => {
            const item = normalizers[index](raw, mode);
            return [keys[index](item, mode), item];
          })));
          const missing = incoming.map((items, index) => {
            const missingItems = [];
            for (const [key, item] of items) {
              const existing = records[index].get(key);
              if (existing && !same(existing, item)) throw new Error(t("备份与当前账目有冲突，本次恢复未写入。"));
              if (!existing) {
                records[index].set(key, item);
                missingItems.push(item);
              }
            }
            return missingItems;
          });
          checkAssociations(records[0], records[1], mode);
          missing.forEach((items, index) => items.forEach(item => transaction.objectStore(storeNames[index]).add(item)));
          const assignments = transaction.objectStore("assignments");
          for (const item of missing[0]) {
            for (const payment of item.payments) assignments.add(ledger.assignmentFor(item, payment));
          }
          added = missing.reduce((count, items) => count + items.length, 0);
          if (added) ledger.recordActivity(transaction, mode, "从备份恢复 " + added + " 条记录");
        } catch (error) {
          reason = error.message;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(added);
      transaction.onabort = () => reject(new Error(reason || t("恢复备份失败，本次未写入。")));
    });
  }

  return {exportWorkspace, restoreWorkspace};
})(typeof module !== "undefined" ? require("./ledger") : Ledger);

if (typeof module !== "undefined") module.exports = Backup;
