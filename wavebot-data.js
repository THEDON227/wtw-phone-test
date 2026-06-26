(function (global) {
  global.WTW_WAVEBOT_FALLBACK_PROMISE = (async function () {
    try {
      const response = await fetch('_dev/wtw-current-site-data-export-v1.json', { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json();
      global.WTW_WAVEBOT_FALLBACK = data;
      return data;
    } catch (error) {
      console.warn('WTW WaveBot fallback export load failed:', error);
      return null;
    }
  })();
})(window);
