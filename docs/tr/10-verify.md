<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/10-verify.md)
<!-- /nav -->

# Doğrulama raporu

Doğrulamayı, dosya düzenleyemeyen bir ajan yapar; böylece aşağı akıştaki kimse bir testin
geçmesi için kodun değiştirilip değiştirilmediğini merak etmek zorunda kalmaz.

## Her kriter, kanıtıyla

Her kabul kriteri bir sonuç ve onu kanıtlayan komutu alır:

| Sonuç | Anlamı |
|---|---|
| `PASS` | doğrulama komutu çalıştı ve geçti |
| `FAIL` | çalıştı ve kaldı |
| `NOT COVERED` | depoda bunu kanıtlayan hiçbir şey yok |

`NOT COVERED` birinci sınıf bir sonuçtur ve kendi nötr kaydında çizilir. Bir başarısızlık
değildir — genelde rapordaki en yararlı satırdır ve onu kapatacak testin adını verir.

## Genel sonuç

| Sonuç | Kural |
|---|---|
| `PASS` | ilgili her kriter geçer, tüm test paketi geçer, denetim temizdir |
| `PARTIAL` | kapsanan her şey geçer ama denetim ihlal buldu ya da bir kriter `NOT COVERED` |
| `FAIL` | herhangi bir kriter kaldı ya da tüm paket kaldı |

Ekran bu sonucu üreten kuralı açıkça yazar ve testler ne kadar iyi geçerse geçsin herhangi
bir kapsam ihlalinin sonucu `PARTIAL` ile sınırladığını söyler.

## Tracker yorumu

Rapor, plugin'in göndereceği yorumla biter:

```
[WIZRELAY-VERIFY] CU-86c1abcd — backend — PARTIAL
```

Bu bir yan etki değil, bir onaydır: metin tamamıyla gösterilir ve sen onaylamadan hiçbir
şey gönderilmez.

<!-- foot -->
← Önceki: [Kapsam koruması ve denetim](09-scope-and-audit.md) · [Dokümantasyon](README.md) · Sonraki: [Soru döngüsü](11-questions.md) →
<!-- /foot -->
