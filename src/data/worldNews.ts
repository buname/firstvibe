/** Curated world-news rows for the geopolitical map sidebar (static demo content). */

export type WorldNewsCategory =
  | "ALL"
  | "CONFLICT"
  | "TENSION"
  | "SANCTIONS"
  | "WARS"
  | "CRISES";

export type WorldNewsItem = {
  id: string;
  title: string;
  source: string;
  /** Filter chip (not `ALL`). */
  category: Exclude<WorldNewsCategory, "ALL">;
  region: string;
  timeLabel: string;
  url: string;
  /** `RiskMarker.id` values for “related to this node”. */
  relatedMarkerIds: string[];
};

export const WORLD_NEWS: WorldNewsItem[] = [
  {
    id: "wn-1",
    title: "How Iran, suffering under sanctions, diversified trade partners and domestic industry",
    source: "The New York Times",
    category: "SANCTIONS",
    region: "Middle East",
    timeLabel: "Today",
    url: "https://www.nytimes.com",
    relatedMarkerIds: ["tehran", "riyadh", "dubai"],
  },
  {
    id: "wn-2",
    title: "Gaza corridor: humanitarian access and security incidents remain tightly linked",
    source: "Reuters",
    category: "CONFLICT",
    region: "Middle East",
    timeLabel: "Today",
    url: "https://www.reuters.com",
    relatedMarkerIds: ["gaza", "jerusalem", "beirut"],
  },
  {
    id: "wn-3",
    title: "Taiwan Strait: naval activity and export controls keep semiconductor supply chains in focus",
    source: "Financial Times",
    category: "TENSION",
    region: "Asia",
    timeLabel: "Today",
    url: "https://www.ft.com",
    relatedMarkerIds: ["taiwan", "beijing", "tokyo", "seoul"],
  },
  {
    id: "wn-4",
    title: "Sudan and neighbours: displacement and cross-border instability strain regional diplomacy",
    source: "BBC News",
    category: "CRISES",
    region: "Africa",
    timeLabel: "Today",
    url: "https://www.bbc.com/news",
    relatedMarkerIds: ["khartoum", "addis", "abuja"],
  },
  {
    id: "wn-5",
    title: "Ukraine front updates: allies weigh air-defence packages as winter operations continue",
    source: "The Economist",
    category: "WARS",
    region: "Europe",
    timeLabel: "Today",
    url: "https://www.economist.com",
    relatedMarkerIds: ["kyiv", "warsaw", "berlin", "moscow"],
  },
  {
    id: "wn-6",
    title: "Red Sea shipping: insurers and carriers adjust routes as escort coordination evolves",
    source: "Lloyd's List",
    category: "TENSION",
    region: "Middle East",
    timeLabel: "Today",
    url: "https://lloydslist.maritimeintelligence.informa.com",
    relatedMarkerIds: ["redsea", "riyadh", "sanaa", "dubai"],
  },
  {
    id: "wn-7",
    title: "Korean peninsula: missile tests and joint drills keep alert levels elevated",
    source: "Associated Press",
    category: "TENSION",
    region: "Asia",
    timeLabel: "Today",
    url: "https://apnews.com",
    relatedMarkerIds: ["pyongyang", "seoul", "tokyo"],
  },
  {
    id: "wn-8",
    title: "Venezuela sanctions and energy markets: traders watch for secondary effects on flows",
    source: "Bloomberg",
    category: "SANCTIONS",
    region: "Americas",
    timeLabel: "Today",
    url: "https://www.bloomberg.com",
    relatedMarkerIds: ["caracas", "nyc"],
  },
  {
    id: "wn-9",
    title: "Syria–Lebanon border economy: cash transfers and fuel pricing still drive local flashpoints",
    source: "Al Jazeera",
    category: "CRISES",
    region: "Middle East",
    timeLabel: "Today",
    url: "https://www.aljazeera.com",
    relatedMarkerIds: ["damascus", "beirut", "jerusalem"],
  },
  {
    id: "wn-10",
    title: "Central African Republic: mineral corridors and peacekeeping mandates under review",
    source: "Africa Confidential",
    category: "CRISES",
    region: "Africa",
    timeLabel: "Today",
    url: "https://www.africa-confidential.com",
    relatedMarkerIds: ["bangui", "abuja"],
  },
  {
    id: "wn-11",
    title: "NATO eastern flank: logistics hubs expand capacity along the Baltic–Black Sea arc",
    source: "Politico Europe",
    category: "TENSION",
    region: "Europe",
    timeLabel: "Today",
    url: "https://www.politico.eu",
    relatedMarkerIds: ["warsaw", "berlin", "helsinki", "kyiv"],
  },
  {
    id: "wn-12",
    title: "Afghanistan neighbourhood: cross-border security and aid corridors remain contested",
    source: "The Diplomat",
    category: "WARS",
    region: "Asia",
    timeLabel: "Today",
    url: "https://thediplomat.com",
    relatedMarkerIds: ["kabul", "tehran", "mumbai"],
  },
];
