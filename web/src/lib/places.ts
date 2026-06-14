import "server-only";
// Yerler (müze/gezilecek yer) okuma katmanı — sayfalar/route'lar buradan import eder.
// Asıl mantık PlaceCache'te (EventCache simetrisi).
export {
  getPlaces,
  getAllPlaces,
  getPlaceBySlug,
  getFeaturedPlaces,
} from "./scrapers/PlaceCache";
