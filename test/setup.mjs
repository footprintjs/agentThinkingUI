// jsdom lacks a couple of browser bits the views/playback touch.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
if (!globalThis.matchMedia) {
  globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
}
