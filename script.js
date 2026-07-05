(function () {
  "use strict";

  var STORAGE_COUNT_KEY = "jagdhund_count";
  var STORAGE_CLICKS_KEY = "jagdhund_clicks";

  var counterValueEl = document.getElementById("counterValue");
  var lastDrinkEl = document.getElementById("lastDrink");
  var incrementBtn = document.getElementById("incrementBtn");
  var decrementBtn = document.getElementById("decrementBtn");
  var resetBtn = document.getElementById("resetBtn");
  var confirmOverlay = document.getElementById("confirmOverlay");
  var confirmResetBtn = document.getElementById("confirmResetBtn");
  var cancelResetBtn = document.getElementById("cancelResetBtn");
  var chartCanvas = document.getElementById("chart");
  var ctx = chartCanvas.getContext("2d");

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

  // Gruppiert die Klick-Zeitstempel stundenweise, damit der Verlauf
  // ueber einen ganzen Abend hinweg auf dem Fernseher lesbar bleibt.
  function buildHourlyBuckets() {
    if (clicks.length === 0) return { labels: [], data: [] };

    var buckets = {};
    clicks.forEach(function (ts) {
      var d = new Date(ts);
      var key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate() + "-" + d.getHours();
      buckets[key] = (buckets[key] || 0) + 1;
    });

    var first = new Date(clicks[0]);
    var last = new Date(clicks[clicks.length - 1]);
    first.setMinutes(0, 0, 0);
    last.setMinutes(0, 0, 0);

    var labels = [];
    var data = [];
    var cursor = new Date(first);

    while (cursor <= last) {
      var key = cursor.getFullYear() + "-" + cursor.getMonth() + "-" + cursor.getDate() + "-" + cursor.getHours();
      labels.push(String(cursor.getHours()).padStart(2, "0") + ":00");
      data.push(buckets[key] || 0);
      cursor.setHours(cursor.getHours() + 1);
    }

    return { labels: labels, data: data };
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

    var bucket = buildHourlyBuckets();
    var labels = bucket.labels;
    var data = bucket.data;

    var paddingLeft = 48;
    var paddingRight = 20;
    var paddingTop = 20;
    var paddingBottom = 40;
    var chartWidth = width - paddingLeft - paddingRight;
    var chartHeight = height - paddingTop - paddingBottom;

    if (data.length === 0) {
      ctx.fillStyle = "#a89a7c";
      ctx.font = "600 " + Math.max(16, height * 0.06) + "px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Noch keine Daten – erster Jagdhund fehlt", width / 2, height / 2);
      return;
    }

    var maxValue = Math.max.apply(null, data);
    if (maxValue < 1) maxValue = 1;
    var niceMax = Math.ceil(maxValue * 1.2);

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

    // Balken
    var barSlot = chartWidth / data.length;
    var barWidth = Math.min(barSlot * 0.6, 90);

    data.forEach(function (value, i) {
      var barHeight = (value / niceMax) * chartHeight;
      var x = paddingLeft + i * barSlot + (barSlot - barWidth) / 2;
      var y = paddingTop + chartHeight - barHeight;

      var gradient = ctx.createLinearGradient(0, y, 0, paddingTop + chartHeight);
      gradient.addColorStop(0, "#1c7a49");
      gradient.addColorStop(1, "#0a3d23");
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.strokeStyle = "#dda637";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, barWidth, barHeight);

      // Wert ueber dem Balken
      ctx.fillStyle = "#f0c169";
      ctx.font = "700 " + Math.max(13, height * 0.04) + "px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(String(value), x + barWidth / 2, y - 6);

      // X-Achsen Beschriftung
      ctx.fillStyle = "#a89a7c";
      ctx.font = "600 " + Math.max(12, height * 0.032) + "px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(labels[i], x + barWidth / 2, paddingTop + chartHeight + 8);
    });
  }

  function increment() {
    count += 1;
    clicks.push(Date.now());
    saveState();
    render();
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
