<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/09-scope-and-audit.md)
<!-- /nav -->

# Kapsam koruması ve denetim

Plugin kapsamı beş katmanda korur. Pano bu katmanların neye karar verdiğini gösterir;
kendisi hiçbir şeye karar vermez.

## Denetim ne raporlar

`wizrelay audit --format json` dört liste ve bir bütünlük kontrolüyle yanıt verir:

| | |
|---|---|
| **Kapsam içi** | rolün `allow` glob'larının kapsadığı değişmiş yollar |
| **Kapsam dışı** | hiçbir şeyin kapsamadığı değişmiş yollar |
| **Açıkça yasaklanmış** | bir `deny` glob'unun eşleştiği yollar, glob ile birlikte |
| **Yan ürün** | ihlal sayılmayan kurulum yan etkileri |
| **Bütünlük** | değişmiş, kaybolmuş ya da kilitte olmayan kilitli researcher dosyaları |

Sonuç cümlesi plugin'in kendi cümlesidir: *İhlal yok. Değişen 13 yolun tamamı
açıklanabilir.*

## Koruma olayları

Uygulama sırasında `PreToolUse` hook'unun ürettiği her `deny` ve her `ask`; dosya,
eşleşen kural ve kişinin ne yaptığıyla birlikte. İki gün sonra bir `PARTIAL` doğrulamayı
açıklayan zaman çizelgesi budur.

## Koruma aktif değilken

Hook'lar bir oturumda çalışmadıysa — aynı manifest adını kullanan başka bir plugin,
`disableAllHooks`, güvenilmemiş bir klasör — pano kalıcı bir bant gösterir. Kapsam
korumasının **sessizce** başarısız olması, bütün ürünün var olma sebebi olan hatadır; bu
yüzden bant oturum boyunca kapatılamaz ve üç olası nedeni sayar.

## Panonun yapamadığı

Bir `deny`'ı geçersiz kılamaz. Bir kapsamı genişletemez. İkisi de researcher'ın kararıdır
ve onlara ulaşmanın yolu soru döngüsüdür.

<!-- foot -->
← Önceki: [Model ve effort yönlendirmesi](08-routing.md) · [Dokümantasyon](README.md) · Sonraki: [Doğrulama raporu](10-verify.md) →
<!-- /foot -->
