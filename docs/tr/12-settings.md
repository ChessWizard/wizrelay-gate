<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/12-settings.md)
<!-- /nav -->

# Ayarlar, bağlantılar ve gizlilik

## Parolanız

Ayarlar → **Parolanız**. Değiştirmek için şu anki parolanız gerekir: oturum kim
olduğunuzu zaten kanıtlıyor ama açık kalmış bir ekran, sizi kendi hesabınızdan etmeye
yetmemeli.

En az 12 karakter; harf ve rakam içermeli. Değiştirdiğinizde diğer bütün oturumlarınız
kapanır, kullandığınız oturum açık kalır.

Kimse sizin yerinize değiştiremez. Owner ya da admin yalnızca yeni bir davet bağlantısı
üretebilir; bu da eski parolanızı ve açık oturumlarınızı sonlandırır — ne olduğu
görünür biçimde.

İlk owner, ortamdaki `OWNER_PASSWORD` ile başlar. O kişi kendi parolasını seçene kadar
panel bunu burada söyler ve kurulum listesinde bir madde açık tutar.

## Çalışma alanı

Hub (bağlantı, dal, yerel çalışma kopyası, tracker, rol kataloğu, son çekme) ve bağlı
depolar; rolleri, stack'leri ve test komutlarıyla.

## Yönlendirme politikası

Etkin politikanın ve nereden geldiğinin salt okunur görünümü — plugin varsayılanı ya da
hub'ın `policies/routing-policy.json` dosyası. Düzenlemesi hub'da yapılır; çünkü ekibin
politikasının yeri orasıdır.

## Görünüm

Tasarım yönü (Control Room ya da Studio), tema (açık, koyu ya da sistem) ve dil. Üçü de
çalışma alanı dosyasında saklanır; böylece sunucu ilk çizimde doğrusunu basar ve yanıp
sönme olmaz.

## Bildirimler

Bir kapı seni beklediğinde, bir soru yanıtlandığında ya da CI bittiğinde masaüstü
bildirimi. Varsayılan olarak yalnızca ilki açıktır.

## Tanılama

PATH'te `git`, `python3`, `wizrelay` ve `claude`; CLI kuruluysa ayrıca `wizrelay doctor`.
Rapor düz metin olarak kopyalanır.

## Commit ve push onayı

Panel bir commit ya da push'tan önce sorar. Bu iki adım makineden çıkar ve senin adını
taşır; varsayılan her zaman sormaktır.

Beşinci kez aynı soruyu cevaplayan kişi onay vermiyor, tıklıyor. Onay kartının yanında
**Bunu bir daha sorma** var: **bu task'ta** ya da **bütün task'larımda**. Kapattığın şey
yalnızca seni ilgilendirir — kimse senin adına kapatamaz, sen de başkasının sorusunu
kapatamazsın. Commit ile push ayrıdır.

Kapalıyken adım çalışır ama konsola kaydı düşer: *"sormadan çalıştı, senin ayarınla"*.
"Sen onayladın" ile "ayarın onayladı" farklı iki olgudur ve altı hafta sonra bunları
yalnızca döküm ayırt edebilir. Kapattıklarının hepsi bu sayfada listelenir, tek tıkla
geri alınır.

## Bağlantılar

Kendi ClickUp ve GitHub hesaplarınız, buraya kişisel bir token ile bağlanır. Panel bir
görevi okurken, depolarınızı listelerken, hub'ı okurken ya da bir pull request'e bakarken
sizin adınıza hareket eder.

Token kaydedildiği anda sunucu anahtarıyla şifrelenir ve bir daha gösterilmez — alan, bir
token'ın bağlı olup olmadığını gösterir, ne olduğunu değil. Kaldırırsanız panel, kurulumda
varsa, ortamdaki paylaşılan `GITHUB_TOKEN` ya da `CLICKUP_API_TOKEN` değerine düşer.

Sizin yerinize kimse bir şey bağlamaz. Sizin vermediğiniz bir token'la sizin adınıza
hareket eden bir panel, hesabını veremeyeceğiniz bir panel olurdu.

### GitHub token'ını üretmek

**github.com → avatarınız → Settings → Developer settings → Personal access tokens.**
İki tür var; doğru cevap fine-grained olanı.

**Fine-grained token** (*Fine-grained tokens → Generate new token*):

| Alan | Ne seçmeli |
|---|---|
| **Resource owner** | Kendi hesabınız ya da hub'ın ve proje depolarının ait olduğu organizasyon. |
| **Repository access** | *Only select repositories* — hub ve proje olarak kaydedeceğiniz her depo. *All repositories* de çalışır ve bakımı daha azdır. |
| **Repository permissions → Contents** | **Read-only.** Asıl olan bu: hub'ı ve proje depolarını okur. |
| **Repository permissions → Metadata** | **Read-only.** GitHub kendisi seçer ve kaldırmanıza izin vermez. |
| **Repository permissions → Pull requests** | **Read-only**; panelin relay'in yanında açık pull request'leri gösterebilmesi için. Kapalı bırakırsanız geri kalan her şey yine çalışır. |
| **Expiration** | Size kalmış. Süresi dolduğunda panel bunu adıyla söyler, "GitHub bağlı değil" demez. |

Başka hiçbir şey. Yazma izni yok, hesap izni yok, workflow kapsamı yok. Panel bu token'la
asla push etmez — commit ve dal işleri sizin makinenizde, sizin git kimliğinizle olur.

**Klasik token** (*Tokens (classic) → Generate new token*): yalnızca **`repo`** işaretleyin.
`repo` kabadır — okumanın yanında yazmayı da verir — fine-grained token'ın tercih edilme
sebebi tam olarak budur. Hub ve depoların hepsi public ise `public_repo` yeter.

### Depolar organizasyona aitse

İnsanları takan iki şey var ve ikisi de sorunsuz görünüp hiçbir şey görmeyen bir token
üretir:

1. Organizasyon **fine-grained personal access token'lara izin vermiş olmalı**
   (*Organisation settings → Personal access tokens*). İzin yoksa SSO ile organizasyona
   yetkilendirilmiş, `repo` kapsamlı klasik token kullanın.
2. Organizasyona karşı üretilen fine-grained bir token, çalışmadan önce bir **owner'ın
   onayını** bekliyor olabilir. O zamana kadar token vardır ve reddedilir.

Panel artık bunlardan hangisi olduğunu söylüyor: süresi dolmuş ya da iptal edilmiş token,
izni olmayan token, hiçbir depo görmeyen token ve ulaşılamayan GitHub dört ayrı mesaj;
tek bir "bağlı değil" değil.

### Organizasyon kişisel token'lara izin vermiyorsa

Birçok organizasyon fine-grained token'ları kısıtlar, bazıları tamamen reddeder. Bu listeyi
sırayla deneyin; ilk uyan cevabınızdır.

**1 · Organizasyona yetkilendirilmiş klasik token.** Olağan çıkış yolu budur, çünkü
yukarıdaki kısıt özellikle *fine-grained* token'larla ilgilidir.

*Settings → Developer settings → Tokens (classic) → Generate new token (classic)* →
**`repo`** işaretleyin → üretin. Sonra aynı token listesinde token'ı bulun ve
organizasyonun yanındaki **Configure SSO → Authorize** adımını uygulayın. Bu adım olmadan
token üretilir, kusursuz görünür ve organizasyonun hiçbir deposunu görmez.

*Configure SSO* bağlantısı yoksa organizasyon SAML kullanmıyordur; okuma yetkisiyle üye
olduğunuz anda token çalışır.

**2 · Bir owner'dan kapıyı açmasını isteyin.** Tek ayar, bir kez, herkes için:
*Organisation settings → Third-party Access → Personal access tokens → Settings*. Üç
seçenek var — izin ver, onay iste, kısıtla. **Onay iste** makul ortadır: token'lar çalışır
ve her birini önce bir owner görür. Zaten *onay iste* durumundaysa token'ınız vardır ve
bekliyordur; bir owner *Pending requests* altından onaylar.

**3 · Kendi SSH anahtarınız, panel kendi makinenizde.** Panelin git ile yaptığı her şey —
hub'ı okumak — zaten push ettiğiniz anahtarla SSH üzerinden çalışır. API'ye ihtiyaç duyan
kısımlar depo listesi ve dal açılır listesidir; token olmadan adresi elle yazarsınız,
form bunu sunar.

Tek kişilik bir kurulum için bu yeter. Sunucudaki bir panel için yetmez; onun kendine ait
bir anahtarı yoktur.

**4 · Panel için salt-okunur bir hesap.** Organizasyona hub ve proje depolarına okuma
yetkisiyle eklenmiş bir hesap, kendi klasik token'ı ve bu token'ın ortamda `GITHUB_TOKEN`
olarak verilmesi. Kendi token'ını bağlamamış herkes buna düşer.

Bunu son seçenek sayın. Yaptığı her iş bir kişiye değil o hesaba yazılır; bu panelin
kurulma sebebi tam olarak bundan kaçınmaktır.

### Token olmadan ne çalışmaya devam eder

Sandığınızdan fazlası; çünkü panel GitHub'a doğruluk için değil kolaylık için sorar:

| Çalışır | Token ister |
|---|---|
| Public hub'ı okumak; kendi makinenizde SSH ile private hub'ı okumak | Sunucuda private hub'ı okumak |
| Adresini yazarak proje eklemek | Seçeceğiniz depo listesi |
| Dal adını elle yazmak | Dal açılır listesi |
| Bütün kapılar, bütün paketler, bütün sorular | Relay'in yanında gösterilen pull request'ler |

Panel token'ınızla asla push etmez. Commit ve dal işleri, burada ne bağlı olursa olsun,
sizin makinenizde ve sizin git kimliğinizle olur.

## Gizlilik

Kendi yapılandırdığın git uzak deposu ve tracker dışında bu makineden hiçbir şey çıkmaz.
Hesap yok, sunucu yok, telemetri yok. Pano kendi durumunu `.wizrelay-gate/` içinde tutar
ve o klasörü silmek onu sıfırlar.

Tracker ve paket içeriği **veri olarak** ele alınır, **asla talimat olarak değil** — bir
task açıklaması bir asistana seslenen bir metin içeriyorsa, o metin alıntılanarak
gösterilir, uygulanmaz.

<!-- foot -->
← Önceki: [Soru döngüsü](11-questions.md) · [Dokümantasyon](README.md) · Sonraki: [Kodun düzeni](13-architecture.md) →
<!-- /foot -->
