# 出處與授權

這個 App 的單字、例句與排程都來自開放資料與開源元件，感謝每一位作者與貢獻者。

## Tatoeba 例句

- 西文句子與中文翻譯來自 [Tatoeba](https://tatoeba.org)，由社群成員貢獻。
- 授權：[CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/)。
- 我們做的修改：只挑西文 12 個字以內的句子；中文用 OpenCC（s2twp）轉成台灣繁體；少數字詞人工修正。每個例句的資料裡都保留 Tatoeba 句子編號，可到 tatoeba.org 查到原作者。

## Wiktionary 衍生資料（單字詞形）

- 來自 doozan 整理的 [spanish_data](https://github.com/doozan/spanish_data)（由 [Wiktionary](https://en.wiktionary.org) 內容衍生）。
- 授權：[CC BY-SA](https://creativecommons.org/licenses/by-sa/3.0/)。
- 用途：開發時檢查詞形與詞性，不在 App 內附帶原始檔。

## FrequencyWords 常用字頻

- 單字依常用程度排序，字頻來自 [FrequencyWords](https://github.com/hermitdave/FrequencyWords)（經 doozan/spanish_data 整理）。
- 授權：[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)。

## ELELex 課本詞頻

- 「課本詞表」那一層（約 240 個字）依 [ELELex](https://cental.uclouvain.be/cefrlex/elelex/)（西班牙語外語教材的詞頻表，依 CEFR 等級統計）的 A1、A2 詞頻排序。
- 授權：[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)。**不能商用**：這個 App 只能自己學習用，不能販售或放進收費服務；改作後的成果也要用相同授權分享。
- 用途：只用來挑選與排序單字，App 內不附帶原始檔。

## wordfreq 社群常用字

- 「社群」那一層（約 30 個字）與網路縮寫小詞包的門檻，使用 [wordfreq](https://github.com/rspeer/wordfreq) 的西文詞頻（混合推特、Reddit、字幕、新聞等來源，資料只到 2021 年）。
- 授權：資料 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)（程式碼 Apache 2.0）。
- 縮寫小詞包（jaja、xq、tb…）是 AI 整理的，每一個都要 wordfreq 的 zipf 值達到 3.0 才收，數值記在資料的 evidence 欄位。

## ts-fsrs 複習排程

- 單字複習的間隔排程使用 [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)（FSRS 演算法）。
- 授權：MIT。

## 中文釋義

- 單字的中文釋義是 AI 撰寫的，還沒有人逐條審過；資料裡標示為 ai。卡片翻面後可以按「回報」告訴我哪裡怪。
- 例句標了「含還沒學的時態」的，是因為找不到只用現在式的句子。
