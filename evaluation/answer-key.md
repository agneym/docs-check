# Reference answers and grading key — PRIVATE

## react-01 — React

In React, how does a useState initializer function differ from a function passed to its setter?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** easy · **Category:** api-usage

### Reference answer

The initializer is pure, takes no arguments, and supplies initial state; it is ignored after initial render [e1]. A setter function is a pure updater receiving pending state; React queues it and applies queued updaters on the next render [e2].

### Criteria (2 points)

- **c1 (1):** Initializer is pure, takes no arguments, and its result initializes state; initialState is ignored after initial render. Evidence: e1.
- **c2 (1):** Setter updater is pure, receives pending state and is queued for the next render. Evidence: e2.

### Common mistakes

- Wrong: Both functions run on every render. Correction: The initializer is used for initialization and the updater is queued for the next render.

### Evidence

**e1:** [sources/react/src/content/reference/react/useState.md:41–42](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useState.md#L41-L42)

```text
* `initialState`: The value you want the state to be initially. It can be a value of any type, but there is a special behavior for functions. This argument is ignored after the initial render.
  * If you pass a function as `initialState`, it will be treated as an _initializer function_. It should be pure, should take no arguments, and should return a value of any type. React will call your initializer function when initializing the component, and store its return value as the initial state. [See an example below.](#avoiding-recreating-the-initial-state)
```

**e2:** [sources/react/src/content/reference/react/useState.md:74–74](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useState.md#L74-L74)

```text
  * If you pass a function as `nextState`, it will be treated as an _updater function_. It must be pure, should take the pending state as its only argument, and should return the next state. React will put your updater function in a queue and re-render your component. During the next render, React will calculate the next state by applying all of the queued updaters to the previous state. [See an example below.](#updating-state-based-on-the-previous-state)
```

## react-02 — React

In React, when should a component use a ref instead of state for an interval ID, and what render-time restriction applies?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** easy · **Category:** constraints

### Reference answer

A ref retains the same object across renders, and changing current does not trigger a render, making it appropriate for an interval ID not used for visual output [e1][e2]. Do not read or write current during rendering except for initialization [e3].

### Criteria (3 points)

- **c1 (1):** The ref object is retained across renders. Evidence: e1.
- **c2 (1):** Changing current does not trigger a render; refs suit information like an interval ID that does not affect visual output. Evidence: e2.
- **c3 (1):** Do not read or write current during render except for initialization. Evidence: e3.

### Common mistakes

- Wrong: Changing a ref causes a render. Correction: Changing ref.current does not cause React to re-render.

### Evidence

**e1:** [sources/react/src/content/reference/react/useRef.md:46–46](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useRef.md#L46-L46)

```text
On the next renders, `useRef` will return the same object.
```

**e2:** [sources/react/src/content/reference/react/useRef.md:75–75](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useRef.md#L75-L75)

```text
**Changing a ref does not trigger a re-render.** This means refs are perfect for storing information that doesn't affect the visual output of your component. For example, if you need to store an [interval ID](https://developer.mozilla.org/en-US/docs/Web/API/setInterval) and retrieve it later, you can put it in a ref. To update the value inside the ref, you need to manually change its <CodeStep step={2}>`current` property</CodeStep>:
```

**e3:** [sources/react/src/content/reference/react/useRef.md:52–52](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useRef.md#L52-L52)

```text
* Do not write _or read_ `ref.current` during rendering, except for [initialization.](#avoiding-recreating-the-ref-contents) This makes your component's behavior unpredictable.
```

## react-03 — React

In React, how does useContext choose a value when there is or is not a provider above the reader? Can a provider returned by that same reader affect it?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** easy · **Category:** defaults

### Reference answer

The nearest provider above supplies its value; without one, useContext returns createContext’s default value [e1]. A provider returned by the reader itself cannot affect that call; it must be above the reader [e2].

### Criteria (2 points)

- **c1 (1):** The nearest provider above supplies the value, or createContext defaultValue if none exists. Evidence: e1.
- **c2 (1):** A provider returned by the same component does not affect its useContext call. Evidence: e2.

### Common mistakes

- Wrong: A provider returned by the reader wraps and affects its own useContext call. Correction: The provider must be above the calling component.

### Evidence

**e1:** [sources/react/src/content/reference/react/useContext.md:41–41](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useContext.md#L41-L41)

```text
`useContext` returns the context value for the calling component. It is determined as the `value` passed to the closest `SomeContext` above the calling component in the tree. If there is no such provider, then the returned value will be the `defaultValue` you have passed to [`createContext`](/reference/react/createContext) for that context. The returned value is always up-to-date. React automatically re-renders components that read some context if it changes.
```

**e2:** [sources/react/src/content/reference/react/useContext.md:45–45](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useContext.md#L45-L45)

```text
* `useContext()` call in a component is not affected by providers returned from the *same* component. The corresponding `<Context>` **needs to be *above*** the component doing the `useContext()` call.
```

## react-04 — React

In React, what is useId intended to provide, and can it generate list keys or use() cache keys?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** easy · **Category:** constraints

### Reference answer

useId returns a unique ID string associated with the particular call and component [e1], useful for accessibility attributes [e2]. Do not use it for list keys or use() cache keys; generate these from data [e3][e4].

### Criteria (4 points)

- **c1 (1):** Returns a unique ID string associated with the call and component. Evidence: e1.
- **c2 (1):** Can supply IDs for accessibility attributes. Evidence: e2.
- **c3 (1):** Do not use it for list keys; keys should come from data. Evidence: e3.
- **c4 (1):** Do not use it for use() cache keys; derive cache keys from data. Evidence: e4.

### Common mistakes

- Wrong: useId is the recommended source of list keys. Correction: List keys should be generated from the data.

### Evidence

**e1:** [sources/react/src/content/reference/react/useId.md:41–41](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useId.md#L41-L41)

```text
`useId` returns a unique ID string associated with this particular `useId` call in this particular component.
```

**e2:** [sources/react/src/content/reference/react/useId.md:7–7](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useId.md#L7-L7)

```text
`useId` is a React Hook for generating unique IDs that can be passed to accessibility attributes.
```

**e3:** [sources/react/src/content/reference/react/useId.md:49–49](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useId.md#L49-L49)

```text
* `useId` **should not be used to generate keys** in a list. [Keys should be generated from your data.](/learn/rendering-lists#where-to-get-your-key)
```

**e4:** [sources/react/src/content/reference/react/useId.md:47–47](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useId.md#L47-L47)

```text
* `useId` **should not be used to generate cache keys** for [use()](/reference/react/use). The ID is stable when a component is mounted but may change during rendering. Cache keys should be generated from your data.
```

## react-05 — React

A React Effect connects to a service using a room prop, with Strict Mode enabled at the root. What happens on a changed dependency and unmount, and why can an extra connection cycle occur in development?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** medium · **Category:** debugging

### Reference answer

After a commit with changed dependencies, React runs the old cleanup before the new setup; on removal it runs cleanup [e1]. Root-level Strict Mode adds a development-only setup/cleanup cycle as a cleanup stress test; implement cleanup that mirrors setup [e2]. If Strict Mode is not enabled at the root, React does not re-run Effects an extra time on initial mount [e3].

### Criteria (2 points)

- **c1 (1):** On changed dependencies, old cleanup runs before new setup; cleanup also runs on removal. Evidence: e1.
- **c2 (1):** Root-level Strict Mode adds a development-only setup and cleanup cycle before real setup to stress-test cleanup. Evidence: e2, e3.

### Common mistakes

- Wrong: The extra cycle proves production always reconnects twice. Correction: The extra Strict Mode cycle is development-only.

### Evidence

**e1:** [sources/react/src/content/reference/react/useEffect.md:47–47](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useEffect.md#L47-L47)

```text
* `setup`: The function with your Effect's logic. Your setup function may also optionally return a *cleanup* function. When your [component commits](/learn/render-and-commit#step-3-react-commits-changes-to-the-dom), React will run your setup function. After every commit with changed dependencies, React will first run the cleanup function (if you provided it) with the old values, and then run your setup function with the new values. After your component is removed from the DOM, React will run your cleanup function.
```

**e2:** [sources/react/src/content/reference/react/useEffect.md:61–61](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useEffect.md#L61-L61)

```text
* When Strict Mode is on, React will **run one extra development-only setup+cleanup cycle** before the first real setup. This is a stress-test that ensures that your cleanup logic "mirrors" your setup logic and that it stops or undoes whatever the setup is doing. If this causes a problem, [implement the cleanup function.](/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development)
```

**e3:** [sources/react/src/content/reference/react/StrictMode.md:127–127](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/StrictMode.md#L127-L127)

```text
When `StrictMode` is enabled for a part of the app, React will only enable behaviors that are possible in production. For example, if `<StrictMode>` is not enabled at the root of the app, it will not [re-run Effects an extra time](#fixing-bugs-found-by-re-running-effects-in-development) on initial mount, since this would cause child effects to double fire without the parent effects, which cannot happen in production.
```

## react-06 — React

In React, all APIs named use are Hooks and must never be called conditionally. Is that true for use(promise), and how are its pending and rejected states handled?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** medium · **Category:** false-premise

### Reference answer

No. use(promise) is not a Hook and can be called in loops and conditions, though it must be inside a component or Hook [e1][e2]. A pending promise suspends and shows a surrounding Suspense fallback; rejection shows the nearest Error Boundary fallback [e3].

### Criteria (3 points)

- **c1 (1):** use(promise) is not a Hook and can be called in loops and conditions. Evidence: e1.
- **c2 (1):** use must be called inside a component or Hook. Evidence: e2.
- **c3 (1):** Pending promises suspend to Suspense fallback; rejected promises go to the nearest Error Boundary. Evidence: e3.

### Common mistakes

- Wrong: use(promise) must always be at the top level like useState. Correction: Unlike Hooks, use can be called in conditions and loops.

### Evidence

**e1:** [sources/react/src/content/reference/react/use.md:52–52](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/use.md#L52-L52)

```text
Call `use` with a [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) to read its resolved value. The component calling `use` *suspends* while the Promise is pending. Despite its name, `use` is not a Hook. Unlike Hooks, it can be called inside loops and conditional statements like `if`.
```

**e2:** [sources/react/src/content/reference/react/use.md:45–45](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/use.md#L45-L45)

```text
* `use` must be called inside a Component or a Hook.
```

**e3:** [sources/react/src/content/reference/react/use.md:62–62](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/use.md#L62-L62)

```text
If the component that calls `use` is wrapped in a [Suspense](/reference/react/Suspense) boundary, the fallback will be displayed while the Promise is pending. Once the Promise is resolved, the Suspense fallback is replaced by the rendered components using the data returned by `use`. If the Promise is rejected, the fallback of the nearest [Error Boundary](/reference/react/Component#catching-rendering-errors-with-an-error-boundary) will be displayed.
```

## react-07 — React

A React component stores fullName derived from firstName and lastName in state and updates it with an Effect. What does React recommend instead, and when is an Effect appropriate?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** medium · **Category:** multi-source

### Reference answer

Calculate fullName during rendering instead of keeping redundant state and an Effect [e1]. An immediate state update in an Effect causes an unnecessary extra render pass [e2]. Effects are appropriate for synchronization with external systems [e3].

### Criteria (3 points)

- **c1 (1):** Calculate the value from existing state during rendering rather than storing redundant state. Evidence: e1.
- **c2 (1):** An immediate Effect state update causes unnecessary extra render work. Evidence: e2.
- **c3 (1):** Effects are for synchronization with external systems. Evidence: e3.

### Common mistakes

- Wrong: Derived values should always be copied into state with an Effect. Correction: Calculate values derivable from state during rendering.

### Evidence

**e1:** [sources/react/src/content/learn/you-might-not-need-an-effect.md:63–63](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/learn/you-might-not-need-an-effect.md#L63-L63)

```text
**When something can be calculated from the existing props or state, [don't put it in state.](/learn/choosing-the-state-structure#avoid-redundant-state) Instead, calculate it during rendering.** This makes your code faster (you avoid the extra "cascading" updates), simpler (you remove some code), and less error-prone (you avoid bugs caused by different state variables getting out of sync with each other). If this approach feels new to you, [Thinking in React](/learn/thinking-in-react#step-3-find-the-minimal-but-complete-representation-of-ui-state) explains what should go into state.
```

**e2:** [sources/react/src/content/learn/you-might-not-need-an-effect.md:26–26](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/learn/you-might-not-need-an-effect.md#L26-L26)

```text
* **You don't need Effects to transform data for rendering.** For example, let's say you want to filter a list before displaying it. You might feel tempted to write an Effect that updates a state variable when the list changes. However, this is inefficient. When you update the state, React will first call your component functions to calculate what should be on the screen. Then React will ["commit"](/learn/render-and-commit) these changes to the DOM, updating the screen. Then React will run your Effects. If your Effect *also* immediately updates the state, this restarts the whole process from scratch! To avoid the unnecessary render passes, transform all the data at the top level of your components. That code will automatically re-run whenever your props or state change.
```

**e3:** [sources/react/src/content/reference/react/useEffect.md:7–7](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useEffect.md#L7-L7)

```text
`useEffect` is a React Hook that lets you [synchronize a component with an external system.](/learn/synchronizing-with-effects)
```

## react-08 — React

How does React useActionState handle multiple dispatches, and where must dispatchAction be invoked?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** medium · **Category:** api-usage

### Reference answer

The action receives previous state followed by the payload [e1]. Dispatches are queued and executed sequentially, each receiving the previous result [e2]. Dispatch inside an Action, for example using startTransition or an Action prop [e3].

### Criteria (3 points)

- **c1 (1):** The action receives previous state followed by the dispatch payload. Evidence: e1.
- **c2 (1):** Multiple dispatches are executed sequentially, passing the previous result as state. Evidence: e2.
- **c3 (1):** Dispatch must be called inside an Action, such as startTransition or an Action prop. Evidence: e3.

### Common mistakes

- Wrong: Multiple dispatches always execute in parallel. Correction: React queues and executes them sequentially.

### Evidence

**e1:** [sources/react/src/content/reference/react/useActionState.md:42–42](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useActionState.md#L42-L42)

```text
* `reducerAction`: The function to be called when the Action is triggered. When called, it receives the previous state (initially the `initialState` you provided, then its previous return value) as its first argument, followed by the `actionPayload` passed to `dispatchAction`.
```

**e2:** [sources/react/src/content/reference/react/useActionState.md:59–59](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useActionState.md#L59-L59)

```text
* React queues and executes multiple calls to `dispatchAction` sequentially. Each call to `reducerAction` receives the result of the previous call.
```

**e3:** [sources/react/src/content/reference/react/useActionState.md:70–70](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useActionState.md#L70-L70)

```text
You can wrap it in [`startTransition`](/reference/react/startTransition), or pass it to an [Action prop](/reference/react/useTransition#exposing-action-props-from-components). Calls outside that scope won’t be treated as part of the Transition and [log an error](#async-function-outside-transition) on development mode.
```

## react-09 — React

In React, how should an optimistic state update and an asynchronous final state update be marked when using a Transition, including after await?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Call the useOptimistic setter inside an Action [e1]. Currently state setters after await need another startTransition to be marked as Transitions [e2].

### Criteria (2 points)

- **c1 (1):** The optimistic setter must be called inside an Action. Evidence: e1.
- **c2 (1):** State setters after await require another startTransition to be marked as Transitions. Evidence: e2.

### Common mistakes

- Wrong: All setters after await automatically remain marked as Transition updates. Correction: Currently, wrap setters after await in another startTransition.

### Evidence

**e1:** [sources/react/src/content/reference/react/useOptimistic.md:80–80](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useOptimistic.md#L80-L80)

```text
* The `set` function must be called inside an [Action](reference/react/useTransition#functions-called-in-starttransition-are-called-actions). If you call the setter outside an Action, [React will show a warning](#an-optimistic-state-update-occurred-outside-a-transition-or-action) and the optimistic state will briefly render.
```

**e2:** [sources/react/src/content/reference/react/useTransition.md:98–98](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useTransition.md#L98-L98)

```text
* `action`: A function that updates some state by calling one or more [`set` functions](/reference/react/useState#setstate). React calls `action` immediately with no parameters and marks all state updates scheduled synchronously during the `action` function call as Transitions. Any async calls that are awaited in the `action` will be included in the Transition, but currently require wrapping any `set` functions after the `await` in an additional `startTransition` (see [Troubleshooting](#react-doesnt-treat-my-state-update-after-await-as-a-transition)). State updates marked as Transitions will be [non-blocking](#perform-non-blocking-updates-with-actions) and [will not display unwanted loading indicators](#preventing-unwanted-loading-indicators).
```

## react-10 — React

A React app reads a mutable external store during a non-blocking Transition. What snapshot rules apply, and what happens if the store changes before the DOM update?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

getSnapshot must return the same value while the store is unchanged; React compares using Object.is [e1]. Snapshots must be immutable: cache the last snapshot until the mutable data changes, then return a new immutable snapshot [e2]. During a Transition React checks again before DOM changes and restarts as blocking if the snapshot differs [e3].

### Criteria (3 points)

- **c1 (1):** Repeated getSnapshot calls return the same value while unchanged, compared using Object.is. Evidence: e1.
- **c2 (1):** Snapshots are immutable; cache unchanged snapshots and replace when data changes. Evidence: e2.
- **c3 (1):** React checks again before DOM changes and restarts the Transition update as blocking if the snapshot changed. Evidence: e3.

### Common mistakes

- Wrong: A changed external store snapshot is committed as a non-blocking Transition without rechecking. Correction: React rechecks and restarts as blocking if the snapshot changed.

### Evidence

**e1:** [sources/react/src/content/reference/react/useSyncExternalStore.md:46–46](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useSyncExternalStore.md#L46-L46)

```text
* `getSnapshot`: A function that returns a snapshot of the data in the store that's needed by the component. While the store has not changed, repeated calls to `getSnapshot` must return the same value. If the store changes and the returned value is different (as compared by [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is)), React re-renders the component.
```

**e2:** [sources/react/src/content/reference/react/useSyncExternalStore.md:56–56](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useSyncExternalStore.md#L56-L56)

```text
* The store snapshot returned by `getSnapshot` must be immutable. If the underlying store has mutable data, return a new immutable snapshot if the data has changed. Otherwise, return a cached last snapshot.
```

**e3:** [sources/react/src/content/reference/react/useSyncExternalStore.md:60–60](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useSyncExternalStore.md#L60-L60)

```text
* If the store is mutated during a [non-blocking Transition update](/reference/react/useTransition), React will fall back to performing that update as blocking. Specifically, for every Transition update, React will call `getSnapshot` a second time just before applying changes to the DOM. If it returns a different value than when it was called originally, React will restart the update from scratch, this time applying it as a blocking update, to ensure that every component on screen is reflecting the same version of the store.
```

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

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Separate the connected notification into an Effect Event, whose callback reads the latest committed theme without making the connection Effect reactive to theme [e1][e2]. Keep roomId reactive and preserve connection setup and cleanup; omit the Effect Event from dependencies [e3][e4].

```jsx
import { useEffect, useEffectEvent } from 'react';

function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);
  });

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.on('connected', () => {
      onConnected();
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]);

  return null;
}
```

This extracts a genuinely non-reactive event, not the room-dependent connection itself. Accept other documented implementations that meet the same lifecycle, freshness, and linting requirements; the exact helper name or code formatting is not required.

### Criteria (4 points)

- **c1 (2):** Shows corrected code, including the necessary React imports, that separates the notification from connection reactivity while reading the latest committed theme; useEffectEvent is the reference implementation, not a required spelling for a valid documented alternative. Evidence: e1, e2, e3.
- **c2 (1):** The connection Effect remains reactive to roomId but not theme, without lint suppression; if using an Effect Event, omit it from the dependency array. Evidence: e3, e4.
- **c3 (1):** Preserves the connected listener, connection setup, and disconnect cleanup so room changes reconnect and removal disconnects. Evidence: e3.

### Common mistakes

- Wrong: Simply delete theme from the dependencies while leaving the notification callback unchanged. Correction: That leaves a reactive theme read inside the Effect; extract the notification into an Effect Event so it sees the latest committed theme without reconnecting.
- Wrong: Move the entire connection setup into an Effect Event and remove roomId from dependencies. Correction: The room-dependent connection must stay reactive; only the connected notification is non-reactive.

### Evidence

**e1:** [sources/react/src/content/reference/react/useEffectEvent.md:41–41](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useEffectEvent.md#L41-L41)

```text
* `callback`: A function containing the logic for your Effect Event. The function can accept any number of arguments and return any value. When you call the returned Effect Event function, the `callback` always accesses the latest committed values from render at the time of the call.
```

**e2:** [sources/react/src/content/learn/separating-events-from-effects.md:406–412](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/learn/separating-events-from-effects.md#L406-L412)

```text
import { useEffect, useEffectEvent } from 'react';

function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);
  });
```

**e3:** [sources/react/src/content/learn/separating-events-from-effects.md:420–432](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/learn/separating-events-from-effects.md#L420-L432)

```text
function ChatRoom({ roomId, theme }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);
  });

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);
    connection.on('connected', () => {
      onConnected();
    });
    connection.connect();
    return () => connection.disconnect();
  }, [roomId]); // ✅ All dependencies declared
```

**e4:** [sources/react/src/content/learn/separating-events-from-effects.md:436–436](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/learn/separating-events-from-effects.md#L436-L436)

```text
This solves the problem. Note that you had to *remove* `theme` from the list of your Effect's dependencies, because it's no longer used in the Effect. You also don't need to *add* `onConnected` to it, because **Effect Events are not reactive and must be omitted from dependencies.**
```

## react-12 — React

For a server-rendered React component subscribing with useSyncExternalStore, what must be provided for hydration, and how should subscription and snapshots behave across renders?

**Scope:** Official react.dev main-branch documentation snapshot; not a release-pinned checkout.

**Difficulty:** hard · **Category:** constraints

### Reference answer

Provide getServerSnapshot for server rendering and hydration; its result must match between server and client, and omitting it makes server rendering throw [e1]. subscribe receives a callback and returns cleanup; a different subscribe function causes resubscription [e2][e3]. getSnapshot must return the same value while unchanged, and immutable snapshots should be cached until data changes [e4][e5].

### Criteria (5 points)

- **c1 (1):** getServerSnapshot is used for server rendering and hydration; it must match between server and client, and omission causes server rendering to throw. Evidence: e1.
- **c2 (1):** subscribe receives a callback and returns a cleanup function. Evidence: e2.
- **c3 (1):** Changing subscribe identity causes resubscription. Evidence: e3.
- **c4 (1):** getSnapshot returns the same value while the store is unchanged. Evidence: e4.
- **c5 (1):** Snapshots must be immutable, with a new immutable snapshot when underlying mutable data changes. Evidence: e5.

### Common mistakes

- Wrong: getServerSnapshot may be omitted during server rendering. Correction: If omitted, server rendering the component throws.

### Evidence

**e1:** [sources/react/src/content/reference/react/useSyncExternalStore.md:48–48](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useSyncExternalStore.md#L48-L48)

```text
* **optional** `getServerSnapshot`: A function that returns the initial snapshot of the data in the store. It will be used only during server rendering and during hydration of server-rendered content on the client. The server snapshot must be the same between the client and the server, and is usually serialized and passed from the server to the client. If you omit this argument, rendering the component on the server will throw an error.
```

**e2:** [sources/react/src/content/reference/react/useSyncExternalStore.md:44–44](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useSyncExternalStore.md#L44-L44)

```text
* `subscribe`: A function that takes a single `callback` argument and subscribes it to the store. When the store changes, it should invoke the provided `callback`, which will cause React to re-call `getSnapshot` and (if needed) re-render the component. The `subscribe` function should return a function that cleans up the subscription.
```

**e3:** [sources/react/src/content/reference/react/useSyncExternalStore.md:58–58](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useSyncExternalStore.md#L58-L58)

```text
* If a different `subscribe` function is passed during a re-render, React will re-subscribe to the store using the newly passed `subscribe` function. You can prevent this by declaring `subscribe` outside the component.
```

**e4:** [sources/react/src/content/reference/react/useSyncExternalStore.md:46–46](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useSyncExternalStore.md#L46-L46)

```text
* `getSnapshot`: A function that returns a snapshot of the data in the store that's needed by the component. While the store has not changed, repeated calls to `getSnapshot` must return the same value. If the store changes and the returned value is different (as compared by [`Object.is`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is)), React re-renders the component.
```

**e5:** [sources/react/src/content/reference/react/useSyncExternalStore.md:56–56](https://github.com/reactjs/react.dev/blob/0821e7d9428a6c58c922765b891bbffba9ed6249/src/content/reference/react/useSyncExternalStore.md#L56-L56)

```text
* The store snapshot returned by `getSnapshot` must be immutable. If the underlying store has mutable data, return a new immutable snapshot if the data has changed. Otherwise, return a cached last snapshot.
```

## nextjs-01 — Next.js

In Next.js 16.4.3 App Router, what is the default caching behavior for Route Handlers, and which methods can opt into caching when Cache Components is disabled?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** easy · **Category:** defaults

### Reference answer

Route Handlers are not cached by default; GET can opt into caching, for example with force-static. [e1] Other supported methods are not cached even alongside a cached GET. [e2]

### Criteria (2 points)

- **c1 (1):** Route Handlers are not cached by default; GET can opt into caching, for example with force-static. Evidence: e1.
- **c2 (1):** Other supported methods are not cached even alongside a cached GET. Evidence: e2.

### Common mistakes

- Wrong: All handler methods are cached automatically. Correction: Route Handlers are not cached by default; GET can opt into caching, for example with force-static.

### Evidence

**e1:** [sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx:51–51](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/15-route-handlers.mdx#L51-L51)

```text
Route Handlers are not cached by default. You can, however, opt into caching for `GET` methods. Other supported HTTP methods are **not** cached. To cache a `GET` method, use a [route config option](/docs/app/guides/caching-without-cache-components#dynamic) such as `export const dynamic = 'force-static'` in your Route Handler file.
```

**e2:** [sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx:85–85](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/15-route-handlers.mdx#L85-L85)

```text
> **Good to know**: Other supported HTTP methods are **not** cached, even if they are placed alongside a `GET` method that is cached, in the same file.
```

## nextjs-02 — Next.js

In Next.js 16.4.3 App Router, how do I access request cookies in a Server Component, and where can I set them?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** easy · **Category:** api-usage

### Reference answer

Import cookies from next/headers and await it to read incoming cookies in a Server Component; Server Functions and Route Handlers can read and write cookies. [e1] Do not set cookies during Server Component rendering; invoke a Server Function from the client or use a Route Handler. [e2]

### Criteria (2 points)

- **c1 (1):** Import cookies from next/headers and await it to read incoming cookies in a Server Component; Server Functions and Route Handlers can read and write cookies. Evidence: e1.
- **c2 (1):** Do not set cookies during Server Component rendering; invoke a Server Function from the client or use a Route Handler. Evidence: e2.

### Common mistakes

- Wrong: Cookies can be set while rendering a Server Component. Correction: Setting cookies is not supported during Server Component rendering; invoke a Server Function from the client or use a Route Handler.

### Evidence

**e1:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/cookies.mdx:6–10](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/cookies.mdx#L6-L10)

```text
`cookies` is an **async** function that allows you to read the HTTP incoming request cookies in [Server Components](/docs/app/getting-started/server-and-client-components), and read/write outgoing request cookies in [Server Functions](/docs/app/getting-started/mutating-data) or [Route Handlers](/docs/app/api-reference/file-conventions/route).
```

**e2:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/cookies.mdx:81–81](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/cookies.mdx#L81-L81)

```text
- **Setting cookies** is not supported during Server Component rendering. To modify cookies, invoke a Server Function from the client or use a Route Handler.
```

## nextjs-03 — Next.js

In Next.js 16.4.3 App Router, where should I define a Route Handler, and can it share a segment with a page?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** easy · **Category:** constraints

### Reference answer

Define it in a route.js or route.ts file inside app. [e1] A route.js and page.js cannot be at the same route segment level. [e2]

### Criteria (2 points)

- **c1 (1):** Define it in a route.js or route.ts file inside app. Evidence: e1.
- **c2 (1):** A route.js and page.js cannot be at the same route segment level. Evidence: e2.

### Common mistakes

- Wrong: A page and route handler may coexist at the same segment. Correction: A route.js and page.js cannot be at the same route segment level.

### Evidence

**e1:** [sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx:29–29](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/15-route-handlers.mdx#L29-L29)

```text
Route Handlers are defined in a [`route.js|ts` file](/docs/app/api-reference/file-conventions/route) inside the `app` directory:
```

**e2:** [sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx:39–39](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/15-route-handlers.mdx#L39-L39)

```text
Route Handlers can be nested anywhere inside the `app` directory, similar to `page.js` and `layout.js`. But there **cannot** be a `route.js` file at the same route segment level as `page.js`.
```

## nextjs-04 — Next.js

In Next.js 16.4.3 App Router, which component type are pages and layouts by default, and when would I use a Client Component?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** easy · **Category:** defaults

### Reference answer

Pages and layouts are Server Components by default. [e1] Use a Client Component for browser-only APIs such as localStorage. [e2] Use a Client Component for state and event handlers. [e3]

### Criteria (3 points)

- **c1 (1):** Pages and layouts are Server Components by default. Evidence: e1.
- **c2 (1):** Use a Client Component for browser-only APIs such as localStorage. Evidence: e2.
- **c3 (1):** Use a Client Component for state and event handlers. Evidence: e3.

### Common mistakes

- Wrong: Pages are Client Components by default. Correction: Pages and layouts are Server Components by default.

### Evidence

**e1:** [sources/nextjs/docs/01-app/01-getting-started/05-server-and-client-components.mdx:12–12](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/05-server-and-client-components.mdx#L12-L12)

```text
By default, layouts and pages are [Server Components](https://react.dev/reference/rsc/server-components), which lets you fetch data and render parts of your UI on the server, optionally cache the result, and stream it to the client. When you need interactivity or browser APIs, you can use [Client Components](https://react.dev/reference/rsc/use-client) to layer in functionality.
```

**e2:** [sources/nextjs/docs/01-app/01-getting-started/05-server-and-client-components.mdx:26–26](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/05-server-and-client-components.mdx#L26-L26)

```text
- Browser-only APIs. E.g. `localStorage`, `window`, `navigator.geolocation`, etc.
```

**e3:** [sources/nextjs/docs/01-app/01-getting-started/05-server-and-client-components.mdx:24–24](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/05-server-and-client-components.mdx#L24-L24)

```text
- [State](https://react.dev/learn/managing-state) and [event handlers](https://react.dev/learn/responding-to-events). E.g. `onClick`, `onChange`.
```

## nextjs-05 — Next.js

In Next.js 16.4.3 App Router, why can a Server Component fetch with no-store show old data after a development HMR refresh, and how can I clear that cache?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** medium · **Category:** debugging

### Reference answer

The development HMR cache applies even to no-store fetches, so HMR refreshes may show old data. [e1] Navigation or a full-page reload clears the cache. [e1]

### Criteria (2 points)

- **c1 (1):** The development HMR cache applies even to no-store fetches, so HMR refreshes may show old data. Evidence: e1.
- **c2 (1):** Navigation or a full-page reload clears the HMR cache. Evidence: e1.

### Common mistakes

- Wrong: no-store guarantees fresh data across every HMR refresh. Correction: The development HMR cache applies even to no-store fetches, so HMR refreshes may show old data; navigation or a full-page reload clears it.

### Evidence

**e1:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/fetch.mdx:105–105](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/fetch.mdx#L105-L105)

```text
By default, the [HMR cache](/docs/app/api-reference/config/next-config-js/serverComponentsHmrCache) applies to all fetch requests, including those with the default `auto no cache` and `cache: 'no-store'` option. This means uncached requests will not show fresh data between HMR refreshes. However, the cache will be cleared on navigation or full-page reloads.
```

**e2:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/fetch.mdx:103–103](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/fetch.mdx#L103-L103)

```text
Next.js caches `fetch` responses in Server Components across Hot Module Replacement (HMR) in local development for faster responses and to reduce costs for billed API calls.
```

## nextjs-06 — Next.js

In Next.js 16.4.3 App Router, how does revalidatePath distinguish a concrete URL from a dynamic route pattern, and what does a layout invalidation cover?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** medium · **Category:** api-usage

### Reference answer

For a dynamic route pattern supply type page or layout; omit type for a literal path. [e1] A layout invalidation covers the layout, nested layouts, and pages beneath them. [e2] Do not append /page or /layout to the path; use the type parameter. [e3]

### Criteria (3 points)

- **c1 (1):** For a dynamic route pattern supply type page or layout; omit type for a literal path. Evidence: e1.
- **c2 (1):** A layout invalidation covers the layout, nested layouts, and pages beneath them. Evidence: e2.
- **c3 (1):** Do not append /page or /layout to the path; use the type parameter. Evidence: e3.

### Common mistakes

- Wrong: A dynamic route pattern never needs a type. Correction: For a dynamic route pattern supply type page or layout; omit type for a literal path.

### Evidence

**e1:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx:29–29](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx#L29-L29)

```text
- `type`: (optional) `'page'` or `'layout'` string to change the type of path to revalidate. If `path` contains a dynamic segment, for example `/product/[slug]`, this parameter is required. If `path` is a literal path like `/product/1`, omit `type`.
```

**e2:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx:42–42](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx#L42-L42)

```text
- **Layouts**: Invalidates the layout (the `layout.tsx` at that segment), all nested layouts beneath it, and all pages beneath them
```

**e3:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx:28–28](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/revalidatePath.mdx#L28-L28)

```text
- `path`: Either a string that represents your route file structure. This can be a literal path like `/product/123`, or a route pattern with dynamic segments like `/product/[slug]`. Do not append `/page` or `/layout`, use the `type` parameter instead. Must not exceed 1024 characters. This value is case-sensitive. You do not need to include a trailing slash, regardless of your [`trailingSlash`](/docs/app/api-reference/config/next-config-js/trailingSlash) config.
```

## nextjs-07 — Next.js

In Next.js 16.4.3 App Router, when incrementally migrating from the Pages Router, which App Router conventions replace getStaticPaths, _app.js/_document.js, and pages/api/*?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** medium · **Category:** migration

### Reference answer

In app, generateStaticParams replaces getStaticPaths. [e1] A single app/layout.js root layout replaces pages/_app.js and pages/_document.js. [e2] The route.js Route Handler convention replaces pages/api/* API Routes. [e3]

### Criteria (3 points)

- **c1 (1):** In app, generateStaticParams replaces getStaticPaths. Evidence: e1.
- **c2 (1):** A single app/layout.js root layout replaces pages/_app.js and pages/_document.js. Evidence: e2.
- **c3 (1):** The route.js Route Handler convention replaces pages/api/* API Routes. Evidence: e3.

### Common mistakes

- Wrong: App Router pages should continue using getStaticPaths. Correction: In app, generateStaticParams replaces getStaticPaths.

### Evidence

**e1:** [sources/nextjs/docs/01-app/02-guides/migrating/app-router-migration.mdx:138–138](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/02-guides/migrating/app-router-migration.mdx#L138-L138)

```text
- Data fetching functions like `getServerSideProps` and `getStaticProps` have been replaced with [a new API](/docs/app/getting-started/fetching-data) inside `app`. `getStaticPaths` has been replaced with [`generateStaticParams`](/docs/app/api-reference/functions/generate-static-params).
```

**e2:** [sources/nextjs/docs/01-app/02-guides/migrating/app-router-migration.mdx:139–139](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/02-guides/migrating/app-router-migration.mdx#L139-L139)

```text
- `pages/_app.js` and `pages/_document.js` have been replaced with a single `app/layout.js` root layout. [Learn more](/docs/app/api-reference/file-conventions/layout#root-layout).
```

**e3:** [sources/nextjs/docs/01-app/02-guides/migrating/app-router-migration.mdx:142–142](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/02-guides/migrating/app-router-migration.mdx#L142-L142)

```text
- `pages/api/*` API Routes have been replaced with the [`route.js`](/docs/app/api-reference/file-conventions/route) (Route Handler) special file.
```

## nextjs-08 — Next.js

In Next.js 16.4.3 App Router, I assume identical GET fetches are persistently cached just because they are memoized during rendering. Is that correct, and does that memoization apply in Route Handlers?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** medium · **Category:** false-premise

### Reference answer

No. Matching GET fetches are memoized for one server render pass, separate from persistent caching across requests. [e1] Memoization does not apply in Route Handlers because they are not part of the React component tree. [e2]

### Criteria (2 points)

- **c1 (1):** No. Matching GET fetches are memoized for one server render pass, separate from persistent caching across requests. Evidence: e1.
- **c2 (1):** Memoization does not apply in Route Handlers because they are not part of the React component tree. Evidence: e2.

### Common mistakes

- Wrong: Render-pass memoization implies persistent caching. Correction: No. Matching GET fetches are memoized for one server render pass, separate from persistent caching across requests.

### Evidence

**e1:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/fetch.mdx:88–88](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/fetch.mdx#L88-L88)

```text
`fetch` requests using `GET` with the same URL and options are automatically [memoized](/docs/app/glossary#memoization) during a server render pass. If you call the same `fetch` in multiple Server Components, layouts, pages, `generateStaticParams` and `generateViewport`, Next.js executes it only once and shares the result. This is separate from persistent [caching](/docs/app/getting-started/caching): memoization lasts only for a single render pass, while cached responses persist across requests.
```

**e2:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/fetch.mdx:97–97](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/fetch.mdx#L97-L97)

```text
> **Good to know**: Memoization does not apply in [Route Handlers](/docs/app/api-reference/file-conventions/route), since they are not part of the React component tree.
```

## nextjs-09 — Next.js

In Next.js 16.4.3 App Router, after a Server Action edits a post, I need the writer to see fresh tagged data immediately; for a webhook Route Handler I can tolerate stale data. Which API and behavior should each use?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Use updateTag in the Server Action; it is not available in Route Handlers. [e1] updateTag immediately expires the tag; the next request waits for fresh data rather than serving stale data. [e2] In the webhook Route Handler use revalidateTag with the max profile for stale-while-revalidate. [e3] [e4]

### Criteria (3 points)

- **c1 (1):** Use updateTag in the Server Action; it is not available in Route Handlers. Evidence: e1.
- **c2 (1):** updateTag immediately expires the tag; the next request waits for fresh data rather than serving stale data. Evidence: e2.
- **c3 (1):** In the webhook Route Handler use revalidateTag with the max profile for stale-while-revalidate. Evidence: e3, e4.

### Common mistakes

- Wrong: updateTag is available in Route Handlers. Correction: Use updateTag in the Server Action; it is not available in Route Handlers.

### Evidence

**e1:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/updateTag.mdx:12–12](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/updateTag.mdx#L12-L12)

```text
`updateTag` can **only** be called from within [Server Actions](/docs/app/getting-started/mutating-data). It cannot be used in Route Handlers, Client Components, or any other context.
```

**e2:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/updateTag.mdx:16–16](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/updateTag.mdx#L16-L16)

```text
> **Good to know**: `updateTag` immediately expires the cached data for the specified tag. The next request will wait to fetch fresh data rather than serving stale content from the cache, ensuring users see their changes immediately.
```

**e3:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx:23–23](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx#L23-L23)

```text
- **`profile="max"` (recommended)**: A one year window, long enough that requests are always served stale content while the revalidation runs.
```

**e4:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx:15–15](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx#L15-L15)

```text
`revalidateTag` can be called in Server Functions and Route Handlers.
```

## nextjs-10 — Next.js

In Next.js 16.4.3 App Router, a webhook needs tagged data expired immediately without serving stale data, but updateTag fails in its Route Handler. What should I call and how must the tag be assigned first?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Call revalidateTag(tag, { expire: 0 }); the next request blocks to revalidate rather than receiving stale content. [e1] updateTag is limited to Server Actions and cannot be called in a Route Handler. [e2] First assign the tag with fetch next.tags, or use cacheTag inside a use cache scope. [e3] [e4]

### Criteria (3 points)

- **c1 (1):** Call revalidateTag(tag, { expire: 0 }); the next request blocks to revalidate rather than receiving stale content. Evidence: e1.
- **c2 (1):** updateTag is limited to Server Actions and cannot be called in a Route Handler. Evidence: e2.
- **c3 (1):** First assign the tag with fetch next.tags, or use cacheTag inside a use cache scope; either method suffices. Evidence: e3, e4.

### Common mistakes

- Wrong: Use updateTag directly in the webhook Route Handler. Correction: Call revalidateTag(tag, { expire: 0 }); the next request blocks to revalidate rather than receiving stale content.

### Evidence

**e1:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx:25–25](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx#L25-L25)

```text
- **`{ expire: 0 }`**: Stale content is never served, so the next request is a blocking revalidate/cache miss. Use it when the caller needs the data gone immediately and you cannot use [`updateTag`](/docs/app/api-reference/functions/updateTag).
```

**e2:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/updateTag.mdx:12–12](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/updateTag.mdx#L12-L12)

```text
`updateTag` can **only** be called from within [Server Actions](/docs/app/getting-started/mutating-data). It cannot be used in Route Handlers, Client Components, or any other context.
```

**e3:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx:43–43](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx#L43-L43)

```text
- Using the [`next.tags`](/docs/app/api-reference/functions/fetch) option with `fetch` for caching external API requests:
```

**e4:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx:49–49](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx#L49-L49)

```text
- Using [`cacheTag`](/docs/app/api-reference/functions/cacheTag) inside cached functions or components with the `'use cache'` directive:
```

## nextjs-11 — Next.js

I am migrating app/shop/[slug]/opengraph-image.tsx from Next.js 15 to 16.4.3 App Router. It exports generateImageMetadata({ params }), returning string image IDs, and a default Image({ params, id }) function. Which arguments become promises, and which remain synchronous? Show the corrected TypeScript parameter types and how to read them; the image-rendering implementation can be omitted.

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

In Next.js 15 these image-function arguments were read synchronously [e5]. In Next.js 16, the default image-generation function receives params and id as promises, but generateImageMetadata continues to receive synchronous params [e1]. The corrected signatures and reads for this route and string IDs are [e2][e3][e4][e6]:

```tsx
export function generateImageMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  // Use slug when constructing metadata if needed.
  return [{ id: '1', alt: slug }];
}

export default async function Image({
  params,
  id,
}: {
  params: Promise<{ slug: string }>;
  id: Promise<string>;
}) {
  const { slug } = await params;
  const imageId = await id;
  // Existing image-rendering implementation uses slug and imageId here.
}
```

The default function's rendering body is intentionally omitted as permitted by the prompt. Equivalent Promise.all reads and compatible broader ID types are acceptable. generateImageMetadata itself may be async for data fetching; that does not make its params argument a promise.

### Criteria (3 points)

- **c1 (1):** Keeps generateImageMetadata's params synchronous, typed as { slug: string }, and reads slug directly rather than describing params as newly promise-valued. Evidence: e1, e2.
- **c2 (1):** Explains the Next.js 15-to-16 change and shows Image parameters typed as Promise<{ slug: string }> and Promise<string> for the stated string IDs; a compatible broader ID type is acceptable. Evidence: e1, e3, e4, e5.
- **c3 (1):** Shows asynchronous reads of both Image params and id before using their resolved values, in an async function or equivalent documented implementation. Evidence: e4, e6.

### Common mistakes

- Wrong: Both exports now receive promise-valued params because all Next.js 16 params are async. Correction: The image-generation function receives promise-valued params and id; generateImageMetadata still receives synchronous params.
- Wrong: Only Image params becomes a promise; id remains a string argument. Correction: Image id is also a promise, resolving here to a string because the metadata returns string IDs.

### Evidence

**e1:** [sources/nextjs/docs/01-app/02-guides/upgrading/version-16.mdx:316–316](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/02-guides/upgrading/version-16.mdx#L316-L316)

```text
Starting with **Next.js 16**, to align with the [Async Request APIs](#async-request-apis-breaking-change) change, the image generating function now receives `params` and `id` as promises. The `generateImageMetadata` function continues to receive synchronous `params`.
```

**e2:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/generate-image-metadata.mdx:22–28](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/generate-image-metadata.mdx#L22-L28)

```text
export function generateImageMetadata({
  params,
}: {
  params: { slug: string }
}) {
  // ...
}
```

**e3:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/generate-image-metadata.mdx:140–149](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/generate-image-metadata.mdx#L140-L149)

```text
A promise that resolves to the `id` value from one of the items returned by `generateImageMetadata`. The `id` will be a `string` or `number` depending on what was returned from `generateImageMetadata`.
```

**e4:** [sources/nextjs/docs/01-app/03-api-reference/04-functions/generate-image-metadata.mdx:160–170](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/03-api-reference/04-functions/generate-image-metadata.mdx#L160-L170)

```text
export default async function Icon({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  // Use slug to generate the image
}
```

**e5:** [sources/nextjs/docs/01-app/02-guides/upgrading/version-16.mdx:308–312](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/02-guides/upgrading/version-16.mdx#L308-L312)

```text
// Next.js 15 - synchronous params and id access
export default function Image({ params, id }) {
  const slug = params.slug
  const imageId = id // string
  // ...
```

**e6:** [sources/nextjs/docs/01-app/02-guides/upgrading/version-16.mdx:324–328](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/02-guides/upgrading/version-16.mdx#L324-L328)

```text
// Next.js 16 - asynchronous params and id access
export default async function Image({ params, id }) {
  const { slug } = await params // params now async
  const imageId = await id // id is now Promise<string> when using generateImageMetadata
  // ...
```

## nextjs-12 — Next.js

In Next.js 16.4.3 App Router, with Cache Components enabled, how do GET Route Handlers behave with runtime data, and how can a database query be included in a static response?

**Scope:** Next.js 16.4.3 stable release documentation; App Router unless explicitly comparing Pages Router.

**Difficulty:** hard · **Category:** constraints

### Reference answer

GET handlers run at request time by default, but can be prerendered if they do not access uncached or runtime data. [e1] Request-specific data such as request headers or cookies stops prerendering. [e2] Extract the query to a helper with use cache to include the data in the prerendered response; do not put the directive directly in the Route Handler body. [e3] [e4]

### Criteria (3 points)

- **c1 (1):** GET handlers run at request time by default, but can be prerendered if they do not access uncached or runtime data. Evidence: e1.
- **c2 (1):** Request-specific data such as request headers or cookies stops prerendering. Evidence: e2.
- **c3 (1):** Extract the database query to a helper with use cache to include it in the prerendered response; do not put the directive directly in the handler body. Evidence: e3, e4.

### Common mistakes

- Wrong: Place use cache directly in the handler body. Correction: Extract the cached work into a helper function and put use cache there, not directly in the Route Handler body.

### Evidence

**e1:** [sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx:89–89](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/15-route-handlers.mdx#L89-L89)

```text
When [Cache Components](/docs/app/getting-started/caching) is enabled, `GET` Route Handlers follow the same model as normal UI routes in your application. They run at request time by default, can be prerendered when they don't access uncached or runtime data, and you can use `use cache` to include uncached data in the static response.
```

**e2:** [sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx:124–124](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/15-route-handlers.mdx#L124-L124)

```text
> **Good to know**: Prerendering stops if the `GET` handler accesses network requests, database queries, async file system operations, request object properties (like `req.url`, `request.headers`, `request.cookies`, `request.body`), runtime APIs like [`cookies()`](/docs/app/api-reference/functions/cookies), [`headers()`](/docs/app/api-reference/functions/headers), [`connection()`](/docs/app/api-reference/functions/connection), or non-deterministic operations.
```

**e3:** [sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx:144–144](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/15-route-handlers.mdx#L144-L144)

```text
> **Good to know**: `use cache` cannot be used directly inside a Route Handler body; extract it to a helper function. Cached responses revalidate according to `cacheLife` when a new request arrives.
```

**e4:** [sources/nextjs/docs/01-app/01-getting-started/15-route-handlers.mdx:126–126](https://github.com/vercel/next.js/blob/29bbeab09981148ade186e8599ecdede15abc281/docs/01-app/01-getting-started/15-route-handlers.mdx#L126-L126)

```text
**Cached example** - accesses uncached data (database query) but caches it with `use cache`, allowing it to be included in the prerendered response:
```

## tanstack-01 — TanStack Query for React

In TanStack Query for React, what are the default retry count and retry delay for failed queries, and how does server rendering differ?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** easy · **Category:** defaults

### Reference answer

By default failed queries retry three times with exponential backoff [e1], starting at 1000 ms and capped at 30 seconds [e3]; server retries default to zero [e2].

### Criteria (3 points)

- **c1 (1):** Default is three retries. Evidence: e1.
- **c2 (1):** Delay doubles from 1000 ms up to 30 seconds. Evidence: e3.
- **c3 (1):** Server retry default is zero. Evidence: e2.

### Common mistakes

- Wrong: Server queries also retry three times by default. Correction: Server retries default to zero.

### Evidence

**e1:** [sources/tanstack-query/docs/framework/react/guides/important-defaults.md:33–35](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/important-defaults.md#L33-L35)

```text
- Queries that fail are **silently retried 3 times, with exponential backoff delay** before capturing and displaying an error to the UI.

  > To change this, you can alter the default `retry` and `retryDelay` options for queries to something other than `3` and the default exponential backoff function.
```

**e2:** [sources/tanstack-query/docs/framework/react/guides/query-retries.md:15–17](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/query-retries.md#L15-L17)

```text
[//]: # 'Info'

> On the server, retries default to `0` to make server rendering as fast as possible.
```

**e3:** [sources/tanstack-query/docs/framework/react/guides/query-retries.md:39–41](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/query-retries.md#L39-L41)

```text
By default, retries in TanStack Query do not happen immediately after a request fails. As is standard, a back-off delay is gradually applied to each retry attempt.

The default `retryDelay` is set to double (starting at `1000`ms) with each attempt, but not exceed 30 seconds:
```

## tanstack-02 — TanStack Query for React

In TanStack Query for React, I assume a disabled useQuery automatically refetches after invalidateQueries and that skipToken still permits its returned refetch. Is that correct, and what should I use for manual fetching?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** medium · **Category:** false-premise

### Reference answer

No. An enabled: false query ignores invalidation/refetch calls that would normally refetch it, but its returned refetch can manually fetch [e1]. skipToken does not support refetch; calling it yields Missing queryFn. Use enabled: false when manual refetch is needed [e2].

### Criteria (3 points)

- **c1 (1):** Disabled queries ignore invalidation-triggered refetch. Evidence: e1.
- **c2 (1):** Returned refetch works with enabled: false. Evidence: e1.
- **c3 (1):** skipToken refetch fails with Missing queryFn. Evidence: e2.

### Common mistakes

- Wrong: skipToken supports manual refetch. Correction: It fails because there is no valid query function.

### Evidence

**e1:** [sources/tanstack-query/docs/framework/react/guides/disabling-queries.md:8–15](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/disabling-queries.md#L8-L15)

```text
When `enabled` is `false`:

- If the query has cached data, then the query will be initialized in the `status === 'success'` or `isSuccess` state.
- If the query does not have cached data, then the query will start in the `status === 'pending'` and `fetchStatus === 'idle'` state.
- The query will not automatically fetch on mount.
- The query will not automatically refetch in the background.
- The query will ignore query client `invalidateQueries` and `refetchQueries` calls that would normally result in the query refetching.
- `refetch` returned from `useQuery` can be used to manually trigger the query to fetch. However, it will not work with `skipToken`.
```

**e2:** [sources/tanstack-query/docs/framework/react/guides/disabling-queries.md:96–100](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/disabling-queries.md#L96-L100)

```text
## Typesafe disabling of queries using `skipToken`

If you are using TypeScript, you can use the `skipToken` to disable a query. This is useful when you want to disable a query based on a condition, but you still want the query to be type safe.

> **IMPORTANT**: `refetch` from `useQuery` will not work with `skipToken`. Calling `refetch()` on a query that uses `skipToken` will result in a `Missing queryFn` error because there is no valid query function to execute. If you need to manually trigger queries, consider using `enabled: false` instead, which allows `refetch()` to work properly. Other than this limitation, `skipToken` works the same as `enabled: false`.
```

## tanstack-03 — TanStack Query for React

In TanStack Query for React, compare staleTime Infinity and static when invalidating an active query, including the special always-refetch options.

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Infinity prevents staleness-based refetches but manual invalidation works; active invalidated queries normally refetch in the background [e1][e2]. Static prevents invalidation-triggered refetches and blocks refetchOnMount, refetchOnWindowFocus and refetchOnReconnect set to always [e1].

### Criteria (3 points)

- **c1 (1):** Infinity allows manual invalidation and normal background refetch of an active query. Evidence: e1, e2.
- **c2 (1):** Static prevents invalidation from triggering a refetch. Evidence: e1.
- **c3 (1):** Static blocks the three named always-refetch options. Evidence: e1.

### Common mistakes

- Wrong: Infinity and static have identical invalidation behavior. Correction: Static is stricter and prevents invalidation-triggered refetches.

### Evidence

**e1:** [sources/tanstack-query/docs/framework/react/guides/important-defaults.md:12–17](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/important-defaults.md#L12-L17)

```text
- A Query that has a `staleTime` set is considered **fresh** until that `staleTime` has elapsed.
  - set `staleTime` to e.g. `2 * 60 * 1000` to make sure data is read from the cache, without triggering any kinds of refetches, for 2 minutes, or until the Query is [invalidated manually](./query-invalidation.md).
  - set `staleTime` to `Infinity` to never trigger a refetch until the Query is [invalidated manually](./query-invalidation.md).
  - set `staleTime` to `'static'` to **never** trigger a refetch, even if the Query is [invalidated manually](./query-invalidation.md).

> `'static'` and `Infinity` both prevent staleness-based refetches, but `'static'` is stricter: `queryClient.invalidateQueries()` can invalidate a query with `staleTime: Infinity`, but has no effect on `staleTime: 'static'`. `refetchOnMount`, `refetchOnWindowFocus`, and `refetchOnReconnect` set to `"always"` are also blocked by `'static'`. Use `'static'` for data that cannot change while the app is running: feature flags fetched at boot, user permissions loaded at login, static reference tables. Use `Infinity` when you still want manual invalidation to work.
```

**e2:** [sources/tanstack-query/docs/framework/react/guides/query-invalidation.md:21–24](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/query-invalidation.md#L21-L24)

```text
When a query is invalidated with `invalidateQueries`, two things happen:

- It is marked as stale. This stale state overrides any `staleTime` configurations being used in `useQuery` or related hooks
- If the query is currently being rendered via `useQuery` or related hooks, it will also be refetched in the background
```

## tanstack-04 — TanStack Query for React

In TanStack Query for React, how can I invalidate every query whose key begins with todos, and how can I restrict this to the exact key?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** easy · **Category:** api-usage

### Reference answer

Use queryClient.invalidateQueries({ queryKey: ['todos'] }) for the prefix [e1]. Add exact: true to restrict the match to exactly that key, excluding keys with extra subkeys [e2].

### Criteria (2 points)

- **c1 (1):** Use the todos queryKey as a prefix filter. Evidence: e1.
- **c2 (1):** Add exact: true to exclude keys with additional parts. Evidence: e2.

### Common mistakes

- Wrong: A todos key filter is exact by default. Correction: It matches keys beginning with todos unless exact is set.

### Evidence

**e1:** [sources/tanstack-query/docs/framework/react/guides/query-invalidation.md:27–49](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/query-invalidation.md#L27-L49)

```text

When using APIs like `invalidateQueries` and `removeQueries` (and others that support partial query matching), you can match multiple queries by their prefix, or get really specific and match an exact query. For information on the types of filters you can use, please see [Query Filters](./filters.md#query-filters).

In this example, we can use the `todos` prefix to invalidate any queries that start with `todos` in their query key:

[//]: # 'Example2'

```tsx
import { useQuery, useQueryClient } from '@tanstack/react-query'

// Get QueryClient from the context
const queryClient = useQueryClient()

queryClient.invalidateQueries({ queryKey: ['todos'] })

// Both queries below will be invalidated
const todoListQuery = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodoList,
})
const todoListQuery = useQuery({
  queryKey: ['todos', { page: 1 }],
  queryFn: fetchTodoList,
```

**e2:** [sources/tanstack-query/docs/framework/react/guides/query-invalidation.md:79–99](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/query-invalidation.md#L79-L99)

```text
The `invalidateQueries` API is very flexible, so even if you want to **only** invalidate `todos` queries that don't have any more variables or subkeys, you can pass an `exact: true` option to the `invalidateQueries` method:

[//]: # 'Example4'

```tsx
queryClient.invalidateQueries({
  queryKey: ['todos'],
  exact: true,
})

// The query below will be invalidated
const todoListQuery = useQuery({
  queryKey: ['todos'],
  queryFn: fetchTodoList,
})

// However, the following query below will NOT be invalidated
const todoListQuery = useQuery({
  queryKey: ['todos', { type: 'done' }],
  queryFn: fetchTodoList,
})
```

## tanstack-05 — TanStack Router for React

In TanStack Router for React, how do preload freshness and unused retention defaults differ, and when is unused data removed?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** easy · **Category:** defaults

### Reference answer

Preloaded loader data is fresh for 30 seconds by default; unused results have a 5-minute retention window and become eligible for pruning during later cache reconciliation, not at a scheduled exact eviction time [e1][e2].

### Criteria (3 points)

- **c1 (1):** Freshness defaults to 30 seconds. Evidence: e1.
- **c2 (1):** Unused retention defaults to 5 minutes. Evidence: e1.
- **c3 (1):** Pruning occurs on a later reconciliation rather than at a guaranteed exact deadline. Evidence: e2.

### Common mistakes

- Wrong: Every preload is evicted exactly five minutes after it is created. Correction: The window determines eligibility for later pruning.

### Evidence

**e1:** [sources/tanstack-router/docs/router/guide/preloading.md:20–31](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/router/guide/preloading.md#L20-L31)

```text

Successful preloaded loader results can enter the router's in-memory cache with
two independent policies:

- **Freshness defaults to 30 seconds.** Configure it with
  `defaultPreloadStaleTime` or a route's `preloadStaleTime`.
- **The unused retention window defaults to 5 minutes.** Configure it with
  `defaultPreloadGcTime` or a route's `preloadGcTime`. Older unused entries
  are eligible for pruning during a later cache reconciliation.
- **The speculative lane is never promoted into router state.** Navigation
  creates its own presentation and runs its own `beforeLoad` chain. It can reuse
  cached loader data or join a loader that is still in flight.
```

**e2:** [sources/tanstack-router/docs/router/guide/preloading.md:102–108](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/router/guide/preloading.md#L102-L108)

```text
retained loader result can be reused without another loader call.
`preloadGcTime` (or `defaultPreloadGcTime`) controls when an unused preload
result becomes eligible for pruning during a later cache reconciliation; it
does not schedule a timer to evict the result at that exact moment. Both preload
GC options default to 5 minutes.

To change this, you can set the `defaultPreloadStaleTime` option on your router:
```

## tanstack-06 — TanStack Router and Query for React

A React app uses TanStack Router loaders with TanStack Query. Query should decide whether preloaded data is fresh, rather than Router skipping the loader because of its own preload freshness window. What Router setting enables this? Show how a loader and component can share a posts query definition while the component remains subscribed to Query updates. Assume fetchPosts returns an array of posts and the router context and QueryClientProvider already use the same QueryClient. Choose an example Query freshness window and explain why the Router setting does not disable Query caching.

**Scope:** Official Router and Query main-branch documentation snapshots; not release-pinned.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Set defaultPreloadStaleTime: 0 on the router, or preloadStaleTime: 0 on the route. This makes settled Router preload results immediately stale so Query can make the freshness decision; it does not disable retention, Query caching, or in-flight sharing [e1]. Share queryKey, queryFn, and a chosen staleTime through queryOptions [e2]. Here is a route-level implementation using an illustrative 30-second Query freshness window [e3][e4]:

```tsx
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

const postsQuery = queryOptions({
  queryKey: ['posts'],
  queryFn: fetchPosts,
  staleTime: 30_000,
});

export const Route = createFileRoute('/posts')({
  preloadStaleTime: 0,
  loader: ({ context }) => context.queryClient.query(postsQuery),
  component: PostsPage,
});

function PostsPage() {
  const { data: posts } = useSuspenseQuery(postsQuery);
  return <div>{posts.map((post) => post.title).join(', ')}</div>;
}
```

Returning the loader's promise waits for data. Query can return its own fresh cached data without fetching, or fetch if stale or absent [e4]. The component hook subscribes to updates rather than merely reading a loader snapshot [e3]. The example's 30 seconds is an application choice, not a required default. The snapshot documents queryClient.query; accept other documented equivalent loader APIs when valid for the requested scope.

### Criteria (5 points)

- **c1 (1):** Sets router defaultPreloadStaleTime or route preloadStaleTime to zero so the external Query cache can decide freshness. Evidence: e1.
- **c2 (1):** Shows a shared posts queryKey and queryFn definition, for example queryOptions, and an explicitly chosen Query staleTime rather than treating a particular freshness window as mandatory. Evidence: e2.
- **c3 (2):** Shows a loader that returns or awaits a Query cache-populating request and a component Query hook using the same definition and QueryClient to remain subscribed to updates. Evidence: e2, e3.
- **c4 (1):** Explains that zero Router preload freshness does not disable Query caching: Query still uses its own staleTime to reuse fresh cached data or fetch stale or missing data. Evidence: e1, e4.

### Common mistakes

- Wrong: Set Query staleTime to zero; Router's preload freshness can remain unchanged. Correction: Set Router defaultPreloadStaleTime or route preloadStaleTime to zero so Router does not use its settled preload freshness to bypass Query's decision.
- Wrong: Zero Router preload freshness disables caching and forces a network request on every navigation. Correction: Query still reuses fresh cached data according to its own staleTime; Router retention and in-flight sharing are separate.

### Evidence

**e1:** [sources/tanstack-router/docs/router/guide/preloading.md:164–169](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/router/guide/preloading.md#L164-L169)

```text
To let an external cache make the freshness decision, set
`routerOptions.defaultPreloadStaleTime` or `routeOptions.preloadStaleTime` to
`0`. Settled preload data then becomes immediately stale in the Router, while
retention still follows `preloadGcTime`. Overlapping preload or navigation
consumers can still share in-flight loader work, and `shouldReload` can still
suppress a loader call.
```

**e2:** [sources/tanstack-query/docs/framework/react/guides/query-options.md:11–28](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/guides/query-options.md#L11-L28)

```text
import { queryOptions } from '@tanstack/react-query'

function groupOptions(id: number) {
  return queryOptions({
    queryKey: ['groups', id],
    queryFn: () => fetchGroups(id),
    staleTime: 5 * 1000,
  })
}

// usage:

useQuery(groupOptions(1))
useSuspenseQuery(groupOptions(5))
useQueries({
  queries: [groupOptions(1), groupOptions(2)],
})
queryClient.query(groupOptions(23))
```

**e3:** [sources/tanstack-router/docs/router/guide/external-data-loading.md:80–93](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/router/guide/external-data-loading.md#L80-L93)

```text
const postsQueryOptions = queryOptions({
  queryKey: ['posts'],
  queryFn: () => fetchPosts(),
})

export const Route = createFileRoute('/posts')({
  // Use the `loader` option to ensure that the data is loaded
  loader: () =>
    queryClient.query({ ...postsQueryOptions, staleTime: 'static' }),
  component: () => {
    // Read the data from the cache and subscribe to updates
    const {
      data: { posts },
    } = useSuspenseQuery(postsQueryOptions)
```

**e4:** [sources/tanstack-query/docs/framework/react/reference/classes/QueryClient.md:1087–1090](https://github.com/TanStack/query/blob/604d0a5aaf7b510f51f35fdf31b9881aaedc4499/docs/framework/react/reference/classes/QueryClient.md#L1087-L1090)

```text
If the query already exists in the cache and its data is not stale (per the given
`staleTime`), the cached data is returned without fetching. Otherwise, the query is fetched
and the promise resolves once the fetch settles. If a `select` function is provided, it is
applied to the data in both cases (cached or freshly fetched) before it is returned.
```

## tanstack-07 — TanStack Router for React

In TanStack Router for React, how are nested URL search parameters represented, and how should a route turn parsed search parameters into trusted typed values?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** medium · **Category:** api-usage

### Reference answer

The default JSON-first parser encodes nested data as URL-safe JSON strings [e1]. Use the route validateSearch function: it receives parsed but unvalidated search as Record<string, unknown> and returns a typed object, ideally with sensible fallbacks [e2].

### Criteria (2 points)

- **c1 (1):** Nested structures are encoded as URL-safe JSON strings. Evidence: e1.
- **c2 (1):** validateSearch receives unvalidated parsed values and returns a typed object; sensible fallbacks are recommended. Evidence: e2.

### Common mistakes

- Wrong: Parsed search values are automatically trusted and need no validation. Correction: The route should validate them with validateSearch.

### Evidence

**e1:** [sources/tanstack-router/docs/router/guide/search-params.md:77–81](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/router/guide/search-params.md#L77-L81)

```text
If you noticed, there are a few things going on here:

- The first level of the search params is flat and string based, just like `URLSearchParams`.
- First level values that are not strings are accurately preserved as actual numbers and booleans.
- Nested data structures are automatically converted to URL-safe JSON strings
```

**e2:** [sources/tanstack-router/docs/router/guide/search-params.md:116–118](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/router/guide/search-params.md#L116-L118)

```text
### Validating Search Params

The `validateSearch` option is a function that is provided the JSON parsed (but non-validated) search params as a `Record<string, unknown>` and returns a typed object of your choice. It's usually best to provide sensible fallbacks for malformed or unexpected search params so your users' experience stays non-interrupted.
```

## tanstack-08 — TanStack Start for React

In TanStack Start for React, should an API intended for external cross-origin callers use a server function or a server route? What HTTP method does createServerFn use by default?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** easy · **Category:** api-usage

### Reference answer

Use a server route for external or intentionally cross-origin APIs; server functions are same-origin RPC endpoints intended for the Start application [e1]. createServerFn defaults to GET [e2].

### Criteria (3 points)

- **c1 (1):** Use server routes for external or cross-origin endpoints. Evidence: e1.
- **c2 (1):** Server functions are same-origin RPC for the app. Evidence: e1.
- **c3 (1):** createServerFn defaults to GET. Evidence: e2.

### Common mistakes

- Wrong: Server functions are the recommended public cross-origin API. Correction: Use server routes for that purpose.

### Evidence

**e1:** [sources/tanstack-router/docs/start/framework/react/guide/server-functions.md:23–29](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/start/framework/react/guide/server-functions.md#L23-L29)

```text

> [!NOTE]
> Server functions are meant to be called by your TanStack Start application. They are easy to use from your app code, and Start handles serialization across the client/server boundary. If you need an endpoint that can be called from outside your Start app, use [server routes](./server-routes) instead.

## Same-Origin Requests

Server functions are same-origin RPC endpoints for your application. Browser requests to server functions should come from the same origin, verified with Fetch Metadata (`Sec-Fetch-Site`), `Origin`, or `Referer` headers. Use server routes for public APIs or endpoints that intentionally support cross-origin requests.
```

**e2:** [sources/tanstack-router/docs/start/framework/react/guide/server-functions.md:53–61](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/start/framework/react/guide/server-functions.md#L53-L61)

```text
Server functions are created with `createServerFn()` and can specify HTTP method:

```tsx
import { createServerFn } from '@tanstack/react-start'

// GET request (default)
export const getData = createServerFn().handler(async () => {
  return { message: 'Hello from server!' }
})
```

## tanstack-09 — TanStack Start for React

In TanStack Start for React, what happens to server-function CSRF protection when adding a custom src/start.ts, and which middleware type applies to server functions as well as SSR requests?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Without src/start.ts Start installs server-function CSRF middleware automatically; if you define it, explicitly add createCsrfMiddleware, typically filtered to serverFn [e1]. Request middleware covers server requests including SSR and server functions [e2].

### Criteria (3 points)

- **c1 (1):** Without src/start.ts server-function CSRF middleware is installed automatically. Evidence: e1.
- **c2 (1):** With custom src/start.ts explicitly add createCsrfMiddleware for server functions. Evidence: e1.
- **c3 (1):** Request middleware covers SSR requests and server functions. Evidence: e2.

### Common mistakes

- Wrong: A custom start.ts preserves automatic CSRF middleware installation. Correction: Add it explicitly.

### Evidence

**e1:** [sources/tanstack-router/docs/start/framework/react/guide/server-functions.md:29–42](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/start/framework/react/guide/server-functions.md#L29-L42)

```text
Server functions are same-origin RPC endpoints for your application. Browser requests to server functions should come from the same origin, verified with Fetch Metadata (`Sec-Fetch-Site`), `Origin`, or `Referer` headers. Use server routes for public APIs or endpoints that intentionally support cross-origin requests.

TanStack Start provides `createCsrfMiddleware()` to protect server functions from cross-site requests. If your app does not define `src/start.ts`, Start installs this middleware automatically for server functions. If you define `src/start.ts`, add the middleware explicitly:

```tsx
// src/start.ts
import { createStart, createCsrfMiddleware } from '@tanstack/react-start'

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
```

**e2:** [sources/tanstack-router/docs/start/framework/react/guide/middleware.md:82–85](https://github.com/TanStack/router/blob/da2adec76dbe6c0da6d6a0d5640f7b9388217f45/docs/start/framework/react/guide/middleware.md#L82-L85)

```text
## Request Middleware

Request middleware is used to customize the behavior of any server request that passes through it, including server routes, SSR and server functions.
```

## tanstack-10 — TanStack Table for React

When migrating a React table from TanStack Table v8 to the full v9 useTable API, what hook and feature configuration changes are required, and what temporary compatibility alternative is available?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** medium · **Category:** migration

### Reference answer

For the full v9 API, replace useReactTable with useTable and provide the required features option [e1][e2]. Alternatively, useLegacyTable accepts v8-style options on v9, but is deprecated, temporary, and includes all features [e3].

### Criteria (3 points)

- **c1 (1):** For the full v9 API, replace useReactTable with useTable. Evidence: e1.
- **c2 (1):** For useTable, provide the required features configuration. Evidence: e2.
- **c3 (1):** useLegacyTable is a deprecated temporary v8-style compatibility shortcut that includes all features. Evidence: e3.

### Common mistakes

- Wrong: useLegacyTable is the preferred permanent v9 hook. Correction: It is deprecated and intended as a temporary migration aid.

### Evidence

**e1:** [sources/tanstack-table/docs/framework/react/guide/migrating.md:91–109](https://github.com/TanStack/table/blob/c14e0221b1e656c7bb35e7b3d4cdf188719a3599/docs/framework/react/guide/migrating.md#L91-L109)

```text
### Hook Rename

The number one change: `useReactTable` is now `useTable`, consistent with hook naming across all TanStack libraries:

```tsx
// Table V8
import { useReactTable } from '@tanstack/react-table'
const table = useReactTable(options)

// Table V9
import { useTable } from '@tanstack/react-table'
const table = useTable(options)
```

### New Required `features` Table Option

In Table V9, you must explicitly declare which features your table uses. Features, Row Models, and Row Model processing "Fns" are defined on the new `features` table option.

In Table V8, all features were bundled and included in the `useReactTable` hook. In Table V9, you import only what you need.
```

**e2:** [sources/tanstack-table/docs/framework/react/guide/migrating.md:105–109](https://github.com/TanStack/table/blob/c14e0221b1e656c7bb35e7b3d4cdf188719a3599/docs/framework/react/guide/migrating.md#L105-L109)

```text
### New Required `features` Table Option

In Table V9, you must explicitly declare which features your table uses. Features, Row Models, and Row Model processing "Fns" are defined on the new `features` table option.

In Table V8, all features were bundled and included in the `useReactTable` hook. In Table V9, you import only what you need.
```

**e3:** [sources/tanstack-table/docs/framework/react/guide/migrating.md:65–67](https://github.com/TanStack/table/blob/c14e0221b1e656c7bb35e7b3d4cdf188719a3599/docs/framework/react/guide/migrating.md#L65-L67)

```text
## Quick Legacy Migration

Need to migrate incrementally? We are providing a temporary shortcut with the `useLegacyTable` hook. It accepts the Table V8-style API while using Table V9 under the hood. **This is deprecated** and intended only as a temporary migration aid. It includes all features by default, so your bundle will be even larger than it was with Table V8.
```

## tanstack-11 — TanStack Table for React

With TanStack Table v9 for React using manual server-side pagination, why can row selection state contain IDs that getSelectedRowModel does not return, and how should row IDs be chosen?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

manualPagination assumes supplied data is already paginated [e1]. getSelectedRowModel can only return selected rows on the current page, while selection state can retain IDs absent from that data [e2]. Row IDs default to row.index; supply getRowId for a stable unique identifier such as a database ID [e3].

### Criteria (3 points)

- **c1 (1):** Manual pagination assumes passed data is already paginated. Evidence: e1.
- **c2 (1):** The selected row model only includes current-page rows, while selection state may contain other IDs. Evidence: e2.
- **c3 (1):** Row IDs default to row.index and getRowId can supply unique IDs. Evidence: e3.

### Common mistakes

- Wrong: getSelectedRowModel retrieves selected records from all server pages. Correction: It can only generate rows from the data passed in.

### Evidence

**e1:** [sources/tanstack-table/docs/framework/react/guide/pagination.md:80–84](https://github.com/TanStack/table/blob/c14e0221b1e656c7bb35e7b3d4cdf188719a3599/docs/framework/react/guide/pagination.md#L80-L84)

```text
### Manual Server-Side Pagination

If you decide that you need to use server-side pagination, here is how you can implement it.

No pagination row model is needed for server-side pagination, but if you have provided it for other tables that do need it in a shared component, you can still turn off the client-side pagination by setting the `manualPagination` option to `true`. Setting the `manualPagination` option to `true` will tell the table instance to use the `table.getPrePaginatedRowModel` row model under the hood, and it will make the table instance assume that the `data` that you pass in is already paginated.
```

**e2:** [sources/tanstack-table/docs/framework/react/guide/row-selection.md:53–54](https://github.com/TanStack/table/blob/c14e0221b1e656c7bb35e7b3d4cdf188719a3599/docs/framework/react/guide/row-selection.md#L53-L54)

```text
> [!NOTE]
> If you are using `manualPagination`, be aware that the `getSelectedRowModel` API will only return selected rows on the current page because table row models can only generate rows based on the `data` that is passed in. Row selection state, however, can contain row ids that are not present in the `data` array just fine.
```

**e3:** [sources/tanstack-table/docs/framework/react/guide/row-selection.md:100–102](https://github.com/TanStack/table/blob/c14e0221b1e656c7bb35e7b3d4cdf188719a3599/docs/framework/react/guide/row-selection.md#L100-L102)

```text
### Useful Row Ids

By default, the row id for each row is simply the `row.index`. If you are using row selection features, you most likely want to use a more useful row identifier, since the row selection state is keyed by row id. You can use the `getRowId` table option to specify a function that returns a unique row id for each row.
```

## tanstack-12 — TanStack Table for React

In TanStack Table v9 for React, what happens to pageIndex auto-reset by default with manualPagination, why might explicitly enabling auto-reset still not reset it when server-side sorting changes, and how should you handle the missing reset?

**Scope:** Official main-branch documentation snapshot; not release-pinned.

**Difficulty:** medium · **Category:** constraints

### Reference answer

pageIndex normally resets to zero when client row models recompute; manualPagination disables that default, though autoResetPageIndex can override it [e1]. If the relevant client-side row model is absent in a manual server-side table, sorting changes do not trigger a reset even if enabled; reset pageIndex in the change handler [e1].

### Criteria (3 points)

- **c1 (1):** Client row-model recomputation normally resets pageIndex to zero, but manualPagination disables that default. Evidence: e1.
- **c2 (1):** The option can be explicitly overridden. Evidence: e1.
- **c3 (1):** Without the relevant client-side row model no automatic reset occurs; reset in the change handler. Evidence: e1.

### Common mistakes

- Wrong: Setting autoResetPageIndex true always resets server-side sorting changes. Correction: A relevant included client-side row model must recompute.

### Evidence

**e1:** [sources/tanstack-table/docs/framework/react/guide/pagination.md:283–288](https://github.com/TanStack/table/blob/c14e0221b1e656c7bb35e7b3d4cdf188719a3599/docs/framework/react/guide/pagination.md#L283-L288)

```text
#### Auto Reset Page Index

By default, `pageIndex` is reset to `0` whenever the client-side row models recompute, such as when the `data` is updated, filters change, sorting changes, or grouping changes. This behavior is automatically disabled when `manualPagination` is `true`, but it can be overridden by explicitly assigning a boolean value to the `autoResetPageIndex` table option. There is also a global `autoResetAll` table option that disables (or enables) every auto-reset behavior at once.

> [!NOTE]
> Automatic resets run only when an included client-side row model that triggers them recomputes. If a manual server-side table omits the filtered, sorted, grouped, or other relevant row model, changing that controlled state does not trigger a page-index reset, even when `autoResetPageIndex` or `autoResetAll` is `true`. Reset `pageIndex` yourself in the corresponding change handler.
```

## takumi-01 — Takumi

What fonts are available by default in Takumi, and what should I do for non-Latin text?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** easy · **Category:** defaults

### Reference answer

Takumi does not read system fonts. Its built-in Geist covers Latin at weights 300–800 and is last in the fallback chain [e1]. Load fonts covering each script you use [e2].

### Criteria (2 points)

- **c1 (1):** State system fonts are not read and built-in Geist covers Latin weights 300–800, last in fallback. Evidence: e1.
- **c2 (1):** Load a font for every script used. Evidence: e2.

### Common mistakes

- Wrong: Takumi automatically uses system fonts. Correction: System fonts are never read.

### Evidence

**e1:** [sources/takumi/docs/content/docs/fonts.mdx:9–10](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/fonts.mdx#L9-L10)

```text
Takumi never reads system fonts. The only built-in font is Geist, which covers Latin at weights
  300 to 800 and comes last in every fallback chain.
```

**e2:** [sources/takumi/docs/content/docs/fonts.mdx:6–6](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/fonts.mdx#L6-L6)

```text
Load a font for every script your text uses.
```

## takumi-02 — Takumi

In Takumi image rendering, what format is the default, and how does WebP choose lossless versus lossy output?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** easy · **Category:** defaults

### Reference answer

PNG is the default. WebP is lossless unless quality is set; lossless: true wins [e1]. On WebAssembly WebP is always lossless, and quality and lossless have no effect on it [e2].

### Criteria (2 points)

- **c1 (1):** Identify PNG as default and explain WebP quality and lossless precedence. Evidence: e1.
- **c2 (1):** Identify the WebAssembly WebP exception. Evidence: e2.

### Common mistakes

- Wrong: WebP is always lossy. Correction: WebP defaults to lossless.

### Evidence

**e1:** [sources/takumi/docs/content/docs/formats.mdx:23–25](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/formats.mdx#L23-L25)

```text
| `png` (default) | Yes   | No        | No         | Lossless. Use it for transparency or exact pixels.                 |
| `jpeg`          | No    | Yes       | No         | Lossy. Draw an opaque background, since JPEG has no alpha channel. |
| `webp`          | Yes   | Yes       | Yes        | Lossless unless you set `quality`. `lossless: true` wins.          |
```

**e2:** [sources/takumi/docs/content/docs/formats.mdx:32–33](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/formats.mdx#L32-L33)

```text
On the WebAssembly backend, WebP is always lossless. `quality` and `lossless` are accepted but
  have no effect on WebP.
```

## takumi-03 — Takumi

How do I render a Takumi template directly as either an SVG string or encoded raster bytes?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** easy · **Category:** api-usage

### Reference answer

Use await renderSvg(template, options) for an SVG document string [e1]; use await render(template, options) for encoded raster bytes [e2].

### Criteria (2 points)

- **c1 (1):** Use renderSvg for an SVG document string. Evidence: e1.
- **c2 (1):** Use render for encoded image bytes. Evidence: e2.

### Common mistakes

- Wrong: renderSvg returns raster bytes. Correction: It returns an SVG document string.

### Evidence

**e1:** [sources/takumi/docs/content/docs/formats.mdx:84–84](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/formats.mdx#L84-L84)

```text
`renderSvg()` returns an SVG document string instead of a bitmap.
```

**e2:** [sources/takumi/docs/content/docs/formats.mdx:6–6](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/formats.mdx#L6-L6)

```text
`render()` returns encoded bytes, and the `format` option chooses the encoder.
```

## takumi-04 — Takumi

A Takumi image layout looks wrong. What option can help inspect its node boxes, and what does it do?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** easy · **Category:** debugging

### Reference answer

Set `drawDebugBorder: true` in the render options [e1]; it outlines every node [e1].

### Criteria (2 points)

- **c1 (1):** Set drawDebugBorder to true in the render options. Evidence: e1.
- **c2 (1):** It outlines every node. Evidence: e1.

### Common mistakes

- Wrong: It outlines only the root node. Correction: It outlines every node.

### Evidence

**e1:** [sources/takumi/docs/content/docs/troubleshooting.mdx:194–205](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/troubleshooting.mdx#L194-L205)

```text
Set `drawDebugBorder` to outline every node:

```tsx title="Outline every node"
import { ImageResponse } from "takumi-js/response";

export function GET() {
  return new ImageResponse(<div tw="flex w-full h-full p-8">Hello</div>, {
    width: 1200,
    height: 630,
    drawDebugBorder: true,
  });
}
```

## takumi-05 — Takumi

Takumi automatically applies Tailwind Preflight to its built-in tw parser, so headings have no default margin. How can I keep that automatic reset?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** medium · **Category:** false-premise

### Reference answer

The premise is false: Preflight is not applied by default, and an h1 retains a 0.67em top margin [e1]. Enable it with css: `@import "tailwindcss";` [e2].

### Criteria (2 points)

- **c1 (1):** Correct the premise: no default Preflight and h1 retains its default margin. Evidence: e1.
- **c2 (1):** Enable Preflight using the Tailwind import in css. Evidence: e2.

### Common mistakes

- Wrong: Preflight is already active for tw. Correction: It is off by default.

### Evidence

**e1:** [sources/takumi/docs/content/docs/styles.mdx:199–199](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/styles.mdx#L199-L199)

```text
The built-in parser applies no Tailwind Preflight by default. Elements keep their default margins, so an `<h1>` gets a `0.67em` top margin until you add `mt-0`.
```

**e2:** [sources/takumi/docs/content/docs/styles.mdx:221–221](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/styles.mdx#L221-L221)

```text
css: `@import "tailwindcss";`,
```

## takumi-06 — Takumi

When migrating Takumi v1 to v2, how should JavaScript code handle render calls and reusable fonts?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** medium · **Category:** migration

### Reference answer

Await top-level render, renderSvg and renderAnimation, which now return promises; Renderer methods are async too [e1]. Pass fonts per render, or await registerFont on a reused renderer to preload them before rendering [e2].

### Criteria (2 points)

- **c1 (1):** Await top-level render functions and Renderer methods. Evidence: e1.
- **c2 (1):** Pass fonts per render or await registerFont to preload fonts on a reused renderer before rendering. Evidence: e2.

### Common mistakes

- Wrong: Top-level render remains synchronous in v2. Correction: It returns a promise and must be awaited.

### Evidence

**e1:** [sources/takumi/docs/content/docs/migration/v2.mdx:22–22](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/migration/v2.mdx#L22-L22)

```text
The top-level `takumi-js` functions `render`, `renderSvg`, and `renderAnimation` load fonts and images before they render, so they return promises. `await` them. The [napi](https://www.npmjs.com/package/@takumi-rs/core) and [WebAssembly](https://www.npmjs.com/package/@takumi-rs/wasm) `Renderer` methods are async too.
```

**e2:** [sources/takumi/docs/content/docs/migration/v2.mdx:43–55](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/migration/v2.mdx#L43-L55)

```text
Pass `fonts` with each render for most uses. Use `registerFont` to preload fonts on a renderer you reuse.

```ts title="Pass fonts per render"
renderer.loadFonts([archivo, geist]); // [!code --]
renderer.render(node, { fonts: [archivo, geist] }); // [!code ++]
```

To preload a font once and reuse it across many renders, call `registerFont`, which replaces all three loaders. It takes raw bytes or a `{ name, data, weight, style }` descriptor, and resolves to the families it registered.

```ts title="Replace loadFonts with registerFont"
renderer.loadFonts([archivo, geist]); // [!code --]
await renderer.registerFont(archivo); // [!code ++]
await renderer.registerFont(geist); // [!code ++]
```

## takumi-07 — Takumi

How does Takumi devicePixelRatio affect the output image dimensions and CSS layout? How do I double the resolution of a 1200 by 630 design?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** medium · **Category:** defaults

### Reference answer

Width and height remain output pixels; devicePixelRatio sets image pixels per CSS pixel [e1]. Use 2400 by 1260 with ratio 2 for the same layout at double resolution [e2].

### Criteria (2 points)

- **c1 (1):** Explain dimensions remain output pixels while ratio scales CSS pixels. Evidence: e1.
- **c2 (1):** Specify 2400 × 1260 and ratio 2 for equivalent 1200 × 630 layout. Evidence: e2.

### Common mistakes

- Wrong: Setting ratio 2 doubles the output dimensions automatically. Correction: Width and height stay the output pixel dimensions.

### Evidence

**e1:** [sources/takumi/docs/content/docs/formats.mdx:42–42](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/formats.mdx#L42-L42)

```text
`devicePixelRatio` sets how many image pixels each CSS pixel takes. `width` and `height` stay the image size in pixels.
```

**e2:** [sources/takumi/docs/content/docs/formats.mdx:54–54](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/formats.mdx#L54-L54)

```text
The result is a 2400 × 1260 image. Every CSS length draws twice as large, so the layout matches a 1200 × 630 render at ratio `1`.
```

## takumi-08 — Takumi

How does Takumi handle an unknown style object property versus a supported property with an invalid value?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** medium · **Category:** constraints

### Reference answer

An unsupported property name is silently dropped [e1]. A supported name whose value cannot be parsed fails the entire style object [e2].

### Criteria (2 points)

- **c1 (1):** An unsupported property name is silently dropped. Evidence: e1.
- **c2 (1):** An unparsable value for a supported property fails the whole style object. Evidence: e2.

### Common mistakes

- Wrong: Invalid values are always silently ignored. Correction: An unparsable value for a listed property fails the style object.

### Evidence

**e1:** [sources/takumi/docs/content/docs/concepts.mdx:46–46](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/concepts.mdx#L46-L46)

```text
A property name outside the supported list is dropped without an error.
```

**e2:** [sources/takumi/docs/content/docs/concepts.mdx:46–46](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/concepts.mdx#L46-L46)

```text
A listed name with an unparsable value fails the whole style object.
```

## takumi-09 — Takumi

Using Takumi's native Node.js backend in a Next.js App Router endpoint, write a GET handler returning a 1200 by 630 PNG containing Hello. If rendering fails, return a plain-text HTTP 503 instead of a broken image stream. Include the required native-binding bundler configuration.

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Use ImageResponse from takumi-js/response in a Node.js App Router handler, and externalize @takumi-rs/core because its native .node addon cannot be bundled [e1][e2]. Use app/og/route.ts with an HTML string (which Takumi accepts [e1]) to follow Next.js's documented route.js|ts convention without JSX in a .ts file. Set the dimensions and select PNG explicitly, or rely on its PNG default [e3]. Await response.ready before returning the image; it rejects on render failure, allowing a different Response to be returned before the image response is committed [e4].

```ts
// app/og/route.ts
import { ImageResponse } from 'takumi-js/response';

export async function GET() {
  try {
    const response = new ImageResponse('<div>Hello</div>', {
      width: 1200,
      height: 630,
      format: 'png',
    });
    await response.ready;
    return response;
  } catch {
    return new Response('Failed to generate image', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
```

```ts
// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  serverExternalPackages: ['@takumi-rs/core'],
};

export default config;
```

onError is only a side-effect hook: its return value is ignored and it does not replace the failed stream [e5]. The 503 status and text are the requested adaptation of the documented fallback Response pattern.

### Criteria (5 points)

- **c1 (1):** Shows an App Router GET handler using ImageResponse from takumi-js/response to render Hello at width 1200 and height 630 as PNG, explicitly or via the PNG default, in the requested Node.js environment. Evidence: e1, e3.
- **c2 (2):** Awaits response.ready before returning the image and catches rendering failure before committing the response, rather than relying on onError to return a fallback. Evidence: e4, e5.
- **c3 (1):** Returns a separate plain-text Response with HTTP status 503 on failure; an explicit text/plain header or the standard string-Response behavior is acceptable. Evidence: e4.
- **c4 (1):** Includes serverExternalPackages: ['@takumi-rs/core'] in Next.js configuration to keep the native addon out of the bundle. Evidence: e2.

### Common mistakes

- Wrong: Return a new Response with status 503 from ImageResponse's onError callback. Correction: Takumi ignores onError's return value and the image stream still errors; await ready and catch the failure before returning a response.
- Wrong: A try/catch around returning new ImageResponse is enough to catch later asynchronous rendering failures. Correction: The response streams while rendering; await response.ready inside the try/catch before returning it.

### Evidence

**e1:** [sources/takumi/docs/content/docs/reference/image-response.mdx:9–16](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/reference/image-response.mdx#L9-L16)

```text
import { ImageResponse } from "takumi-js/response";

export function GET() {
  return new ImageResponse(<div>Hello Takumi</div>, { width: 1200, height: 630 });
}
```

The first argument takes what `render()` takes: JSX, an HTML string, or a node tree.
```

**e2:** [sources/takumi/docs/content/docs/frameworks/nextjs.mdx:20–30](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/frameworks/nextjs.mdx#L20-L30)

```text
Add `@takumi-rs/core` to `serverExternalPackages`. It holds a native `.node` addon, which Next.js cannot bundle.
```

**e3:** [sources/takumi/docs/content/docs/reference/image-response.mdx:32–36](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/reference/image-response.mdx#L32-L36)

```text
format: {
      type: '"png" | "jpeg" | "webp" | "ico" | "raw"',
      default: '"png"',
      description: "Output encoder. Also sets the default content-type.",
```

**e4:** [sources/takumi/docs/content/docs/reference/image-response.mdx:125–134](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/reference/image-response.mdx#L125-L134)

```text
export async function GET() {
  const response = new ImageResponse(<div>Hello Takumi</div>, { width: 1200, height: 630 });

  try {
    await response.ready; // [!code highlight]
    return response;
  } catch {
    return new Response("Failed to generate image", { status: 500 });
  }
}
```

**e5:** [sources/takumi/docs/content/docs/reference/image-response.mdx:137–137](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/reference/image-response.mdx#L137-L137)

```text
`onError` is for side effects such as logging. Takumi ignores its return value, and the response stream still errors. Use `ready` to send a fallback.
```

## takumi-10 — Takumi

A Takumi v1 template uses an absolutely positioned badge and Tailwind border-l-2 border-dashed. What v2 changes could alter the result without Preflight, and how do I fix them?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

v2 defaults position to static, so explicitly set position: relative on the intended containing block [e1]. Without Preflight, border-dashed sets all sides and unset widths are medium: the left is 2px and other sides 3px. Preflight’s border: 0 solid reset removes the extra borders [e2]; enable it through the Tailwind import [e3].

### Criteria (3 points)

- **c1 (1):** Set position relative on the intended containing block because v2 defaults to static. Evidence: e1.
- **c2 (1):** Explain border-dashed draws 2px left and 3px other borders without Preflight. Evidence: e2.
- **c3 (1):** Enable Preflight with the Tailwind import. Evidence: e3.

### Common mistakes

- Wrong: border-l-2 border-dashed only paints the left edge without Preflight. Correction: The other edges are 3px.

### Evidence

**e1:** [sources/takumi/docs/content/docs/migration/v2.mdx:187–187](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/migration/v2.mdx#L187-L187)

```text
`position` now defaults to `static`, not `relative`. An element establishes a containing block for absolutely positioned descendants, and honors `top`/`right`/`bottom`/`left` insets, only when you opt in. Set `position: relative` where you relied on the old default.
```

**e2:** [sources/takumi/docs/content/docs/styles.mdx:206–209](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/styles.mdx#L206-L209)

```text
Without Preflight, a border style utility draws on every side. `border-dashed` sets `border-style`
  on all four sides, and an unset border width is `medium`. So `border-l-2 border-dashed` draws a
  2px left border and 3px borders on the other sides. Preflight's `border: 0 solid` reset removes
  them.
```

**e3:** [sources/takumi/docs/content/docs/styles.mdx:221–221](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/styles.mdx#L221-L221)

```text
css: `@import "tailwindcss";`,
```

## takumi-11 — Takumi

For a Takumi template rendered both as an image and as a PDF, how do screen and print media queries behave, what happens with unlisted media features such as prefers-color-scheme, and how should I handle PDF blur filters?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Image renders use screen and PDF renders use print [e1]. Unlisted media features including prefers-color-scheme match nothing, but the remaining stylesheet applies [e2]. PDF cannot draw filter blur or drop-shadow and stops; remove the filter or rasterize the subtree as an img [e3].

### Criteria (3 points)

- **c1 (1):** Distinguish screen image renders from print PDF renders. Evidence: e1.
- **c2 (1):** Unlisted media features including prefers-color-scheme match nothing; remaining styles apply. Evidence: e2.
- **c3 (1):** Explain PDF blur/drop-shadow failure and remove filter or rasterize subtree as img. Evidence: e3.

### Common mistakes

- Wrong: PDF renders silently ignore blur. Correction: The renderer stops instead.

### Evidence

**e1:** [sources/takumi/docs/content/docs/styles.mdx:72–72](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/styles.mdx#L72-L72)

```text
| `screen`, `print`, `all` | the media type: image renders are `screen`, PDF renders are `print` |
```

**e2:** [sources/takumi/docs/content/docs/styles.mdx:77–78](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/styles.mdx#L77-L78)

```text
Any other feature, `prefers-color-scheme` included, matches nothing. The rest of the stylesheet
  still applies.
```

**e3:** [sources/takumi/docs/content/docs/troubleshooting.mdx:170–170](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/troubleshooting.mdx#L170-L170)

```text
Remove the filter, or rasterize that subtree yourself and place it as an `<img>`. PDF has no blur operator, so `filter: blur()` and `drop-shadow()` cannot be drawn. The renderer stops rather than ship a page that differs from the image output.
```

## takumi-12 — Takumi

A Takumi server renders untrusted image URLs and shares a byte cache. How should I restrict requests safely, and what happens when an image fetch fails?

**Scope:** Official Takumi master-branch documentation snapshot; not release-pinned.

**Difficulty:** hard · **Category:** multi-source

### Reference answer

Set images.allowUrl for user-controlled markup [e1]. It checks redirect destinations, but a fetchCache hit checks only the requested URL, so do not share a cache across URL policies; use custom fetch to filter resolved IPs [e2]. By default a failed fetch rejects the render; images.throwOnError: false omits that image and draws the rest [e3].

### Criteria (3 points)

- **c1 (1):** Set allowUrl for user-controlled markup. Evidence: e1.
- **c2 (1):** Explain redirect checks, cache-hit limitation, no cross-policy cache sharing, and custom fetch for IP filtering. Evidence: e2.
- **c3 (1):** Default failed image rejects render; throwOnError false omits it. Evidence: e3.

### Common mistakes

- Wrong: A shared cache rechecks every cached redirect against each new policy. Correction: Cache hits check only the requested URL.

### Evidence

**e1:** [sources/takumi/docs/content/docs/images.mdx:251–252](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/images.mdx#L251-L252)

```text
Takumi fetches these URLs from your server. Set `allowUrl` whenever user input can reach the
  markup.
```

**e2:** [sources/takumi/docs/content/docs/images.mdx:255–257](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/images.mdx#L255-L257)

```text
- `allowUrl` checks each redirect destination, up to five hops. Each hop shares the same deadline and gets its own attempts.
- A `fetchCache` hit checks only the requested URL, because cached bytes keep no redirect history. Do not share one `fetchCache` across different URL policies.
- `allowUrl` sees URLs, not IP addresses. To filter by resolved address, pass a custom `fetch`.
```

**e3:** [sources/takumi/docs/content/docs/images.mdx:234–234](https://github.com/kane50613/takumi/blob/0cb1228af6dc55c88323aaf9218f720f056cf85d/docs/content/docs/images.mdx#L234-L234)

```text
By default, one image that fails to fetch rejects the whole render. Set `throwOnError: false` to leave that image out and draw the rest.
```

