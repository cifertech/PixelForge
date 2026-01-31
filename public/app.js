const THEMES = {
  githubDark: { bg: "#0d1117", text: "#c9d1d9", accent: "#58a6ff" },
  dracula: { bg: "#282a36", text: "#f8f8f2", accent: "#bd93f9" },
  nord: { bg: "#2e3440", text: "#d8dee9", accent: "#88c0d0" },
  solarizedDark: { bg: "#002b36", text: "#93a1a1", accent: "#b58900" },
  catppuccinMocha: { bg: "#1e1e2e", text: "#cdd6f4", accent: "#cba6f7" },
  tokyoNight: { bg: "#1a1b26", text: "#c0caf5", accent: "#7aa2f7" },
  monokai: { bg: "#272822", text: "#f8f8f2", accent: "#f92672" },
  gruvboxDark: { bg: "#282828", text: "#ebdbb2", accent: "#fabd2f" },
  emberGlow: { bg: "#1a120c", text: "#f1d8c4", accent: "#ff6d1f" }
};

let templateLogoData = null;
let templateBgData = null;
let lastSvgText = null;
let lastBlobUrl = null;
const DEFAULT_LOGO_PATH = "/public/assets/example-logo.png";

function $(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const el = $("status");
  if (el) el.textContent = text || "";
}

function setPreviewSvg(svgText) {
  lastSvgText = svgText;
  const btn = $("downloadSvg");
  if (btn) btn.disabled = !svgText;

  if (lastBlobUrl) URL.revokeObjectURL(lastBlobUrl);
  lastBlobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  $("preview").src = lastBlobUrl;
}

function normalizeTemplateMetrics(svgText) {
  if (!svgText || !svgText.includes('class="metric"')) return svgText;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const metricTexts = [...doc.querySelectorAll("text.metric")];
    if (metricTexts.length < 2) return svgText;

    const parsed = metricTexts
      .map((text) => {
        const group = text.closest("g");
        if (!group) return null;
        const transform = group.getAttribute("transform") || "";
        const match = /translate\(([^,]+),\s*([^)]+)\)/.exec(transform);
        if (!match) return null;
        return { group, x: match[1], y: match[2] };
      })
      .filter(Boolean);

    if (parsed.length < 2) return svgText;

    const targetY = parsed[0].y;
    parsed.forEach(({ group, x }) => {
      group.setAttribute("transform", `translate(${x}, ${targetY})`);
    });

    const titleText = doc.querySelector("text.title");
  if (parsed[0].x) {
    if (titleText) titleText.setAttribute("x", parsed[0].x);
    const subtitleText = doc.querySelector("text.subtitle");
    if (subtitleText) subtitleText.setAttribute("x", parsed[0].x);
  }

    return new XMLSerializer().serializeToString(doc);
  } catch (err) {
    return svgText;
  }
}

function downloadSvg() {
  if (!lastSvgText) return;
  const a = document.createElement("a");
  a.href = lastBlobUrl || URL.createObjectURL(new Blob([lastSvgText], { type: "image/svg+xml" }));
  a.download = "github-template-banner.svg";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

window.downloadSvg = downloadSvg;

function syncThemeToColors() {
  const key = $("theme").value;
  const t = THEMES[key];
  if (!t) return;
  $("bg").value = t.bg;
  $("text").value = t.text;
  $("accent").value = t.accent;
}

function setThemeCustom() {
  const themeEl = $("theme");
  if (themeEl && themeEl.value) themeEl.value = "";
}

function toggleMode() {
  const mode = $("mode")?.value || "template";
  const templatePanel = $("templatePanel");
  const metricsPanel = $("metricsPanel");
  if (templatePanel) templatePanel.style.display = mode === "template" ? "block" : "none";
  if (metricsPanel) metricsPanel.style.display = mode === "template" ? "none" : "block";
  if (templatePanel) templatePanel.hidden = mode !== "template";
  if (metricsPanel) metricsPanel.hidden = mode === "template";
  if (document.body) document.body.dataset.mode = mode;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error || new Error("Failed to read file"));
    r.readAsDataURL(file);
  });
}

function setupDropzone({ zoneId, fileInputId, hintId, onData }) {
  const zone = $(zoneId);
  const input = $(fileInputId);
  const hint = $(hintId);
  if (!zone || !input) return;

  const setHint = (t) => {
    if (hint) hint.textContent = t;
  };

  const acceptFile = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      setStatus("Please drop an image file.");
      return;
    }
    // Basic size guard (keeps request reasonable)
    if (file.size > 800_000) {
      setStatus("Image is too large. Please use an image under 800KB.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    onData(dataUrl);
    setHint(`${file.name} (${Math.round(file.size / 1024)} KB)`);
    // If user uploads a file, treat URL input as optional
  };

  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    await acceptFile(file);
  });

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dropzoneActive");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dropzoneActive"));
  zone.addEventListener("drop", async (e) => {
    e.preventDefault();
    zone.classList.remove("dropzoneActive");
    const file = e.dataTransfer?.files?.[0];
    await acceptFile(file);
  });
}

function generate() {
  toggleMode();
  const mode = $("mode")?.value || "template";
  const owner = $("owner").value.trim();
  const repo = $("repo").value.trim();
  setStatus("");

  if (location.protocol === "file:") {
    setStatus("Error: You opened this page as a local file (file://). Please run it via a local server or deploy (Vercel), otherwise /api/badge will not work.");
    return;
  }

  if (mode !== "template" && (!owner || !repo)) {
    setStatus("Please enter both Owner and Repository.");
    return;
  }

  const theme = $("theme").value;
  const style = $("style").value;
  const bg = $("bg").value.replace("#", "");
  const text = $("text").value.replace("#", "");
  const accent = $("accent").value.replace("#", "");
  const glow = $("glow").checked ? "1" : "0";
  const emoji = $("emoji").checked ? "1" : "0";
  const transparentBg = $("transparentBg")?.checked ? "1" : "0";
  const outline = $("outline")?.checked ? "1" : "0";
  const titleSize = $("titleSize")?.value?.trim();
  const metricSize = $("metricSize")?.value?.trim();

  const params = new URLSearchParams();
  params.set("mode", mode);
  if (owner) params.set("owner", owner);
  if (repo) params.set("repo", repo);
  params.set("style", style);
  params.set("glow", glow);
  params.set("emoji", emoji);
  params.set("transparentBg", transparentBg);
  params.set("outline", outline);
  if (titleSize) params.set("titleSize", titleSize);
  if (metricSize) params.set("metricSize", metricSize);

  if (mode === "template") {
    const title = $("title")?.value?.trim() || "";
    const subtitle = $("subtitle")?.value?.trim() || "";
    const logoUrl = $("logoUrl")?.value?.trim() || "";
    const bgImageUrl = $("bgImageUrl")?.value?.trim() || "";
    const drawIcons = "1";
    const slot1 = $("slot1")?.value || "stars";
    const slot2 = $("slot2")?.value || "forks";
    const slot3 = $("slot3")?.value || "downloads";
    if (title) params.set("title", title);
    if (subtitle) params.set("subtitle", subtitle);
    if (logoUrl) params.set("logoUrl", logoUrl);
    if (bgImageUrl) params.set("bgImageUrl", bgImageUrl);
    params.set("drawIcons", drawIcons);
    params.set("slots", [slot1, slot2, slot3].join(","));

    // If user uploaded images via drag&drop, render via POST so we don't stuff huge data URIs into a GET URL.
    if (templateLogoData || templateBgData) {
      const payload = {
        mode: "template",
        owner,
        repo,
        title: title || undefined,
        subtitle: subtitle || undefined,
        slots: [slot1, slot2, slot3].join(","),
        drawIcons,
        glow,
        emoji,
        transparentBg,
        outline,
        titleSize: titleSize || undefined,
        metricSize: metricSize || undefined,
        theme: theme || "",
        bg: theme ? undefined : `#${bg}`,
        text: theme ? undefined : `#${text}`,
        accent: theme ? undefined : `#${accent}`,
        logoUrl: logoUrl || undefined,
        bgImageUrl: bgImageUrl || undefined,
        logoData: templateLogoData || undefined,
        bgImageData: templateBgData || undefined
      };

      fetch("/api/badge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(async (r) => {
          const t = await r.text();
          if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
          return t;
        })
        .then((svg) => {
          const normalized = mode === "template" ? normalizeTemplateMetrics(svg) : svg;
          setPreviewSvg(normalized);
          setStatus("Rendered via upload (POST). Use Download SVG to save it.");
          $("markdown").value =
            "Template rendered from uploaded images.\n" +
            "Use the Download SVG button, then upload the SVG (or logo/background) to a public URL for README usage.";
        })
        .catch((e) => {
          const msg = `Failed to render template via upload.\n${e?.message || e || ""}`;
          setStatus(msg);
        });
      return;
    }
  } else {
    const metrics = [...document.querySelectorAll("fieldset input:checked")]
      .map(e => e.value)
      .join(",");
    params.set("metrics", metrics);
  }

  // If a preset is selected, include it; otherwise include explicit colors.
  if (theme) {
    params.set("theme", theme);
  } else {
    params.set("bg", `#${bg}`);
    params.set("text", `#${text}`);
    params.set("accent", `#${accent}`);
  }

  const url = `/api/badge?${params.toString()}`;
  const absoluteUrl = `${location.origin}${url}`;

  lastSvgText = null;
  const btn = $("downloadSvg");
  if (btn) btn.disabled = true;
  if (lastBlobUrl) {
    URL.revokeObjectURL(lastBlobUrl);
    lastBlobUrl = null;
  }

  setStatus(`Rendering via GET:\n${absoluteUrl}`);

  fetch(url, { headers: { accept: "image/svg+xml" } })
    .then(async (r) => {
      const t = await r.text();
      if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
      return t;
    })
    .then((svg) => {
      const normalized = mode === "template" ? normalizeTemplateMetrics(svg) : svg;
      setPreviewSvg(normalized);
      setStatus(`Rendered via GET.\n${absoluteUrl}`);
      $("markdown").value = `![GitBadge](${absoluteUrl})`;
    })
    .catch((e) => {
      const msg = `Failed to render via GET.\n${e?.message || e || ""}`;
      setStatus(msg);
      const preview = $("preview");
      if (preview) preview.removeAttribute("src");
      const btn2 = $("downloadSvg");
      if (btn2) btn2.disabled = true;
    });
}

let autoRenderTimer = null;

function scheduleGenerate() {
  if (autoRenderTimer) window.clearTimeout(autoRenderTimer);
  autoRenderTimer = window.setTimeout(() => {
    autoRenderTimer = null;
    generate();
  }, 300);
}

// Auto-apply preset colors when theme changes
window.addEventListener("DOMContentLoaded", () => {
  const modeEl = $("mode");
  if (modeEl) modeEl.addEventListener("change", () => {
    toggleMode();
    scheduleGenerate();
  });
  toggleMode();

  const ownerEl = $("owner");
  const repoEl = $("repo");
  if (ownerEl && repoEl && !ownerEl.value && !repoEl.value) {
    ownerEl.value = "octocat";
    repoEl.value = "Hello-World";
  }

  const logoUrlEl = $("logoUrl");
  if (logoUrlEl && !logoUrlEl.value && (location.protocol === "http:" || location.protocol === "https:")) {
    logoUrlEl.value = `${location.origin}${DEFAULT_LOGO_PATH}`;
    const logoHint = $("logoDropHint");
    if (logoHint) logoHint.textContent = "Default logo loaded (edit URL or drop to replace)";
  }

  setupDropzone({
    zoneId: "logoDrop",
    fileInputId: "logoFile",
    hintId: "logoDropHint",
    onData: (d) => {
      templateLogoData = d;
      setThemeCustom();
    }
  });
  setupDropzone({
    zoneId: "bgDrop",
    fileInputId: "bgFile",
    hintId: "bgDropHint",
    onData: (d) => {
      templateBgData = d;
      setThemeCustom();
    }
  });

  const themeEl = $("theme");
  if (themeEl) themeEl.addEventListener("change", () => {
    syncThemeToColors();
    scheduleGenerate();
  });

  // If the user tweaks colors manually, treat it as a custom theme.
  const bgEl = $("bg");
  const textEl = $("text");
  const accentEl = $("accent");
  if (bgEl) bgEl.addEventListener("change", () => {
    setThemeCustom();
    scheduleGenerate();
  });
  if (textEl) textEl.addEventListener("change", () => {
    setThemeCustom();
    scheduleGenerate();
  });
  if (accentEl) accentEl.addEventListener("change", () => {
    setThemeCustom();
    scheduleGenerate();
  });

  const previewEl = $("preview");
  if (previewEl) {
    previewEl.addEventListener("load", () => {
      const currentStatus = $("status")?.textContent || "";
      if (!currentStatus || currentStatus.startsWith("Rendering via GET")) {
        setStatus("Preview rendered.");
      }
    });
    previewEl.addEventListener("error", () => {
      setStatus("Failed to load preview. Check owner/repo or API response.");
    });
  }

  const liveInputs = [
    "owner",
    "repo",
    "title",
    "subtitle",
    "logoUrl",
    "bgImageUrl",
    "titleSize",
    "metricSize"
  ];

  liveInputs.forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("input", scheduleGenerate);
  });

  const liveSelects = ["style", "slot1", "slot2", "slot3"];
  liveSelects.forEach((id) => {
    const el = $(id);
    if (el) el.addEventListener("change", scheduleGenerate);
  });

  document.querySelectorAll("fieldset.metrics input[type='checkbox']").forEach((el) => {
    el.addEventListener("change", scheduleGenerate);
  });

  const glowEl = $("glow");
  if (glowEl) glowEl.addEventListener("change", scheduleGenerate);
  const emojiEl = $("emoji");
  if (emojiEl) emojiEl.addEventListener("change", scheduleGenerate);
  const transparentBgEl = $("transparentBg");
  if (transparentBgEl) transparentBgEl.addEventListener("change", scheduleGenerate);
  const outlineEl = $("outline");
  if (outlineEl) outlineEl.addEventListener("change", scheduleGenerate);

  scheduleGenerate();
});