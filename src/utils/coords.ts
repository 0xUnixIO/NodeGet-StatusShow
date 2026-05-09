// [关键词, lng, lat]
export const REGION_COORDS: [string, number, number][] = [
  ['大阪', 135.5, 34.7], ['osaka', 135.5, 34.7],
  ['东京', 139.7, 35.7], ['tokyo', 139.7, 35.7],
  ['日本', 139.7, 35.7], ['japan', 139.7, 35.7], ['-jp', 139.7, 35.7], ['jp-', 139.7, 35.7], ['jp2', 139.7, 35.7],
  ['香港', 114.2, 22.3], ['hong kong', 114.2, 22.3], ['hkt', 114.2, 22.3], ['hk', 114.2, 22.3],
  ['新加坡', 103.8, 1.3], ['singapore', 103.8, 1.3], ['sgp', 103.8, 1.3],
  ['台湾', 121.5, 25.0], ['台北', 121.5, 25.0], ['taiwan', 121.5, 25.0],
  ['上海', 121.5, 31.2], ['沪', 121.5, 31.2],
  ['北京', 116.4, 39.9], ['京', 116.4, 39.9],
  ['广州', 113.3, 23.1], ['深圳', 114.1, 22.5], ['广', 113.3, 23.1],
  ['成都', 104.1, 30.7], ['杭州', 120.2, 30.3], ['武汉', 114.3, 30.6],
  ['韩国', 126.9, 37.6], ['首尔', 126.9, 37.6], ['korea', 126.9, 37.6], ['seoul', 126.9, 37.6],
  ['洛杉矶', -118.2, 34.1], ['los angeles', -118.2, 34.1], ['lax', -118.2, 34.1],
  ['圣何塞', -121.9, 37.3], ['san jose', -121.9, 37.3], ['sjc', -121.9, 37.3],
  ['纽约', -74.0, 40.7], ['new york', -74.0, 40.7], ['nyc', -74.0, 40.7],
  ['西雅图', -122.3, 47.6], ['seattle', -122.3, 47.6], ['sea', -122.3, 47.6],
  ['达拉斯', -96.8, 32.8], ['dallas', -96.8, 32.8], ['dfw', -97.0, 32.9],
  ['芝加哥', -87.6, 41.9], ['chicago', -87.6, 41.9],
  ['法兰克福', 8.7, 50.1], ['frankfurt', 8.7, 50.1], ['fra', 8.7, 50.1],
  ['柏林', 13.4, 52.5], ['berlin', 13.4, 52.5],
  ['阿姆斯特丹', 4.9, 52.4], ['amsterdam', 4.9, 52.4], ['ams', 4.9, 52.4],
  ['巴黎', 2.3, 48.9], ['paris', 2.3, 48.9],
  ['伦敦', -0.1, 51.5], ['london', -0.1, 51.5], ['lon', -0.1, 51.5],
  ['悉尼', 151.2, -33.9], ['sydney', 151.2, -33.9], ['syd', 151.2, -33.9],
  ['澳大利亚', 151.2, -33.9], ['australia', 151.2, -33.9],
  ['多伦多', -79.4, 43.7], ['toronto', -79.4, 43.7],
  ['温哥华', -123.1, 49.3], ['vancouver', -123.1, 49.3],
  ['莫斯科', 37.6, 55.8], ['moscow', 37.6, 55.8],
  ['马来西亚', 101.7, 3.1], ['malaysia', 101.7, 3.1], ['my', 101.7, 3.1], ['吉隆坡', 101.7, 3.1], ['kuala lumpur', 101.7, 3.1],
  ['美国', -95.7, 37.1], ['united states', -95.7, 37.1], ['us', -95.7, 37.1],
  ['中国', 116.4, 39.9], ['china', 116.4, 39.9], ['cn', 116.4, 39.9],
]

export function guessCoords(text: string): [number, number] | null {
  const lower = text.toLowerCase()
  for (const [kw, lng, lat] of REGION_COORDS) {
    if (lower.includes(kw.toLowerCase())) return [lng, lat]
  }
  return null
}

export function resolveCoords(meta?: { lat?: number | null; lng?: number | null; region?: string; name?: string }): [number, number] | null {
  const lat = meta?.lat ?? null
  const lng = meta?.lng ?? null
  if (lat != null && lng != null) return [lng, lat]
  const haystack = [meta?.region, meta?.name].filter(Boolean).join(' ')
  if (!haystack) return null
  return guessCoords(haystack)
}
