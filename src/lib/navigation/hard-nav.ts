/** Full page navigation — reliable when client-side routing leaves stale content. */
export function navigateTo(href: string) {
  window.location.assign(href);
}
