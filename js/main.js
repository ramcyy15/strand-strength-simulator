(function () {
  const tensileInput = document.getElementById("tensile");
  const weightInput = document.getElementById("weight");
  const angleInput = document.getElementById("angle");
  const runBtn = document.getElementById("runBtn");
  const swingBtn = document.getElementById("swingBtn");
  const resetBtn = document.getElementById("resetBtn");
  const validationMsg = document.getElementById("validationMsg");
  const referenceList = document.getElementById("referenceList");

  const meterFill = document.getElementById("meterFill");
  const meterLabel = document.getElementById("meterLabel");
  const mLoad = document.getElementById("mLoad");
  const mTension = document.getElementById("mTension");
  const mCapacity = document.getElementById("mCapacity");
  const mSafety = document.getElementById("mSafety");
  const mVerdict = document.getElementById("mVerdict");

  function renderReferences() {
    referenceList.innerHTML = "";
    window.REFERENCES.forEach((r) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${r.name}</span><strong>${r.capacityKg} kg</strong>`;
      li.classList.add("clickable");
      li.title = `Use ${r.capacityKg} kg as tensile strength`;
      li.addEventListener("click", () => {
        tensileInput.value = String(r.capacityKg);
        clearValidation();
        tensileInput.focus();
      });
      referenceList.appendChild(li);
    });
  }

  function parseNonNegative(raw, label) {
    const trimmed = raw.trim();
    if (trimmed === "") return { ok: false, msg: `Enter ${label}.` };
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return { ok: false, msg: `${label} must be a number.` };
    if (num < 0) return { ok: false, msg: `${label} cannot be negative.` };
    if (num > 1e6) return { ok: false, msg: `${label} is unrealistically large.` };
    return { ok: true, value: num };
  }

  function parseAngle(raw) {
    const trimmed = (raw || "").trim();
    if (trimmed === "") return { ok: true, value: 0 };
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return { ok: false, msg: "Angle must be a number." };
    if (n < 0) return { ok: false, msg: "Angle cannot be negative." };
    if (n > 80) return { ok: false, msg: "Angle must be 80° or less." };
    return { ok: true, value: n };
  }

  function validate() {
    const t = parseNonNegative(tensileInput.value, "tensile strength");
    if (!t.ok) return t;
    if (t.value === 0) {
      return { ok: false, msg: "Tensile strength must be greater than 0." };
    }
    const w = parseNonNegative(weightInput.value, "weight");
    if (!w.ok) return w;
    const a = parseAngle(angleInput.value);
    if (!a.ok) return a;
    return { ok: true, tensile: t.value, weight: w.value, angle: a.value };
  }

  function clearValidation() {
    validationMsg.textContent = "";
  }

  function fmtN(n) {
    return `${n.toFixed(1)} N`;
  }

  function renderInsights(insights) {
    const cappedPct = Math.min(Math.max(insights.utilization, 0), 100);
    meterFill.style.width = `${cappedPct}%`;
    meterFill.classList.remove("caution", "danger");
    if (insights.utilization > 100) meterFill.classList.add("danger");
    else if (insights.utilization > 75) meterFill.classList.add("caution");

    meterLabel.textContent = `${insights.utilization.toFixed(1)} %`;
    mLoad.textContent = fmtN(insights.loadForce);
    mTension.textContent = fmtN(insights.tensionForce);
    mCapacity.textContent = fmtN(insights.capacityForce);
    mSafety.textContent = Number.isFinite(insights.safetyFactor)
      ? `${insights.safetyFactor.toFixed(2)}×`
      : "∞";

    const angleNote = insights.angleDeg > 0
      ? ` At ${insights.angleDeg}° from vertical, only ${(insights.cosA * 100).toFixed(0)}% of the load weight pulls along the strand (T = m·g·cos θ).`
      : "";

    if (insights.willHold) {
      if (insights.utilization > 90) {
        mVerdict.textContent = `Held — but only just. Tension is at ${insights.utilization.toFixed(0)}% of capacity. Any extra load would snap it.${angleNote}`;
      } else if (insights.utilization > 60) {
        mVerdict.textContent = `Held with caution. Safety factor of ${insights.safetyFactor.toFixed(1)}× — workable but not generous.${angleNote}`;
      } else {
        mVerdict.textContent = `Held safely. Safety factor of ${insights.safetyFactor.toFixed(1)}× leaves comfortable margin.${angleNote}`;
      }
    } else {
      const overload = insights.tensionForce - insights.capacityForce;
      const overPct = insights.utilization - 100;
      mVerdict.textContent = `Snapped. Tension exceeds capacity by ${overload.toFixed(1)} N (${overPct.toFixed(0)}% over the limit).${angleNote}`;
    }
  }

  function clearInsights() {
    meterFill.style.width = "0%";
    meterFill.classList.remove("caution", "danger");
    meterLabel.textContent = "— %";
    mLoad.textContent = "— N";
    mTension.textContent = "— N";
    mCapacity.textContent = "— N";
    mSafety.textContent = "—";
    mVerdict.textContent = "Run a simulation to see how the strand handles the load.";
  }

  function applyMeter(util) {
    const cappedPct = Math.min(Math.max(util, 0), 100);
    meterFill.style.width = `${cappedPct}%`;
    meterFill.classList.remove("caution", "danger");
    if (util > 100) meterFill.classList.add("danger");
    else if (util > 75) meterFill.classList.add("caution");
  }

  function liveSwingTick(info) {
    if (info.phase === "swinging") {
      applyMeter(info.utilization);
      meterLabel.textContent = `${info.utilization.toFixed(1)} %`;
      mTension.textContent = `${info.tensionN.toFixed(1)} N`;
      mSafety.textContent =
        info.tensionN > 0
          ? `${(info.capacityN / info.tensionN).toFixed(2)}×`
          : "∞";
      mVerdict.textContent = `Swinging — current tension ${info.tensionN.toFixed(1)} N. Peak so far: ${info.peakTensionN.toFixed(1)} N (${info.peakUtilization.toFixed(0)}%).`;
    } else if (info.phase === "swing-end") {
      applyMeter(info.peakUtilization);
      meterLabel.textContent = `peak ${info.peakUtilization.toFixed(1)} %`;
      mTension.textContent = `${info.peakTensionN.toFixed(1)} N (peak)`;
      mSafety.textContent =
        info.peakTensionN > 0
          ? `${(info.capacityN / info.peakTensionN).toFixed(2)}×`
          : "∞";
      if (info.survived) {
        mVerdict.textContent = `Survived the swing. Peak tension ${info.peakTensionN.toFixed(1)} N (${info.peakUtilization.toFixed(0)}% of capacity) at the bottom of the arc — where v² is largest.`;
      } else {
        const overload = info.peakTensionN - info.capacityN;
        mVerdict.textContent = `Snapped mid-swing. Peak tension hit ${info.peakTensionN.toFixed(1)} N — ${overload.toFixed(1)} N over the limit. Centripetal force (m·v²/r) at the bottom of the arc pushed it past capacity.`;
      }
    }
  }

  runBtn.addEventListener("click", () => {
    const result = validate();
    if (!result.ok) {
      validationMsg.textContent = result.msg;
      return;
    }
    clearValidation();
    window.Simulation.setOnTick(null);
    const insights = window.Simulation.computeInsights(
      result.tensile,
      result.weight,
      result.angle
    );
    renderInsights(insights);
    window.Simulation.runSimulation(result.tensile, result.weight, result.angle);
  });

  swingBtn.addEventListener("click", () => {
    const result = validate();
    if (!result.ok) {
      validationMsg.textContent = result.msg;
      return;
    }
    if (result.angle <= 0) {
      validationMsg.textContent = "Set an angle greater than 0° to swing.";
      return;
    }
    clearValidation();
    const insights = window.Simulation.computeInsights(
      result.tensile,
      result.weight,
      result.angle
    );
    mLoad.textContent = fmtN(insights.loadForce);
    mCapacity.textContent = fmtN(insights.capacityForce);
    mTension.textContent = "— N";
    mSafety.textContent = "—";
    meterFill.style.width = "0%";
    meterFill.classList.remove("caution", "danger");
    meterLabel.textContent = "0.0 %";
    mVerdict.textContent = `Released from ${insights.angleDeg}°. Watch the meter — tension peaks at the bottom of the arc due to T = m·g·cos θ + m·v²/r.`;
    window.Simulation.setOnTick(liveSwingTick);
    window.Simulation.runSwing(result.tensile, result.weight, result.angle);
  });

  resetBtn.addEventListener("click", () => {
    clearValidation();
    weightInput.value = "";
    tensileInput.value = "";
    angleInput.value = "";
    window.Simulation.setOnTick(null);
    clearInsights();
    window.Simulation.resetSimulation();
  });

  [tensileInput, weightInput, angleInput].forEach((el) => {
    el.addEventListener("input", clearValidation);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runBtn.click();
    });
  });

  angleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      swingBtn.click();
    }
  });

  renderReferences();
  clearInsights();
  window.Simulation.resetSimulation();
})();
