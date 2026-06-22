# Komuta Kullanım Kılavuzu (Özer & Salih için)

> Bu kılavuz tamamen **Türkçe**dir ve panel kullanıcıları **Özer** (işletme sahibi) ve
> **Salih** (muhasebeci) içindir. Teknik bilgi gerektirmez. Adımları sırasıyla takip edin.

İçindekiler:

1. [Panele giriş](#1-panele-giriş)
2. [Panodaki (dashboard) bilgileri okuma](#2-panodaki-bilgileri-okuma)
3. [Metriklerin anlamı](#3-metriklerin-anlamı)
4. [Çalışanlar ciroyu nasıl gönderir](#4-çalışanlar-ciroyu-nasıl-gönderir)
5. [Yeni gönderici → şube eşleştirmesini onaylama](#5-yeni-gönderici--şube-eşleştirmesini-onaylama)
6. [Salih aylık verileri nasıl girer](#6-salih-aylık-verileri-nasıl-girer)
7. [Mesaj / hatırlatma gönderme](#7-mesaj--hatırlatma-gönderme)
8. [Monitör sayfasını okuma](#8-monitör-sayfasını-okuma)

---

## 1. Panele giriş

1. Tarayıcınızda panel adresini açın: **https://komuta.app** (gerçek adresinizi kullanın).
2. **E-posta** ve **şifrenizi** girin.
   - Özer: işletme sahibi hesabı.
   - Salih: muhasebeci hesabı.
3. **Giriş Yap**'a tıklayın.

> **İlk girişte şifrenizi mutlaka değiştirin.** Sağ üstteki profil menüsünden
> **Şifre Değiştir** seçeneğini kullanın. İlk kurulumda verilen geçici şifreyi
> kullanmaya devam etmeyin.

Şifrenizi unutursanız sistem yöneticisiyle (operatör) iletişime geçin.

---

## 2. Panodaki bilgileri okuma

Giriş yapınca ana **Pano (Dashboard)** açılır. Burada:

- **Üst kartlar:** Bugünün toplam cirosu, raporlayan şube sayısı, eksik şube sayısı gibi
  özetler.
- **Grafikler:** Günlük/aylık ciro eğilimleri (Recharts grafikleri). Fareyle üzerine
  gelince ayrıntılı değerleri gösterir.
- **Firma / Marka / Şube filtreleri:** Belirli bir firmaya (Kakao Gıda, ZerKay Gıda,
  Roka Gıda, Bakır Kupa Gıda), markaya veya şubeye göre süzebilirsiniz.
- **Tarih aralığı seçici:** Gün, hafta, ay bazında inceleyebilirsiniz.

Veriler **canlı** güncellenir; yeni bir ciro mesajı geldiğinde pano kendiliğinden
yenilenir (sayfayı yenilemeniz gerekmez).

---

## 3. Metriklerin anlamı

| Metrik                       | Anlamı                                                                 |
|------------------------------|------------------------------------------------------------------------|
| **Ciro**                     | Bir şubenin günlük geliri (toplam satış). Çalışanlar WhatsApp ile gönderir. |
| **Stok**                     | Şubedeki envanter/stok değeri. Aylık olarak Salih girer.              |
| **Personel Maaşı**           | O şube/dönem için ödenen maaş gideri. Aylık girilir.                  |
| **Mal Alım**                 | Satın alınan malların maliyeti (alımlar). Aylık girilir.             |
| **Öğrenci Sayısı – Ortaokul**| Okul kantinlerinde ortaokul öğrenci sayısı.                          |
| **Öğrenci Sayısı – Lise**    | Okul kantinlerinde lise öğrenci sayısı.                              |
| **Çalışan Sayısı**           | O şubede çalışan personel sayısı.                                    |

> **Ciro** günlük ve otomatiktir (WhatsApp'tan gelir). **Stok, Personel Maaşı, Mal Alım,
> Öğrenci Sayısı ve Çalışan Sayısı** ise aylık olarak elle (Salih tarafından) girilir.

---

## 4. Çalışanlar ciroyu nasıl gönderir

Çalışanlar panele **girmez**. Sadece tek bir **WhatsApp Business numarasına** günlük
cirolarını **düz metin** olarak yazarlar. Sistem tutarı otomatik anlar.

### Kabul edilen tutar biçimleri

Komuta hem Türk hem de İngiliz/ABD biçimini anlar:

| Yazılan mesaj           | Anlaşılan tutar | Açıklama                                  |
|-------------------------|-----------------|--------------------------------------------|
| `73256,76`              | 73.256,76 TL    | Virgül = kuruş ayıracı (Türkçe)           |
| `73.256,76`             | 73.256,76 TL    | Nokta = binlik, virgül = kuruş (Türkçe)   |
| `73256.76`              | 73.256,76 TL    | Nokta = kuruş (İngilizce/ABD)             |
| `73,256.76`            | 73.256,76 TL    | Virgül = binlik, nokta = kuruş (ABD)      |

### Şubeyi belirtme (birden fazla şube yöneten çalışanlar için)

Bir çalışan birden çok şubeden sorumluysa, tutarın önüne **şube kodu** veya **şube adı**
ekleyebilir:

| Yazılan mesaj           | Anlamı                                              |
|-------------------------|------------------------------------------------------|
| `1234 73256,76`         | **1234** kodlu şubenin cirosu 73.256,76 TL          |
| `Çamlıca 73256,76`      | **Çamlıca** şubesinin cirosu 73.256,76 TL           |

> Çalışan tek bir şubeden sorumluysa, kod/ad yazmasına gerek yoktur — sadece tutarı
> gönderebilir; sistem göndericinin numarasından şubeyi bilir.

Mesaj başarıyla işlenince çalışan WhatsApp'tan bir **onay mesajı** alır:

```
✅ Çamlıca için 73.256,76 TL cironuz 22.06.2026 tarihine kaydedildi.
```

---

## 5. Yeni gönderici → şube eşleştirmesini onaylama

Daha önce hiç mesaj atmamış **yeni bir telefon numarasından** ciro gelirse, sistem o
numaranın hangi şubeye ait olduğundan emin olamaz. Bu durumda kayıt **"Onay Bekliyor"**
durumuna düşer ve panoda size gösterilir.

Onaylamak için:

1. Panoda **Bekleyen Onaylar** (veya monitör sayfasındaki **sarı** kayıtlar) bölümüne
   gidin.
2. İlgili kaydı açın: gönderen numara, gelen mesaj ve sistemin tahmin ettiği şube görünür.
3. Doğru **şubeyi** seçin (veya tahmini onaylayın).
4. **Onayla**'ya tıklayın.

Onayladıktan sonra bu numara o şubeyle **kalıcı olarak eşleşir**; aynı numaradan gelen
sonraki mesajlar otomatik işlenir.

> Yanlış bir eşleşme yaptıysanız, şube ayarlarından göndericiyi kaldırabilir/yeniden
> eşleştirebilirsiniz.

---

## 6. Salih aylık verileri nasıl girer

Ciro dışındaki veriler aylıktır ve Salih tarafından elle girilir.

1. **Salih** hesabıyla giriş yapın.
2. Sol menüden **Aylık Veri Girişi** (veya ilgili şubeyi açıp **Aylık** sekmesi) bölümüne
   gidin.
3. **Firma → Marka → Şube** ve **ay** seçin.
4. Şu alanları doldurun:
   - **Stok** (envanter değeri)
   - **Personel Maaşı**
   - **Mal Alım**
   - **Öğrenci Sayısı (Ortaokul)** ve **Öğrenci Sayısı (Lise)** — okul kantinleri için
   - **Çalışan Sayısı**
5. **Kaydet**'e tıklayın.

Girilen değerler panodaki raporlara ve karşılaştırmalara hemen yansır. Bir değeri
düzeltmek isterseniz aynı ekrandan güncelleyip tekrar kaydedin.

---

## 7. Mesaj / hatırlatma gönderme

Bir şube günlük cirosunu göndermediyse, ona hatırlatma yollayabilirsiniz.

1. **Monitör** sayfasında **kırmızı** (eksik) şubeyi bulun.
2. Kaydın yanındaki **Hatırlat** düğmesine tıklayın.
3. Sistem o şubenin yetkilisine WhatsApp hatırlatma mesajı gönderir.

> İpucu: Belirli bir saatten (`REPORTING_CUTOFF_LOCAL`, örn. 21:00) sonra eksik kalan
> şubeler otomatik olarak işaretlenir ve operatöre Telegram bildirimi gidebilir.

Ayrıca bir çalışanın WhatsApp penceresi **açıkken** (yani aynı gün size mesaj attıysa)
gönderilen yanıtlar **ücretsizdir**. Pencere dışındaki hatırlatmalar küçük bir ücrete
tabidir; bu yüzden gereksiz mesajdan kaçının.

---

## 8. Monitör sayfasını okuma

**Monitör** sayfası, o günün durumunu **renklerle** tek bakışta gösterir:

| Renk            | Durum                | Anlamı                                                  |
|-----------------|----------------------|----------------------------------------------------------|
| 🟢 **Yeşil**    | **Alındı**           | Şube bugünkü cirosunu gönderdi ve kaydedildi.           |
| 🔴 **Kırmızı**  | **Eksik**            | Şubeden bugün henüz ciro gelmedi. Hatırlatma yapabilirsiniz. |
| 🟡 **Sarı**     | **Onay Bekliyor**    | Bir mesaj geldi ama şube eşleşmesi/onay bekliyor (bkz. Bölüm 5). |

Hedef: gün sonunda tüm şubelerin **yeşil** olması. **Sarı** kayıtları onaylayın,
**kırmızı** kayıtlar için hatırlatma gönderin.

---

### Sık sorulanlar

- **Çalışan yanlış tutar gönderdi, ne yapayım?** Kaydı panodan düzeltin; doğru tutarı
  girip kaydedin. Geçmiş kayıtlar düzenlenebilir (yetkiniz varsa).
- **Aynı şube iki kez gönderdi.** Sistem aynı WhatsApp mesajını **iki kez işlemez**
  (mesaj kimliğiyle tekilleştirir). Farklı tutarlar geldiyse en doğru olanı bırakın.
- **Şifremi unuttum.** Operatörle iletişime geçin.

Sorun yaşarsanız operatör/sistem yöneticisiyle iletişime geçin.
