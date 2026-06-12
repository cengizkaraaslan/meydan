import type { EventSource } from "../types";
import { SOURCE_LABELS } from "../types";
import type { BaseScraper, ScraperResult, ScraperRunOptions } from "./BaseScraper";
import { BiletixScraper } from "./providers/BiletixScraper";
import { BubiletScraper } from "./providers/BubiletScraper";
import { MobiletScraper } from "./providers/MobiletScraper";
import { PassoScraper } from "./providers/PassoScraper";
import { BiletinialScraper } from "./providers/BiletinialScraper";
import { BugeceScraper } from "./providers/BugeceScraper";
import { BiletinoScraper } from "./providers/BiletinoScraper";
import { SongkickScraper } from "./providers/SongkickScraper";
import { TicketmasterScraper } from "./providers/TicketmasterScraper";
import { IBBScraper } from "./providers/IBBScraper";
import { ZorluPsmScraper } from "./providers/ZorluPsmScraper";
import { SehirTiyatrolariScraper } from "./providers/SehirTiyatrolariScraper";
import { AnadoluScraper } from "./providers/AnadoluScraper";
import { BilkentScraper } from "./providers/BilkentScraper";
import { ITUScraper } from "./providers/ITUScraper";
import { BogaziciScraper } from "./providers/BogaziciScraper";
import { VisitEskisehirScraper } from "./providers/VisitEskisehirScraper";
import { EskisehirTrendScraper } from "./providers/EskisehirTrendScraper";
import { FestTrScraper } from "./providers/FestTrScraper";
import { FestivallTrScraper } from "./providers/FestivallTrScraper";
import { TOBBScraper } from "./providers/TOBBScraper";
import { OdunpazariScraper } from "./providers/OdunpazariScraper";
import { QuarkAkademiScraper } from "./providers/QuarkAkademiScraper";
import { IsamScraper } from "./providers/IsamScraper";
import { DiyanetScraper } from "./providers/DiyanetScraper";
import { YapiKrediKulturScraper } from "./providers/YapiKrediKulturScraper";
import { YunusEmreScraper } from "./providers/YunusEmreScraper";
import { GazhaneScraper } from "./providers/GazhaneScraper";
import { GenericMunicipalityScraper, GenericUniversityScraper } from "./GenericMunicipalityScraper";
import { ALL_MUNICIPALITY_CONFIGS } from "./configs/municipalities";
import { UNIVERSITY_CONFIGS } from "./configs/universities";
import { VENUE_CONFIGS } from "./configs/venues";

class Registry {
  private readonly scrapers = new Map<EventSource, BaseScraper>();

  register(scraper: BaseScraper) {
    this.scrapers.set(scraper.source, scraper);
    if (!SOURCE_LABELS[scraper.source as string]) {
      SOURCE_LABELS[scraper.source as string] = scraper.displayName;
    }
  }

  get(source: EventSource): BaseScraper | undefined {
    return this.scrapers.get(source);
  }

  list(): BaseScraper[] {
    return [...this.scrapers.values()];
  }

  async runOne(source: EventSource, opts?: ScraperRunOptions): Promise<ScraperResult | null> {
    const s = this.get(source);
    if (!s) return null;
    return s.run(opts);
  }

  async runAll(opts?: ScraperRunOptions): Promise<ScraperResult[]> {
    return Promise.all(this.list().map((s) => s.run(opts)));
  }
}

export const scraperRegistry = new Registry();

// Bilet platformları (ücretli)
scraperRegistry.register(new BiletixScraper());
scraperRegistry.register(new BubiletScraper());
scraperRegistry.register(new MobiletScraper());
scraperRegistry.register(new PassoScraper());
scraperRegistry.register(new BiletinialScraper());
scraperRegistry.register(new BugeceScraper());
scraperRegistry.register(new BiletinoScraper());

// Konser API agregatörü (çok şehir, JSON — SONGKICK_API_KEY varsa aktif)
scraperRegistry.register(new SongkickScraper());

// Dünya geneli etkinlik API agregatörü (JSON — TICKETMASTER_API_KEY varsa aktif)
scraperRegistry.register(new TicketmasterScraper());

// Kültür kurumları (SSR concrete parse)
scraperRegistry.register(new ZorluPsmScraper());
scraperRegistry.register(new SehirTiyatrolariScraper());

// Büyükşehir belediyeleri (özel concrete class'lar — mock data + İBB gerçek parse)
scraperRegistry.register(new IBBScraper());
scraperRegistry.register(new VisitEskisehirScraper());
scraperRegistry.register(new EskisehirTrendScraper());
scraperRegistry.register(new OdunpazariScraper());
scraperRegistry.register(new FestTrScraper());
scraperRegistry.register(new FestivallTrScraper());
scraperRegistry.register(new QuarkAkademiScraper());

// TOBB resmi Fuar Takvimi (B2B/mesleki fuarlar — category: FUAR, ziyaretçiye ücretsiz)
scraperRegistry.register(new TOBBScraper());

// Vakıf / dini-manevi / kültür kurumları (JSON API + SSR HTML — ücretsiz)
scraperRegistry.register(new IsamScraper());        // dini/ilmi (DINI)
scraperRegistry.register(new DiyanetScraper());     // dini/ilmi (DINI)
scraperRegistry.register(new YapiKrediKulturScraper()); // kültür vakfı (söyleşi/atölye/sergi)
scraperRegistry.register(new YunusEmreScraper());   // kültür/akademi
scraperRegistry.register(new GazhaneScraper());     // müze/atölye/konser

// Üniversiteler (özel concrete class'lar)
scraperRegistry.register(new AnadoluScraper());
scraperRegistry.register(new BilkentScraper());
scraperRegistry.register(new ITUScraper());
scraperRegistry.register(new BogaziciScraper());

// Geri kalan büyükşehir + ilçe belediyeleri (config-driven generic)
for (const config of ALL_MUNICIPALITY_CONFIGS) {
  scraperRegistry.register(new GenericMunicipalityScraper(config));
}

// Geri kalan üniversiteler (config-driven generic)
for (const config of UNIVERSITY_CONFIGS) {
  scraperRegistry.register(new GenericUniversityScraper(config));
}

// Kültür merkezi / müze / sahne / topluluk / ücretsiz atölye kaynakları.
// ŞİMDİLİK KAPALI: bu siteler (Pera, SALT, kultur.istanbul, devtiyatro.gov.tr, coderspace...)
// Vercel serverless egress IP'sinden ~11s'de timeout (yabancı datacenter IP engeli). Vercel
// fonksiyon bölgesi Türkiye'ye yakın bir noktaya alınırsa ya da bir TR-relay (WebScraper IIS)
// üzerinden çekilirse açılabilir. VENUE_CONFIGS configs/venues.ts'te hazır duruyor.
const ENABLE_VENUE_SCRAPERS = process.env.ENABLE_VENUE_SCRAPERS === "true";
if (ENABLE_VENUE_SCRAPERS) {
  for (const config of VENUE_CONFIGS) {
    scraperRegistry.register(new GenericMunicipalityScraper(config));
  }
}
