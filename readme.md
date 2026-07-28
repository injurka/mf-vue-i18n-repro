# Title

shared wrappers freeze live value exports (`vue@3.6` `currentInstance` breaks `vue-i18n`: "Must be called at the top of a setup function")

# Description

## Summary

When a package is declared in `shared` (e.g. `vue: { singleton: true }`), the
generated `loadShare` wrapper copies the package's named exports **by value**
once, at module evaluation time. This silently drops ESM live bindings for any
mutable *value* export. Since `vue@3.6.0-beta.x` (browser build) newly exports
its internal mutable `currentInstance`, any consumer that reads it — notably
`vue-i18n@11` — receives a permanently stale `null` and crashes on startup, in
both dev and production builds.

## Environment

- `@module-federation/vite`: 1.20.0
- `vite`: 8.1.5
- `vue`: 3.6.0-beta.17
- `vue-i18n`: 11.4.8

## Reproduction

```sh
bun install
bun run dev        # blank page, error in console
bun run build && bun run preview   # same error in production
```

The project is just a host with:

```ts
federation({
  name: 'repro_host',
  shared: { vue: { singleton: true } },
})
```

and a single component calling `useI18n()` in `setup`.

## Actual behavior

```
[Vue warn]: Unhandled error during execution of setup function at <App>
Uncaught (in promise) SyntaxError: Must be called at the top of a `setup` function
    at useI18n (vue-i18n.js)
    at setup (App.vue)
```

(`I18nErrorCodes.MUST_BE_CALL_SETUP_TOP` — vue-i18n sees
`getCurrentInstance() == null` inside a running `setup`.)

## Expected behavior

The page renders; shared wrappers preserve live bindings so value exports of
shared packages stay up to date.

## Root cause

1. `vue@3.6` (browser `esm-bundler` build of `@vue/runtime-core`) exports the
   internal **mutable** module-level `currentInstance` alongside
   `getCurrentInstance()`. `vue@3.5` exports only the getter function — which
   is why the bug does not reproduce there.
2. `vue-i18n@11.4.8` prefers the value export when present:
   ```js
   const key = 'currentInstance' // dynamic key to avoid bundler warnings
   if (key in Vue) return Vue[key]
   return Vue.getCurrentInstance()
   ```
3. The generated `loadShare__vue` virtual module snapshots exports once:
   ```js
   let __mf_345;
   const __mfApplySharedExports = (mod) => {
     __mf_345 = mod["currentInstance"]; // null at eval time — forever
   };
   export { __mf_345 as currentInstance };
   ```
   With a plain ESM namespace, `Vue.currentInstance` would be a live binding
   and stay correct; through the wrapper it is frozen to the value at module
   evaluation time (always `null`, since no component instance exists then).
   Function exports survive the copy (they keep pointing at real code), which
   is why everything else appears to work.
4. Dev evidence: the pre-bundled `node_modules/.vite/deps/vue-i18n.js` imports
   `virtual:mf:...loadShare__vue__loadShare__.js` instead of the real `vue`.
   Production evidence: the emitted `loadShare` chunk contains the same
   value-copy (`fS = $.currentInstance`).

## General impact

This is not vue-specific: any live *value* export of any `shared` package is
frozen at module-eval time for all consumers loaded through the wrapper.
`vue@3.6` + `vue-i18n` is just the first widely-used trigger. Note that the
Node/SSR build of `vue@3.6` does not export `currentInstance` — only the
browser build does — so the failure is specific to browser bundles.

## Workaround

Patch affected consumers to always use the getter function
(`Vue.getCurrentInstance()`), which survives the wrapper. A ready
`bun patch` for `vue-i18n@11.4.8` is included in the repro repo
(`mf-vue-i18n-repro-fixed/`), demonstrating that the app works once the stale
value read is removed.
