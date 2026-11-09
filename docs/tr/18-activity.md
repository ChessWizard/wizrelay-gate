<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/18-activity.md)
<!-- /nav -->

# Kişiler, roller ve etkinlik

## Giriş

Kimse kendi kaydolmaz. İlk owner, ilk açılışta `OWNER_EMAIL` ve `OWNER_PASSWORD`
değerlerinden gelir; sonrasında bir owner ya da admin, kişiyi Claude hesabının kullandığı
e-posta ile ekler ve panelin ürettiği davet bağlantısını iletir. Bağlantı bir kez çalışır,
kişi kendi parolasını onunla belirler.

## Roller

İki tür var, çünkü iki ayrı soru yanıtlanıyor.

**Panel rolleri**, kişinin panelin kendisine ne yapabileceğini söyler:

| Rol | Yapabilir |
|---|---|
| **Owner** | Her şey; panelin adı, logosu ve kurulumu dahil. Tek bir tane vardır ve panelden devredilemez. |
| **Admin** | Hub, proje ve kişi ekler; kendi seviyesi ve altındaki rolleri atar; her projeye erişir. |
| **Üye** | Üyesi olduğu projelerde çalışır. |

**Proje rolleri**, kişinin tek bir depoda ne yapabileceğini söyler ve bir kişi ikisine de
sahip olabilir:

| Rol | Çalıştırır |
|---|---|
| **Researcher** | Araştırma hattı — alım, araştırma, paket doğrulama, yayın. |
| **Developer** | Geliştirme hattı — çekme, planlama, uygulama, doğrulama, teslim. |

Bir kapı, hattının sahibi olmayan rolü reddeder. Admin her şeyi çalıştırabilir.

## Bir soruyu kim duyar

Her projenin bir araştırma sorumlusu vardır; başlangıçta owner'dır, proje bazında
değiştirilebilir. Bir çalışma soruda durduğunda, geldiği proje ve relay ile birlikte o
kişinin gelen kutusuna düşer. Push kanalı yok: gelen kutusu sayfa açıldığında okunur.

## Bu ekranlar nerede

**Kişiler** menüde kendi sayfasıdır: panelde kim var, panel rolü ne, hangi projelerde ve
en son ne zaman giriş yapmış. Herkes okuyabilir; çünkü "bu projede başka kim var" sorusu
bir yetki gerektirmemeli.

Bunların herhangi birini değiştirmek yöneticinin işidir ve bu **Yönetim** altında olur;
orası üç sekmeli tek bir sayfadır:

| Sekme | İçeriği |
|---|---|
| **Genel** | Panelin kendi adı, açıklaması, logosu ve favicon'u. |
| **Hub'lar** | Bağlı hub'lar ve her birinin altındaki projeler. |
| **Kişiler** | Davetler, panel rolleri, kimin devre dışı bırakılabileceği ya da kaldırılabileceği. |

Üç ayrı sayfa değil sekme olmalarının nedeni hâlâ tek bir ekran olması; sekme adrestedir,
yani bir bağlantıdır, geri tuşu çalışır ve yenileme kaldığı yere düşer.

Tek bir kişinin rolleri kendi sayfasında, davetin kullandığı kontrolün aynısıyla
düzenlenir — her rol için, o rolün ne yapmaya izin verdiğini söyleyen bir kart. Eskiden
bir yerde işaret kutuları, başka bir yerde farklı görünen butonlar vardı; aynı karar iki
alakasız şey gibi duruyordu.

## Etkinlik ne tutar

Yalnızca insanların task'lara yaptıkları: bir kapı çalıştı ve nasıl bitti, bir isteme
cevap verildi, bir soru soruldu ve yanıtlandı, bir paket yayınlandı.

Giriş kayıtları, bağlanan hub'lar, role atanan kişiler burada değil. Gerçek olaylar ama
yönetime ait; aynı akışa karışınca herkesin aradığı tek şey — *"o kapıyı kim çalıştırdı
ve ne dedi"* — aralarında kaybolmuştu.

Bir kapı için tek satır yazılır ve **bittiğinde** yazılır, sonucuyla birlikte. Eskiden
düğmeye basıldığında yazılıyordu: kayıt bir kapının çalıştığını söylüyor, geçip geçmediğini
hiç söylemiyordu.

## Kimin etkinliğini görürsünüz

Paneli yönetmiyorsanız yalnızca kendinizinkini. Owner ya da admin herkesinkini görür ve
üstteki çiplerle kaydı tek bir kişiye daraltabilir — giriş yapabilen herkes değil,
gerçekten bir şey yapmış kişiler. Filtre adrestedir, yani daraltılmış kayıt bir
bağlantıdır.

Bu eskisinden dar ve bilerek öyle: başkalarının işinin akışı, bir üyenin kendi işini
yapması için gereken bir şey değildir ve denetim izi bir yöneticinin aracıdır. Erişim
kurallarının geri kalanı [Kim neyi görür](20-access.md) sayfasındadır.

## Daha geriye bakmak

En yeniden eskiye, kırkar kırkar; altta **Daha eski** düğmesi.

Sayfa numarasıyla değil cursor ile sayfalanır; çünkü kayıt okunurken yazılmaya devam eder:
biten bir kapı bütün satırları aşağı kaydırır, numaralı bir sorgunun ikinci sayfası arada
geleni atlar ve üçüncü sayfada tekrar gösterir. Cursor listedeki bir konumdur, yani
okuduğunuz okunmuş kalır. Bir sayfa geri gitmek geri tuşudur.

Kimseyi anmayan bir satır, panel çalıştıranı kaydetmeye başlamadan önce yazılmıştır. Şu an
yazılan her satır bir kişi taşır — çöken bir kapı dahil; o eskiden hiç satır bırakmıyordu.

## Bağlantılar

Her kişi kendi ClickUp ve GitHub hesabını **Bağlantılar**'dan bağlar; panel bir task
okurken ya da bir dal gönderirken o kişi adına hareket eder. Anahtarlar sunucu anahtarıyla
şifrelenir ve bir daha gösterilmez. Ortamdaki ortak `CLICKUP_API_TOKEN` veya `GITHUB_TOKEN`
ise kişi kendi bağlantısını yapmadığında devreye girer.

<!-- foot -->
← Önceki: [Sunucuda çalıştırmak](17-docker.md) · [Dokümantasyon](README.md) · Sonraki: [Kendi makinende çalıştırmak](19-agent.md) →
<!-- /foot -->
