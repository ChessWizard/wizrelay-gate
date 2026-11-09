<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/21-walkthrough.md)
<!-- /nav -->

# Baştan sona kurulum

Boş bir makineden çalışan bir panele kadar her adım, sırayla. Her başlık bir kere
yapılır; bir daha dönmeniz gerekmez.

Bir yerde takılırsanız o adımın altındaki **"Ters giderse"** kutusuna bakın — oradakilerin
hepsi gerçekten başımıza gelmiş şeyler.

---

## 0 · Önce karar: kapılar nerede çalışacak

Bu, altındaki her şeyi belirler.

| Seçenek | Ne demek | Kime uygun |
|---|---|---|
| **agent** (önerilen) | Panel hiçbir şey çalıştırmaz. Herkes kendi makinesinde bir ajan çalıştırır; kapılar kişinin kendi checkout'unda, kendi git kimliğiyle, kendi Claude oturumuyla koşar. | Ekip |
| **local** | Panel kapıları kendi makinesinde çalıştırır. | Tek kişi |
| **auto** (varsayılan) | Eşleşmiş makine varsa oraya, yoksa panelin makinesine. | Denemek için |

Ekip paneli için `agent` seçin: sunucuda ne depo, ne SSH anahtarı, ne Claude oturumu
tutulur ve hiçbir commit başkası adına atılmaz.

---

## 1 · Paneli ayağa kaldırın

Tek container kurulumun tamamıdır; imaj kendi PostgreSQL'ini taşır.

```bash
docker run -d --name wizrelay-gate \
  -p 3100:3100 \
  -v wizrelay-gate-data:/data \
  -e OWNER_EMAIL=siz@sirket.com \
  -e OWNER_PASSWORD='uzun-bir-parola' \
  -e WIZRELAY_GATE_EXECUTION=agent \
  wizrelay/gate:beta
```

`http://localhost:3100` açılır. `OWNER_EMAIL` ile girersiniz; o hesap panelin tek
owner'ıdır.

`AUTH_SECRET` vermezseniz container kendisi üretip birime yazar — oturumlar yeniden
başlatmayı atlatır. Kendi PostgreSQL'inizi kullanacaksanız `DATABASE_URL` verin, gömülü
olan hiç başlatılmaz. Ayrıntılar: [Sunucuda çalıştırmak](17-docker.md).

> **Ters giderse.** `docker logs wizrelay-gate` ilk açılışta veritabanını hazırlar;
> healthcheck'in 60 saniyelik başlangıç payı vardır. `/api/health` veritabanını, imza
> anahtarını ve `git`, `python3`, `wizrelay`, `claude` komutlarının bulunup bulunmadığını
> söyler.

---

## 2 · GitHub token'ınızı üretin

Panel depolarınızı listelerken, hub'ı okurken ve pull request'leri gösterirken **sizin
adınıza** hareket eder. Token kişiseldir; panelde sunucu anahtarıyla şifrelenir ve bir
daha gösterilmez.

**github.com → avatarınız → Settings → Developer settings → Personal access tokens**

### Fine-grained token (tercih edilen)

*Fine-grained tokens → Generate new token*

| Alan | Seçim |
|---|---|
| **Resource owner** | Hub ve proje depolarının sahibi olan hesap ya da organizasyon |
| **Repository access** | *Only select repositories* → hub + proje olarak ekleyeceğiniz depolar |
| **Contents** | **Read-only** — hub'ı ve depo içeriğini okur |
| **Metadata** | **Read-only** — GitHub kendisi seçer, kaldıramazsınız |
| **Pull requests** | **Read-only** — relay yanında PR göstermek için; kapalı bırakılabilir |

Başka hiçbir izin yok. Yazma yok, workflow yok, hesap izni yok. **Panel bu token'la asla
push etmez** — commit ve dal işleri sizin makinenizde, sizin git kimliğinizle olur.

### Klasik token

*Tokens (classic) → Generate new token (classic)* → yalnızca **`repo`**.

Organizasyon SAML kullanıyorsa token listesinde o token'ın yanındaki
**Configure SSO → Authorize** adımını uygulayın. Bu adım atlanırsa token üretilir,
kusursuz görünür ve organizasyonun **hiçbir deposunu görmez**.

> **Ters giderse.** Organizasyon fine-grained token'lara izin vermiyorsa, ya bir owner
> *Organisation settings → Third-party Access → Personal access tokens* altından açar, ya
> da SSO ile yetkilendirilmiş klasik token kullanırsınız. Fine-grained token bir owner
> onayı bekliyorsa token vardır ve reddedilir — yeni token üretmeyin, onay bekleyin.
> Panel hangisi olduğunu adıyla söyler. Tamamı:
> [Ayarlar ve bağlantılar](12-settings.md).

### Panele girin

**Ayarlar → Bağlantılar → GitHub** → token'ı yapıştırın → Bağla.

Kartın altında hangi izinlerin gerektiği yazılıdır. Aynı yerde **ClickUp** token'ını da
bağlayın (*app.clickup.com → Settings → Apps → API Token*): panel görevi okur, soruları
kart yorumu olarak bırakır ve yanıtları geri getirir.

---

## 3 · Hub'ı bağlayın

**Yönetim → Hub'lar → Hub ekle** → hub deposunun adresi.

Panel `wizrelay-hub.json` dosyasını okur; hub'ın adını, tracker'ını ve rol kataloğunu
oradan alır. İçinde kimlik bilgisi olan URL reddedilir.

Aynı ekranda:

- **Dal** — paketlerin okunacağı dal. Normalde `master` ya da `main`. Değiştirirseniz
  panelin gördüğü bütün paketler değişir; o dalda olmayan görevler panodan kaybolur.
- **Tracker** ve **Task id öneki** — `clickup` ve `CU-` gibi.
- **Bu makinedeki kopya** — panel ile aynı makinede bir checkout varsa. Tek kişilik
  kurulumda doldurun; ekip panelinde boş bırakın.

> **Ters giderse.** Boş bırakılırsa panel kendi **okuma aynasını** klonlar. Ayna her
> tazelemede `git reset --hard` ile sıfırlanır, bu yüzden hub'a **yazan** kapılar aynada
> çalışmaz ve panel bunu söyleyerek reddeder. Ekip panelinde doğrusu budur: yazma işi
> kişinin kendi makinesinde olur.

---

## 4 · Projeleri ekleyin

Her hub rolü bir depoya karşılık gelir. **Yönetim → Hub'lar → Depo**.

GitHub token'ınızın gördüğü depolar listelenir; arayın, seçin, rol verin. Panel hiçbir şey
klonlamaz — depoyu kaydeder, kapıyı çalıştıran makine zaten ona sahiptir.

Liste gelmiyorsa altındaki **Depoyu elle gir** ile klon adresini yapıştırabilirsiniz;
adres doğrulanır.

Rol, deponun kendi `.wizrelay/config.json` dosyasından gelir; açılır liste yedek yoldur.
Her projeye bir **araştırma sorumlusu** atayın: adreslenmemiş sorular ona düşer.

---

## 5 · Kişileri davet edin

**Yönetim → Kişiler → Davet oluştur**

Adres, panel rolü ve **proje bazında** roller tek adımda belirlenir:

- **Researcher** — araştırma kapılarını çalıştırır, paketi yazar
- **Developer** — planı uygular, teslim kapılarını çalıştırır

Bir kişi ikisi birden olabilir. Hiçbiri işaretlenmezse o projeye erişimi olmaz — ve bu
çoğu zaman doğru cevaptır. Panel bir davet bağlantısı üretir; onu siz iletirsiniz, tek
kullanımlıktır, kişi parolasını kendisi belirler.

Kimin neyi görebildiğinin tamamı: [Kim neyi görür](20-access.md).

---

## 6 · Herkes kendi makinesini bağlasın

Bu adımı panelde çalışacak **her kişi kendi makinesinde** yapar.

### 6.1 · Ajanı indirin ve eşleştirin

Panelde **Ayarlar → Bağlantılar → Makineler → Eşleştirme kodu al**. Kod 8 karakterdir,
tek kullanımlıktır ve kısa ömürlüdür.

```bash
curl -fsSL https://panel.sirket.com/agent -o /tmp/wizrelay-agent.mjs
node /tmp/wizrelay-agent.mjs pair ABCD-2345 --panel https://panel.sirket.com
```

Panel bir **makine token'ı** üretir, ajan onu `~/.wizrelay-gate/agent.json` dosyasına
yazar ve kendini `~/.wizrelay-gate/wizrelay-agent.mjs` yoluna kopyalar. Bu token yalnızca
panel ile makineniz arasında anlamlıdır; Claude'a, GitHub'a, ClickUp'a geçmez.

### 6.2 · Çalışma kopyalarını tanıtın

```bash
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/arastirma-hub --role hub
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/api  --role api
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/web
```

`--role` verilmezse deponun kendi `.wizrelay/config.json` dosyasından okunur.
**`hub` özel bir isimdir**: araştırma kapılarının hepsi hub checkout'unun içinde çalışır,
dolayısıyla araştırma yapacaksanız bu satır şart.

Kontrol:

```bash
node ~/.wizrelay-gate/wizrelay-agent.mjs repos
```

### 6.3 · Ajanı çalıştırın

```bash
node ~/.wizrelay-gate/wizrelay-agent.mjs run
```

Açılışta bütün klasörleri listeler ve iş beklemeye başlar. Panelde **Makineler** kartında
çevrimiçi görünmelidir.

> **Ters giderse.**
>
> **"outside every folder this machine offers"** — ajan ayar dosyasını her işte tazeler,
> ama **1.1.0'dan eski** bir sürüm açılışta bir kez okur. Ayrıca makinede birden fazla
> ajan çalışıyorsa işi hangisi önce kaparsa o alır ve eskisi reddeder. 1.2.0'dan beri
> ikinci bir kopya başlayamaz; `ps aux | grep wizrelay-agent` ile bakın ve eskileri
> kapatın.
>
> **`check.binaryMissing`** — ajan bir terminalden başlatılır ama ondan uzun yaşar:
> shell'inizin kurduğu PATH'i almaz. Üstelik `wizrelay` komutunu Claude Code yalnızca
> kendi araçlarının PATH'ine ekler. Sabitleyin:
> ```bash
> node ~/.wizrelay-gate/wizrelay-agent.mjs use wizrelay ~/.claude/plugins/cache/wizrelay/wizrelay/<sürüm>/bin/wizrelay
> node ~/.wizrelay-gate/wizrelay-agent.mjs status
> ```
> Plugin'i güncelledikten sonra bu yolu yenileyin.

### 6.4 · wizrelay CLI'ını kontrol edin

```bash
which -a wizrelay
```

**Birden fazla sonuç çıkıyorsa dikkat.** `wizrelay` hem bir Claude Code plugin'i hem de
pip ile kurulabilir bir pakettir ve pip dağıtımı yalnızca kütüphaneyi taşır — tracker
kataloğu ve şablonlar dışarıda kalır. O kopya PATH'te önce gelirse kapılar aracın
derinliklerinde patlar:

```
Unknown tracker type 'clickup'.
  Fix: Use one of: none.
```

Hub'ın ayarında yanlış bir şey yoktur. Çözüm:

```bash
pip uninstall wizrelay       # CLI'ı plugin sağlar
```

### 6.5 · Claude izinlerini verin

Kapılar `claude` komutunu **sizin makinenizde, sizin oturumunuzla** çalıştırır. Panel
Claude hesabınıza erişmez; yalnızca koşuyu adınızla damgalamak için `~/.claude.json`
içindeki e-postayı okur.

Headless bir oturum izin soramaz, dolayısıyla reddedilen bir araç sessizce reddedilmiş
kalır. Araştırma kapısının tracker görevini okuyabilmesi için izinleri kalıcı verin —
`~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__claude_ai_ClickUp__clickup_get_task",
      "mcp__claude_ai_ClickUp__clickup_get_task_comments"
    ]
  }
}
```

---

## 7 · İlk görevi çalıştırın

**Relay'ler → Yeni relay**: tracker referansı, başlık, roller.

Sonra sırayla: **Alım → Araştırma → Paket doğrulama → Yayın**. Her kapı tek tek
çalıştırılabilir ya da hattın tamamı bir kerede.

Alım, görev adına bir dal açar (`research/<id>-<slug>`) ve paketi oraya yazar. Yayın o
dala gönderir; hub'ın ana dalına çıkış teslim sırasında, sizin onayınızla olur.

Paket sayfasından (`/package/<id>`) dosyaları okuyabilir, **Düzenle** ile elle
değiştirebilir ya da tek satırlık bir talimatla Claude'a düzelttirebilirsiniz.

> **Ters giderse.** Bir kapı, öncekinin geçmesini bekler ve bunu söyler. Eski bir kapıyı
> yeniden çalıştırırsanız sonrasındaki bütün kapılar sıfırlanır — verdiktleri artık var
> olmayan bir iş hakkındaydı. Ayrıntı: [Dokuz kapı](04-gates.md).

---

## Kontrol listesi

- [ ] Panel ayakta, `/api/health` dört aracı da görüyor
- [ ] GitHub ve ClickUp token'ları **her kişi için** bağlı
- [ ] Hub bağlı, dal ve tracker doğru
- [ ] Her hub rolü için bir depo kayıtlı, araştırma sorumlusu atanmış
- [ ] Kişiler davet edilmiş, proje rolleri verilmiş
- [ ] Her makinede ajan eşleşmiş, `hub` dahil kopyalar tanıtılmış, ajan çalışıyor
- [ ] `which -a wizrelay` tek sonuç veriyor
- [ ] Claude araç izinleri kalıcı verilmiş

<!-- foot -->
← Önceki: [Kim neyi görür](20-access.md) · [Dokümantasyon](README.md)
<!-- /foot -->
