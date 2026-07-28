# Fixed: @module-federation/vite shared vue + vue-i18n (vue-i18n patched)

Identical to `../mf-vue-i18n-repro-error`, but with a `bun patch` applied to
`vue-i18n@11.4.8` (`patches/` + `patchedDependencies` in `package.json`).

The patch makes vue-i18n always call `Vue.getCurrentInstance()` instead of
reading the `currentInstance` value export, which the Module Federation
`loadShare` wrapper copies by value once (losing the live binding and
leaving it `null` forever).

## Run

```sh
bun install   # applies patches/vue-i18n@11.4.8.patch automatically
bun run dev   # open http://localhost:5173 — renders "Hello from vue-i18n"
```

See `../mf-vue-i18n-repro-error/README.md` for the full bug description.

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
