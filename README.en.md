# Chain Ledger

[简体中文](README.md) · [繁體中文](README.zh-Hant.md) · English

Chain Ledger is an open-source reconciliation tool for individuals and small teams that accept crypto payments. Receive funds in your existing wallet, then verify transfers, match invoices, and export records in a browser.

## Quick start

Clone the repository and serve its files locally with Python 3.

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open `http://127.0.0.1:8080/`. Go to **Verification** and select **Try split-payment sample** to match two demo transfers to one invoice and see how its outstanding balance changes.

Use the language menu to choose Simplified Chinese, Traditional Chinese, or English. The browser remembers your selection. Payment links and downloaded payment pages open in the language selected when you generated them.

## Features

- Create invoices, import or export CSV files, and generate downloadable payment pages. CSV import accepts templates in all three languages.
- Verify transactions by hash or signature in batches, or search for recent payments by receiving address.
- Track split payments and overpayments, unlink an individual payment, record exceptions, and review recent activity.
- Keep separate ledgers by network and asset, with JSON backup and restore.
- Use built-in networks including Base, Ethereum, Arbitrum One, OP Mainnet, Polygon PoS, Avalanche C-Chain, BNB Smart Chain, and Solana. The asset menu shows which assets are available on each network.
- Add custom EVM networks, RPC endpoints, and ERC-20 tokens. Solana supports custom compatible mainnet RPC endpoints.

Verification uses read-only RPC queries. Invoices and settings are stored in your browser. Export a backup for each ledger before changing devices or site addresses. If you use a custom network or asset, configure the same network and contract in the new browser before restoring.

## Contributing

Open an Issue to report a problem or suggest an improvement, or submit a Pull Request. For verification problems, include the network, asset, and steps to reproduce. Use a public transaction or demo data as your example.

## License

[MIT License](LICENSE)

## Donate

If Chain Ledger saves you time, you are welcome to support it with an optional donation. All features are free to use.

| Network | Donation address |
| --- | --- |
| Ethereum | `0xEbc48077968d7Afda810603194b0412C35e3B655` |
| Bitcoin | `bc1qjj9dx0fwmzevwjffa55z6wp76egaztjee8ml08` |
| Solana | `2y11NNPRiJpSkLHR4zW23M67KuqxmpdTmhpKim46WtBn` |
| Tron | `TBUzeZCAuqEFuh1rUGmCnmGQoiCKkgHk4Z` |
| Stellar | `GDA4A4GN5WCMADT3GXXBKUEVIUQQPOPDVRX5B23TOVK2AGRV5LBHV545` |

Before sending, make sure your wallet is using the network listed next to the address.
