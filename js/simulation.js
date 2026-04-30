(function () {
  const GRAVITY = 1500;
  const G = 9.8;
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
  const ROPE_L_M = 1.5;
  const SWING_DAMPING = 0.35;
  const SWING_MAX_TIME = 9;
  const SWING_REST_THETA = 0.025;
  const SWING_REST_OMEGA = 0.06;

  function computeInsights(tensileKg, weightKg, angleDeg) {
    const safeAngle = Math.max(0, Math.min(angleDeg || 0, 89));
    const angleRad = (safeAngle * Math.PI) / 180;
    const cosA = Math.cos(angleRad);
    const loadForce = weightKg * G;
    const tensionForce = loadForce * cosA;
    const capacityForce = tensileKg * G;
    const utilization = capacityForce > 0 ? (tensionForce / capacityForce) * 100 : 0;
    const safetyFactor = tensionForce > 0 ? capacityForce / tensionForce : Infinity;
    const willHold = tensionForce <= capacityForce;
    return {
      loadForce,
      tensionForce,
      capacityForce,
      utilization,
      safetyFactor,
      willHold,
      angleDeg: safeAngle,
      cosA,
    };
  }

  let rafId = null;
  let state = null;
  let onTick = null;

  function setOnTick(cb) {
    onTick = typeof cb === "function" ? cb : null;
  }

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

  function setRopeFull(x1, y1, x2, y2) {
    dom.full.setAttribute("x1", x1);
    dom.full.setAttribute("y1", y1);
    dom.full.setAttribute("x2", x2);
    dom.full.setAttribute("y2", y2);
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
      const len = state.ropeLen + state.springY;
      const wx = state.anchorX + len * state.sinA;
      const wy = ANCHOR_Y + len * state.cosA;
      placeWeight(wx, wy);
      setRopeFull(state.anchorX, ANCHOR_Y, wx, wy);

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
      const len = state.ropeLen + stretch;
      const wx = state.anchorX + len * state.sinA + shake;
      const wy = ANCHOR_Y + len * state.cosA;
      placeWeight(wx, wy);
      setRopeFull(state.anchorX, ANCHOR_Y, wx, wy);

      if (t >= 1) {
        state.phase = "falling";
        dom.svg.classList.add("snapped");
        const totalLen = len;
        const breakRatio = 0.25 + Math.random() * 0.4;
        state.bottomLen = totalLen * (1 - breakRatio);
        state.weightY = wy;
        state.weightX = wx;
        state.vy = 40;
        state.vx = (Math.random() - 0.5) * 30;
        state.topY = ANCHOR_Y + totalLen * breakRatio;
        state.topV = -260;
        state.bannerShown = false;
        state.fallElapsed = 0;
      }
    } else if (state.phase === "swinging") {
      const sinT = Math.sin(state.theta);
      const cosT = Math.cos(state.theta);
      const alpha = -(G / ROPE_L_M) * sinT - SWING_DAMPING * state.omega;
      state.omega += alpha * dt;
      state.theta += state.omega * dt;

      const v = ROPE_L_M * state.omega;
      const tensionN =
        state.weight * G * Math.cos(state.theta) +
        (state.weight * v * v) / ROPE_L_M;
      const capacityN = state.insights.capacityForce;
      const utilization = capacityN > 0 ? (tensionN / capacityN) * 100 : 0;

      if (tensionN > state.peakTension) {
        state.peakTension = tensionN;
        state.peakUtil = utilization;
        state.peakTheta = state.theta;
      }

      const wx = state.anchorX + state.ropeLen * Math.sin(state.theta);
      const wy = ANCHOR_Y + state.ropeLen * Math.cos(state.theta);
      placeWeight(wx, wy);
      setRopeFull(state.anchorX, ANCHOR_Y, wx, wy);

      if (onTick) {
        onTick({
          phase: "swinging",
          tensionN,
          utilization,
          peakTensionN: state.peakTension,
          peakUtilization: state.peakUtil,
          theta: state.theta,
          capacityN,
        });
      }

      state.elapsed += dt;

      if (tensionN > capacityN) {
        dom.svg.classList.add("snapped");
        const breakRatio = 0.25 + Math.random() * 0.4;
        const totalLen = state.ropeLen;
        state.bottomLen = totalLen * (1 - breakRatio);
        state.weightX = wx;
        state.weightY = wy;
        state.vx = state.ropeLen * Math.cos(state.theta) * state.omega;
        state.vy = -state.ropeLen * Math.sin(state.theta) * state.omega + 30;
        state.topY = ANCHOR_Y + totalLen * breakRatio;
        state.topV = -260;
        state.bannerShown = false;
        state.fallElapsed = 0;
        state.swungSnap = true;
        state.phase = "falling";
        return;
      }

      const settled =
        Math.abs(state.theta) < SWING_REST_THETA &&
        Math.abs(state.omega) < SWING_REST_OMEGA;
      if (settled || state.elapsed > SWING_MAX_TIME) {
        if (!state.bannerShown) {
          showBanner(
            `Survived swing. Peak tension ${state.peakTension.toFixed(1)} N (${state.peakUtil.toFixed(0)}% of capacity).`,
            "success"
          );
          state.bannerShown = true;
        }
        if (onTick) {
          onTick({
            phase: "swing-end",
            tensionN,
            utilization,
            peakTensionN: state.peakTension,
            peakUtilization: state.peakUtil,
            theta: state.theta,
            capacityN,
            survived: true,
          });
        }
        state.done = true;
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
        state.anchorX,
        state.topY,
        state.weightX,
        state.weightY,
        state.bottomLen
      );

      state.fallElapsed += dt;
      if (!state.bannerShown && state.fallElapsed > 0.15) {
        let msg;
        if (state.swungSnap) {
          msg = `Snapped mid-swing. Peak tension ${state.peakTension.toFixed(1)} N exceeded the ${state.insights.capacityForce.toFixed(1)} N limit.`;
          if (onTick) {
            onTick({
              phase: "swing-end",
              tensionN: state.peakTension,
              utilization: state.peakUtil,
              peakTensionN: state.peakTension,
              peakUtilization: state.peakUtil,
              theta: state.peakTheta,
              capacityN: state.insights.capacityForce,
              survived: false,
            });
          }
        } else {
          const overPct = Math.max(state.insights.utilization - 100, 0);
          msg = `Snapped. Tension ${state.insights.tensionForce.toFixed(1)} N exceeds ${state.insights.capacityForce.toFixed(1)} N (+${overPct.toFixed(0)}%).`;
        }
        showBanner(msg, "failure");
        state.bannerShown = true;
      }

      if (state.weightY > h + WEIGHT_H + 40) {
        state.done = true;
      }
    }
  }

  function runSimulation(tensileKg, weightKg, angleDeg) {
    cacheDom();
    cancelLoop();
    hideBanner();
    dom.svg.classList.remove("snapped");

    const insights = computeInsights(tensileKg, weightKg, angleDeg);
    const size = syncViewBox();
    const anchorX = size.w / 2;
    const restTopY = size.h * REST_RATIO;
    const ropeLen = restTopY - ANCHOR_Y;
    const angleRad = (insights.angleDeg * Math.PI) / 180;
    const sinA = Math.sin(angleRad);
    const cosA = Math.cos(angleRad);
    const restWX = anchorX + ropeLen * sinA;
    const restWY = ANCHOR_Y + ropeLen * cosA;

    showWeight(formatKg(weightKg));
    placeWeight(restWX, restWY);
    setRopeFull(anchorX, ANCHOR_Y, restWX, restWY);

    const willHold = insights.willHold;

    state = {
      size,
      tensile: tensileKg,
      weight: weightKg,
      insights,
      anchorX,
      ropeLen,
      angleRad,
      sinA,
      cosA,
      phase: willHold ? "held" : "strain",
      elapsed: 0,
      springY: 0,
      springV: 0,
      done: false,
    };

    if (willHold) {
      const ratio = Math.min(insights.utilization / 100, 1);
      state.springY = HOLD_BOB_AMP + ratio * 18;
      state.springV = 0;
      showBanner(
        `Held. ${insights.safetyFactor === Infinity ? "no" : insights.safetyFactor.toFixed(1) + "×"} safety factor at ${insights.utilization.toFixed(0)}% capacity.`,
        "success"
      );
    }

    startLoop();
    return insights;
  }

  function runSwing(tensileKg, weightKg, angleDeg) {
    cacheDom();
    cancelLoop();
    hideBanner();
    dom.svg.classList.remove("snapped");

    const insights = computeInsights(tensileKg, weightKg, angleDeg);
    const size = syncViewBox();
    const anchorX = size.w / 2;
    const restTopY = size.h * REST_RATIO;
    const ropeLen = restTopY - ANCHOR_Y;
    const angleRad = (insights.angleDeg * Math.PI) / 180;

    const wx = anchorX + ropeLen * Math.sin(angleRad);
    const wy = ANCHOR_Y + ropeLen * Math.cos(angleRad);

    showWeight(formatKg(weightKg));
    placeWeight(wx, wy);
    setRopeFull(anchorX, ANCHOR_Y, wx, wy);

    state = {
      size,
      tensile: tensileKg,
      weight: weightKg,
      insights,
      anchorX,
      ropeLen,
      theta: angleRad,
      omega: 0,
      peakTension: 0,
      peakUtil: 0,
      peakTheta: angleRad,
      phase: "swinging",
      elapsed: 0,
      bannerShown: false,
      done: false,
      swungSnap: false,
    };

    startLoop();
    return insights;
  }

  function resetSimulation() {
    cacheDom();
    cancelLoop();
    state = null;
    const { w, h } = syncViewBox();
    dom.svg.classList.remove("snapped");
    const restTopY = h * REST_RATIO;
    const x = w / 2;
    setRopeFull(x, ANCHOR_Y, x, restTopY);
    placeWeight(x, restTopY);
    hideWeight();
    hideBanner();
  }

  window.addEventListener("resize", () => {
    if (state && !state.done) return;
    cacheDom();
    const { w, h } = syncViewBox();
    if (dom.svg.classList.contains("snapped")) return;
    const x = w / 2;
    setRopeFull(x, ANCHOR_Y, x, h * REST_RATIO);
  });

  window.Simulation = { runSimulation, runSwing, resetSimulation, computeInsights, setOnTick };
})();
