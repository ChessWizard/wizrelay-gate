<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/15-troubleshooting.md)
<!-- /nav -->

# Sorun giderme

## "wizrelay PATH'te yok, bu yüzden kapılar yerleşik dökümle çalışıyor"

CLI kurulu değil. Kapılar yine de çalışır — deterministik bir döküm oynatırlar — ama
depolarına hiçbir şey dokunmaz. Kurmak için:

```bash
pip install "git+https://github.com/ChessWizard/wizrelay@main"
```

## Konsol "Bu kapı henüz başlamadı" diyor

Kapının henüz olayı yok. Çalıştırma ekranında **Bu kapıyı başlat**'a bas ya da yazma
alanından bir mesaj gönder. `Seni bekliyor` durumundaki bir kapının zaten bir istemi
vardır — yanıtla, kapı oradan devam eder.

## Hub bağlanmıyor

| Ne diyor | Ne demek |
|---|---|
| *Bu depoda `wizrelay-hub.json` yok* | klasör bir git deposu ama hub değil; `wizrelay hub init` ile oluştur |
| *Erişim yok* | git onu kimlik bilgilerinle okuyamadı — SSH anahtarı ekle ya da kimlik yardımcınla giriş yap |
| *URL'de kimlik bilgisi var* | bilerek reddedilir; SSH ya da kimlik yardımcısı kullan |

## Hub bağladım ama pano hâlâ örnek çalışma alanını gösteriyor

Hub bağlamak çalışma alanını `live` yapar; ama SSH ile ulaşılan bir hub yalnızca listelenir,
okunmaz: onu yerele klonla ve hub'ı o klasöre yönlendir ki pano `tasks/*/task.json`
dosyalarını okuyabilsin.

## Yükseltmeden sonra örnek veri bozuk görünüyor

Ayarlar → Tanılama → **Örnek çalışma alanını sıfırla** onu yeniden yazar.

## Kapsam koruması aktif değil

Bant, plugin'in kontrol ettiği üç nedeni sayar: `wizrelay` manifest adını kullanan başka
bir plugin, kapalı hook'lar ya da güvenilmemiş bir klasör. O depoda `/wizrelay:doctor`
çalıştır.

## Konsolda hiçbir şey akmıyor

Akış, Node çalışma zamanını ve doğrudan bir bağlantıyı gerektirir. Yanıtları tamponlayan
bir proxy'nin arkasında sunucu olayları tek seferde en sonda gelir; pano
`x-accel-buffering: no` başlığını gönderir ve çoğu proxy buna uyar.

<!-- foot -->
← Önceki: [wizrelay-gate üzerinde çalışmak](14-development.md) · [Dokümantasyon](README.md) · Sonraki: [Sık sorulan sorular](16-faq.md) →
<!-- /foot -->
