/** Prefix in-app links while the development demo notebook is open. */
export function withDemoPrefix(pathname: string, to: string): string {
  const demo = pathname === '/demo' || pathname.startsWith('/demo/')
  if (!demo) return to
  if (to === '/') return '/demo'
  return to.startsWith('/demo') ? to : `/demo${to.startsWith('/') ? to : `/${to}`}`
}

export function bareJournalPath(pathname: string): string {
  if (pathname === '/demo') return '/'
  if (pathname.startsWith('/demo/')) return pathname.slice('/demo'.length)
  return pathname
}
