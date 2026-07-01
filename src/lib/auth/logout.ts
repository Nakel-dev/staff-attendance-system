export const LOGOUT_PATH = "/auth/logout";

/** Hard navigation clears client cache and follows server redirect to login. */
export function navigateToLogout() {
  window.location.assign(LOGOUT_PATH);
}
