import { redirect } from "next/navigation";

/**
 * Eski profil sayfası kaldırıldı.
 * Kullanıcının kendi profil bilgileri artık doğrudan /ayarlar/profil'de açılır.
 * Bookmark'lanmış eski URL'ler buraya gelirse yönlendirilir.
 */
export default function MyProfileRedirect(): never {
  redirect("/ayarlar/profil");
}
