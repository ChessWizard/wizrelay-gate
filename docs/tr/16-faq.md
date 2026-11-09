<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/16-faq.md)
<!-- /nav -->

# Sık sorulan sorular

**Bu, wizrelay plugin'inin yerine mi geçiyor?**
Hayır. Onu sürüyor. Her deterministik sonuç `wizrelay` CLI'dan gelir ve plugin terminalden
tam olarak kullanılabilir kalır.

**Claude Code kurulu olmalı mı?**
Yalnızca gerçek bir depoya karşı konuşma kapıları için. O olmadan bu kapılar yerleşik
dökümü oynatır ve konsol hangi motorun çalıştığını söyler.

**Verim nereye gidiyor?**
Hiçbir yere. Hesap yok, sunucu yok. Pano depolarını okur ve makinende `.wizrelay-gate/`
klasörünü yazar.

**Pano engellenmiş bir düzenlemeyi geçersiz kılabilir mi?**
Hayır. Bir `deny` kesindir; pano eşleşen kuralı gösterir ve soru döngüsünü işaret eder.

**Neden iki tasarım yönü?**
Çünkü aynı ürünü, bir operasyon paneli isteyenler de sakin bir belge isteyenler de
kullanıyor. Her ekranı, her bileşeni ve her metni paylaşırlar; yalnızca token'lar ve
birkaç yerleşim kararı değişir.

**Tek depoda iki rolle kullanabilir miyim?**
Henüz hayır — plugin'in kendisi v1'de depo başına tek roldür. İki rollü bir task, her biri
kendi deposunu gösteren iki teslim hattı çizer.

**`NOT COVERED` neden bir başarısızlık değil?**
Çünkü doğru. Hiçbir şeyin kanıtlamadığı bir kriter, kalan bir kriter değildir; birinin
hâlâ yazması gereken bir testtir ve rapor onun adını verir.

**Kapı ortasında tarayıcıyı kapatırsam ne olur?**
Yanıt ve olaylar diskte. Konsolu yeniden aç, günlükten tekrar oynatır; bekleyen bir kapı
hâlâ bekliyordur.

<!-- foot -->
← Önceki: [Sorun giderme](15-troubleshooting.md) · [Dokümantasyon](README.md) · Sonraki: [Sunucuda çalıştırmak](17-docker.md) →
<!-- /foot -->
