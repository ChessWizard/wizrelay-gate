<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/19-agent.md)
<!-- /nav -->

# Kendi makinende çalıştırmak

Panel bir sunucuda durur, komutlar senin makinende çalışır.

Panelin iki hâli var. Kendi dizüstünde çalıştırdığında panel zaten o makinedir: depolar
orada, git kimliğin orada, Claude oturumun orada. Paneli ekibin ortak eriştiği bir makineye
aldığında bunların hiçbiri orada değil — ve oraya taşımak, bir sunucuya herkesin
kimliğini vermek demek.

Bu yüzden ortak panel hiçbir şey çalıştırmaz. **Sorar.** Kendi makinende küçük bir ajan
çalışır; panele kendisi bağlanır, sana ait bir iş gelince onu senin çalışma kopyanda, senin
araçlarınla çalıştırır ve çıktıyı geri yollar. Ekip panelde herkesin ilerlemesini görür;
kod kimsenin sunucusuna gitmez.

## Üç özellik bilerek böyle

- **Bağlantıyı ajan kurar.** Makinende hiçbir port açılmaz, hiçbir şey dinlemez. NAT
  arkasından, VPN'den ya da kurumsal güvenlik duvarının ardından çalışır.
- **İzin listesi komutun çalıştığı yerde uygulanır**, yalnızca planlandığı yerde değil.
  Ele geçirilmiş bir panel bile makinene `curl` çalıştıramaz.
- **Bir iş, ajanın kendi tanıttığı bir klasörü adlandırır.** Panel senin seçmediğin hiçbir
  klasöre uzanamaz.

## Kurulum

### 1 — Makineyi eşle

Ajanı panelin kendisinden indir. npm'de bir paket yok ve olmamalı: yayımlanmış bir ajan,
konuştuğu panelden ayrışırdı ve her kurulumun hangi makinede hangi sürümün olduğunu
dert etmesi gerekirdi. Panelden indirince ikisi tanım gereği aynı sürüm olur.

```
curl -fsSL https://panel.ornek.com/agent -o /tmp/wizrelay-agent.mjs
```

Sonra panelde sağ üstteki avatardan **Bağlantılar** → **Bu makine** → **Makine eşle**.
Sekiz karakterlik bir kod çıkar; on dakika ve tek kullanımlık.

```
node /tmp/wizrelay-agent.mjs pair ABCD-2345 --panel https://panel.ornek.com
```

Eşleme başarılı olunca ajan kendini `~/.wizrelay-gate/wizrelay-agent.mjs` yoluna kopyalar,
böylece bundan sonraki her komutun tek ve sabit bir yolu olur. İndirdiğin geçici dosyayı
silebilirsin.

Kod bir jeton satın alır. Jeton `~/.wizrelay-gate/agent.json` içinde, `chmod 600` olarak
durur; panelde yalnızca HMAC'i tutulur, yani geri okunamaz. Kaybedersen yeniden eşlersin.

### 2 — Çalışma kopyalarını tanıt

Her rol için bir kez. Depo `wizrelay init` görmüşse rolünü kendisi söyler:

```
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/web
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/api --role api
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/research-hub --role hub
```

Araştırma kapıları `hub` rolündeki kopyada, geliştirme kapıları kendi rolünün kopyasında
çalışır. Tanıtmadığın bir klasörde hiçbir şey çalışmaz.

### 3 — Ajanı çalışır bırak

```
node ~/.wizrelay-gate/wizrelay-agent.mjs run
```

Her çalıştırdığı komutu önce yazar. Ne yaptığını görmek için başka bir yere bakman
gerekmez.

```
14:13:28 run git rev-parse --abbrev-ref HEAD  in ~/Repos/web
14:13:28 ok 1s
14:13:32 refused git log -1  in /etc — outside every folder this machine offers: /etc
```

`run --dry-run` ile hiçbir komut başlatılmaz, hepsi reddedilmiş olarak raporlanır: protokolü
denemek için.

## Ajan hangi programı çalıştırır

Ajan terminalden başlatılır ama o terminalden uzun yaşar, ve senin kabuğunun kurduğu
PATH'i almaz: nvm yok, pyenv yok, direnv yok. Daha kötüsü, PATH bir ismi **yanlış kopyaya**
çözebilir.

Gerçek bir örnek: `wizrelay` hem bir Claude Code plugin'i hem de pip ile kurulabilen bir
paket. pip kurulumu PATH'te önce geliyorsa, plugin'in eksiksiz kurulumunu eksik bir
kopyayla gölgeler ve kapı, aracın kendi içinde anlaşılmaz bir hatayla düşer:

```
wizrelay pull CU-86c1abcd
The template directory is missing from this installation.
```

Hangi kopyanın kullanıldığını `status` söyler:

```
node ~/.wizrelay-gate/wizrelay-agent.mjs status
```

```
  wizrelay   found /Library/Frameworks/Python.framework/Versions/3.12/bin/wizrelay
  git        found /opt/homebrew/bin/git
```

Doğrusunu sabitlemek için:

```
node ~/.wizrelay-gate/wizrelay-agent.mjs use wizrelay ~/.claude/plugins/cache/wizrelay/wizrelay/0.1.0/bin/wizrelay
```

```
  wizrelay   found ~/.claude/plugins/cache/wizrelay/wizrelay/0.1.0/bin/wizrelay (pinned)
```

Sabitlemeyi kaldırmak için `use wizrelay auto`. Sabitlenmiş bir yol kaybolursa ajan bunu
söyler ve o programı çalıştırmaz — sessizce PATH'teki kopyaya düşmez, çünkü insan zaten
ondan kaçmak için sabitlemişti.

Makine kartı da panelde her aracı bulup bulmadığını gösterir.

## Aynı tuzak panelin makinesinde

Yukarıdakilerin hepsi kişinin kendi makinesiyle ilgili; ama bir kapının ihtiyaç duyduğu
checkout'u eşleşmiş hiçbir makine tutmuyorsa kapıyı panel kendisi çalıştırır — ve onun
PATH'i de `wizrelay`'i aynı eksik pip kopyasına çözebilir. Orada, birden bilinmeyen hale
gelen bir tracker olarak görünür:

```
wizrelay hub new CU-7fd2e914 --title "…" --roles api
Unknown tracker type 'clickup'.
  Why: No descriptor for it was found in the tracker catalogue.
  Fix: Use one of: none.
```

Hub'ın tracker ayarında yanlış bir şey yoktur. Çalıştırılan kopyanın hiç kataloğu yoktur,
bu yüzden sunabildiği tek tracker gömülü `none`'dır. CLI'ın yeni sürümleri ayarı suçlamak
yerine bunu açıkça söyler.

İki çıkış yolu var; birincisi daha iyi:

```bash
pip uninstall wizrelay
```

```bash
WIZRELAY_BIN=~/.claude/plugins/cache/wizrelay/wizrelay/<sürüm>/bin/wizrelay
```

`WIZRELAY_BIN`, `GIT_BIN`, `CLAUDE_BIN` ve `PYTHON3_BIN`, panelin programlarını agent'taki
`use` gibi sabitler. Çözülemeyen bir sabitleme, programın yokluğu olarak bildirilir —
sessizce, sabitleyerek kaçtığınız kopyaya dönmek yerine.

## Panel hangi makineye gönderir

Bir kapıyı sen başlattığında iş **senin** makinene gider. Sunucuya değil, bir meslektaşının
makinesine değil. Birden fazla makinen varsa, o rolün çalışma kopyasına sahip olan ve
çevrimiçi olan seçilir — dizüstünde backend, masaüstünde frontend varsa doğru olan kendi
bulunur.

Bir kapının çalıştırabilmesi için gereken her şey **Bu makine** ekranında yazar: hangi
çalışma kopyalarını sunduğun, hangi araçların bulunduğu, hangi Claude hesabıyla giriş
yaptığın. Düğme gri ise sebebi bu üçünden biridir ve ekran hangisi olduğunu söyler.

## Claude girişi

Ajan `~/.claude.json` dosyasını senin makinende okur ve hangi hesapla giriş yaptığını
panele bildirir. Çalıştırma o hesapla damgalanır — yani panel bir koşuyu sunucunun değil,
senin adına kaydeder. Sunucuda hiçbir Claude kimlik bilgisi tutulmaz, tutulması da
gerekmez: oturum zaten senin makinende açık.

`claude` komutu makinende yoksa konuşmalı kapılar paket içindeki döküme düşer ve konsol
bunu açıkça söyler.

## Operatör için

```
WIZRELAY_GATE_EXECUTION=agent
```

`auto` (varsayılan) eşlenmiş bir makine varsa oraya, yoksa panelin kendi makinesine
gönderir — tek kişilik kurulum için doğrusu budur. Ortak bir panelde `agent` seçilir: o
makinede kimsenin deposu yok, ve eksik bir ajanın sessizce sunucuda çalışmak yerine
yüksek sesle söylemesi gerekir. `docker-compose.yml` bunu zaten `agent` yapar.

`WIZRELAY_GATE_URL` ajanların bağlanacağı adresi sabitler; boş bırakılırsa panel sayfanın
açıldığı adresi kullanır.

## Protokol

| Uç | Ne yapar |
|---|---|
| `POST /api/agent/pair` | Kodu jetona çevirir. Jeton isteyen tek uç, jetonsuz tek uç. |
| `POST /api/agent/hello` | Nabız ve envanter: çalışma kopyaları, araçlar, Claude hesabı. |
| `GET /api/agent/jobs` | Uzun yoklama; 25 saniye bekler, iş çıkarsa hemen döner. |
| `POST /api/agent/jobs/:id` | Satırlar ve sonuç. Her satırın kendi sıra numarası var. |

Sözleşme `src/core/agent/protocol.ts` içinde; ajandaki kopyası `tests/agent-protocol.test.ts`
ile eşlenir, ikisi ayrışırsa test düşer.

## Sorun giderme

**"Eşlenmiş ve çevrimiçi bir makinen yok"** — ajan çalışmıyor ya da panele ulaşamıyor.
`node ~/.wizrelay-gate/wizrelay-agent.mjs status` ne gördüğünü söyler.

**"Çevrimiçi makinelerinin hiçbirinde bu rolün çalışma kopyası yok"** — o rolün deposunu
`add` ile tanıt. Rol adı hub'ın `wizrelay-hub.json` kataloğundan gelir.

**Kapı aracın kendi içinde düşüyor** (`template directory is missing`, `command not found`,
beklenmedik bir sürüm) — ajan yanlış kopyayı çalıştırıyor olabilir. `status` hangi yolu
kullandığını söyler; `use <program> <yol>` doğrusunu sabitler.

**Ajan 401 alıyor** — makine panelden kaldırılmış. Yeni bir kodla yeniden eşle.

**Ajan 409 alıyor** — panel senin ajanından yeni bir protokol konuşuyor; ajanı güncelle.

## Panelin okuduğu hub ile bir kapının yazdığı hub

Panel, kimsenin checkout'una ihtiyaç duymadan paketleri okuyabilmek için hub'ın sığ bir
klonunu tutar. O klon bir **aynadır**: `git fetch` ve `git reset --hard` ile tazelenir,
yani içine yazılan her şey bir sonraki tazelemede yok olur.

Bu yüzden hub'a yazan bir kapı — intake, research, validate, publish — aynaya karşı
çalışmaz. Başlamadan reddeder ve ne yapılacağını söyler:

> Bu kapı hub'a yazıyor, ama bu makinedeki tek hub kopyası panelin okuma aynası. Hub
> deposunu kendi makinenize `--role hub` ile tanıtın.

```bash
node ~/.wizrelay-gate/wizrelay-agent.mjs add ~/Repos/arastirma-hub --role hub
```

Bu kural konmadan önce böyle bir kapı aynaya karşı çalışıyor ve çalışmış gibi
görünüyordu: konsol dalın açıldığını bildiriyor, kişinin kendi checkout'u `master`'da
kalıyor ve iş bir önbellek tazelemesi kadar uzakta siliniyordu.

Yönetim'den yerel yolu ile kaydedilmiş bir hub gerçek bir checkout'tur, ayna değildir;
ona yazmakta sakınca yoktur.

<!-- foot -->
← Önceki: [Kişiler, roller ve etkinlik](18-activity.md) · [Dokümantasyon](README.md) · Sonraki: [Kim neyi görür](20-access.md) →
<!-- /foot -->
