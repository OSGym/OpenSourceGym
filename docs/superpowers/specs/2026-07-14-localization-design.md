# OpenGym Türkçe/İngilizce Localization Tasarımı

## Amaç

Admin dashboard ve mobil üye uygulamasındaki tüm kullanıcı metinlerini Türkçe
ve İngilizce sunmak. İlk dil cihaz/tarayıcı tercihlerinden otomatik seçilir;
kullanıcının `TR | EN` seçimi cihazda kalıcı olur ve otomatik seçimi ezer.
Desteklenmeyen diller İngilizceye düşer.

## Mimari

Her istemci kendi `i18next` kaynaklarını ve `react-i18next` sağlayıcısını
barındırır. Web, `navigator.languages` ve `localStorage` kullanır; mobil,
`expo-localization` ve `SecureStore` kullanır. Geçerli saklama anahtarı
`opengym.language`, desteklenen değerler `tr` ve `en`'dir. Manuel seçim yoksa
tercih listesindeki ilk desteklenen dil kullanılır. Dil çözülmeden içerik
gösterilmez; böylece yanlış dilde ilk kare oluşmaz.

Dil değişimi sayfa yenilemeden metinleri, erişilebilirlik etiketlerini ve
`Intl` tarih/sayı biçimlerini günceller. Web seçici giriş kartında ve üst
çubukta; mobil seçici kimlik doğrulama ekranlarında ve ana ekran başlığında
görünür. Serbest kullanıcı verileri, adlar, e-postalar ve cihaz adları
çevrilmez.

## Hatalar ve Native Metinler

Beklenen REST hataları kararlı bir `ApiErrorCode` ile döner. İstemciler ham
sunucu cümlesini göstermek yerine API ve BetterAuth kodlarını seçili dilde
eşler; bilinmeyen hatalar genel, çevrilmiş mesaja düşer. Başarılı API şekilleri
ve veritabanı değişmez.

Mobil uygulama `expo-localization` config plugin'i ile `tr` ve `en` dillerini
native sisteme ilan eder. Kamera, konum ve galeri izin açıklamaları iki dilde
native locale kaynaklarına taşınır; bu değişiklik yeni native build gerektirir.

## Kabul Kriterleri

- İlk açılışta Türkçe ve İngilizce cihaz dilleri doğru seçilir; diğer diller
  İngilizceye düşer.
- Manuel seçim yeniden açılışta korunur ve cihaz dili değişiminden etkilenmez.
- Her iki istemcide tüm kullanıcı metinleri, hatalar, tarihler, sayılar ve
  çoğullar seçili dilde görünür.
- TR ve EN sözlükleri aynı anahtarları içerir; tüm API hata kodları çevrilidir.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` ve `pnpm build` başarılıdır.

## Kapsam Dışı

Dil tercihinin kullanıcı hesabına veya veritabanına yazılması, yeni API
endpoint'i, RTL dil desteği ve ürün verilerinin otomatik çevirisi bu sürümde
yoktur.
