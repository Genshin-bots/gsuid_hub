/** Run after first contentful paint so extra locales / Twemoji do not contend with the login form. */
export function afterFirstPaint(fn: () => void, timeoutMs = 2500): void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    fn();
  };
  try {
    if (performance.getEntriesByName('first-contentful-paint').length) {
      run();
      return;
    }
    const obs = new PerformanceObserver((list) => {
      if (list.getEntries().some((entry) => entry.name === 'first-contentful-paint')) {
        obs.disconnect();
        run();
      }
    });
    obs.observe({ type: 'paint', buffered: true });
  } catch {
    run();
    return;
  }
  window.setTimeout(run, timeoutMs);
}
