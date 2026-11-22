# 鏈上對帳臺

[简体中文](README.md) · 繁體中文 · [English](README.en.md)

這是給使用加密貨幣收款的個人和小團隊使用的開放原始碼對帳工具。使用現有錢包收款，在瀏覽器裡核驗轉帳、配對帳單和匯出紀錄。

## 快速開始

下載程式碼後，在專案目錄中用 Python 3 啟動靜態檔案伺服器。

```sh
python -m http.server 8080 --bind 127.0.0.1
```

在瀏覽器開啟 `http://127.0.0.1:8080/`。進入「交易核驗」並選擇「試用分筆範例」，可以將兩筆示範轉帳關聯到同一張帳單，查看待收餘額和結清狀態。

右上角可切換簡體中文、繁體中文和 English，瀏覽器會記住你的選擇。付款連結和下載的付款頁會使用產生時選取的語言。

## 功能

- 新增帳單、匯入和匯出 CSV，並產生可下載的付款頁。CSV 匯入支援三種語言的範本。
- 依交易雜湊或簽名批次核驗，也能依收款地址查詢近期入帳。
- 追蹤分筆收款和溢收金額、撤銷單筆付款關聯、註記異常及查看操作紀錄。
- 依網路和幣種儲存各自的帳本，支援 JSON 備份和還原。
- 內建 Base、Ethereum、Arbitrum One、OP Mainnet、Polygon PoS、Avalanche C-Chain、BNB Smart Chain 和 Solana。各網路支援的幣種可在頁面的選單中查看。
- 可新增自訂 EVM 網路、RPC 節點和 ERC-20 代幣。Solana 可新增相容的主網 RPC 節點。

鏈上核驗使用唯讀的 RPC 查詢，帳單和設定儲存在目前的瀏覽器。更換裝置或網站網址前，可為每個使用中的帳本匯出備份。若有使用自訂網路或代幣，請先在新環境設定相同的網路及合約，再還原帳本。

## 參與貢獻

歡迎透過 Issue 回報問題或建議，並透過 Pull Request 提交修改。回報核驗問題時，請附上網路、幣種和重現步驟。請以公開交易或示範資料作為範例。

## 授權條款

[MIT License](LICENSE)

## 自願捐贈

如果這個專案幫你節省了對帳時間，歡迎自願支持。所有功能皆可免費使用。

| 網路 | 捐贈收款地址 |
| --- | --- |
| Ethereum | `0xEbc48077968d7Afda810603194b0412C35e3B655` |
| Bitcoin | `bc1qjj9dx0fwmzevwjffa55z6wp76egaztjee8ml08` |
| Solana | `2y11NNPRiJpSkLHR4zW23M67KuqxmpdTmhpKim46WtBn` |
| Tron | `TBUzeZCAuqEFuh1rUGmCnmGQoiCKkgHk4Z` |
| Stellar | `GDA4A4GN5WCMADT3GXXBKUEVIUQQPOPDVRX5B23TOVK2AGRV5LBHV545` |

傳送前請確認錢包選擇的網路與表中相符。
