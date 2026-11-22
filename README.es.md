# Chain Ledger

[简体中文](README.md) · [繁體中文](README.zh-Hant.md) · [English](README.en.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · Español

Chain Ledger es una herramienta de código abierto para conciliar pagos en criptomonedas, pensada para particulares y equipos pequeños. Recibe fondos en tu cartera habitual y usa el navegador para verificar transferencias, conciliarlas con facturas y exportar los registros.

## Primeros pasos

Descarga el repositorio y ejecuta un servidor local con Python 3 desde el directorio del proyecto.

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8080/`. En **Verificación**, elige **Probar ejemplo de pago fraccionado** para conciliar dos pagos de demostración con una factura. Selecciona Español en el menú de idioma. El navegador guarda tu selección y los enlaces y páginas de pago descargadas se abren en el idioma elegido al generarlos.

## Funciones

- Crear facturas, importar y exportar CSV y generar páginas de pago descargables. Las plantillas CSV están disponibles en seis idiomas.
- Buscar por ID de factura, cliente o dirección de recepción, y filtrar pagos parciales o excedentes. Puedes editar el cliente en cualquier momento y cambiar el importe o la dirección antes de vincular un pago.
- Verificar transacciones por hash o firma en lotes, o consultar pagos recientes por dirección.
- Registrar pagos fraccionados y excesos, desvincular un pago, documentar incidencias y consultar la actividad reciente.
- Mantener libros separados por red y activo, con copias y restauración en JSON.
- Usar Base, Ethereum, Arbitrum One, OP Mainnet, Polygon PoS, Avalanche C-Chain, BNB Smart Chain y Solana. Puedes añadir redes EVM, nodos RPC y tokens ERC-20 personalizados, así como nodos compatibles con la red principal de Solana.

La verificación usa consultas RPC de solo lectura. Las facturas y los ajustes se guardan en el navegador. Exporta una copia de cada libro antes de cambiar de dispositivo o de dirección del sitio. Si usas un activo personalizado, configura la misma red y el mismo contrato antes de restaurar.

## Colaborar

Abre una Issue para informar de un problema o sugerir una mejora. Si has hecho cambios, envía una Pull Request. Si hay un problema de verificación, indica la red, el activo y los pasos para reproducirlo con una transacción pública o datos de demostración.

## Licencia

[MIT](LICENSE)

## Donaciones

Si esta herramienta te resulta útil, puedes apoyarla con una donación voluntaria. Todas las funciones son gratuitas.

| Red | Dirección para donaciones |
| --- | --- |
| Ethereum | `0xEbc48077968d7Afda810603194b0412C35e3B655` |
| Bitcoin | `bc1qjj9dx0fwmzevwjffa55z6wp76egaztjee8ml08` |
| Solana | `2y11NNPRiJpSkLHR4zW23M67KuqxmpdTmhpKim46WtBn` |
| Tron | `TBUzeZCAuqEFuh1rUGmCnmGQoiCKkgHk4Z` |
| Stellar | `GDA4A4GN5WCMADT3GXXBKUEVIUQQPOPDVRX5B23TOVK2AGRV5LBHV545` |

Antes de enviar fondos, comprueba que tu cartera usa la red indicada junto a la dirección.
