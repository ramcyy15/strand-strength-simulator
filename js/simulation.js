(function () {
  const GRAVITY = 1500;
  const ANCHOR_Y = 24;
  const REST_RATIO = 0.62;
  const WEIGHT_W = 90;
  const WEIGHT_H = 80;
  const STRAIN_DURATION = 0.7;
  const STRAIN_STRETCH = 26;
  const STRAIN_SHAKE = 1.6;
  const HOLD_BOB_AMP = 6;
  const SPRING_K = 110;
  const SPRING_C = 4.2;
  const TOP_RECOIL_K = 220;
  const TOP_RECOIL_C = 8.0;

  let rafId = null;
  let state = null;

  const dom = {};
  function cacheDom() {
    dom.stage = document.querySelector(".stage");
    dom.svg = document.getElementById("strandSvg");
    dom.full = document.getElementById("ropeFull");
    dom.top = document.getElementById("ropeTop");
    dom.bottom = document.getElementById("ropeBottom");
    dom.weight = document.getElementById("weightBox");
    dom.label = document.getElementById("weightLabel");
    dom.banner = document.getElementById("resultBanner");
  }

  function stageSize() {
    const r = dom.stage.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function syncViewBox() {
    const { w, h } = stageSize();
    dom.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    return { w, h };
  }

  function setRopeFull(x, fromY, toY) {
    dom.full.setAttribute("x1", x);
    dom.full.setAttribute("y1", fromY);
    dom.full.setAttribute("x2", x);
    dom.full.setAttribute("y2", toY);
  }

  function setRopeBroken(anchorX, breakY, weightX, weightTopY, bottomLen) {
    dom.top.setAttribute("x1", anchorX);
    dom.top.setAttribute("y1", ANCHOR_Y);
    dom.top.setAttribute("x2", anchorX);
    dom.top.setAttribute("y2", breakY);
    dom.bottom.setAttribute("x1", weightX);
    dom.bottom.setAttribute("y1", weightTopY - bottomLen);
    dom.bottom.setAttribute("x2", weightX);
    dom.bottom.setAttribute("y2", weightTopY);
  }

  function showBanner(message, type) {
    dom.banner.textContent = message;
    dom.banner.classList.remove("success", "failure", "show");
    void dom.banner.offsetWidth;
    dom.banner.classList.add(type, "show");
  }

  function hideBanner() {
    dom.banner.classList.remove("show", "success", "failure");
    dom.banner.textContent = "";
  }

  function placeWeight(x, topY) {
    dom.weight.style.transform = `translate(${x - WEIGHT_W / 2}px, ${topY}px)`;
  }

  function showWeight(label) {
    dom.label.textContent = label;
    dom.weight.style.width = `${WEIGHT_W}px`;
    dom.weight.style.height = `${WEIGHT_H}px`;
    dom.weight.classList.add("visible");
  }

  function hideWeight() {
    dom.weight.classList.remove("visible");
  }

  function cancelLoop() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function startLoop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      step(dt);
      if (state && !state.done) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    };
    rafId = requestAnimationFrame(tick);
  }

  function formatKg(n) {
    return Number.isInteger(n) ? `${n} kg` : `${n.toFixed(2)} kg`;
  }

  function step(dt) {
    if (!state) return;
    const { w, h } = state.size;

    if (state.phase === "held") {
      const a = -SPRING_K * state.springY - SPRING_C * state.springV;
      state.springV += a * dt;
      state.springY += state.springV * dt;
      const topY = state.restTopY + state.springY;
      placeWeight(state.x, topY);
      setRopeFull(state.x, ANCHOR_Y, topY);

      state.elapsed += dt;
      if (state.elapsed > 2.2 && Math.abs(state.springV) < 0.6 && Math.abs(state.springY) < 0.3) {
        state.done = true;
      }
    } else if (state.phase === "strain") {
      state.elapsed += dt;
      const t = Math.min(state.elapsed / STRAIN_DURATION, 1);
      const eased = t * t;
      const stretch = STRAIN_STRETCH * eased;
      const shake = (Math.random() - 0.5) * STRAIN_SHAKE * eased;
      const topY = state.restTopY + stretch;
      const xJitter = state.x + shake;
      placeWeight(xJitter, topY);
      setRopeFull(xJitter, ANCHOR_Y, topY);

      if (t >= 1) {
        state.phase = "falling";
        dom.svg.classList.add("snapped");
        const totalLen = topY - ANCHOR_Y;
        const breakRatio = 0.25 + Math.random() * 0.4;
        state.breakY = ANCHOR_Y + totalLen * breakRatio;
        state.bottomLen = totalLen - (state.breakY - ANCHOR_Y);
        state.weightY = topY;
        state.weightX = state.x;
        state.vy = 40;
        state.vx = (Math.random() - 0.5) * 30;
        state.topY = state.breakY;
        state.topV = -260;
        state.bannerShown = false;
        state.fallElapsed = 0;
      }
    } else if (state.phase === "falling") {
      state.vy += GRAVITY * dt;
      state.weightY += state.vy * dt;
      state.weightX += state.vx * dt;

      const restTopY = ANCHOR_Y + 6;
      const offset = state.topY - restTopY;
      const a = -TOP_RECOIL_K * offset - TOP_RECOIL_C * state.topV;
      state.topV += a * dt;
      state.topY += state.topV * dt;
      if (state.topY < ANCHOR_Y + 2) state.topY = ANCHOR_Y + 2;

      placeWeight(state.weightX, state.weightY);
      setRopeBroken(
        w / 2,
        state.topY,
        state.weightX,
        state.weightY,
        state.bottomLen
      );

      state.fallElapsed += dt;
      if (!state.bannerShown && state.fallElapsed > 0.15) {
        showBanner(
          `Snapped. ${formatKg(state.weight)} exceeds ${formatKg(state.tensile)} limit.`,
          "failure"
        );
        state.bannerShown = true;
      }

      if (state.weightY > h + WEIGHT_H + 40) {
        state.done = true;
      }
    }
  }

  function runSimulation(tensileKg, weightKg) {
    cacheDom();
    cancelLoop();
    hideBanner();
    dom.svg.classList.remove("snapped");

    const size = syncViewBox();
    const x = size.w / 2;
    const restTopY = size.h * REST_RATIO;

    showWeight(formatKg(weightKg));
    placeWeight(x, restTopY);
    setRopeFull(x, ANCHOR_Y, restTopY);

    const willHold = weightKg <= tensileKg;

    state = {
      size,
      tensile: tensileKg,
      weight: weightKg,
      x,
      restTopY,
      phase: willHold ? "held" : "strain",
      elapsed: 0,
      springY: 0,
      springV: 0,
      done: false,
    };

    if (willHold) {
      const ratio = tensileKg > 0 ? Math.min(weightKg / tensileKg, 1) : 0;
      state.springY = HOLD_BOB_AMP + ratio * 18;
      state.springV = 0;
      showBanner(
        `Held. ${formatKg(weightKg)} within ${formatKg(tensileKg)} limit.`,
        "success"
      );
    }

    startLoop();
  }

  function resetSimulation() {
    cacheDom();
    cancelLoop();
    state = null;
    const { w, h } = syncViewBox();
    dom.svg.classList.remove("snapped");
    const restTopY = h * REST_RATIO;
    setRopeFull(w / 2, ANCHOR_Y, restTopY);
    placeWeight(w / 2, restTopY);
    hideWeight();
    hideBanner();
  }

  window.addEventListener("resize", () => {
    if (state && !state.done) return;
    cacheDom();
    const { w, h } = syncViewBox();
    if (dom.svg.classList.contains("snapped")) return;
    setRopeFull(w / 2, ANCHOR_Y, h * REST_RATIO);
  });

  window.Simulation = { runSimulation, resetSimulation };
})();
