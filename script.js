(function () {
  "use strict";

  var STORAGE_COUNT_KEY = "jagdhund_count";
  var STORAGE_CLICKS_KEY = "jagdhund_clicks";

  var counterValueEl = document.getElementById("counterValue");
  var lastDrinkEl = document.getElementById("lastDrink");
  var incrementBtn = document.getElementById("incrementBtn");
  var incrementFiveBtn = document.getElementById("incrementFiveBtn");
  var decrementBtn = document.getElementById("decrementBtn");
  var resetBtn = document.getElementById("resetBtn");
  var confirmOverlay = document.getElementById("confirmOverlay");
  var confirmResetBtn = document.getElementById("confirmResetBtn");
  var cancelResetBtn = document.getElementById("cancelResetBtn");
  var chartCanvas = document.getElementById("chart");
  var ctx = chartCanvas.getContext("2d");
  var locomotivePopup = document.getElementById("locomotivePopup");
  var locomotivePopupCount = document.getElementById("locomotivePopupCount");

  var count = 0;
  var clicks = []; // Array von Timestamps (ms seit Epoch)

  function loadState() {
    var storedCount = localStorage.getItem(STORAGE_COUNT_KEY);
    var storedClicks = localStorage.getItem(STORAGE_CLICKS_KEY);

    count = storedCount ? parseInt(storedCount, 10) : 0;
    if (isNaN(count) || count < 0) count = 0;

    try {
      clicks = storedClicks ? JSON.parse(storedClicks) : [];
      if (!Array.isArray(clicks)) clicks = [];
    } catch (e) {
      clicks = [];
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_COUNT_KEY, String(count));
    localStorage.setItem(STORAGE_CLICKS_KEY, JSON.stringify(clicks));
  }

  function formatTime(ts) {
    var d = new Date(ts);
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    var ss = String(d.getSeconds()).padStart(2, "0");
    return hh + ":" + mm + ":" + ss;
  }

  function render() {
    counterValueEl.textContent = String(count);

    if (clicks.length > 0) {
      lastDrinkEl.textContent = "Letzter Jagdhund: " + formatTime(clicks[clicks.length - 1]);
    } else {
      lastDrinkEl.textContent = "Letzter Jagdhund: –";
    }

    drawChart();
  }

  var LOCOMOTIVE_INTERVAL = 10;

  function formatHourMinute(ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }

  function drawChart() {
    var dpr = window.devicePixelRatio || 1;
    var rect = chartCanvas.getBoundingClientRect();
    chartCanvas.width = rect.width * dpr;
    chartCanvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var width = rect.width;
    var height = rect.height;
    ctx.clearRect(0, 0, width, height);

    if (clicks.length === 0) {
      var placeholderText = "Noch keine Daten – erster Jagdhund fehlt";
      var placeholderSize = Math.max(16, Math.min(height * 0.06, width / (placeholderText.length * 0.55)));
      ctx.fillStyle = "#a89a7c";
      ctx.font = "600 " + placeholderSize + "px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(placeholderText, width / 2, height / 2);
      return;
    }

    // Punkte des Verlaufs: (Uhrzeit, kumulierter Stand)
    var points = clicks.map(function (ts, i) {
      return { t: ts, c: i + 1 };
    });

    var tMin = points[0].t;
    var tMax = points[points.length - 1].t;
    if (tMax === tMin) tMax = tMin + 60000;

    var maxCount = points[points.length - 1].c;
    var niceMax = Math.max(LOCOMOTIVE_INTERVAL, Math.ceil(maxCount * 1.25));

    var paddingLeft = 52;
    var paddingRight = 24;
    var paddingTop = 56;
    var paddingBottom = 44;
    var chartWidth = width - paddingLeft - paddingRight;
    var chartHeight = height - paddingTop - paddingBottom;

    function xForTime(t) {
      return paddingLeft + ((t - tMin) / (tMax - tMin)) * chartWidth;
    }
    function yForCount(c) {
      return paddingTop + chartHeight - (c / niceMax) * chartHeight;
    }

    // Achsen
    ctx.strokeStyle = "#dda637";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, paddingTop);
    ctx.lineTo(paddingLeft, paddingTop + chartHeight);
    ctx.lineTo(paddingLeft + chartWidth, paddingTop + chartHeight);
    ctx.stroke();

    // Y-Achsen Beschriftung (0, Mitte, Max)
    ctx.fillStyle = "#a89a7c";
    ctx.font = "600 " + Math.max(12, height * 0.035) + "px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    [0, 0.5, 1].forEach(function (frac) {
      var y = paddingTop + chartHeight - frac * chartHeight;
      var value = Math.round(niceMax * frac);
      ctx.fillText(String(value), paddingLeft - 10, y);
    });

    // X-Achsen Beschriftung: Uhrzeit
    var tickCount = Math.min(6, points.length);
    tickCount = Math.max(tickCount, 2);
    ctx.fillStyle = "#a89a7c";
    ctx.font = "600 " + Math.max(12, height * 0.032) + "px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (var i = 0; i < tickCount; i++) {
      var t = tMin + ((tMax - tMin) * i) / (tickCount - 1);
      var x = xForTime(t);
      ctx.fillText(formatHourMinute(t), x, paddingTop + chartHeight + 8);
    }

    // Verlaufslinie
    ctx.strokeStyle = "#f0c169";
    ctx.lineWidth = 3;
    ctx.beginPath();
    points.forEach(function (p, idx) {
      var x = xForTime(p.t);
      var y = yForCount(p.c);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Punkte + Lokomotive bei jedem 10er-Schritt
    points.forEach(function (p) {
      var x = xForTime(p.t);
      var y = yForCount(p.c);

      ctx.fillStyle = "#1c7a49";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      if (p.c % LOCOMOTIVE_INTERVAL === 0) {
        var emojiSize = Math.max(20, height * 0.08);
        ctx.font = emojiSize + "px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("🚂", x, y - 14);

        ctx.fillStyle = "#f6dfae";
        ctx.font = "700 " + Math.max(13, height * 0.04) + "px Arial";
        ctx.fillText(String(p.c), x, y - emojiSize - 10);
      }
    });
  }

  var locomotivePopupTimer = null;

  function showLocomotivePopup(currentCount) {
    locomotivePopupCount.textContent = String(currentCount);
    locomotivePopup.classList.add("show");

    if (locomotivePopupTimer) clearTimeout(locomotivePopupTimer);
    locomotivePopupTimer = setTimeout(function () {
      locomotivePopup.classList.remove("show");
    }, 2800);
  }

  function addJagdhunde(amount) {
    var oldCount = count;
    var now = Date.now();

    count += amount;
    for (var n = 0; n < amount; n++) clicks.push(now);
    saveState();
    render();

    for (var i = oldCount + 1; i <= count; i++) {
      if (i % LOCOMOTIVE_INTERVAL === 0) {
        showLocomotivePopup(i);
      }
    }
  }

  function increment() {
    addJagdhunde(1);
  }

  function incrementFive() {
    addJagdhunde(5);
  }

  function decrement() {
    if (count <= 0) return;
    count -= 1;
    clicks.pop();
    saveState();
    render();
  }

  function openConfirm() {
    confirmOverlay.classList.add("open");
  }

  function closeConfirm() {
    confirmOverlay.classList.remove("open");
  }

  function resetAll() {
    count = 0;
    clicks = [];
    saveState();
    render();
    closeConfirm();
  }

  incrementBtn.addEventListener("click", increment);
  incrementFiveBtn.addEventListener("click", incrementFive);
  decrementBtn.addEventListener("click", decrement);
  resetBtn.addEventListener("click", openConfirm);
  confirmResetBtn.addEventListener("click", resetAll);
  cancelResetBtn.addEventListener("click", closeConfirm);
  confirmOverlay.addEventListener("click", function (e) {
    if (e.target === confirmOverlay) closeConfirm();
  });

  window.addEventListener("resize", drawChart);

  loadState();
  render();
})();
