<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/07-prompts.md)
<!-- /nav -->

# Kapı istemleri ve onaylar

Kapı istemi, pipeline'ın durup bir insana ihtiyaç duyduğu andır. Beş türü vardır ve tek
bir sözleşmeyi paylaşırlar: kapısını söyle, tek cümleyle sor, her yanıtın neye yol
açacağını belirt, hiçbir şeyi önceden seçme.

## Karar

Claude seçenekler sunar. Her biri ne anlama geldiğini ve yanlış olmanın bedelini söyler;
biri her zaman "Bilmiyorum — Researcher'a sor"dur ve bu, karar uydurmak yerine soru
döngüsünü açar.

## Metin

Serbest metin; gideceği yer adıyla belirtilir — bir changelog özeti, `sync` çalıştıran her
geliştiricinin bu satırı okuyacağını söyler.

## Onay

Push, tracker yorumu, pull request. Bunlar dışarı dönük eylemlerdir, bu yüzden kart
**içeriğin tamamını** gösterir: tam komut, tam yorum metni, uzak depo ve dal. Bir onay,
onay kelimesinin yazılmasını ister, başka bir onayla asla birleştirilmez ve her zaman
"Komutu kopyala, kendim çalıştırayım" seçeneği sunar.

## Kapsam izni

Plugin'in `ask` modundan gelir: dosya, kapsam içi glob'lar ve üç yanıt — bir kez izin ver,
reddet ya da Researcher'a sor. Her yanıt sonrasında ne olacağını söyler.

Bir `deny` **istem değildir**. Panodan geçersiz kılınamaz. Eşleşen kural ve ileri yolla
birlikte bir bilgi kartı olarak gösterilir:

> `app/billing/invoice.py`, `CU-86c1abcd` kapsamı tarafından açıkça yasaklanmış
> (`app/billing/**` kalıbı). `/wizrelay:ask` ile sor; yanıt yeni bir paket sürümü olarak
> gelir.

## Ek dosya

Claude bir ekran görüntüsü, diyagram ya da dışa aktarılmış bir belge ister; paket
sınırları gözünün önünde durur: dosya başına 5 MB, paket başına 20 MB, sembolik bağlantı
yok.

## Bir yanıta ne olur

Yanıt önce kaydedilir — relay'e ve kapının olay günlüğüne — ve kapı ancak ondan sonra
devam eder. Bu sıra bilinçlidir: bir yanıt çökmeden, yeniden başlatmadan ya da soru ile
sonraki olay arasında tarayıcının kapanmasından sağ çıkmalıdır.

<!-- foot -->
← Önceki: [Çalıştırma ve konsolu](06-run-and-console.md) · [Dokümantasyon](README.md) · Sonraki: [Model ve effort yönlendirmesi](08-routing.md) →
<!-- /foot -->
