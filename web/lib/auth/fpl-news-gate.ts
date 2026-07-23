/** Routes that require a signed-in account. */
export function isFplNewsPath(path: string): boolean {
  return (
    path === "/news/fpl-daily" ||
    path.startsWith("/news/fpl-daily/") ||
    path === "/news/fpl-x" ||
    path.startsWith("/news/fpl-x/")
  );
}
