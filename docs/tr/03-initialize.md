<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/03-initialize.md)
<!-- /nav -->

# Paneli kurmak

Giriş yapan ilk kişi owner'dır; ilk açılışta `OWNER_EMAIL` ve `OWNER_PASSWORD`
değerlerinden oluşturulur. Doğrudan **Paneli kur** ekranına gelir; bu dört adımdır.

## 1 · Panel

Bu kurulumun gösterdiği ad, logo ve favicon. Varsayılanları `PANEL_NAME`,
`PANEL_LOGO_URL` ve `PANEL_FAVICON_URL`'dir; burada girilen onları ezer.

## 2 · Hub

Hub repo bağlantısını yapıştırın ya da sunucuda hazır bir çalışma kopyasını gösterin.
Panel `wizrelay-hub.json`'dan hub'ın adını, tracker'ını ve rol kataloğunu okur ve
paketlerin okunabilmesi için klonlar. İçinde kimlik bilgisi olan URL reddedilir.

Bir ekip birden fazla hub bağlayabilir; üst çubuktaki anahtar aralarında geçiş yapar.

## 3 · Projeler

Her hub rolü için bir depo; **GitHub token'ınızın** gördüğü depolar arasından seçilir.
Token'ı [Ayarlar → Bağlantılar](12-settings.md) altından bağlayın, liste kendiliğinden
dolar; arayın, birini seçin, rol verin.

Eskiden bunun üç yolu vardı — panelin makinesinde bir klasör seçmek, bir klon URL'si
yapıştırmak ya da bir agent'ın klonlaması için URL yazmak. Paylaşılan bir panelde
birincisi hiçbir kapının dokunmadığı bir dosya sistemini tarif eder, çünkü iş insanların
kendi makinelerinde olur; diğer ikisi de birinin başka bir yerden doğru kopyalaması
gereken bir satırdır. Panel burada hiçbir şey klonlamaz: depoyu kaydeder, kapıyı çalıştıran
makine zaten o depoya sahiptir.

Rol, deponun kendi `.wizrelay/config.json` dosyasından gelir; açılır liste yalnızca yedek
yoldur. Her proje bir araştırma sorumlusu alır; başlangıçta owner'dır ve adreslenmemiş bir
soru ona düşer — [Soru döngüsü](11-questions.md) sayfasına bakın.

## 4 · Kişiler

Burada çalışacak kişileri Claude hesaplarının kullandığı e-posta ile ekleyin ve panelin
ürettiği davet bağlantısını iletin. Her birine, çalıştıkları projelerde Researcher ya da
Developer verin — bkz. [Kişiler, roller ve etkinlik](18-activity.md).

## Bitirmek

**Kurulumu bitir**, paneli herkese açar. O ana kadar giriş yapan başka biri, panelin hâlâ
kurulmakta olduğunu görür.

<!-- foot -->
← Önceki: [Kurulum ve çalıştırma](02-install.md) · [Dokümantasyon](README.md) · Sonraki: [Dokuz task kalite kapısı](04-gates.md) →
<!-- /foot -->
