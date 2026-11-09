<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/04-gates.md)
<!-- /nav -->

# Dokuz task kalite kapısı

Bir relay, uçtan uca akan tek bir task'tır. Kapı ise ilerlemenin birimidir.

```
HAT: ARAŞTIRMA  (hub, researcher)
  G1 ALIM ──► G2 ARAŞTIRMA ──► G3 DOĞRULAMA ──► G4 YAYIN
                                                   │  rol başına dallanma
HAT: TESLİM  (her rol için bir tane)
  G5 ÇEKME ──► G6 PLANLAMA ──► G7 UYGULAMA ──► G8 DOĞRULAMA RAPORU ──► G9 TESLİM

ŞERİT: soru döngüsü — Uygulama'yı askıya alabilir, Yayın'ı yeniden açabilir
```

| Kapı | Sahibi | Ne çalıştırır | Ne yazar |
|---|---|---|---|
| **Alım** | Researcher | `wizrelay hub new <ref> --roles …` | taslak olarak paket iskeleti |
| **Araştırma** | Researcher + Claude | konuşma, ekler | `research.md`, `scope.md`, `acceptance.md`, `decisions.md`, `contracts.md`, `roles/<rol>.md` |
| **Doğrulama** | Researcher | `wizrelay hub validate <ref>` + yazma yetkisi olmayan kritik | hub'dan hiç çıkmayan `.validation.md` |
| **Yayın** | Researcher | `hub publish-prep`, `git commit`, `git push`, tracker yorumu | sürüm + 1, `published`, changelog satırı |
| **Çekme** | Developer | `wizrelay pull <ref>` | salt okunur paket kopyası ve `.lock.json` |
| **Planlama** | Developer + Claude | `/wizrelay:plan` | `plan.md`, iş birimi başına bir `- [ ]` adımı |
| **Uygulama** | Developer + Claude | `/wizrelay:implement`; kapsamı plugin'in hook'ları uygular | kod ve plandaki kutucuklar |
| **Doğrulama raporu** | Dosya düzenleyemeyen bağımsız doğrulayıcı | projenin kendi test komutları + `wizrelay audit` | `verification.md` |
| **Teslim** | Developer, sonra CI | `git commit`, `git push`, pull request, CI denetimi | dal ve pull request |

### Uygulama bir konuşma değil, bir komut çalıştırır

`/wizrelay:implement`, `plan.md` dosyasını okur, işaretlenmemiş adımları sırayla ve rolün
`allow` kapsamı içinde yapar, her adımın kendi testini çalıştırır ve adımı ancak o test
geçtiğinde işaretler. Aynı adım iki kez başarısız olursa üçüncü kez denemek yerine durup
rapor eder.

Önceden bu kapı, bir cümlelik düz metinle ve brief olmadan bir oturum açıyordu — kapsam
yok, plan yok, hangi adımda olunduğunun kaydı yok. Plan yazılıyor, sonra onu yürüten bir
şey olmuyordu.

Açıklama amaçlı yorum satırı yazmaz. Metot ve alan özetleri istisnadır; kodu anlatan bir
yorum, kimsenin güncellemediği ikinci bir kopyasıdır.

Commit ya da push yapmaz. Bu karar sizindir ve panel üzerinden çalıştırmada onay adımına
aittir — [Kapı istemleri ve onaylar](07-prompts.md) sayfasına bakın.

## Adımlar — bir kapı gerçekte neyi çalıştırır

Bir kapı kısa bir adım listesidir ve pano onları çalıştırır. **Adımlar** sekmesi her adımı
komutu doldurulmuş hâliyle listeler — `wizrelay pull <ref>` değil,
`wizrelay pull CU-86c1abcd` — yani adım kopyalanacak bir şey değil, basılacak bir şeydir.

Her adım tek başına çalışır; başarısız olan bir adım, çalışanları yeniden oynatmadan
denenebilir. Adım nerede çalıştığını (hub'da mı, proje deposunda mı), yalnızca okuyup
okumadığını ve size bir şey sorup sormayacağını söyler.

Çalışmayı üç kural biçimlendirir:

- **Dışarı çıkan hiçbir şey onaysız olmaz.** Bir commit ya da push duraklar ve önce size
  tam komutu gösterir. Reddetmek o adımı atlar ve sonucu `PARTIAL` ile sınırlar; kapıyı
  başarısız yapmaz, çünkü push etmemeyi seçmek bir hata değildir.
- **Eksik bir değer tahmin edilmez, sorulur.** `publish-prep` bir değişiklik satırı,
  `ship` bir commit mesajı ister; kapı bunlar için duraklar.
- **Çalışamayan bir adım nedenini söyler.** Bu rol için bağlı depo yok, CLI PATH'te değil,
  Claude oturumu yok — her biri nedenini söyleyen başarısız bir kontroldür, sessiz bir
  atlama değil.

Sohbet gerektiren bir adım o çalışma kopyasında Claude Code'a devreder ve kapının geri
kalanı çalışmayı beklerken geri döner.

## Bütün bir hattı çalıştırmak

**Araştırma hattını çalıştır** ve **Geliştirme hattını çalıştır**, kapıları sırayla yürür.
Zincir, başarısız olan ya da soru soran ilk kapıda durur; çünkü ondan sonraki kapılar onun
bittiğini varsayacaktı — pipeline dediğimiz şey budur. Zaten tamamlanmış bir kapı yeniden
çalıştırılmaz, atlanır; böylece yarım kalmış bir hatta devam etmek kaldığınız yerden
sürer.

Sonuç, hangi kapıların çalıştığını ve nerede durduğunu söyler. Size soru soracak hiçbir
şey habersiz çalışmaz: bir onay zinciri yine durdurur.

## Dallanma

Araştırma relay başına bir kez çalışır. Teslim ve ship her **rol** için bir kez: backend
ve frontend dilimi olan bir paket iki teslim hattı üretir ve relay ancak her rolün Teslim
kapısı geçtiğinde biter. Pano bunu araştırma pipeline'ının altındaki bir köşeli parantezle
çizer.

## Durumlar

Dokuz durum; her birinin kendi simgesi ve etiketi var — asla yalnızca renk değil:

`Başlamadı` · `Çalışıyor` · **`Seni bekliyor`** · `Researcher'ı bekliyor` · `Geçti` ·
`Uyarıyla geçti` · `Kaldı` · `Engellendi` · `Atlandı`

Pano önce `Seni bekliyor`, sonra `Kaldı`, sonra `Researcher'ı bekliyor` sıralar. Geri
kalan her şey aşağıdadır, çünkü geri kalan her şey bekleyebilir.

### Bir kapıyı yeniden çalıştırmak sonrakileri sıfırlar

Bir kapının verdikti, önündeki iş hakkındadır. Araştırmayı yeniden çalıştırdığınızda, dün
geçen doğrulama artık var olmayan bir paketi geçmiştir — bu yüzden o verdikt de, ondan
sonraki her şey de, iki hatta birden temizlenir.

Buna developer'ın bitmiş `implement`'i de dahil; kulağa sert geliyor ve maksat tam olarak
bu: planı, o zamandan beri değişmiş bir pakete göre kurulmuştu ve relay bunu görünür
kılmak için var, geçiştirmek için değil. Yazdıkları koda dokunulmaz; sıfırlanan, panelin
"bu kapı çalıştı" kaydıdır ve konsol dökümü her hâlükârda olay kaydında kalır.

Yeniden kilitlenen kapılar nedenini söyler — *Araştırma geçene kadar engellendi* — yani
sıra baştan, sırayla yürünür.

<!-- foot -->
← Önceki: [Paneli kurmak](03-initialize.md) · [Dokümantasyon](README.md) · Sonraki: [Relay panosu](05-board.md) →
<!-- /foot -->
