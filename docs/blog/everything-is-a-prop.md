# Everything is a prop

*Integrating AgentThinkingUI should feel like adding one of **your** components —
not configuring a third-party widget. So every seam, including how you inject the
debug context the protocol didn't carry, is a React prop.*

## Two ways to ship a UI library

A component can be integrated as a **platform you configure** — globals, a config
file, an `init()` call, a backend, a portal you log into — or as a **component you
compose** — you pass props, it renders. AgentThinkingUI is the second, all the way
down. The player is just another node in *your* React tree, driven entirely by the
props you give it.

## Everything is a prop

There is no control surface outside props:

- **look** — `theme` (incl. `mode: "dark"`), `labels`, `icons`, `brand`
- **the data** — the `trace` / `FlowGraph` *you* assemble (the adapter is a helper
  you call, not a backend the component talks to)
- **the semantic layer** — `classify` decides data-vs-instruction as you build it
- **integration back to your stack** — `onSelect`, `onNodeOpen`, `linkResolver`
- **the missing / debug content** — `renderDetail(step)` injects whatever your app
  has that the protocol didn't
- **behaviour** — `live`, `loop`, `mobile`, `storageKey`, `onRender`

No `window.*` to set (the back-compat global is a convenience, not the API). No
config file. No imperative handle you must call after mount. Even the theme rides
as CSS variables on the component's **own element**, scoped — so two players can
wear different brands on one page and nothing leaks into your app.

## Why it matters — injecting context is *native*

When debugging needs more than the trace holds, you don't reach for a side
channel. You pass a prop — the same way you pass any data in your app:

```jsx
<AgentThinkingUI
  trace={enrichedFromYourStore}                       // you own the data
  renderDetail={(s) => <YourContextPanel id={s.spanId} />}  // you own the detail
  linkResolver={(s) => yourDashboardUrl(s)}           // you own the links
/>
```

It reads like *your* code because it is. Props are reactive and **controlled**:
change one and the view follows — no global mutation, no instance crosstalk, no
"configure then hope." The component assumes nothing and reaches nowhere on its
own; what it shows is exactly what you passed.

## The bet

An embeddable UI earns its place when it feels like a component you **own**, not a
platform you bolt on. Make every seam — branding, the data, the semantic layer,
the debug context — a prop, and integrating it (and extending it when the protocol
falls short) becomes a native, declarative part of your application.
