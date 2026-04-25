(function () {
  const tensileInput = document.getElementById("tensile");
  const weightInput = document.getElementById("weight");
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");
  const validationMsg = document.getElementById("validationMsg");
  const referenceList = document.getElementById("referenceList");

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

  function validate() {
    const t = parseNonNegative(tensileInput.value, "tensile strength");
    if (!t.ok) return t;
    if (t.value === 0) {
      return { ok: false, msg: "Tensile strength must be greater than 0." };
    }
    const w = parseNonNegative(weightInput.value, "weight");
    if (!w.ok) return w;
    return { ok: true, tensile: t.value, weight: w.value };
  }

  function clearValidation() {
    validationMsg.textContent = "";
  }

  runBtn.addEventListener("click", () => {
    const result = validate();
    if (!result.ok) {
      validationMsg.textContent = result.msg;
      return;
    }
    clearValidation();
    window.Simulation.runSimulation(result.tensile, result.weight);
  });

  resetBtn.addEventListener("click", () => {
    clearValidation();
    weightInput.value = "";
    tensileInput.value = "";
    window.Simulation.resetSimulation();
  });

  [tensileInput, weightInput].forEach((el) => {
    el.addEventListener("input", clearValidation);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") runBtn.click();
    });
  });

  renderReferences();
  window.Simulation.resetSimulation();
})();
