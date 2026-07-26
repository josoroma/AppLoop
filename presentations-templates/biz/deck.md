---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  section {
    background: #000000;
    background: linear-gradient(135deg, #000000 0%, #0a0a0f 50%, #000000 100%);
    color: #ffffff;
    font-family: "Inter", "SF Pro Display", system-ui, sans-serif;
    padding: 64px 80px;
    overflow: hidden;
  }
  h1, h2, h3, h4, h5, h6 {
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
  }
  h1 { font-size: 3.5rem; }
  h2 { font-size: 2.5rem; }
  h3 { font-size: 1.75rem; }
  h4 { font-size: 1.35rem; }
  p, li {
    font-size: 1.25rem;
    line-height: 1.55;
    color: #d4d4d8;
  }
  .text-gradient {
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
  }
  .text-gradient-blue {
    background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    color: transparent;
  }
  .card {
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 16px;
    background: rgba(255,255,255,0.03);
    backdrop-filter: blur(20px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
    padding: 32px;
  }
  .card-active {
    border: 1px solid rgba(6,182,212,0.4);
    background: linear-gradient(135deg, rgba(6,182,212,0.12) 0%, rgba(59,130,246,0.12) 100%);
    box-shadow: 0 8px 32px rgba(6,182,212,0.15), 0 2px 4px rgba(0,0,0,0.3);
  }
  .circle {
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .circle-bordered {
    border: 1px solid rgba(255,255,255,0.12);
  }
  .gradient-ring {
    border-radius: 50%;
    background: conic-gradient(from 0deg, #06b6d4, #3b82f6, #6366f1, #06b6d4);
    padding: 2px;
  }
  .gradient-ring-inner {
    border-radius: 50%;
    background: #000000;
    background: linear-gradient(135deg, #000000 0%, #0a0a0f 50%, #000000 100%);
  }
  .gradient-badge {
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    padding: 6px 16px;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #000;
  }
  .btn-gradient {
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    color: #000;
    padding: 14px 32px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .btn-gradient:hover {
    box-shadow: 0 8px 32px rgba(6,182,212,0.4);
    transform: translateY(-2px);
  }
  .translucent-square {
    width: 120px;
    height: 120px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    backdrop-filter: blur(10px);
  }
  .geometric-squares {
    display: flex;
    gap: 8px;
  }
  .geo-square {
    width: 12px;
    height: 12px;
    background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    border-radius: 3px;
    opacity: 0.6;
  }
  .geo-square:nth-child(2) { opacity: 0.4; transform: scale(0.8); }
  .geo-square:nth-child(3) { opacity: 0.2; transform: scale(0.6); }
  .icon-svg {
    width: 48px;
    height: 48px;
    stroke: #71717a;
    stroke-width: 1.5;
    fill: none;
  }
  .icon-svg-active {
    stroke: #06b6d4;
  }
  .card-metric {
    font-size: 4rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    color: #ffffff;
  }
  .card-metric-label {
    font-size: 1rem;
    font-weight: 600;
    color: #a1a1aa;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .copyright {
    font-size: 0.75rem;
    color: #52525b;
    letter-spacing: 0.05em;
  }
  .placeholder-text {
    color: #71717a;
    font-size: 1.1rem;
    line-height: 1.6;
  }
  .columns-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    align-items: start;
  }
  .columns-2-equal {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
  }
  .cards-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 24px;
    width: 100%;
  }
  .cards-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    width: 100%;
  }
  .text-center { text-align: center; }
  .text-left { text-align: left; }
  .text-right { text-align: right; }
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .items-center { align-items: center; }
  .justify-center { justify-content: center; }
  .justify-between { justify-content: space-between; }
  .gap-4 { gap: 16px; }
  .gap-6 { gap: 24px; }
  .gap-8 { gap: 32px; }
  .gap-12 { gap: 48px; }
  .mt-4 { margin-top: 16px; }
  .mt-6 { margin-top: 24px; }
  .mt-8 { margin-top: 32px; }
  .mt-12 { margin-top: 48px; }
  .mt-16 { margin-top: 64px; }
  .mb-4 { margin-bottom: 16px; }
  .mb-6 { margin-bottom: 24px; }
  .mb-8 { margin-bottom: 32px; }
  .mb-12 { margin-bottom: 48px; }
  .w-full { width: 100%; }
  .h-full { height: 100%; }
  .absolute { position: absolute; }
  .relative { position: relative; }
  .top-0 { top: 0; }
  .right-0 { right: 0; }
  .bottom-0 { bottom: 0; }
  .left-0 { left: 0; }
  .z-10 { z-index: 10; }
  .overflow-hidden { overflow: hidden; }
---

<!-- _class: cover-slide -->
<!-- _paginate: false -->

<div class="absolute top-0 left-0 z-10 flex items-center gap-3">
  <svg class="icon-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="24" height="24" rx="6" stroke="url(#grad-logo)" stroke-width="2"/>
    <defs>
      <linearGradient id="grad-logo" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="#06b6d4"/>
        <stop offset="100%" stop-color="#3b82f6"/>
      </linearGradient>
    </defs>
    <path d="M10 16L14 20L22 12" stroke="url(#grad-logo)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
  <span style="font-size: 1.125rem; font-weight: 700; letter-spacing: -0.02em; color: #fff;">Biz</span>
</div>

<div class="absolute top-0 right-0 z-10 flex flex-col items-end gap-4 text-right placeholder-text" style="max-width: 400px;">
  <p>Transforming vision into measurable<br>business outcomes through strategic<br>innovation and execution.</p>
  <div class="geometric-squares mt-6"></div>
</div>

<div class="absolute bottom-0 left-0 flex flex-col items-start gap-24" style="max-width: 600px;">
  <h1 class="text-left leading-tight">Business Innovation<span class="text-gradient">.</span></h1>
  <p class="placeholder-text max-w-md">A strategic framework for building resilient, scalable businesses in the digital age.</p>
</div>

<div class="absolute bottom-0 right-0 z-10 text-right copyright">
  © 2025 Biz Framework. All rights reserved.
</div>

---

<!-- _class: content-slide -->

<div class="absolute top-0 right-0 w-[180px] h-[180px] translucent-square" style="top: -40px; right: -40px;"></div>

<div class="gradient-ring absolute bottom-0 left-0 w-[280px] h-[280px]" style="bottom: -80px; left: -80px;">
  <div class="gradient-ring-inner absolute inset-[2px]"></div>
</div>

<div class="relative z-10 flex flex-col items-start gap-8 max-w-3xl">
  <h1 class="text-left leading-tight">Driving Innovation for<br>Business Growth<span class="text-gradient">.</span></h1>
  <p class="placeholder-text max-w-xl">A systematic approach to identifying, validating, and scaling opportunities that create sustainable competitive advantage.</p>
</div>

<div class="absolute bottom-0 right-0 w-full max-w-3xl columns-2 gap-12" style="bottom: 80px; right: 80px;">
  <div class="flex flex-col gap-4">
    <h3 class="text-left">Strategic Discovery</h3>
    <p class="placeholder-text">Uncover hidden market opportunities through rigorous research, competitive intelligence, and customer insight synthesis.</p>
  </div>
  <div class="flex flex-col gap-4">
    <h3 class="text-left">Validated Execution</h3>
    <p class="placeholder-text">Rapid prototyping, data-driven iteration, and measurable milestones reduce risk while accelerating time-to-value.</p>
  </div>
</div>

---

<!-- _class: content-slide -->

<div class="relative z-10 columns-2-equal gap-12 h-full">
  <div class="flex flex-col justify-center gap-8">
    <h2 class="text-left">About Us<span class="text-gradient">.</span></h2>
    <p class="placeholder-text">We partner with ambitious organizations to design and deliver transformative digital products. Our interdisciplinary team combines strategy, design, and engineering to turn bold visions into market-leading realities.</p>
    <p class="placeholder-text">Since 2018, we've launched 40+ ventures across fintech, healthtech, SaaS, and enterprise platforms—generating over $2.3B in combined valuation for our partners.</p>
    <button class="btn-gradient w-fit mt-4" style="width: 220px;">Visit Website →</button>
  </div>
  <div class="relative flex items-center justify-center">
    <div class="gradient-ring w-[360px] h-[360px]">
      <div class="gradient-ring-inner absolute inset-[3px] flex items-center justify-center">
        <div class="text-center">
          <span style="font-size: 4rem; font-weight: 800; letter-spacing: -0.04em; color: #fff;">40+</span>
          <p class="placeholder-text mt-2" style="font-size: 1.1rem;">Ventures<br>Launched</p>
        </div>
      </div>
    </div>
  </div>
</div>

---

<!-- _class: content-slide -->

<div class="relative z-10 columns-2 gap-12 h-full items-start">
  <div class="flex flex-col justify-center gap-8 w-full max-w-lg">
    <h2 class="text-left">Financial & Growth<br>Projections<span class="text-gradient">.</span></h2>
    <p class="placeholder-text">Our financial model projects disciplined growth through strategic reinvestment, operational leverage, and expanding market share across core verticals.</p>
    <p class="placeholder-text">Year-over-year revenue acceleration driven by platform network effects and expanding enterprise adoption.</p>
  </div>
  <div class="relative flex items-center justify-center">
    <div class="circle circle-bordered gradient-ring w-[320px] h-[320px]">
      <div class="gradient-ring-inner absolute inset-[2px] circle circle-bordered flex flex-col items-center justify-center text-center p-8">
        <span style="font-size: 3.5rem; font-weight: 800; color: #fff;">$2.3B</span>
        <p class="placeholder-text mt-4" style="font-size: 1.1rem;">Projected<br>Valuation by 2027</p>
      </div>
    </div>
  </div>
</div>

<div class="absolute bottom-0 left-0 right-0 flex justify-center" style="bottom: 64px;">
  <div class="card w-full max-w-4xl flex flex-row items-center justify-between gap-8 p-8">
    <div class="text-center flex-1">
      <div class="card-metric">430K</div>
      <div class="card-metric-label mt-2">Active Users</div>
    </div>
    <div class="w-px h-24 bg-white/10"></div>
    <div class="text-center flex-1">
      <div class="card-metric-label">Definition of Innovation</div>
      <p class="placeholder-text mt-2 max-w-xs mx-auto" style="font-size: 1rem;">Systematic transformation of ideas into measurable value through disciplined experimentation.</p>
    </div>
    <div class="w-px h-24 bg-white/10"></div>
    <div class="text-center flex-1">
      <div class="card-metric">$2.3B</div>
      <div class="card-metric-label mt-2">Projected Valuation</div>
    </div>
  </div>
</div>

---

<!-- _class: content-slide -->

<div class="relative z-10 flex flex-col items-center gap-12 h-full">
  <div class="text-center">
    <h2 class="text-center">Our Innovative<br>Approach<span class="text-gradient">.</span></h2>
    <p class="placeholder-text mt-4 max-w-2xl mx-auto">Four pillars that drive sustainable innovation from ideation to market leadership.</p>
  </div>
  <div class="cards-4 w-full max-w-[1400px]">
    <div class="card flex flex-col gap-6 h-full">
      <svg class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 3v18h18M18 3v9M3 12h9"/>
      </svg>
      <h3 class="text-left">Data-Driven Insights</h3>
      <p class="placeholder-text flex-1">Real-time analytics and predictive modeling inform every strategic decision.</p>
    </div>
    <div class="card card-active flex flex-col gap-6 h-full">
      <svg class="icon-svg icon-svg-active" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        <path d="M9 12l2 2 4-4"/>
      </svg>
      <h3 class="text-left" style="color: #fff;">Secure Foundations</h3>
      <p class="placeholder-text flex-1" style="color: #e4e4e7;">Enterprise-grade security, compliance, and risk management built-in.</p>
    </div>
    <div class="card flex flex-col gap-6 h-full">
      <svg class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 12c0 1.66 4 3 9 3s9-1.34 9-3M12 3v18"/>
      </svg>
      <h3 class="text-left">Balanced Strategy</h3>
      <p class="placeholder-text flex-1">Harmonizing short-term wins with long-term vision for sustainable growth.</p>
    </div>
    <div class="card flex flex-col gap-6 h-full">
      <svg class="icon-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="7" height="9" rx="1"/>
        <rect x="14" y="3" width="7" height="9" rx="1"/>
        <rect x="3" y="15" width="7" height="6" rx="1"/>
        <rect x="14" y="15" width="7" height="6" rx="1"/>
      </svg>
      <h3 class="text-left">Scalable Architecture</h3>
      <p class="placeholder-text flex-1">Modular, cloud-native systems that grow with your ambition.</p>
    </div>
  </div>
</div>

---

<!-- _class: content-slide -->

<div class="relative z-10 flex flex-col items-center gap-12 h-full">
  <div class="text-center">
    <h2 class="text-center">The People Making It<br>Happen<span class="text-gradient-blue">.</span></h2>
    <p class="placeholder-text mt-4 max-w-2xl mx-auto">Visionary leaders with deep domain expertise and a shared commitment to excellence.</p>
  </div>
  <div class="cards-3 w-full max-w-[1100px]">
    <div class="card flex flex-col items-center text-center gap-6 h-full p-8">
      <div class="circle circle-bordered w-28 h-28 flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
        <svg class="w-12 h-12 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
        </svg>
      </div>
      <div class="flex flex-col items-center gap-2">
        <h3 class="text-left" style="font-size: 1.25rem;">Jonathan Doe</h3>
        <span class="gradient-badge">CEO Protagonist</span>
      </div>
    </div>
    <div class="card flex flex-col items-center text-center gap-6 h-full p-8">
      <div class="circle circle-bordered w-28 h-28 flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
        <svg class="w-12 h-12 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
        </svg>
      </div>
      <div class="flex flex-col items-center gap-2">
        <h3 class="text-left" style="font-size: 1.25rem;">Angelica Doe</h3>
        <span class="gradient-badge">CFO Protagonist</span>
      </div>
    </div>
    <div class="card flex flex-col items-center text-center gap-6 h-full p-8">
      <div class="circle circle-bordered w-28 h-28 flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
        <svg class="w-12 h-12 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="8" r="4"/>
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
        </svg>
      </div>
      <div class="flex flex-col items-center gap-2">
        <h3 class="text-left" style="font-size: 1.25rem;">Abraham Doe</h3>
        <span class="gradient-badge" style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%);">Marketing</span>
      </div>
    </div>
  </div>
</div>