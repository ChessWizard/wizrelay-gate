<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/05-board.md)
<!-- /nav -->

# Relay panosu

Uygulamanın açıldığı ekran ve "beni ne bekliyor?" sorusunu iki saniyenin altında yanıtlayan ekran.

## Seni bekleyenler

Her açık kapı istemi, en eskisi önce; her biri relay'i, kapıyı, tek satırlık soruyu ve bir
giriş yolunu taşır. Bu bölüm her şeyin üstündedir ve uygulamanın açılma sebebidir.

## Metrikler

Üç kart — bugün harekete geçeceğiniz sayılar:

| Kart | Sayı nereden geliyor |
|---|---|
| **Seni bekleyenler** | açık kapı istemleri |
| **Kalan kapılar** | sonucu `FAIL` olan kapılar |
| **Açık sorular** | durumu `OPEN` olan `Q-nnn` kayıtları ve en eskisinin yaşı |

Altlarında, tek satırda, saatlik değil haftalık okunacak sayılar: biten doğrulama
kapılarının PASS / PARTIAL / FAIL dağılımı, bir düzenlemenin yasaklandığı koruma olayları
ve bir istemin yanıt için beklediği ortanca süre.

Maliyet tahmini, verimlilik puanı ve ekip geneli analitik yok: toplayacak bir sunucu yok
ve kimsenin üzerine hareket edemeyeceği bir sayı gürültüdür.

## Çalışma alanı hazırlığı

Eksik bir şey olduğu sürece — hub yok, depo yok, CLI kurulu değil — relay'lerin üstünde
neyin eksik olduğunu ve nereden düzeltileceğini söyleyen bir kontrol listesi durur. Her
şey hazır olduğunda panodan kaybolur; [Ayarlar](12-settings.md) sayfasında her zaman
durur.

## Arama ve relay listesi

Üst çubuktaki kutu (`⌘K`) hub'daki bütün görevlerin listesi olan **Relay'ler** sayfasını
açar ve adrese yazar — yani arama gönderilebilir bir bağlantıdır ve geri tuşu çalışır.

Eskiden panoyu yerinde daraltıyordu; bu da aramaya ait bir sayfa bırakmıyordu: daha fazla
daraltacak bir yer yok, başkasına gösterecek bir şey yok. Pano hattı gösterir; relay
listesi bir şeye bakılacak yerdir.

Serbest metin relay kimliğini, başlığını, tracker referansını ve rollerini eşler; Türkçe
için katlanmış olarak — `isa`, `İsa`yı bulur. Terimler daha da daraltır ve birleşebilir:

| Terim | Tuttuğu |
|---|---|
| `needs:me` | açık istemi olan relay'ler |
| `status:failed` | o durumda bir kapısı olan relay'ler — yalnızca güncel kapı değil |
| `role:backend` | o role dağılan relay'ler |
| `gate:verify` | o kapıya sahip relay'ler |

Listenin tanımadığı bir kelime düşürülmez, serbest metin olarak kalır; böylece
`http://localhost:3100` tam olarak o aranır.

Relay listesindeki filtre satırları aynı terimleri aynı sorguya yazar; bu yüzden çipler
ile kutu asla birbiriyle çelişemez. Pano, her gün filtrelediğiniz şeyler için kendi üç
çipini korur.

İki liste de yalnızca görebildiğiniz görevleri gösterir —
[Kim neyi görür](20-access.md) sayfasına bakın.

## Relay listesi

**Akış görünümü** (varsayılan): relay başına bir kart. Dokuz kapı bir adım dizisidir —
her biri bir nokta, tek kelime, canlı adıma giren bağlantı akar — araştırma hattı kendi
satırında, altında rol başına bir satır. Bir adımın sonucu ipucu metnidir; kelimeler bir
tık ötede, kapının konsolunda durur.

**Tablo görünümü**: relay *ve rol* başına bir satır; ekrana sığmayacak kadar çok relay
olduğunda.

Bir şey çalıştığı sürece pano kendini birkaç saniyede bir tazeler ve bunu **Canlı**
etiketiyle söyler. Boştaki bir pano hiç istek atmaz.

## Paketi panelden yazmak

Paketteki her `.md` dosyasının, Okunur ve Kaynak'ın yanında bir **Düzenle** görünümü var:
düz bir metin alanı, Kaydet ve Vazgeç, ve kaydedilmemiş değişiklik olduğunu söyleyen bir
rozet. Dosyayı diske yazar — araştırmacının yarısı için hub kopyasına, developer'ın yarısı
için depo kopyasına. Yayınlamak hâlâ publish kapısının işi; kaydetmek yalnızca kaydetmek.

Metin alanı bilerek böyle. Bu metin, başkasının Markdown olarak okuyacağı bir dosyaya
gider; metni sahiplenen bir editör onun hakkında sessizce kararlar verirdi.

Üç şey reddedilir ve panel hangisi olduğunu söyler:

| Reddedilen | Neden |
|---|---|
| Paket klasörünün dışına çıkan yol | `path` tarayıcıdan gelir ve panel, ev dizini ve SSH anahtarı olan bir kullanıcı olarak çalışır |
| `task.json`, `.validation.md`, `.lock.json` | bunları bir araç yazar; elle düzenlenirse araç kendi çıktısıyla çelişir |
| Paketin diğer yarısı | araştırmayı researcher; planı, soruları ve doğrulamayı developer yazar |

Paneli yönetenler iki yarıyı da yazabilir.

### Claude ile düzenlemek

Dosyanın altında tek satırlık bir talimat kutusu var — *AC-3'e bir doğrulama komutu ekle*
gibi. **Araştırma kapısını**, o dosyayı adıyla anarak ve talimatınızı ekleyerek başlatır
ve sizi konsoluna götürür.

İkinci bir oturum türü değil de araştırma kapısı olması bilinçli: iş böylece diğer bütün
kapılarla aynı kapsam korumasının, aynı onayların ve aynı dökümün altında olur — kimsenin
denetleyemeyeceği bir yan kanalda değil.

<!-- foot -->
← Önceki: [Dokuz task kalite kapısı](04-gates.md) · [Dokümantasyon](README.md) · Sonraki: [Çalıştırma ve konsolu](06-run-and-console.md) →
<!-- /foot -->
