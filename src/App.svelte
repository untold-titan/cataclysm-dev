<script>
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { profile, destinations } from './lib/content.js';
  import Panel from './components/Panel.svelte';

  const byId = Object.fromEntries(destinations.map((d) => [d.id, d]));
  const stops = destinations.filter((d) => d.id !== 'home');

  let stage = $state();
  let telemetry = $state();
  const labelEls = {};
  let scene = null;

  let current = $state('home');
  let phase = $state('arrived'); // 'traveling' | 'arrived'
  let hovered = $state(null);
  let mode = $state('loading'); // 'loading' | '3d' | 'fallback'
  let isPortrait = $state(false);

  const dest = $derived(byId[current]);
  const stopIndex = $derived(stops.findIndex((d) => d.id === current));
  const showPanel = $derived(mode === '3d' && phase === 'arrived' && current !== 'home');
  const showHero = $derived(mode === '3d' && phase === 'arrived' && current === 'home');

  function go(id) {
    if (!byId[id] || mode !== '3d') return;
    if (scene.flyTo(id)) {
      current = id;
      phase = 'traveling';
      const hash = id === 'home' ? '' : `#${id}`;
      if (location.hash !== hash) history.pushState(null, '', hash || location.pathname + location.search);
    }
  }

  const hashTarget = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    return byId[id] ? id : 'home';
  };

  function step(delta) {
    const i = stopIndex < 0 ? (delta > 0 ? -1 : 0) : stopIndex;
    go(stops[(i + delta + stops.length) % stops.length].id);
  }

  function onKey(e) {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea')) return;
    if (e.key === 'Escape') go('home');
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else {
      const d = destinations.find((x) => x.key === e.key);
      if (d) go(d.id);
    }
  }

  function setHover(id) {
    hovered = id;
    scene?.highlight(id);
  }

  onMount(() => {
    let disposed = false;
    const mq = window.matchMedia('(max-aspect-ratio: 1/1)');
    const updatePortrait = () => (isPortrait = mq.matches);
    updatePortrait();
    mq.addEventListener('change', updatePortrait);
    const onHash = () => go(hashTarget());
    window.addEventListener('popstate', onHash);
    let launchTimer;

    import('./lib/space.js')
      .then(({ SpaceScene, supportsWebGL }) => {
        if (disposed) return;
        if (!supportsWebGL()) {
          mode = 'fallback';
          return;
        }
        scene = new SpaceScene(stage, {
          destinations,
          labels: labelEls,
          telemetry,
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          onArrive: (id) => {
            if (id === current) phase = 'arrived';
          },
          onHover: (id) => (hovered = id),
          onSelect: (id) => go(id),
        });
        mode = '3d';
        // Deep link (e.g. /#projects): take off shortly after the scene appears.
        if (hashTarget() !== 'home') launchTimer = setTimeout(onHash, 700);
      })
      .catch((err) => {
        console.error(err);
        mode = 'fallback';
      });

    return () => {
      disposed = true;
      mq.removeEventListener('change', updatePortrait);
      window.removeEventListener('popstate', onHash);
      clearTimeout(launchTimer);
      scene?.dispose();
    };
  });
</script>

<svelte:window onkeydown={onKey} />

{#if mode !== 'fallback'}
  <main class="space" class:ready={mode === '3d'} class:portrait={isPortrait}>
    <div class="stage" bind:this={stage}></div>

    <div class="labels" aria-hidden={mode !== '3d'}>
      {#each stops as d (d.id)}
        <button
          class="label"
          class:hovered={hovered === d.id}
          class:parked={current === d.id && phase === 'arrived'}
          style="--accent: {d.color}"
          bind:this={labelEls[d.id]}
          onclick={() => go(d.id)}
          onpointerenter={() => setHover(d.id)}
          onpointerleave={() => setHover(null)}
          tabindex="-1"
        >
          <span class="label-id">{d.designation}</span>
          <span class="label-name">{d.label}</span>
          <span class="label-stem"></span>
        </button>
      {/each}
    </div>

    <header class="topbar">
      <button class="brand" onclick={() => go('home')} aria-label="Return to launch point">
        <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
          <path d="M9 23 L16 7 L23 23 L16 18.5 Z" fill="var(--ember)" />
        </svg>
        <span>cataclysm<span class="tld">.dev</span></span>
      </button>
      <div class="status">
        <span class="status-line">
          {#if phase === 'traveling'}
            <span class="pulse" style="--accent: {dest.color ?? 'var(--ember)'}"></span>
            In transit → {dest.label}
          {:else if current === 'home'}
            <span class="pulse idle"></span>
            Holding pattern · Launch point
          {:else}
            <span class="pulse idle" style="--accent: {dest.color}"></span>
            Orbiting · {dest.label}
          {/if}
        </span>
        <span class="telemetry" bind:this={telemetry}></span>
      </div>
    </header>

    {#if showHero}
      <section class="hero" transition:fly={{ x: -24, duration: 500 }}>
        <p class="hero-kicker">{profile.title} · {profile.location}</p>
        <h1>{profile.name}</h1>
        <p class="hero-tagline">{profile.tagline}</p>
        <p class="hero-hint">
          Pick a destination below, click an asteroid, or press <kbd>1</kbd>–<kbd>{stops.length}</kbd>.
        </p>
      </section>
    {/if}

    {#if showPanel}
      {#key current}
        <div class="panel-wrap" in:fly={{ x: isPortrait ? 0 : 40, y: isPortrait ? 40 : 0, duration: 450 }} out:fade={{ duration: 150 }}>
          <Panel
            {dest}
            prev={stops[(stopIndex - 1 + stops.length) % stops.length]}
            next={stops[(stopIndex + 1) % stops.length]}
            onClose={() => go('home')}
            onGo={go}
          />
        </div>
      {/key}
    {/if}

    <nav class="dock" aria-label="Destinations">
      <button class="dock-btn" class:active={current === 'home'} onclick={() => go('home')}>
        <span class="dock-dot" style="--accent: var(--text)"></span>
        <span class="dock-text">Home</span>
        <kbd>Esc</kbd>
      </button>
      {#each stops as d (d.id)}
        <button
          class="dock-btn"
          class:active={current === d.id}
          class:transit={current === d.id && phase === 'traveling'}
          style="--accent: {d.color}"
          onclick={() => go(d.id)}
          onpointerenter={() => setHover(d.id)}
          onpointerleave={() => setHover(null)}
        >
          <span class="dock-dot"></span>
          <span class="dock-text">{d.short}</span>
          <kbd>{d.key}</kbd>
        </button>
      {/each}
    </nav>

    {#if mode === 'loading'}
      <div class="loading" out:fade={{ duration: 600 }}>
        <span>Spinning up engines…</span>
      </div>
    {/if}
  </main>
{:else}
  <main class="fallback">
    <section class="hero static">
      <p class="hero-kicker">{profile.title} · {profile.location}</p>
      <h1>{profile.name}</h1>
      <p class="hero-tagline">{profile.tagline}</p>
    </section>
    {#each stops as d (d.id)}
      <Panel dest={d} standalone />
    {/each}
  </main>
{/if}

<style>
  .space {
    position: fixed;
    inset: 0;
    overflow: hidden;
  }
  .stage {
    position: absolute;
    inset: 0;
  }
  .stage :global(.space-canvas) {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: manipulation;
  }

  /* ---------- floating asteroid labels */
  .labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    transition: opacity 1s 0.4s;
  }
  .ready .labels {
    opacity: 1;
  }
  .label {
    position: absolute;
    left: 0;
    top: 0;
    visibility: hidden;
    display: grid;
    justify-items: center;
    gap: 3px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    font-family: var(--sans);
    cursor: pointer;
    pointer-events: auto;
    transition: opacity 0.4s;
  }
  .label.parked {
    opacity: 0;
    pointer-events: none;
  }
  .label-id {
    font: 500 10px/1 var(--mono);
    letter-spacing: 0.2em;
    color: var(--accent);
  }
  .label-name {
    font-size: 15px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgb(8 10 22 / 0.55);
    border: 1px solid color-mix(in oklab, var(--accent) 35%, transparent);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s, transform 0.2s;
  }
  .label-stem {
    width: 1px;
    height: 18px;
    background: linear-gradient(var(--accent), transparent);
  }
  .label.hovered .label-name,
  .label:focus-visible .label-name {
    background: color-mix(in oklab, var(--accent) 22%, rgb(8 10 22 / 0.7));
    border-color: var(--accent);
    box-shadow: 0 0 24px color-mix(in oklab, var(--accent) 45%, transparent);
    transform: translateY(-2px);
  }

  /* ---------- top bar */
  .topbar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding: 20px 28px;
    pointer-events: none;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    font: 600 17px var(--sans);
    letter-spacing: -0.01em;
    cursor: pointer;
    pointer-events: auto;
  }
  .tld {
    color: var(--ember);
  }
  .status {
    display: grid;
    justify-items: end;
    gap: 6px;
    font: 500 11px/1 var(--mono);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: right;
  }
  .status-line {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .telemetry {
    color: var(--faint);
    letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums;
  }
  .pulse {
    --accent: var(--ember);
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 0 var(--accent);
    animation: pulse 1s infinite;
  }
  .pulse.idle {
    --accent: #6ee7a8;
    animation-duration: 2.4s;
  }
  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 color-mix(in oklab, var(--accent) 70%, transparent);
    }
    100% {
      box-shadow: 0 0 0 10px transparent;
    }
  }

  /* ---------- hero */
  .hero {
    position: absolute;
    left: clamp(24px, 6vw, 96px);
    top: 50%;
    transform: translateY(-55%);
    max-width: 520px;
    pointer-events: none;
  }
  .hero-kicker {
    margin: 0;
    font: 500 12px/1.4 var(--mono);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ember);
  }
  h1 {
    margin: 14px 0 16px;
    font-size: clamp(48px, 8vw, 96px);
    line-height: 0.95;
    font-weight: 700;
    letter-spacing: -0.04em;
    background: linear-gradient(180deg, #fff 30%, #9aa6c8);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .hero-tagline {
    margin: 0;
    font-size: clamp(17px, 2vw, 20px);
    line-height: 1.5;
    color: var(--muted);
  }
  .hero-hint {
    margin: 28px 0 0;
    font-size: 14px;
    color: var(--faint);
  }

  kbd {
    display: inline-grid;
    place-items: center;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 5px;
    border: 1px solid var(--line);
    border-bottom-width: 2px;
    font: 500 10.5px var(--mono);
    color: var(--muted);
    background: rgb(255 255 255 / 0.04);
  }

  /* ---------- info panel */
  .panel-wrap {
    position: absolute;
    top: 84px;
    right: clamp(16px, 3vw, 40px);
    bottom: 104px;
    width: min(500px, 42vw);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  /* ---------- dock */
  .dock {
    position: absolute;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    display: flex;
    gap: 4px;
    padding: 6px;
    border-radius: 16px;
    background: var(--glass);
    border: 1px solid var(--line);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 20px 60px -20px rgb(0 0 0 / 0.8);
    max-width: calc(100vw - 24px);
  }
  .dock-btn {
    --accent: var(--text);
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 10px 14px;
    border-radius: 11px;
    border: 1px solid transparent;
    background: none;
    color: var(--muted);
    font: 500 14px var(--sans);
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
  }
  .dock-btn:hover {
    color: var(--text);
    background: rgb(255 255 255 / 0.05);
  }
  .dock-btn.active {
    color: var(--text);
    background: color-mix(in oklab, var(--accent) 14%, transparent);
    border-color: color-mix(in oklab, var(--accent) 35%, transparent);
  }
  .dock-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }
  .dock-btn.transit .dock-dot {
    animation: blink 0.6s infinite alternate;
  }
  @keyframes blink {
    to {
      opacity: 0.25;
    }
  }
  .dock-btn kbd {
    height: 18px;
    min-width: 18px;
    font-size: 10px;
  }

  /* ---------- loading */
  .loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--bg);
    font: 500 12px var(--mono);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .loading span {
    animation: blink 0.9s infinite alternate;
  }

  /* ---------- fallback (no WebGL) */
  .fallback {
    max-width: 760px;
    margin: 0 auto;
    padding: 64px 20px;
    display: grid;
    gap: 24px;
  }
  .hero.static {
    position: static;
    transform: none;
    margin-bottom: 24px;
  }

  /* ---------- small / portrait screens */
  @media (max-width: 860px) {
    .topbar {
      padding: 16px;
    }
    .status {
      font-size: 10px;
    }
    .telemetry {
      display: none;
    }
    .dock {
      bottom: 12px;
    }
    .dock-btn {
      padding: 9px 10px;
      font-size: 13px;
    }
    .dock-btn kbd {
      display: none;
    }
  }
  @media (max-width: 520px) {
    .dock-text {
      display: none;
    }
    .dock-btn.active .dock-text {
      display: inline;
    }
  }
  .portrait .hero {
    left: 16px;
    right: 16px;
    top: auto;
    bottom: 96px;
    transform: none;
  }
  .portrait .hero-hint {
    margin-top: 16px;
  }
  .portrait .panel-wrap {
    top: auto;
    left: 12px;
    right: 12px;
    bottom: 76px;
    width: auto;
    height: 56vh;
    justify-content: flex-end;
  }
</style>
