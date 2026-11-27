const STORAGE_DATA_KEY = "mutabaah_tahfidz_data";
const STORAGE_API_KEY = "mutabaah_tahfidz_api_url";

let records = [];
let apiUrl = localStorage.getItem(STORAGE_API_KEY) || "";

const form = document.getElementById("hafalanForm");
const tableBody = document.getElementById("hafalanTableBody");
const filterJenis = document.getElementById("filterJenis");
const syncStatus = document.getElementById("syncStatus");

document.querySelectorAll(".nav-link").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetTab = btn.dataset.tab;
    document.querySelectorAll(".nav-link").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${targetTab}`).classList.add("active");
  });
});

document.getElementById("tanggal").valueAsDate = new Date();

function setStatus(text, type) {
  syncStatus.textContent = text;
  syncStatus.className = `badge badge-${type}`;
}

async function loadData() {
  if (!apiUrl) {
    records = JSON.parse(localStorage.getItem(STORAGE_DATA_KEY) || "[]");
    setStatus("Mode Lokal", "offline");
    renderAll();
    return;
  }

  try {
    setStatus("Memuat data...", "loading");
    const res = await fetch(apiUrl);
    const json = await res.json();
    if (json.status === "success") {
      records = json.data;
      localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(records));
      setStatus("Terhubung Sheets", "online");
      renderAll();
    } else {
      throw new Error(json.message || "Gagal memuat");
    }
  } catch (err) {
    console.error(err);
    records = JSON.parse(localStorage.getItem(STORAGE_DATA_KEY) || "[]");
    setStatus("Gagal Sinkron (Lokal)", "offline");
    renderAll();
  }
}

async function sendToApi(payload) {
  if (!apiUrl) return;
  setStatus("Menyimpan...", "loading");
  await fetch(apiUrl, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  await loadData();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("recordId").value;
  const item = {
    id: id || Date.now().toString(),
    tanggal: document.getElementById("tanggal").value,
    jenis: document.getElementById("jenis").value,
    juz: Number(document.getElementById("juz").value),
    surah: document.getElementById("surah").value.trim(),
    ayat: document.getElementById("ayat").value.trim(),
    halaman: Number(document.getElementById("halaman").value),
    predikat: document.getElementById("predikat").value,
    musyrif: document.getElementById("musyrif").value.trim(),
    catatan: document.getElementById("catatan").value.trim(),
  };

  if (!apiUrl) {
    if (id) {
      records = records.map((r) => (r.id === id ? item : r));
    } else {
      records.unshift(item);
    }
    localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(records));
    resetForm();
    renderAll();
    return;
  }

  const action = id ? "update" : "create";
  resetForm();
  await sendToApi({ action, data: item });
});

function editRecord(id) {
  document.querySelector('.nav-link[data-tab="dashboard"]').click();

  const item = records.find((r) => String(r.id) === String(id));
  if (!item) return;
  document.getElementById("recordId").value = item.id;
  document.getElementById("tanggal").value = String(item.tanggal).slice(0, 10);
  document.getElementById("jenis").value = item.jenis;
  document.getElementById("juz").value = item.juz;
  document.getElementById("surah").value = item.surah;
  document.getElementById("ayat").value = item.ayat;
  document.getElementById("halaman").value = item.halaman;
  document.getElementById("predikat").value = item.predikat;
  document.getElementById("musyrif").value = item.musyrif || "";
  document.getElementById("catatan").value = item.catatan || "";

  document.getElementById("formTitle").textContent = "Edit Setoran Hafalan";
  document.getElementById("btnSubmit").textContent = "Update Setoran";
  document.getElementById("btnCancelEdit").classList.remove("hidden");
}

async function deleteRecord(id) {
  if (!confirm("Hapus catatan setoran ini?")) return;
  if (!apiUrl) {
    records = records.filter((r) => String(r.id) !== String(id));
    localStorage.setItem(STORAGE_DATA_KEY, JSON.stringify(records));
    renderAll();
    return;
  }
  await sendToApi({ action: "delete", id: String(id) });
}

function resetForm() {
  form.reset();
  document.getElementById("recordId").value = "";
  document.getElementById("tanggal").valueAsDate = new Date();
  document.getElementById("formTitle").textContent = "Tambah Setoran Hafalan";
  document.getElementById("btnSubmit").textContent = "Simpan Setoran";
  document.getElementById("btnCancelEdit").classList.add("hidden");
}

document.getElementById("btnCancelEdit").addEventListener("click", resetForm);
filterJenis.addEventListener("change", renderDashboardTable);
document.getElementById("hafalanFilterJenis").addEventListener("change", renderHafalanTab);
document.getElementById("hafalanSearch").addEventListener("input", renderHafalanTab);

function renderAll() {
  let totalZiyadah = 0;
  let totalMurajaah = 0;

  records.forEach((r) => {
    const hal = Number(r.halaman) || 0;
    if (r.jenis === "Ziyadah") totalZiyadah += hal;
    else totalMurajaah += hal;
  });

  document.getElementById("statZiyadah").textContent = `${totalZiyadah} Hal`;
  document.getElementById("statMurajaah").textContent = `${totalMurajaah} Hal`;
  document.getElementById("statJuz").textContent = `${(totalZiyadah / 20).toFixed(2)} Juz`;
  document.getElementById("statCount").textContent = `${records.length} Kali`;

  renderDashboardTable();
  renderHafalanTab();
  renderEvaluasiTab();
  renderProfilTab(totalZiyadah, totalMurajaah);
}

function renderDashboardTable() {
  const filter = filterJenis.value;
  const filtered = filter === "ALL" ? records : records.filter((r) => r.jenis === filter);

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">Belum ada data setoran.</td></tr>`;
    return;
  }

  tableBody.innerHTML = filtered
    .map(
      (r) => `
      <tr>
        <td>${String(r.tanggal).slice(0, 10)}</td>
        <td><strong>${r.jenis}</strong></td>
        <td>Juz ${r.juz} • ${r.surah} (${r.ayat})</td>
        <td>${r.halaman}</td>
        <td>${r.predikat}</td>
        <td>
          <button type="button" class="btn btn-sm btn-edit" onclick="editRecord('${r.id}')">Edit</button>
          <button type="button" class="btn btn-sm btn-del" onclick="deleteRecord('${r.id}')">Hapus</button>
        </td>
      </tr>`
    )
    .join("");
}

function renderHafalanTab() {
  const jenisVal = document.getElementById("hafalanFilterJenis").value;
  const query = document.getElementById("hafalanSearch").value.trim().toLowerCase();
  const body = document.getElementById("allHafalanBody");

  const list = records.filter((r) => {
    const matchJenis = jenisVal === "ALL" || r.jenis === jenisVal;
    const matchText =
      !query ||
      String(r.surah).toLowerCase().includes(query) ||
      String(r.juz).toLowerCase().includes(query) ||
      String(r.ayat).toLowerCase().includes(query);
    return matchJenis && matchText;
  });

  if (list.length === 0) {
    body.innerHTML = `<tr><td colspan="7" class="empty-state">Tidak ada data hafalan yang cocok.</td></tr>`;
    return;
  }

  body.innerHTML = list
    .map(
      (r) => `
      <tr>
        <td>${String(r.tanggal).slice(0, 10)}</td>
        <td><strong>${r.jenis}</strong></td>
        <td>Juz ${r.juz}</td>
        <td>${r.surah} (${r.ayat})</td>
        <td>${r.halaman} Hal</td>
        <td>${r.predikat}</td>
        <td>${r.musyrif || "-"}</td>
      </tr>`
    )
    .join("");
}

function renderEvaluasiTab() {
  const container = document.getElementById("evaluasiList");
  const withNotes = records.filter((r) => r.catatan && String(r.catatan).trim() !== "");

  if (withNotes.length === 0) {
    container.innerHTML = `<p class="empty-state">Belum ada catatan evaluasi atau tajwid yang tersimpan.</p>`;
    return;
  }

  container.innerHTML = withNotes
    .map(
      (r) => `
      <div class="eval-card">
        <div class="eval-meta">
          <span><strong>${String(r.tanggal).slice(0, 10)}</strong> • ${r.jenis} Juz ${r.juz} (${r.surah})</span>
          <span>Predikat: <strong>${r.predikat}</strong> • Penyimak: ${r.musyrif || "-"}</span>
        </div>
        <p class="eval-text">${r.catatan}</p>
      </div>`
    )
    .join("");
}

function renderProfilTab(totalZiyadah, totalMurajaah) {
  const totalHal = totalZiyadah + totalMurajaah;
  document.getElementById("profileTotalHal").textContent = `${totalHal} Hal`;
  document.getElementById("compSummary").textContent = `${totalZiyadah} Ziyadah • ${totalMurajaah} Muraja'ah`;

  const zPct = totalHal > 0 ? Math.round((totalZiyadah / totalHal) * 100) : 0;
  document.getElementById("donutHafalan").style.setProperty("--pct", `${zPct}%`);
  document.getElementById("pctZiyadahText").textContent = `${zPct}%`;

  const totalCount = records.length;
  const mumtazCount = records.filter((r) => r.predikat === "Mumtaz (Lancar)").length;
  const lancPct = totalCount > 0 ? Math.round((mumtazCount / totalCount) * 100) : 0;

  document.getElementById("donutKelancaran").style.setProperty("--pct", `${lancPct}%`);
  document.getElementById("pctLancText").textContent = `${lancPct}%`;
  document.getElementById("lancSummary").textContent = `${mumtazCount} dari ${totalCount} setoran Mumtaz`;

  const predikatList = ["Mumtaz (Lancar)", "Jayyid Jiddan", "Jayyid", "Perlu Pengulangan"];
  const fluencyContainer = document.getElementById("fluencyChart");

  fluencyContainer.innerHTML = predikatList
    .map((p) => {
      const count = records.filter((r) => r.predikat === p).length;
      const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
      return `
        <div class="fluency-pill">
          <span>${p}</span>
          <strong>${pct}% (${count})</strong>
        </div>`;
    })
    .join("");

  const tagsContainer = document.getElementById("submittedHafalanTags");
  if (records.length === 0) {
    tagsContainer.innerHTML = `<span class="empty-state">Belum ada hafalan yang disetorkan.</span>`;
    return;
  }

  const uniqueItems = [...new Map(records.map((r) => [`${r.juz}-${r.surah}-${r.ayat}`, r])).values()];
  tagsContainer.innerHTML = uniqueItems
    .map((r) => `<span class="hafalan-tag">Juz ${r.juz} • <strong>${r.surah}</strong> (${r.ayat}) — ${r.halaman} Hal</span>`)
    .join("");
}

const modal = document.getElementById("settingsModal");
document.getElementById("btnOpenSettings").addEventListener("click", () => {
  document.getElementById("apiUrlInput").value = apiUrl;
  modal.classList.remove("hidden");
});
document.getElementById("btnCloseSettings").addEventListener("click", () => modal.classList.add("hidden"));
document.getElementById("btnSaveApi").addEventListener("click", () => {
  apiUrl = document.getElementById("apiUrlInput").value.trim();
  localStorage.setItem(STORAGE_API_KEY, apiUrl);
  modal.classList.add("hidden");
  loadData();
});

loadData();