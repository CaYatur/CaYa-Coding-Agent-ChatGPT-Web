# Türkçe hızlı başlangıç

Bu proje, kendi bilgisayarındaki seçili bir proje klasörünü **kendi oluşturduğun Custom GPT'ye** bağlamanı sağlar.

## Mantık

```text
Custom GPT
   ↓ GPT Action / HTTPS
Kendi Bridge'in
   ↓
Bilgisayarındaki CaYa Agent
   ↓
Seçtiğin proje klasörü
```

CaYaDev tarafından işletilen bir sunucu zorunlu değildir. Bridge'i **sen barındırırsın**.

## 1. Bridge'i başlat

```powershell
$env:HOST="127.0.0.1"
$env:PORT="8787"
node .\bridge\server.js
```

Kontrol:

```text
http://127.0.0.1:8787/health
```

## 2. HTTPS adresi oluştur

En kolay test yöntemlerinden biri Cloudflare Quick Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8787
```

Sana örneğin şöyle bir HTTPS adresi verir:

```text
https://ornek.trycloudflare.com
```

Kalıcı kullanım için kendi domaininle Cloudflare Tunnel, VPS + Nginx/Caddy/Apache veya mevcut sitende reverse proxy kullanabilirsin.

Detaylar: [SELF_HOSTING.md](SELF_HOSTING.md)

## 3. Agent'i başlat

Bridge ve Agent aynı PC'deyse:

```powershell
node .\agent\index.js `
  --bridge "http://127.0.0.1:8787" `
  --workspace "C:\Projects\Projem"
```

Build/test de çalıştırmak için:

```powershell
node .\agent\index.js `
  --bridge "http://127.0.0.1:8787" `
  --workspace "C:\Projects\Projem" `
  --allow-terminal
```

Ekrana çıkan `Session ID` ve `Session Secret` geçici bağlantı bilgilerindir. Secret'i parola gibi koru.

## 4. Kendi GPT'ni oluştur

ChatGPT web arayüzünde:

```text
Explore GPTs → Create → Configure → Actions
```

Not: OpenAI'nin Temmuz 2026 dokümantasyonuna göre GPT oluşturma/düzenleme ücretli ChatGPT kullanıcıları ve izin verilen managed workspace kullanıcıları içindir.

Authentication için V1'de:

```text
None
```

seç.

`openapi/action.yaml` dosyasındaki:

```yaml
servers:
  - url: https://bridge.example.com
```

kısmını kendi HTTPS adresinle değiştir.

Örnek:

```yaml
servers:
  - url: https://agent.senindomainin.com
```

veya sitenin alt yoluna proxy yaptıysan:

```yaml
servers:
  - url: https://senindomainin.com/caya-agent
```

Şemanın tamamını GPT Actions bölümüne yapıştır.

Sonra `gpt/instructions.md` dosyasını GPT Instructions alanına ekle.

## 5. İlk test

Action listesinden:

```text
getWorkspaceInfo → Test
```

çalıştır ve yeni Agent oturumundaki ID/secret'i ver.

Başarılıysa GPT ile normal sohbette:

```text
Bu CaYa Agent oturumuna bağlan.
Session ID: ...
Session Secret: ...
Önce workspace bilgisini ve proje ağacını kontrol et.
```

## 6. Dosya yazma testi

```text
Proje kökünde test.txt oluştur ve içine
"Merhaba, Custom GPT üzerinden oluşturuldum." yaz.
Sonra dosyayı tekrar okuyup doğrula.
```

## 7. Coding-agent testi

Terminal açıksa:

```text
Projeyi incele, uygun build/test komutunu çalıştır,
hata varsa dosyayı okuyup en küçük güvenli düzeltmeyi yap,
diff'i kontrol et ve build'i tekrar çalıştır.
```

## Güvenlik

- Agent'i Administrator olarak çalıştırma.
- Tüm disk yerine yalnızca proje klasörünü workspace yap.
- Terminali yalnızca gerektiğinde aç.
- Session Secret'i GitHub issue, ekran görüntüsü veya herkese açık mesajlarda paylaşma.
- İnternet üzerinden düz HTTP kullanma; GPT Action endpoint'i HTTPS olmalı.
- Public/multi-user servis yapacaksan OAuth ve gerçek bir gizlilik politikası ekle.
