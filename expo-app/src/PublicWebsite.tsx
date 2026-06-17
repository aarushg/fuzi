import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

type PublicPage =
  | "home"
  | "catalog"
  | "residential"
  | "hotel"
  | "commercial"
  | "hospital"
  | "industrial"
  | "capsule"
  | "parallel"
  | "crisscross"
  | "step"
  | "installation"
  | "maintenance";

type ProductPage = {
  key: PublicPage;
  category: string;
  title: string;
  summary: string;
  image: string;
  features: string[];
  specs: Array<[string, string]>;
  related: PublicPage[];
};

const phoneUrl = "tel:+919928019671";
const whatsappUrl = "https://api.whatsapp.com/send?phone=919928019671";

const products: ProductPage[] = [
  {
    key: "residential",
    category: "Elevators",
    title: "Residential Elevators",
    summary: "Smooth, compact home lifts designed for villas, apartments, and private residences where safety and finish matter every day.",
    image: "https://www.fuzielevators.com/doc/422038_1727107260.jpg",
    features: ["Compact shaft planning", "Quiet VVVF operation", "Automatic rescue device", "Custom cabin finishes"],
    specs: [["Capacity", "4 to 8 persons"], ["Application", "Homes and low-rise buildings"], ["Door", "Manual or automatic"], ["Finish", "MS, SS, glass, laminate"]],
    related: ["commercial", "hospital", "capsule"],
  },
  {
    key: "hotel",
    category: "Elevators",
    title: "Hotel Elevators",
    summary: "Guest-focused vertical mobility with quiet rides, premium interiors, and controls suited to heavy daily traffic.",
    image: "https://www.fuzielevators.com/doc/422040_1727107283.jpg",
    features: ["Luxury cabin options", "Low-noise travel", "Traffic-ready controls", "Service-friendly maintenance"],
    specs: [["Capacity", "6 to 20 persons"], ["Application", "Hotels and resorts"], ["Control", "Microprocessor"], ["Speed", "Project-specific"]],
    related: ["commercial", "capsule", "residential"],
  },
  {
    key: "commercial",
    category: "Elevators",
    title: "Commercial Elevators",
    summary: "Durable passenger lifts for offices, malls, showrooms, and high-traffic commercial properties.",
    image: "https://www.fuzielevators.com/doc/422041_1727107296.jpg",
    features: ["High cycle reliability", "Accessible cabin design", "Energy-efficient drive", "Flexible door choices"],
    specs: [["Capacity", "6 to 26 persons"], ["Application", "Offices and malls"], ["Drive", "Geared or gearless"], ["Door", "Auto sliding"]],
    related: ["hotel", "industrial", "hospital"],
  },
  {
    key: "hospital",
    category: "Elevators",
    title: "Hospital Elevators",
    summary: "Stretcher-ready elevators built for healthcare sites with wide doors, deeper cabins, and dependable movement.",
    image: "https://www.fuzielevators.com/doc/422042_1727107312.jpg",
    features: ["Stretcher-ready dimensions", "Smooth start and stop", "Priority service options", "Hygienic cabin finishes"],
    specs: [["Capacity", "15 to 26 persons"], ["Application", "Hospitals and clinics"], ["Speed", "Up to 0.7 m/s"], ["Opening", "Wide automatic door"]],
    related: ["commercial", "industrial", "residential"],
  },
  {
    key: "industrial",
    category: "Elevators",
    title: "Industrial Elevators",
    summary: "Heavy-duty goods and passenger movement for factories, warehouses, and utility buildings.",
    image: "https://www.fuzielevators.com/doc/422043_1727107326.jpg",
    features: ["Rugged cabin structure", "Goods-friendly platform", "Simple service access", "Built for harsh use"],
    specs: [["Capacity", "Project-specific"], ["Application", "Factories and warehouses"], ["Cabin", "Reinforced"], ["Controls", "Industrial duty"]],
    related: ["commercial", "hospital", "residential"],
  },
  {
    key: "capsule",
    category: "Elevators",
    title: "Capsule Elevators",
    summary: "Panoramic glass elevators that turn movement into a premium visual experience for hotels, malls, and showpiece buildings.",
    image: "https://www.fuzielevators.com/doc/422044_1727107340.jpg",
    features: ["Panoramic glass cabin", "Architectural facade appeal", "Silent ride", "Premium lighting packages"],
    specs: [["Capacity", "6 to 20 persons"], ["Application", "Hotels, malls, atriums"], ["Speed", "Up to 1.5 m/s"], ["Finish", "Glass and stainless steel"]],
    related: ["hotel", "commercial", "residential"],
  },
  {
    key: "parallel",
    category: "Escalators",
    title: "Parallel Escalator",
    summary: "A high-throughput escalator arrangement for malls, stations, and large public buildings with predictable passenger flow.",
    image: "https://www.fuzielevators.com/doc/422045_1727107354.jpg",
    features: ["Balanced up/down movement", "Commercial-duty components", "Safety comb plates", "Traffic-friendly planning"],
    specs: [["Application", "Retail and transit"], ["Arrangement", "Parallel"], ["Duty", "Heavy public usage"], ["Balustrade", "Glass or steel"]],
    related: ["crisscross", "step", "commercial"],
  },
  {
    key: "crisscross",
    category: "Escalators",
    title: "Crisscross Escalator",
    summary: "A space-aware escalator layout that keeps movement intuitive across multiple floors in compact commercial sites.",
    image: "https://www.fuzielevators.com/doc/422046_1727107368.jpg",
    features: ["Efficient floor transitions", "Compact layout", "Clear passenger circulation", "Robust drive system"],
    specs: [["Application", "Malls and complexes"], ["Arrangement", "Crisscross"], ["Usage", "Medium to heavy traffic"], ["Safety", "Standard escalator protection"]],
    related: ["parallel", "step", "commercial"],
  },
  {
    key: "step",
    category: "Escalators",
    title: "Step Type Escalator",
    summary: "Proven escalator design with dependable step movement and easy serviceability for everyday public use.",
    image: "https://www.fuzielevators.com/doc/422047_1727107382.jpg",
    features: ["Durable step chain", "Smooth handrail movement", "Safety switches", "Long service life"],
    specs: [["Application", "Commercial spaces"], ["Type", "Step escalator"], ["Duty", "Continuous use"], ["Finish", "Project-specific"]],
    related: ["parallel", "crisscross", "commercial"],
  },
];

const productByKey = new Map(products.map((product) => [product.key, product]));

const catalogRows = [
  ["Passenger Elevator", "6, 8, 10, 13, 16, 20 persons", "408 to 1360 kg", "Auto sliding", "Up to 2.5 m/s"],
  ["Panoramic / Capsule Elevator", "6, 8, 10, 15, 20 persons", "408 to 1360 kg", "Glass cabin", "Up to 1.5 m/s"],
  ["Hydraulic Elevator", "3 to 20 persons", "225 to 1600 kg", "Low-rise fit", "Project-specific"],
  ["Hospital Elevator", "Stretcher-ready", "Wide cabin", "Auto door", "Up to 0.7 m/s"],
  ["Freight / Goods Elevator", "Industrial range", "Heavy loads", "Reinforced car", "Project-specific"],
  ["Home Elevator", "Compact range", "Villa ready", "Manual or auto", "Low-rise"],
  ["Machine Roomless Elevator", "Passenger range", "Space-saving", "Gearless", "Project-specific"],
];

const branches = ["Ajmer", "Jaipur", "Kota", "Bhilwara", "Udaipur", "Jodhpur", "Delhi NCR", "Indore"];

export function PublicWebsite({ onOpenPortal }: { onOpenPortal: () => void }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState<PublicPage>("home");
  const isWide = width >= 900;
  const isCompact = width < 640;
  const selectedProduct = productByKey.get(page);

  const groupedProducts = useMemo(
    () => ({
      elevators: products.filter((item) => item.category === "Elevators"),
      escalators: products.filter((item) => item.category === "Escalators"),
    }),
    [],
  );

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => undefined);
  }

  function renderNav() {
    const navLinks: Array<[string, PublicPage]> = [
      ["Home", "home"],
      ["Catalog", "catalog"],
      ["Installation", "installation"],
      ["Maintenance", "maintenance"],
    ];
    const pageRail = (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.navScroller, isCompact && styles.navScrollerCompact]}
        contentContainerStyle={[styles.navLinks, isCompact && styles.navLinksCompact]}
      >
        {navLinks.map(([label, key]) => (
          <Pressable key={key} style={[styles.navLink, page === key && styles.navLinkActive]} onPress={() => setPage(key)}>
            <Text style={[styles.navLinkText, page === key && styles.navLinkTextActive]}>{label}</Text>
          </Pressable>
        ))}
        {!isCompact && (
          <>
            <Pressable style={styles.navLink} onPress={onOpenPortal}>
              <Text style={styles.navLinkText}>Login</Text>
            </Pressable>
            <Pressable style={styles.navCta} onPress={() => openUrl(phoneUrl)}>
              <Text style={styles.navCtaText}>Call Us</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    );
    return (
      <View style={[styles.nav, isCompact && styles.navCompact]}>
        <View style={[styles.brandRow, isCompact && styles.brandRowCompact]}>
          <Pressable style={[styles.brand, isCompact && styles.brandCompact]} onPress={() => setPage("home")}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>FE</Text>
            </View>
            <Text style={styles.brandText}>FUZI <Text style={styles.brandAccent}>Elevators</Text></Text>
          </Pressable>
          {isCompact && (
            <View style={styles.mobileActions}>
              <Pressable style={styles.mobileLogin} onPress={onOpenPortal}>
                <Text style={styles.navLinkText}>Login</Text>
              </Pressable>
              <Pressable style={styles.navCta} onPress={() => openUrl(phoneUrl)}>
                <Text style={styles.navCtaText}>Call</Text>
              </Pressable>
            </View>
          )}
        </View>
        {pageRail}
      </View>
    );
  }

  function renderHome() {
    return (
      <>
        <View style={[styles.hero, isCompact && styles.heroCompact, isWide && styles.heroWide]}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Elevator manufacturing, installation, and service</Text>
            <Text style={[styles.heroTitle, isCompact && styles.heroTitleCompact]}>Elevating Your World</Text>
            <Text style={styles.heroText}>
              FUZI Classic Elevators designs, installs, modernizes, and maintains elevators and escalators for homes, hospitals, hotels, commercial spaces, and industrial sites.
            </Text>
            <View style={styles.actionRow}>
              <Pressable style={styles.primaryButton} onPress={() => setPage("catalog")}>
                <Text style={styles.primaryButtonText}>View Catalog</Text>
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => setPage("maintenance")}>
                <Text style={styles.secondaryButtonText}>Service & AMC</Text>
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              {[
                ["24/7", "Breakdown support"],
                ["ISO", "Quality-led process"],
                ["PAN", "Multi-city service"],
              ].map(([value, label]) => (
                <View key={label} style={styles.statBlock}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={styles.heroPanel}>
            <Text style={styles.panelLabel}>Product range</Text>
            {["Passenger elevators", "Capsule elevators", "Hospital elevators", "Industrial elevators", "Escalators"].map((item) => (
              <Text key={item} style={styles.panelItem}>{item}</Text>
            ))}
          </View>
        </View>

        <Section label="Products" title="Elevators for every building type">
          <View style={styles.cardGrid}>
            {groupedProducts.elevators.map((product) => (
              <ProductCard key={product.key} product={product} setPage={setPage} />
            ))}
          </View>
        </Section>

        <Section label="Escalators" title="Commercial passenger-flow systems" muted>
          <View style={styles.cardGrid}>
            {groupedProducts.escalators.map((product) => (
              <ProductCard key={product.key} product={product} setPage={setPage} />
            ))}
          </View>
        </Section>

        <Section label="Services" title="From shaft planning to lifetime maintenance">
          <View style={styles.serviceGrid}>
            <ServiceTile title="Installation" text="Site survey, drawings, material planning, erection, testing, and handover." onPress={() => setPage("installation")} />
            <ServiceTile title="Maintenance" text="AMC planning, preventive checks, breakdown support, and modernization recommendations." onPress={() => setPage("maintenance")} />
            <ServiceTile title="Operations Portal" text="Staff login for CRM, service records, installations, inventory, finance, and department coordination." onPress={onOpenPortal} />
          </View>
        </Section>
      </>
    );
  }

  function renderCatalog() {
    return (
      <>
        <PageHero title="FUZI Elevator Catalog" label="Product Catalog" text="Technical and planning overview for FUZI passenger, capsule, hydraulic, hospital, freight, home, and MRL elevators." />
        <Section label="Specifications" title="Catalog quick reference">
          <View style={styles.table}>
            {catalogRows.map((row, index) => (
              <View key={row[0]} style={[styles.tableRow, index === 0 && styles.tableRowFirst]}>
                {row.map((cell, cellIndex) => (
                  <Text key={cell} style={[styles.tableCell, cellIndex === 0 && styles.tableCellStrong]}>{cell}</Text>
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.note}>Final car, shaft, pit, overhead, machine-room, and door dimensions should be confirmed after site survey.</Text>
        </Section>
        <Section label="Accessories" title="Common cabin and control options" muted>
          <View style={styles.pillGrid}>
            {["ARD", "VVVF drive", "COP and LOP panels", "SS cabin", "Glass cabin", "Intercom", "Automatic door", "Overload sensor", "Emergency light"].map((item) => (
              <Text key={item} style={styles.pill}>{item}</Text>
            ))}
          </View>
        </Section>
        <Section label="Branches" title="Regional service presence">
          <View style={styles.pillGrid}>
            {branches.map((branch) => <Text key={branch} style={styles.branchPill}>{branch}</Text>)}
          </View>
        </Section>
      </>
    );
  }

  function renderProduct(product: ProductPage) {
    return (
      <>
        <PageHero title={product.title} label={product.category} text={product.summary} />
        <Section label="Overview" title={product.title}>
          <View style={[styles.detailGrid, isWide && styles.detailGridWide]}>
            <View style={styles.detailCopy}>
              <Text style={styles.bodyText}>{product.summary}</Text>
              <View style={styles.featureGrid}>
                {product.features.map((feature) => (
                  <View key={feature} style={styles.featureCard}>
                    <Text style={styles.featureDot}>•</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>
              <Pressable style={styles.primaryButton} onPress={() => openUrl(whatsappUrl)}>
                <Text style={styles.primaryButtonText}>Request Quote</Text>
              </Pressable>
            </View>
            <View style={styles.specCard}>
              <Text style={styles.specTitle}>Key specs</Text>
              {product.specs.map(([label, value]) => (
                <View key={label} style={styles.specRow}>
                  <Text style={styles.specLabel}>{label}</Text>
                  <Text style={styles.specValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Section>
        <Section label="Related" title="Explore related solutions" muted>
          <View style={styles.cardGrid}>
            {product.related.map((key) => {
              const related = productByKey.get(key);
              return related ? <ProductCard key={key} product={related} setPage={setPage} /> : null;
            })}
          </View>
        </Section>
      </>
    );
  }

  function renderServicePage(kind: "installation" | "maintenance") {
    const isInstall = kind === "installation";
    const title = isInstall ? "Installation Services" : "Maintenance Services";
    const steps = isInstall
      ? ["Site survey and shaft validation", "Drawing and material coordination", "Lift erection with safety checks", "Testing, commissioning, and handover"]
      : ["Preventive maintenance visits", "Breakdown response and fault logging", "AMC renewal planning", "Modernization and safety recommendations"];
    return (
      <>
        <PageHero
          title={title}
          label={isInstall ? "Project Execution" : "AMC and Service"}
          text={isInstall ? "A structured installation workflow from site readiness to final handover." : "Reliable lift uptime through preventive maintenance, breakdown support, and service records."}
          compact={isCompact}
        />
        <Section label="Workflow" title={isInstall ? "Built for genuine site progress" : "Keeping every lift running safely"}>
          <View style={styles.timeline}>
            {steps.map((step, index) => (
              <View key={step} style={styles.timelineItem}>
                <Text style={styles.timelineIndex}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={styles.timelineText}>{step}</Text>
              </View>
            ))}
          </View>
          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={() => openUrl(phoneUrl)}>
              <Text style={styles.primaryButtonText}>Call Service Team</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => openUrl(whatsappUrl)}>
              <Text style={styles.secondaryButtonText}>WhatsApp</Text>
            </Pressable>
          </View>
        </Section>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      {renderNav()}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {page === "home" && renderHome()}
        {page === "catalog" && renderCatalog()}
        {selectedProduct && renderProduct(selectedProduct)}
        {page === "installation" && renderServicePage("installation")}
        {page === "maintenance" && renderServicePage("maintenance")}
        <Footer setPage={setPage} openUrl={openUrl} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, title, muted, children }: { label: string; title: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.section, muted && styles.sectionMuted]}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function PageHero({ label, title, text, compact }: { label: string; title: string; text: string; compact?: boolean }) {
  return (
    <View style={[styles.pageHero, compact && styles.pageHeroCompact]}>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text style={[styles.pageTitle, compact && styles.pageTitleCompact]}>{title}</Text>
      <Text style={styles.heroText}>{text}</Text>
    </View>
  );
}

function ProductCard({ product, setPage }: { product: ProductPage; setPage: (page: PublicPage) => void }) {
  return (
    <Pressable style={styles.productCard} onPress={() => setPage(product.key)}>
      <View style={styles.productImage}>
        <Image source={{ uri: product.image }} style={styles.productImageAsset} resizeMode="cover" />
        <View style={styles.productImageOverlay}>
          <Text style={styles.productImageText}>{product.category}</Text>
        </View>
      </View>
      <View style={styles.productBody}>
        <Text style={styles.productCategory}>{product.category}</Text>
        <Text style={styles.productTitle}>{product.title}</Text>
        <Text style={styles.productSummary}>{product.summary}</Text>
        <Text style={styles.productLink}>View details</Text>
      </View>
    </Pressable>
  );
}

function ServiceTile({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <Pressable style={styles.serviceTile} onPress={onPress}>
      <Text style={styles.serviceTitle}>{title}</Text>
      <Text style={styles.serviceText}>{text}</Text>
    </Pressable>
  );
}

function Footer({ setPage, openUrl }: { setPage: (page: PublicPage) => void; openUrl: (url: string) => void }) {
  return (
    <View style={styles.footer}>
      <View style={styles.footerBrand}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>FE</Text>
        </View>
        <Text style={styles.footerTitle}>FUZI Classic Elevators</Text>
      </View>
      <View style={styles.footerLinks}>
        {(["catalog", "installation", "maintenance", "residential", "commercial", "hospital"] as PublicPage[]).map((key) => (
          <Pressable key={key} onPress={() => setPage(key)}>
            <Text style={styles.footerLink}>{productByKey.get(key)?.title || titleCase(key)}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => openUrl(whatsappUrl)}>
          <Text style={styles.footerLink}>WhatsApp Enquiry</Text>
        </Pressable>
      </View>
      <Text style={styles.footerCopy}>© 2024 FUZI Classic Elevators. Website and operations portal run from the Expo app.</Text>
    </View>
  );
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0f1117" },
  scroll: { flex: 1, backgroundColor: "#fff" },
  content: { backgroundColor: "#fff" },
  nav: {
    minHeight: 72,
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "#0f1117",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  navCompact: { paddingHorizontal: 16, paddingVertical: 10, alignItems: "stretch", flexDirection: "column", gap: 10 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexShrink: 0 },
  brandRowCompact: { width: "100%" },
  brand: { flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 },
  brandCompact: { flexShrink: 1 },
  brandMark: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#e02020", alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  brandText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  brandAccent: { color: "#ff5b5b" },
  mobileActions: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  mobileLogin: { minHeight: 38, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  navScroller: { flexShrink: 1, maxWidth: "100%" },
  navScrollerCompact: { width: "100%" },
  navLinks: { alignItems: "center", gap: 8, paddingVertical: 2 },
  navLinksCompact: { paddingRight: 16 },
  navLink: { minHeight: 40, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  navLinkActive: { backgroundColor: "rgba(255,255,255,0.1)" },
  navLinkText: { color: "rgba(255,255,255,0.72)", fontWeight: "800", fontSize: 13 },
  navLinkTextActive: { color: "#fff" },
  navCta: { minHeight: 40, borderRadius: 8, backgroundColor: "#e02020", paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  navCtaText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  hero: { backgroundColor: "#11131b", paddingHorizontal: 24, paddingVertical: 56, gap: 28 },
  heroCompact: { paddingHorizontal: 18, paddingVertical: 36, gap: 22 },
  heroWide: { minHeight: 560, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 56 },
  heroCopy: { maxWidth: 680, gap: 18 },
  eyebrow: { color: "#ff7070", fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 },
  heroTitle: { color: "#fff", fontSize: 56, lineHeight: 62, fontWeight: "900" },
  heroTitleCompact: { fontSize: 40, lineHeight: 46 },
  heroText: { color: "rgba(255,255,255,0.68)", fontSize: 16, lineHeight: 25, maxWidth: 660 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 8 },
  primaryButton: { minHeight: 48, borderRadius: 8, backgroundColor: "#e02020", paddingHorizontal: 20, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  primaryButtonText: { color: "#fff", fontWeight: "900", fontSize: 13 },
  secondaryButton: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: "#d5dae4", backgroundColor: "#fff", paddingHorizontal: 18, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  secondaryButtonText: { color: "#11131b", fontWeight: "900", fontSize: 13 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 22, marginTop: 20, paddingTop: 22, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" },
  statBlock: { minWidth: 112 },
  statValue: { color: "#fff", fontSize: 26, fontWeight: "900" },
  statLabel: { color: "rgba(255,255,255,0.58)", fontSize: 12, fontWeight: "800", marginTop: 3 },
  heroPanel: { width: 360, maxWidth: "100%", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.06)", padding: 20, gap: 10 },
  panelLabel: { color: "#ff7070", fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  panelItem: { color: "#fff", fontWeight: "900", borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", padding: 11 },
  section: { paddingHorizontal: 24, paddingVertical: 54, backgroundColor: "#fff" },
  sectionMuted: { backgroundColor: "#f5f7fa" },
  sectionLabel: { color: "#e02020", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.3, marginBottom: 8 },
  sectionTitle: { color: "#11131b", fontSize: 30, lineHeight: 36, fontWeight: "900", marginBottom: 24 },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  productCard: { width: 300, minWidth: 280, flexGrow: 1, maxWidth: "100%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, overflow: "hidden" },
  productImage: { height: 146, backgroundColor: "#11131b", overflow: "hidden" },
  productImageAsset: { width: "100%", height: "100%" },
  productImageOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: "rgba(0,0,0,0.5)" },
  productImageText: { color: "#fff", fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.1, fontSize: 11 },
  productBody: { padding: 16, gap: 7 },
  productCategory: { color: "#e02020", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.8 },
  productTitle: { color: "#11131b", fontSize: 18, fontWeight: "900" },
  productSummary: { color: "#697184", fontSize: 13, lineHeight: 19 },
  productLink: { color: "#e02020", fontSize: 13, fontWeight: "900", marginTop: 4 },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  serviceTile: { width: 310, minWidth: 280, flexGrow: 1, maxWidth: "100%", borderWidth: 1, borderColor: "#e4e7ee", backgroundColor: "#fff", borderRadius: 8, padding: 18, gap: 8 },
  serviceTitle: { color: "#11131b", fontSize: 18, fontWeight: "900" },
  serviceText: { color: "#697184", fontSize: 13, lineHeight: 20 },
  pageHero: { backgroundColor: "#11131b", paddingHorizontal: 24, paddingVertical: 70, gap: 14 },
  pageHeroCompact: { paddingHorizontal: 18, paddingVertical: 42 },
  pageTitle: { color: "#fff", fontSize: 44, lineHeight: 50, fontWeight: "900" },
  pageTitleCompact: { fontSize: 34, lineHeight: 40 },
  table: { borderWidth: 1, borderColor: "#dfe3eb", borderRadius: 8, overflow: "hidden" },
  tableRow: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderTopColor: "#dfe3eb", backgroundColor: "#fff" },
  tableRowFirst: { borderTopWidth: 0 },
  tableCell: { minWidth: 150, flex: 1, padding: 12, color: "#2d3240", fontSize: 13, borderRightWidth: 1, borderRightColor: "#edf0f5" },
  tableCellStrong: { color: "#11131b", fontWeight: "900" },
  note: { color: "#697184", fontSize: 13, marginTop: 12, lineHeight: 20 },
  pillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  pill: { color: "#11131b", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, overflow: "hidden", fontWeight: "800" },
  branchPill: { color: "#11131b", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, overflow: "hidden", fontWeight: "900" },
  detailGrid: { gap: 20 },
  detailGridWide: { flexDirection: "row", alignItems: "flex-start" },
  detailCopy: { flex: 1, gap: 18 },
  bodyText: { color: "#4d5565", fontSize: 15, lineHeight: 24 },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureCard: { minWidth: 210, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#f8fafc", padding: 12 },
  featureDot: { color: "#e02020", fontSize: 10 },
  featureText: { color: "#11131b", fontWeight: "800", fontSize: 13 },
  specCard: { width: 340, maxWidth: "100%", backgroundColor: "#11131b", borderRadius: 8, padding: 18 },
  specTitle: { color: "#fff", fontWeight: "900", fontSize: 17, marginBottom: 8 },
  specRow: { flexDirection: "row", justifyContent: "space-between", gap: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", paddingVertical: 12 },
  specLabel: { color: "rgba(255,255,255,0.52)", fontWeight: "800", fontSize: 12 },
  specValue: { color: "#fff", fontWeight: "900", fontSize: 12, textAlign: "right", flex: 1 },
  timeline: { gap: 12, marginBottom: 22 },
  timelineItem: { flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: "#e4e7ee", borderRadius: 8, backgroundColor: "#fff", padding: 14 },
  timelineIndex: { width: 44, color: "#e02020", fontWeight: "900", fontSize: 18 },
  timelineText: { color: "#11131b", fontSize: 15, fontWeight: "800", flex: 1 },
  footer: { backgroundColor: "#07070f", paddingHorizontal: 24, paddingVertical: 34, gap: 20 },
  footerBrand: { flexDirection: "row", alignItems: "center", gap: 12 },
  footerTitle: { color: "#fff", fontWeight: "900", fontSize: 17 },
  footerLinks: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  footerLink: { color: "rgba(255,255,255,0.58)", fontWeight: "800", fontSize: 13 },
  footerCopy: { color: "rgba(255,255,255,0.35)", fontSize: 12 },
});
