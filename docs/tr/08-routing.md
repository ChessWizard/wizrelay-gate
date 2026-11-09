<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/08-routing.md)
<!-- /nav -->

# Model ve effort yönlendirmesi

Bir task'ın her aşamasının hangi modeli ve ne kadar düşünmeyi alacağı.

## Skor, aritmetik olarak

```
skor = karmaşıklık + risk + belirsizlik       (low = 1, medium = 2, high = 3)
     + 1  kod tabanı büyükse
     + 1  test olgunluğu düşükse
     + 1  rolün kapsamı kritik alanlara dokunuyorsa
     + 1  rolün kapsamı legacy koda dokunuyorsa
```

Sinyaller task'tan gelir (researcher belirler, rol bazında da değiştirebilir); ekler
deponun `profile.json` dosyasından. Aynı task bu yüzden iki depoda farklı yönlenebilir ve
yönlendirme ekranı yalnızca sonucu değil, toplamın tamamını gösterir.

## Tier'lar

| Tier | Skor | Planlama | Uygulama | Doğrulama |
|---|---|---|---|---|
| `T0-mechanical` | `kind: mechanical` | sonnet / low | haiku / medium | sonnet / medium |
| `T1-routine` | ≤ 4 | sonnet / medium | sonnet / medium | sonnet / medium |
| `T2-standard` | 5–6 | opus / high | sonnet / high | sonnet / high |
| `T3-critical` | 7–8 | opus / xhigh | opus / high | opus / high |
| `T4-high-risk` | ≥ 9 | opus / xhigh | opus / high + advisor | opus / xhigh |

## Başlatma komutu

```
claude --model opusplan --effort high --name 'CU-86c1abcd Tenant bazlı günlük API istek kotası'
```

`opusplan`, plan aşaması Opus ve uygulama aşaması Sonnet olduğunda çıkar. Advisor yalnızca
ana modelle aynı ya da daha üst seviyedeyse korunur; belirsiz eşleşme önerilmek yerine
düşürülür.

## Hangi politika

Gösterilen politika plugin'in varsayılanıdır. Bir hub kendi
`policies/routing-policy.json` dosyasını yayınladığında onun yerine o geçer — pano
kaynağı adıyla söyler ve asla kendi kopyasını tercih etmez.

<!-- foot -->
← Önceki: [Kapı istemleri ve onaylar](07-prompts.md) · [Dokümantasyon](README.md) · Sonraki: [Kapsam koruması ve denetim](09-scope-and-audit.md) →
<!-- /foot -->
