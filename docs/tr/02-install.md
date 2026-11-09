<!-- nav -->
[wizrelay-gate](../../README.md) · [Dokümantasyon](README.md) · [English](../en/02-install.md)
<!-- /nav -->

# Kurulum ve çalıştırma

Yeni mi başlıyorsunuz? **[Baştan sona kurulum](21-walkthrough.md)** her adımı sırayla anlatır.

Neye ihtiyacın var ve onu başlatan üç komut.

## Ön koşullar

| | |
|---|---|
| **Node.js** | 20.9 veya üstü |
| **git** | hub'ı ve proje depolarını okumak için |
| **Python 3.9+ ve `wizrelay` CLI** | isteğe bağlı; kapıları gerçek depolarda çalıştırmak için |
| **Claude Code** | isteğe bağlı; konuşma kapıları için |

`wizrelay` ve `claude` olmadan da pano çalışır: kapılar bunun yerine yerleşik dökümü
oynatır ve pano bunu bir bant olarak söyler.

Konteyner mi tercih edersin? [17. Docker ile çalıştırmak](17-docker.md) için
yukarıdakilerin hiçbiri gerekmez, yalnızca Docker yeter.

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm run dev
```

Ardından <http://localhost:3100> adresini aç. İlk çalıştırmada kurulum sihirbazı açılır.

## Derleme ve başlatma

```bash
npm run build
npm start
```

## Durumunu nerede tutar

Her şey projenin yanındaki `.wizrelay-gate/` klasöründe durur:

```
.wizrelay-gate/
├── workspace.json              # hub, depolar, görünüm, dil
├── relays/<id>.json            # relay başına bir dosya
└── events/<relay>__<rol>__<kapı>.jsonl   # yalnızca eklenen kapı konsolu günlüğü
```

`WIZRELAY_GATE_HOME` bu klasörü başka bir yere taşır. Silmek panoyu sıfırlar; içinde
hub'ın ya da depolarının zaten sahip olmadığı hiçbir şey yoktur.

<!-- foot -->
← Önceki: [Genel bakış](01-overview.md) · [Dokümantasyon](README.md) · Sonraki: [Paneli kurmak](03-initialize.md) →
<!-- /foot -->
