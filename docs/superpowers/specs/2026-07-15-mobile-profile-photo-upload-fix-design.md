# Mobil Profil Fotoğrafı Yükleme Düzeltmesi

## Amaç

Android profil fotoğrafı yüklemelerinde `data:` URI kullanımını kaldırmak ve yüksek çözünürlüklü kamera görsellerini API sınırlarının altında tutmak.

## Mevcut Sorun

PR #7, eksik native modül hatasını aşmak için `expo-image-manipulator` bağımlılığını kaldırdı. ImagePicker çıktısını base64 JPEG olarak alıp `data:image/jpeg;base64,...` URI'sine dönüştürdü. Mevcut `uploadBinary` yardımcısı bu URI'yi önce `fetch()` ile okuduğu için Android native fetch, desteklemediği `data:` protokolünde yükleme isteğinden önce hata veriyor.

Ayrıca ImagePicker'ın `quality` seçeneği yalnızca sıkıştırma kalitesini değiştiriyor; piksel boyutlarını küçültmüyor. Bu nedenle yüksek çözünürlüklü görseller API'nin 40 milyon piksel veya 10 MB sınırını aşabiliyor.

## Seçilen Tasarım

`expo-image-manipulator` bağımlılığı geri getirilecek. ImagePicker yalnızca kullanıcıya kare kırpma arayüzü sunacak ve yerel dosya URI'si döndürecek. Seçilen dosya şu sırayla işlenecek:

1. Görsel `ImageManipulator` bağlamına alınacak.
2. En-boy oranı korunarak genişliği 1024 piksele indirilecek.
3. Görsel JPEG biçiminde ve `0.88` sıkıştırma kalitesiyle geçici bir yerel dosyaya kaydedilecek.
4. Oluşan `file://` URI mevcut `uploadBinary` yardımcısına verilecek.
5. `uploadBinary` yerel dosyayı Blob olarak okuyup API'ye `image/jpeg` gövdesiyle gönderecek.

`base64: true`, base64 boşluk kontrolü ve data URL oluşturma kaldırılacak. Native bağımlılığın kullanılabilmesi için Android geliştirme istemcisi bağımlılıklar güncellendikten sonra yeniden derlenecek.

## Hata Yönetimi

İzin reddi, seçimin iptali, görsel işleme hatası, yerel dosya okuma hatası ve API hatası mevcut kullanıcı mesajlarına düşmeye devam edecek. Başarısız işlem profil fotoğrafı durumunu değiştirmeyecek ve meşgul durumu `finally` bloğunda temizlenecek.

## Doğrulama

- Mobil TypeScript tip kontrolü ve lint çalışmalı.
- Mobil testler geçmeli.
- Diff içinde `base64: true` ve `data:image/jpeg` kalmamalı.
- 1024 px `resize` ve JPEG normalizasyonu korunmalı.
- Android native proje yeniden derlenip profil fotoğrafı yükleme akışı doğrulanmalı.

## Kapsam Dışı

API yükleme limitleri, sunucu tarafı normalizasyonu, profil ekranı tasarımı ve diğer dosya yükleme akışları değiştirilmeyecek.
