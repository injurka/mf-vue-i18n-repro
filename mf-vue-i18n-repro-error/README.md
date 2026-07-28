# Repro: @module-federation/vite shared vue breaks vue-i18n (stale `currentInstance`)

Minimal reproduction for: host with `shared: { vue: { singleton: true } }` +
`vue@3.6.0-beta.17` + `vue-i18n@11.4.8` → any `useI18n()` call throws
`SyntaxError: Must be called at the top of a setup function`.

A patched variant that works is in `../mf-vue-i18n-repro-fixed`.

## Run

```sh
bun install   # or npm install / pnpm install
bun run dev   # open http://localhost:5173 — error in console, blank page
```

Also reproducible in production:

```sh
bun run build && bun run preview
```

## Expected

Page renders "Hello from vue-i18n".

## Actual

```
[Vue warn]: Unhandled error during execution of setup function at <App>
Uncaught (in promise) SyntaxError: Must be called at the top of a `setup` function
    at useI18n (vue-i18n.js)
    at setup (App.vue)
```

## Root cause

1. Vue 3.6 exports its internal mutable `currentInstance` (a live ESM binding).
2. vue-i18n prefers it over the getter function:
   ```js
   function getCurrentInstance() {
     const key = 'currentInstance' // avoid bundler warning
     if (key in Vue) return Vue[key]
     return Vue.getCurrentInstance()
   }
   ```
3. The generated `loadShare__vue` virtual module copies exports **by value**,
   once, at module evaluation time:
   ```js
   __mf_345 = mod["currentInstance"]   // null at eval time, forever
   export { __mf_345 as currentInstance }
   ```
   The live binding is lost, so `Vue.currentInstance` observed through the
   shared wrapper is always `null` → vue-i18n throws.
4. The same value-copy pattern exists in production builds
   (`fS = $.currentInstance` in the emitted loadShare chunk).

Note: this affects any live *value* export of a shared package, not only
`currentInstance` and not only vue.

## Workaround

Patch vue-i18n to always call `Vue.getCurrentInstance()`
(function exports survive the wrapper — only value bindings go stale).
