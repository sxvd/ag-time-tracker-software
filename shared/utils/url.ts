export function withAppBase(baseUrl: string, path: string) {
  const base = baseUrl === '/' ? '' : `/${baseUrl.replace(/^\/+|\/+$/g, '')}`
  const suffix = `/${path.replace(/^\/+/, '')}`
  return `${base}${suffix}`
}
