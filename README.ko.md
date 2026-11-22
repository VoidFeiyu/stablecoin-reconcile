# Chain Ledger

[简体中文](README.md) · [繁體中文](README.zh-Hant.md) · [English](README.en.md) · [日本語](README.ja.md) · 한국어 · [Español](README.es.md)

Chain Ledger는 암호화폐 결제를 받는 개인과 소규모 팀을 위한 오픈 소스 입금 대사 도구입니다. 기존 지갑으로 입금을 받고, 브라우저에서 거래를 검증해 청구서와 대사한 뒤 기록을 내보낼 수 있습니다.

## 시작하기

저장소를 내려받고 프로젝트 디렉터리에서 Python 3으로 로컬 서버를 실행합니다.

```sh
python -m http.server 8080 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:8080/`을 엽니다. ‘거래 검증’에서 ‘분할 결제 예제 사용’을 선택하면 청구서 한 건에 예제 입금 두 건을 대사할 수 있습니다. 언어 메뉴에서 한국어를 선택하면 브라우저에 설정이 저장됩니다. 결제 링크와 다운로드한 결제 페이지는 생성 시 선택한 언어로 열립니다.

## 기능

- 청구서 생성, CSV 가져오기·내보내기, 다운로드 가능한 결제 페이지. CSV 템플릿은 여섯 언어로 이용할 수 있습니다.
- 청구서 번호, 고객, 수신 주소 검색 및 일부 입금·초과 입금 필터. 고객 이름은 언제든 수정할 수 있고, 입금을 연결하기 전에는 금액과 수신 주소도 변경할 수 있습니다.
- 해시 또는 서명으로 거래를 일괄 검증하거나 수신 주소에서 최근 입금을 검색합니다.
- 분할 결제와 초과 입금 추적, 입금 연결 해제, 예외 기록 및 최근 활동 확인.
- 네트워크와 자산별 장부, JSON 백업 및 복원.
- Base, Ethereum, Arbitrum One, OP Mainnet, Polygon PoS, Avalanche C-Chain, BNB Smart Chain, Solana 지원. 사용자 지정 EVM 네트워크, RPC, ERC-20 토큰 및 호환되는 Solana 메인넷 RPC를 추가할 수 있습니다.

거래 검증에는 읽기 전용 RPC를 사용하고, 청구서와 설정은 브라우저에 저장합니다. 기기 또는 사이트 주소를 바꾸기 전에는 장부별로 백업을 내보내세요. 사용자 지정 자산의 경우 복원하기 전에 기존과 같은 네트워크와 컨트랙트를 설정하세요.

## 기여

문제 또는 개선 제안은 Issue로, 코드 변경은 Pull Request로 보내 주세요. 거래 검증에 문제가 있다면 네트워크, 자산, 재현 절차와 공개 거래 또는 데모 데이터를 첨부해 주세요.

## 라이선스

[MIT](LICENSE)

## 자발적 후원

이 도구가 도움이 되었다면 자발적으로 후원할 수 있습니다. 모든 기능은 무료입니다.

| 네트워크 | 후원 수신 주소 |
| --- | --- |
| Ethereum | `0xEbc48077968d7Afda810603194b0412C35e3B655` |
| Bitcoin | `bc1qjj9dx0fwmzevwjffa55z6wp76egaztjee8ml08` |
| Solana | `2y11NNPRiJpSkLHR4zW23M67KuqxmpdTmhpKim46WtBn` |
| Tron | `TBUzeZCAuqEFuh1rUGmCnmGQoiCKkgHk4Z` |
| Stellar | `GDA4A4GN5WCMADT3GXXBKUEVIUQQPOPDVRX5B23TOVK2AGRV5LBHV545` |

보내기 전에 지갑에서 표에 표시된 네트워크를 선택했는지 확인하세요.
