# 链上对账台

简体中文 · [繁體中文](README.zh-Hant.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md)

给使用加密货币收款的个人和小团队用的开放源码对账工具。用现有钱包收款，在浏览器里核验转账、匹配账单和导出记录。

## 快速开始

克隆仓库后，可以在项目目录里用 Python 3 启动静态文件服务器。

```sh
python -m http.server 8080 --bind 127.0.0.1
```

在浏览器打开 `http://127.0.0.1:8080/`。进入「交易核验」，点击「试用分笔样例」，可以把两笔演示转账关联到同一张账单，观察余款和结清状态。

右上角可切换简体中文、繁体中文、英语、日语、韩语和西班牙语。浏览器会记住选择，生成的付款链接和下载的付款页会使用当时选中的语言。

## 功能

- 新建账单、导入和导出 CSV、生成可下载的付款页。CSV 导入支持六种语言的模板。
- 按账单号、客户或收款地址搜索，可单独筛选部分收款和多收账单。编辑已关联付款的账单时可修改客户名称。未关联付款的账单也可修改金额和收款地址。
- 按交易哈希或签名批量核验，也可以按收款地址查询近期入账。
- 分笔收款、多收金额、单笔撤销、异常说明和操作记录。
- 按网络和币种保存独立账本，支持 JSON 备份和恢复。
- 内置 Base、Ethereum、Arbitrum One、OP Mainnet、Polygon PoS、Avalanche C-Chain、BNB Smart Chain 和 Solana。各网络支持的币种以页面选择器为准。
- 可添加 EVM 网络、RPC 节点和 ERC-20 代币。Solana 可添加兼容的主网 RPC。

链上核验使用只读 RPC 调用，账单和配置保存在当前浏览器。更换设备或网站地址前，可以为每个在用账本导出备份。使用自定义网络或代币时，在新环境里先配置相同的网络和合约，再恢复对应账本。

## 参与贡献

欢迎通过 Issue 提交问题或建议，通过 Pull Request 提交修改。报告核验问题时，写明网络、币种和复现步骤。使用公开交易或演示数据作为示例。

## 许可证

[MIT License](LICENSE)

## 自愿捐赠

如果这个项目帮你节省了对账时间，欢迎自愿支持。所有功能均可免费使用。

| 网络 | 捐赠收款地址 |
| --- | --- |
| Ethereum | `0xEbc48077968d7Afda810603194b0412C35e3B655` |
| Bitcoin | `bc1qjj9dx0fwmzevwjffa55z6wp76egaztjee8ml08` |
| Solana | `2y11NNPRiJpSkLHR4zW23M67KuqxmpdTmhpKim46WtBn` |
| Tron | `TBUzeZCAuqEFuh1rUGmCnmGQoiCKkgHk4Z` |
| Stellar | `GDA4A4GN5WCMADT3GXXBKUEVIUQQPOPDVRX5B23TOVK2AGRV5LBHV545` |

发送前请确认钱包选择的网络与表中对应。
