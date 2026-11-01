# Evaluation questions — public prompts

## react-01 — React

In React, how does a useState initializer function differ from a function passed to its setter?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-02 — React

In React, when should a component use a ref instead of state for an interval ID, and what render-time restriction applies?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-03 — React

In React, how does useContext choose a value when there is or is not a provider above the reader? Can a provider returned by that same reader affect it?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-04 — React

In React, what is useId intended to provide, and can it generate list keys or use() cache keys?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-05 — React

A React Effect connects to a service using a room prop, with Strict Mode enabled at the root. What happens on a changed dependency and unmount, and why can an extra connection cycle occur in development?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-06 — React

In React, all APIs named use are Hooks and must never be called conditionally. Is that true for use(promise), and how are its pending and rejected states handled?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-07 — React

A React component stores fullName derived from firstName and lastName in state and updates it with an Effect. What does React recommend instead, and when is an Effect appropriate?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-08 — React

How does React useActionState handle multiple dispatches, and where must dispatchAction be invoked?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-09 — React

In React, how should an optimistic state update and an asynchronous final state update be marked when using a Transition, including after await?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-10 — React

A React app reads a mutable external store during a non-blocking Transition. What snapshot rules apply, and what happens if the store changes before the DOM update?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-11 — React

A React chat component receives roomId and theme. Assume serverUrl is a module-level constant and the service helpers are imported. Repair this code so theme changes do not reconnect, roomId changes still reconnect, and connected notifications read the latest committed theme. Show the corrected component and React imports without suppressing dependency linting.

```jsx
function ChatRoom({ roomId, theme }) {
  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.on('connected', () => {
      showNotification('Connected!', theme);
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId, theme]);
  return null;
}
```

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## react-12 — React

For a server-rendered React component subscribing with useSyncExternalStore, what must be provided for hydration, and how should subscription and snapshots behave across renders?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

## nextjs-01 — Next.js

In Next.js 16.4.3 App Router, what is the default caching behavior for Route Handlers, and which methods can opt into caching when Cache Components is disabled?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-02 — Next.js

In Next.js 16.4.3 App Router, how do I access request cookies in a Server Component, and where can I set them?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-03 — Next.js

In Next.js 16.4.3 App Router, where should I define a Route Handler, and can it share a segment with a page?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-04 — Next.js

In Next.js 16.4.3 App Router, which component type are pages and layouts by default, and when would I use a Client Component?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-05 — Next.js

In Next.js 16.4.3 App Router, why can a Server Component fetch with no-store show old data after a development HMR refresh, and how can I clear that cache?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-06 — Next.js

In Next.js 16.4.3 App Router, how does revalidatePath distinguish a concrete URL from a dynamic route pattern, and what does a layout invalidation cover?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-07 — Next.js

In Next.js 16.4.3 App Router, when incrementally migrating from the Pages Router, which App Router conventions replace getStaticPaths, _app.js/_document.js, and pages/api/*?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-08 — Next.js

In Next.js 16.4.3 App Router, I assume identical GET fetches are persistently cached just because they are memoized during rendering. Is that correct, and does that memoization apply in Route Handlers?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-09 — Next.js

In Next.js 16.4.3 App Router, after a Server Action edits a post, I need the writer to see fresh tagged data immediately; for a webhook Route Handler I can tolerate stale data. Which API and behavior should each use?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-10 — Next.js

In Next.js 16.4.3 App Router, a webhook needs tagged data expired immediately without serving stale data, but updateTag fails in its Route Handler. What should I call and how must the tag be assigned first?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-11 — Next.js

I am migrating app/shop/[slug]/opengraph-image.tsx from Next.js 15 to 16.4.3 App Router. It exports generateImageMetadata({ params }), returning string image IDs, and a default Image({ params, id }) function. Which arguments become promises, and which remain synchronous? Show the corrected TypeScript parameter types and how to read them; the image-rendering implementation can be omitted.

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## nextjs-12 — Next.js

In Next.js 16.4.3 App Router, with Cache Components enabled, how do GET Route Handlers behave with runtime data, and how can a database query be included in a static response?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

## tanstack-01 — TanStack Query for React

In TanStack Query for React, what are the default retry count and retry delay for failed queries, and how does server rendering differ?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-02 — TanStack Query for React

In TanStack Query for React, I assume a disabled useQuery automatically refetches after invalidateQueries and that skipToken still permits its returned refetch. Is that correct, and what should I use for manual fetching?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-03 — TanStack Query for React

In TanStack Query for React, compare staleTime Infinity and static when invalidating an active query, including the special always-refetch options.

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-04 — TanStack Query for React

In TanStack Query for React, how can I invalidate every query whose key begins with todos, and how can I restrict this to the exact key?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-05 — TanStack Router for React

In TanStack Router for React, how do preload freshness and unused retention defaults differ, and when is unused data removed?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-06 — TanStack Router and Query for React

A React app uses TanStack Router loaders with TanStack Query. Query should decide whether preloaded data is fresh, rather than Router skipping the loader because of its own preload freshness window. What Router setting enables this? Show how a loader and component can share a posts query definition while the component remains subscribed to Query updates. Assume fetchPosts returns an array of posts and the router context and QueryClientProvider already use the same QueryClient. Choose an example Query freshness window and explain why the Router setting does not disable Query caching.

**Scope:** Official Router and Query main-branch documentation snapshots; not release-pinned.

## tanstack-07 — TanStack Router for React

In TanStack Router for React, how are nested URL search parameters represented, and how should a route turn parsed search parameters into trusted typed values?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-08 — TanStack Start for React

In TanStack Start for React, should an API intended for external cross-origin callers use a server function or a server route? What HTTP method does createServerFn use by default?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-09 — TanStack Start for React

In TanStack Start for React, what happens to server-function CSRF protection when adding a custom src/start.ts, and which middleware type applies to server functions as well as SSR requests?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-10 — TanStack Table for React

When migrating a React table from TanStack Table v8 to the full v9 useTable API, what hook and feature configuration changes are required, and what temporary compatibility alternative is available?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-11 — TanStack Table for React

With TanStack Table v9 for React using manual server-side pagination, why can row selection state contain IDs that getSelectedRowModel does not return, and how should row IDs be chosen?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## tanstack-12 — TanStack Table for React

In TanStack Table v9 for React, what happens to pageIndex auto-reset by default with manualPagination, why might explicitly enabling auto-reset still not reset it when server-side sorting changes, and how should you handle the missing reset?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

## takumi-01 — Takumi

What fonts are available by default in Takumi, and what should I do for non-Latin text?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-02 — Takumi

In Takumi image rendering, what format is the default, and how does WebP choose lossless versus lossy output?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-03 — Takumi

How do I render a Takumi template directly as either an SVG string or encoded raster bytes?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-04 — Takumi

A Takumi image layout looks wrong. What option can help inspect its node boxes, and what does it do?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-05 — Takumi

Takumi automatically applies Tailwind Preflight to its built-in tw parser, so headings have no default margin. How can I keep that automatic reset?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-06 — Takumi

When migrating Takumi v1 to v2, how should JavaScript code handle render calls and reusable fonts?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-07 — Takumi

How does Takumi devicePixelRatio affect the output image dimensions and CSS layout? How do I double the resolution of a 1200 by 630 design?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-08 — Takumi

How does Takumi handle an unknown style object property versus a supported property with an invalid value?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-09 — Takumi

Using Takumi's native Node.js backend in a Next.js App Router endpoint, write a GET handler returning a 1200 by 630 PNG containing Hello. If rendering fails, return a plain-text HTTP 503 instead of a broken image stream. Include the required native-binding bundler configuration.

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-10 — Takumi

A Takumi v1 template uses an absolutely positioned badge and Tailwind border-l-2 border-dashed. What v2 changes could alter the result without Preflight, and how do I fix them?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-11 — Takumi

For a Takumi template rendered both as an image and as a PDF, how do screen and print media queries behave, what happens with unlisted media features such as prefers-color-scheme, and how should I handle PDF blur filters?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

## takumi-12 — Takumi

A Takumi server renders untrusted image URLs and shares a byte cache. How should I restrict requests safely, and what happens when an image fetch fails?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

