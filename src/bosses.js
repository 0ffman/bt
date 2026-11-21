export const BOSSES = [
  // Low A
  { id: 'eva_guardian', name: "Eva's Guardian Millenu", level: 64, tier: 'low' },
  { id: 'karum', name: 'Guardian of the Statue of Giant Karum', level: 64, tier: 'low' },
  { id: 'kastor', name: 'Roaring Lord Kastor', level: 64, tier: 'low' },
  { id: 'kuri', name: 'Demon Kuri', level: 65, tier: 'low' },
  { id: 'lidia', name: 'Ghost of the Well Lidia', level: 66, tier: 'low' },
  { id: 'ancient_drake', name: 'Ancient Drake', level: 65, tier: 'low' },
  { id: 'gorgolos', name: 'Gorgolos', level: 66, tier: 'low' },
  { id: 'angel', name: 'Fierce Tiger King Angel', level: 66, tier: 'low' },
  { id: 'hekaton', name: 'Hekaton Prime', level: 67, tier: 'low' },
  { id: 'hisilrome', name: "Shilen's Priest Hisilrome", level: 67, tier: 'low' },
  { id: 'arak', name: 'Taik High Prefect Arak', level: 64, tier: 'low' },
  { id: 'abyss_brukunt', name: 'Abyss Brukunt', level: 65, tier: 'low' },
  { id: 'marpanak', name: 'Giant Marpanak', level: 65, tier: 'low' },
  { id: 'rahha', name: 'Rahha', level: 66, tier: 'low' },
  { id: 'tiphon', name: 'Gargoyle Lord Tiphon', level: 67, tier: 'low' },
  { id: 'ramdal', name: 'Enmity Ghost Ramdal', level: 67, tier: 'low' },
  { id: 'falston', name: "Demon's Agent Falston", level: 68, tier: 'low' },
  { id: 'utenus', name: 'Last Titan Utenus', level: 68, tier: 'low' },
  { id: 'kelone', name: "Kernon's Faithful Servant Kelone", level: 68, tier: 'low' },

  // High A
  { id: 'rudelto', name: 'Bloody Priest Rudelto', level: 70, tier: 'high' },
  { id: 'andras', name: 'Spirit of Andras, the Betrayer', level: 70, tier: 'high' },
  { id: 'meanas', name: 'Meanas Anor', level: 71, tier: 'high' },
  { id: 'cabrio', name: "Shilen's Messenger Cabrio", level: 70, tier: 'high' },
  { id: 'themis', name: 'Palibati Queen Themis', level: 71, tier: 'high' },
  { id: 'behemoth', name: 'Beast Lord Behemoth', level: 72, tier: 'high' },
  { id: 'zakaron', name: "Anakim's Nemesis Zakaron", level: 72, tier: 'high' },
  { id: 'skylancer', name: 'Roaring Skylancer', level: 71, tier: 'high' },
  { id: 'lokness', name: "Fafurion's Herald Lokness", level: 71, tier: 'high' },
  { id: 'korim', name: 'Korim', level: 70, tier: 'high' },
  { id: 'mardil', name: 'Immortal Savior Mardil', level: 72, tier: 'high' },
  { id: 'tanatos', name: 'Doom Blade Tanatos', level: 72, tier: 'high' },
  { id: 'sheshark', name: 'Water Dragon Seer Sheshark', level: 73, tier: 'high' },
  { id: 'kandra', name: 'Vanor Chief Kandra', level: 73, tier: 'high' },
  { id: 'hallate', name: 'Death Lord Hallate', level: 73, tier: 'high' },
  { id: 'flamestone', name: 'Flamestone Giant', level: 74, tier: 'high' },
  { id: 'cloe', name: 'Antharas Priest Cloe', level: 74, tier: 'high' },
  { id: 'sobekk', name: 'Krokian Padisha Sobekk', level: 74, tier: 'high' },
]

// Окно респавна в часах: фикс + случайная добавка
export const RESPAWN_WINDOW = {
  low:  { fixed: 10, randomMax: 4 },
  high: { fixed: 12, randomMax: 4 },
}

// «По минималке»: фикс + 8ч (разброс 4+4)
export const ESTIMATE_MIN_EXTRA_HOURS = 8

export function fixedRespawnMs(tier) {
  return (RESPAWN_WINDOW[tier]?.fixed ?? 10) * 3600 * 1000
}

export function rollRandomMs(tier) {
  const maxH = RESPAWN_WINDOW[tier]?.randomMax ?? 4
  return Math.random() * maxH * 3600 * 1000
}

export function rollRespawnMs(tier) {
  return fixedRespawnMs(tier) + rollRandomMs(tier)
}

// «По минималке»: фикс + 8ч, без рандома
export function estimateMinRespawnMs(tier) {
  return fixedRespawnMs(tier) + ESTIMATE_MIN_EXTRA_HOURS * 3600 * 1000
}