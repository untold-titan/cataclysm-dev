<script>
  import { profile } from '../lib/content.js';

  /** @type {{ dest: any, prev?: any, next?: any, onClose?: () => void, onGo?: (id: string) => void, standalone?: boolean }} */
  let { dest, prev, next, onClose, onGo, standalone = false } = $props();
</script>

<article class="panel" class:standalone style="--accent: {dest.color}">
  <header>
    <div class="kicker">
      <span class="dot"></span>
      {dest.designation} · {dest.kind === 'contact' ? 'Contact' : dest.label}
    </div>
    <h2>{dest.label}</h2>
    {#if dest.blurb}<p class="blurb">{dest.blurb}</p>{/if}
    {#if !standalone}
      <button class="close" onclick={onClose} aria-label="Return to launch point">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    {/if}
  </header>

  <div class="body">
    {#if dest.kind === 'projects'}
      <ul class="cards">
        {#each dest.items as p (p.name)}
          <li class="card">
            <div class="card-head">
              <h3>{p.name}</h3>
              <span class="year">{p.year}</span>
            </div>
            <p>{p.summary}</p>
            <ul class="chips">
              {#each p.tags as t (t)}<li>{t}</li>{/each}
            </ul>
            {#if p.links?.length}
              <div class="links">
                {#each p.links as l (l.label)}
                  <a href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {:else if dest.kind === 'career'}
      <ol class="timeline">
        {#each dest.items as job (job.company + job.period)}
          <li>
            <span class="period">{job.period}</span>
            <h3>{job.role} <span class="at">@ {job.company}</span></h3>
            <p>{job.summary}</p>
            {#if job.highlights?.length}
              <ul class="highlights">
                {#each job.highlights as h (h)}<li>{h}</li>{/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ol>
    {:else if dest.kind === 'stack'}
      <div class="groups">
        {#each dest.groups as g (g.label)}
          <section>
            <h3>{g.label}</h3>
            <ul class="chips big">
              {#each g.items as t (t)}<li>{t}</li>{/each}
            </ul>
          </section>
        {/each}
      </div>
    {:else if dest.kind === 'contact'}
      <div class="contact">
        <a class="email" href="mailto:{profile.email}">{profile.email}</a>
        <ul class="contact-links">
          {#each profile.links as l (l.label)}
            <li><a href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a></li>
          {/each}
        </ul>
        <p class="location">{profile.location}</p>
      </div>
    {/if}
  </div>

  {#if !standalone && (prev || next)}
    <footer>
      {#if prev}
        <button class="hop" onclick={() => onGo?.(prev.id)}>
          <span class="dir">← Previous</span>
          <span style="color: {prev.color}">{prev.label}</span>
        </button>
      {:else}<span></span>{/if}
      {#if next}
        <button class="hop right" onclick={() => onGo?.(next.id)}>
          <span class="dir">Next →</span>
          <span style="color: {next.color}">{next.label}</span>
        </button>
      {/if}
    </footer>
  {/if}
</article>

<style>
  .panel {
    position: relative;
    display: flex;
    flex-direction: column;
    max-height: 100%;
    background: var(--glass);
    border: 1px solid var(--line);
    border-radius: 18px;
    box-shadow:
      0 0 0 1px color-mix(in oklab, var(--accent) 18%, transparent) inset,
      0 30px 80px -20px rgb(0 0 0 / 0.7);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    overflow: hidden;
  }
  .panel::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.8;
  }
  .panel.standalone {
    max-height: none;
  }

  header {
    padding: 26px 28px 18px;
    border-bottom: 1px solid var(--line);
  }
  .kicker {
    display: flex;
    align-items: center;
    gap: 8px;
    font: 500 11px/1 var(--mono);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 10px var(--accent);
  }
  h2 {
    margin: 12px 0 8px;
    font-size: clamp(28px, 4vw, 38px);
    font-weight: 600;
    letter-spacing: -0.02em;
  }
  .blurb {
    margin: 0;
    color: var(--muted);
    line-height: 1.55;
    max-width: 48ch;
  }
  .close {
    position: absolute;
    top: 18px;
    right: 18px;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid var(--line);
    background: rgb(255 255 255 / 0.04);
    color: var(--muted);
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s, background 0.2s;
  }
  .close:hover {
    color: var(--text);
    border-color: var(--accent);
    background: color-mix(in oklab, var(--accent) 15%, transparent);
  }

  .body {
    padding: 20px 28px 24px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgb(255 255 255 / 0.15) transparent;
  }

  h3 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
  }
  p {
    color: var(--muted);
    line-height: 1.55;
    margin: 8px 0 0;
    font-size: 14.5px;
  }
  ul,
  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .cards {
    display: grid;
    gap: 12px;
  }
  .card {
    padding: 16px 18px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: rgb(255 255 255 / 0.025);
    transition: border-color 0.2s, background 0.2s, transform 0.2s;
  }
  .card:hover {
    border-color: color-mix(in oklab, var(--accent) 55%, transparent);
    background: color-mix(in oklab, var(--accent) 6%, transparent);
    transform: translateY(-1px);
  }
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
  }
  .year {
    font: 12px var(--mono);
    color: var(--faint);
  }

  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .chips li {
    font: 500 11.5px/1 var(--mono);
    padding: 6px 9px;
    border-radius: 999px;
    color: color-mix(in oklab, var(--accent) 70%, white);
    background: color-mix(in oklab, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in oklab, var(--accent) 25%, transparent);
  }
  .chips.big li {
    font-size: 12.5px;
    padding: 8px 12px;
  }

  .links {
    display: flex;
    gap: 16px;
    margin-top: 12px;
  }
  a {
    color: var(--text);
    text-decoration: none;
    font-size: 13.5px;
    font-weight: 500;
    border-bottom: 1px solid color-mix(in oklab, var(--accent) 50%, transparent);
    transition: border-color 0.2s, color 0.2s;
  }
  a:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .timeline {
    position: relative;
    display: grid;
    gap: 22px;
    padding-left: 22px;
  }
  .timeline::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 6px;
    bottom: 6px;
    width: 1px;
    background: linear-gradient(var(--accent), transparent);
  }
  .timeline > li {
    position: relative;
  }
  .timeline > li::before {
    content: '';
    position: absolute;
    left: -22px;
    top: 4px;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--bg);
    border: 2px solid var(--accent);
    box-shadow: 0 0 10px color-mix(in oklab, var(--accent) 60%, transparent);
  }
  .period {
    font: 12px var(--mono);
    color: var(--accent);
    letter-spacing: 0.05em;
  }
  .timeline h3 {
    margin-top: 6px;
  }
  .at {
    color: var(--muted);
    font-weight: 500;
  }
  .highlights {
    margin-top: 10px;
    display: grid;
    gap: 6px;
  }
  .highlights li {
    position: relative;
    padding-left: 16px;
    font-size: 14px;
    color: var(--muted);
    line-height: 1.5;
  }
  .highlights li::before {
    content: '▹';
    position: absolute;
    left: 0;
    color: var(--accent);
  }

  .groups {
    display: grid;
    gap: 22px;
  }
  .groups h3 {
    font: 500 11px/1 var(--mono);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--faint);
  }

  .contact {
    display: grid;
    gap: 18px;
  }
  .email {
    font-size: clamp(20px, 3vw, 26px);
    font-weight: 600;
    justify-self: start;
    border-bottom-width: 2px;
  }
  .contact-links {
    display: flex;
    gap: 20px;
  }
  .location {
    font: 12px var(--mono);
    color: var(--faint);
    margin: 0;
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 20px;
    border-top: 1px solid var(--line);
  }
  .hop {
    display: grid;
    gap: 3px;
    text-align: left;
    padding: 8px 10px;
    border-radius: 10px;
    background: none;
    border: 1px solid transparent;
    color: var(--text);
    font: 600 14px var(--sans);
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .hop.right {
    text-align: right;
  }
  .hop:hover {
    background: rgb(255 255 255 / 0.04);
    border-color: var(--line);
  }
  .dir {
    font: 500 10.5px var(--mono);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--faint);
  }

  @media (max-width: 720px) {
    header {
      padding: 20px 20px 14px;
    }
    .body {
      padding: 16px 20px 20px;
    }
    .close {
      top: 14px;
      right: 14px;
    }
  }
</style>
