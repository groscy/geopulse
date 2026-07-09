/*
 * Curated overlay data — capability: extended-overlays (tasks 1.1-1.4).
 * ⚠️ DEMO / REFERENCE DATA — transcribed verbatim from
 *    design_handoff_geopulse/GeoPulse.dc.html. Not live feeds (out of scope).
 */

export interface Player { country: string; role: string; share: number }
export interface Stage { country: string; stage: string; role: string }
export interface Industry { id: string; name: string; desc: string; players: Player[]; chain: Stage[] }

export const INDUSTRIES: Industry[] = [
  {
    id: 'semis', name: 'Semiconductors', desc: 'Leading-edge logic & memory',
    players: [
      { country: 'Taiwan', role: 'Leading-edge foundry', share: 0.68 }, { country: 'South Korea', role: 'Memory & fabs', share: 0.19 },
      { country: 'China', role: 'Mature-node fabs', share: 0.16 }, { country: 'United States of America', role: 'Design & EDA', share: 0.12 },
      { country: 'Japan', role: 'Materials & tools', share: 0.10 }],
    chain: [
      { country: 'Australia', stage: 'Silicon & rare earths', role: 'Extraction' }, { country: 'Japan', stage: 'Photoresist & wafers', role: 'Materials' },
      { country: 'Taiwan', stage: 'Leading-edge fab', role: 'Fabrication' }, { country: 'China', stage: 'Assembly & test', role: 'Assembly' },
      { country: 'United States of America', stage: 'Device makers', role: 'Market' }],
  },
  {
    id: 'battery', name: 'EV batteries', desc: 'Lithium-ion cells & packs',
    players: [
      { country: 'China', role: 'Cells & cathode', share: 0.74 }, { country: 'South Korea', role: 'Cell production', share: 0.13 },
      { country: 'Australia', role: 'Lithium mining', share: 0.10 }, { country: 'Japan', role: 'Cells & materials', share: 0.06 },
      { country: 'Argentina', role: 'Lithium brine', share: 0.05 }],
    chain: [
      { country: 'Argentina', stage: 'Lithium brine', role: 'Extraction' }, { country: 'China', stage: 'Cathode refining', role: 'Processing' },
      { country: 'South Korea', stage: 'Cell production', role: 'Manufacturing' }, { country: 'Germany', stage: 'Pack & EV assembly', role: 'Integration' },
      { country: 'United States of America', stage: 'EV market', role: 'Market' }],
  },
  {
    id: 'pharma', name: 'Pharmaceuticals', desc: 'Small-molecule drugs & APIs',
    players: [
      { country: 'United States of America', role: 'Innovation & R&D', share: 0.42 }, { country: 'India', role: 'Generics & API', share: 0.20 },
      { country: 'China', role: 'API synthesis', share: 0.17 }, { country: 'Switzerland', role: 'Originators', share: 0.13 },
      { country: 'Germany', role: 'Originators', share: 0.09 }],
    chain: [
      { country: 'China', stage: 'API synthesis', role: 'Base inputs' }, { country: 'India', stage: 'Formulation', role: 'Manufacturing' },
      { country: 'Switzerland', stage: 'R&D & branding', role: 'Value-add' }, { country: 'United States of America', stage: 'Patient market', role: 'Market' }],
  },
  {
    id: 'oil', name: 'Oil & gas', desc: 'Crude, refining & petrochem',
    players: [
      { country: 'United States of America', role: 'Crude & LNG', share: 0.20 }, { country: 'China', role: 'Refining & demand', share: 0.16 },
      { country: 'Saudi Arabia', role: 'Crude export', share: 0.15 }, { country: 'Russia', role: 'Crude & gas', share: 0.12 },
      { country: 'India', role: 'Refining', share: 0.06 }],
    chain: [
      { country: 'Saudi Arabia', stage: 'Crude extraction', role: 'Extraction' }, { country: 'India', stage: 'Refining', role: 'Processing' },
      { country: 'China', stage: 'Petrochemicals', role: 'Manufacturing' }, { country: 'Japan', stage: 'Import market', role: 'Market' }],
  },
  {
    id: 'coffee', name: 'Coffee', desc: 'Green bean to retail cup',
    players: [
      { country: 'Brazil', role: 'Green bean', share: 0.35 }, { country: 'United States of America', role: 'Consumption', share: 0.18 },
      { country: 'Switzerland', role: 'Trading & brands', share: 0.12 }, { country: 'Italy', role: 'Roasting', share: 0.10 },
      { country: 'Germany', role: 'Roast & re-export', share: 0.09 }],
    chain: [
      { country: 'Brazil', stage: 'Bean cultivation', role: 'Extraction' }, { country: 'Italy', stage: 'Roasting', role: 'Processing' },
      { country: 'Switzerland', stage: 'Branding & trade', role: 'Value-add' }, { country: 'United Kingdom', stage: 'Retail market', role: 'Market' }],
  },
];

// air traffic — 28 hub airports, ~34 great-circle routes, 5 named corridors
export const FLIGHT_HUBS: Record<string, [number, number]> = {
  NYC: [-73.8, 40.6], LAX: [-118.4, 33.9], SFO: [-122.4, 37.6], ORD: [-87.9, 42.0], YYZ: [-79.6, 43.7],
  MEX: [-99.1, 19.4], GRU: [-46.5, -23.4], LHR: [-0.5, 51.5], CDG: [2.5, 49.0], FRA: [8.6, 50.0],
  AMS: [4.8, 52.3], MAD: [-3.6, 40.5], IST: [28.8, 41.0], SVO: [37.4, 55.9], DXB: [55.4, 25.3],
  DOH: [51.6, 25.3], DEL: [77.1, 28.6], BOM: [72.9, 19.1], SIN: [103.9, 1.4], HKG: [113.9, 22.3],
  PEK: [116.6, 40.1], PVG: [121.8, 31.1], NRT: [140.4, 35.8], ICN: [126.5, 37.5], BKK: [100.7, 13.7],
  SYD: [151.2, -33.9], JNB: [28.2, -26.1], CPT: [18.6, -33.9],
};
const RAW_ROUTES: [string, string][] = [
  ['NYC', 'LHR'], ['NYC', 'CDG'], ['LAX', 'NRT'], ['SFO', 'ICN'], ['ORD', 'FRA'], ['LHR', 'NYC'], ['LHR', 'DXB'],
  ['LHR', 'SIN'], ['DXB', 'SIN'], ['DXB', 'DEL'], ['DXB', 'LHR'], ['DOH', 'BKK'], ['FRA', 'PEK'], ['CDG', 'GRU'],
  ['AMS', 'SYD'], ['SIN', 'SYD'], ['HKG', 'LAX'], ['PVG', 'SFO'], ['NRT', 'SIN'], ['ICN', 'NYC'], ['DEL', 'DXB'],
  ['BOM', 'LHR'], ['IST', 'FRA'], ['IST', 'DEL'], ['SVO', 'PEK'], ['MEX', 'MAD'], ['GRU', 'JNB'], ['JNB', 'CPT'],
  ['SYD', 'LAX'], ['BKK', 'HKG'], ['PEK', 'HKG'], ['MAD', 'GRU'], ['YYZ', 'LHR'], ['AMS', 'DXB'],
];
export const FLIGHT_ROUTES: [[number, number], [number, number]][] = RAW_ROUTES
  .map(([a, b]) => [FLIGHT_HUBS[a], FLIGHT_HUBS[b]] as [[number, number], [number, number]])
  .filter((p) => p[0] && p[1]);
export const CORRIDORS = [
  { n: 'Transatlantic', r: 'NYC · LHR · CDG' }, { n: 'Gulf super-hub', r: 'DXB · DOH · SIN' },
  { n: 'Transpacific', r: 'LAX · NRT · ICN' }, { n: 'Kangaroo route', r: 'AMS · SIN · SYD' },
  { n: 'Intra-Asia', r: 'HKG · BKK · PEK' },
];

// satellites — 5 orbital shells (inc rad, node deg, altitude factor, count, speed, color)
export interface Orbit { inc: number; node: number; alt: number; count: number; speed: number; color: string }
export const ORBITS: Orbit[] = [
  { inc: 0.925, node: 20, alt: 1.10, count: 16, speed: 0.5, color: 'rgba(120,190,220,0.5)' },
  { inc: 1.57, node: 120, alt: 1.16, count: 11, speed: 0.42, color: 'rgba(150,175,215,0.42)' },
  { inc: 0.49, node: 250, alt: 1.08, count: 13, speed: 0.56, color: 'rgba(110,200,200,0.42)' },
  { inc: 1.13, node: 305, alt: 1.22, count: 9, speed: 0.36, color: 'rgba(140,180,220,0.38)' },
  { inc: 0.02, node: 0, alt: 1.36, count: 6, speed: 0.16, color: 'rgba(205,180,130,0.42)' },
];
export const SAT_SHELLS = [
  { n: 'LEO 53° · broadband', alt: '~550 km', count: 16 }, { n: 'Polar · Earth imaging', alt: '~700 km', count: 11 },
  { n: 'LEO 28° · crewed band', alt: '~420 km', count: 13 }, { n: 'MEO 65° · navigation', alt: '~20 200 km', count: 9 },
  { n: 'GEO · comms & weather', alt: '35 786 km', count: 6 },
];
export const SAT_TOTAL = SAT_SHELLS.reduce((a, b) => a + b.count, 0); // 55

// meteorological — 5 storm systems
export interface Storm { lon: number; lat: number; name: string; cat: string; spin: number }
export const STORMS: Storm[] = [
  { lon: -72, lat: 22, name: 'Hurricane · Caribbean', cat: 'Cat 3', spin: 1 },
  { lon: 129, lat: 19, name: 'Typhoon · W Pacific', cat: 'Cat 4', spin: 1 },
  { lon: -28, lat: 53, name: 'N-Atlantic low', cat: '968 hPa', spin: 1 },
  { lon: 88, lat: 15, name: 'Bay of Bengal', cat: 'Cat 1', spin: 1 },
  { lon: 156, lat: -17, name: 'Coral Sea', cat: 'Cat 2', spin: -1 },
];

// day / night — 9 timezones [city, label, offset hours]
export const ZONES: [string, string, number][] = [
  ['Los Angeles', 'UTC−8', -8], ['New York', 'UTC−5', -5], ['London', 'UTC±0', 0], ['Berlin', 'UTC+1', 1],
  ['Moscow', 'UTC+3', 3], ['Delhi', 'UTC+5:30', 5.5], ['Beijing', 'UTC+8', 8], ['Tokyo', 'UTC+9', 9], ['Sydney', 'UTC+10', 10],
];
